import { toast } from '@/lib/toast';
import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Centralized lifecycle for the asynchronous report pipeline.
 *
 * Click → queue → poll the request-specific status endpoint → either offer an
 * explicit print-preview action or trigger a file download. The generated
 * notification remains available so the user can open the report later.
 */

export type ReportFormat = 'print' | 'excel' | 'csv';

interface ReportNotification {
    id: string;
    action: string;
    description: string;
    created_at: string;
    metadata?: {
        kind?: ReportFormat;
        file_name?: string;
        file_path?: string | null;
        auto_delivered?: boolean;
    } | null;
}

interface PendingReport {
    format: ReportFormat;
    requestId: string | null;
    startedMs: number;
}

interface UseReportQueueResult {
    queueReport: (
        format: ReportFormat,
        payload: Record<string, string | string[]>,
    ) => void;
    pendingFormat: ReportFormat | null;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_DURATION_MS = 30 * 60 * 1000; // matches the job timeout

export function useReportQueue(): UseReportQueueResult {
    const [pending, setPending] = useState<PendingReport | null>(null);
    const intervalRef = useRef<number | null>(null);
    const pendingRef = useRef<PendingReport | null>(null);
    const tickInFlightRef = useRef(false);

    const stopPolling = useCallback(() => {
        if (intervalRef.current !== null) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const finishPending = useCallback(() => {
        stopPolling();
        tickInFlightRef.current = false;
        pendingRef.current = null;
        setPending(null);
    }, [stopPolling]);

    const deliver = useCallback(
        async (
            current: PendingReport,
            notification: ReportNotification,
        ): Promise<void> => {
            const downloadUrl = `/reports/download/${notification.id}`;

            if (current.format === 'print') {
                toast.success('Your print report is ready.', {
                    description:
                        'Open the preview when you are ready to print.',
                    duration: 20_000,
                    action: {
                        label: 'Open print preview',
                        onClick: () =>
                            window.open(
                                downloadUrl,
                                '_blank',
                                'noopener,noreferrer',
                            ),
                    },
                });
                finishPending();
                return;
            }

            try {
                const response = await fetch(downloadUrl, {
                    credentials: 'same-origin',
                });
                if (!response.ok) {
                    throw new Error(`Download failed (${response.status}).`);
                }

                const disposition =
                    response.headers.get('Content-Disposition') || '';
                const match = disposition.match(
                    /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i,
                );
                const filename = match
                    ? decodeURIComponent(match[1])
                    : (notification.metadata?.file_name ??
                      'liquidation-report');

                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = blobUrl;
                anchor.download = filename;
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
                URL.revokeObjectURL(blobUrl);
            } catch {
                toast.error(
                    'Could not download the report. Open the notification to retry.',
                );
            } finally {
                finishPending();
            }
        },
        [finishPending],
    );

    /**
     * Check only the server-issued ID for this request. This avoids timestamp
     * races and reports falling outside the recent-notification page.
     */
    const tick = useCallback(async () => {
        const current = pendingRef.current;
        if (!current || !current.requestId) {
            stopPolling();
            return;
        }

        if (tickInFlightRef.current) return;

        if (Date.now() - current.startedMs > MAX_POLL_DURATION_MS) {
            toast.info(
                'Report is taking longer than expected. Check the notifications panel later.',
            );
            finishPending();
            return;
        }

        tickInFlightRef.current = true;

        try {
            const { data } = await axios.get(
                `/reports/status/${current.requestId}`,
            );
            const notification: ReportNotification | undefined =
                data?.notification;

            if (data?.status === 'pending' || !notification) return;

            if (data.status === 'failed') {
                toast.error(
                    notification.description ||
                        'The report could not be generated. Please try again.',
                );
                finishPending();
                return;
            }

            // A fresh user gesture is needed to reliably open a print tab. Offer
            // an explicit action instead of leaving an empty tab spinning.
            if (current.format === 'print') {
                await deliver(current, notification);
                return;
            }

            try {
                await axios.post(
                    `/reports/notifications/${notification.id}/claim-delivery`,
                );
                await deliver(current, notification);
            } catch (error: unknown) {
                const axiosError = error as { response?: { status?: number } };
                if (axiosError.response?.status === 409) {
                    finishPending();
                }
                // Other errors are treated as transient and retried next tick.
            }
        } catch {
            // Status request failed; retry next tick.
        } finally {
            tickInFlightRef.current = false;
        }
    }, [deliver, finishPending, stopPolling]);

    const startPolling = useCallback(() => {
        stopPolling();
        void tick();
        intervalRef.current = window.setInterval(
            () => void tick(),
            POLL_INTERVAL_MS,
        );
    }, [stopPolling, tick]);

    const queueReport = useCallback(
        (format: ReportFormat, payload: Record<string, string | string[]>) => {
            if (pendingRef.current) {
                toast.error(
                    'Another report is already being prepared. Please wait for it to finish.',
                );
                return;
            }

            const next: PendingReport = {
                format,
                requestId: null,
                startedMs: Date.now(),
            };
            pendingRef.current = next;
            setPending(next);

            void axios
                .post<{ request_id: string }>(route('reports.queue'), {
                    format,
                    ...payload,
                })
                .then(({ data }) => {
                    // The page may have unmounted while this request was in flight.
                    if (pendingRef.current !== next) return;

                    next.requestId = data.request_id;
                    toast.info(
                        format === 'print'
                            ? 'Preparing your print report in the background.'
                            : 'Preparing your report download.',
                        {
                            description:
                                'You can keep working. We will let you know when it is ready.',
                        },
                    );
                    startPolling();
                })
                .catch(() => {
                    if (pendingRef.current !== next) return;

                    toast.error(
                        'Could not queue the report. Please try again.',
                    );
                    finishPending();
                });
        },
        [finishPending, startPolling],
    );

    // The queued job survives navigation and its notification still surfaces.
    // There is intentionally no child spinner tab to orphan on unmount.
    useEffect(() => {
        return () => {
            stopPolling();
            pendingRef.current = null;
        };
    }, [stopPolling]);

    return {
        queueReport,
        pendingFormat: pending?.format ?? null,
    };
}
