import { router } from '@inertiajs/react';
import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@/lib/toast';

/**
 * Centralised lifecycle for the async-report pipeline.
 *
 * Click → pre-open print tab (popup-blocker-safe) → POST /reports/queue →
 * poll /notifications/recent every POLL_INTERVAL_MS → claim atomically via
 * /reports/notifications/{id}/claim-delivery → either navigate the print tab
 * or trigger a hidden anchor download. The notification stays in place so the
 * user can re-deliver from the dropdown later if needed.
 *
 * Putting all of this in a hook means liquidation/index and the /report
 * stepper are pure presentation; swapping polling for Reverb later is a
 * one-file change.
 */

export type ReportFormat = 'print' | 'excel' | 'csv';

interface ReportNotification {
    id: string;
    action: string;
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
    queuedAt: string;        // ISO timestamp guarding against pre-existing notifications
    printTab: Window | null; // present only for format === 'print'
    startedMs: number;       // perf-clock baseline for the 30-min timeout
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_DURATION_MS = 30 * 60 * 1000; // matches the job's $timeout

/**
 * Spinner page injected into the about:blank tab opened on the user's click.
 * Lives until the polling loop navigates the tab to /reports/download/{id}.
 */
const SPINNER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Generating Liquidation Report…</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #f8fafc; color: #0f172a;
  }
  .loader { text-align: center; max-width: 420px; padding: 32px; }
  .spinner {
    width: 56px; height: 56px; margin: 0 auto 20px;
    border: 5px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }
  h2 { font-size: 18px; font-weight: 600; margin: 0 0 8px; }
  p  { font-size: 13px; margin: 0; color: #475569; line-height: 1.5; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <h2>Generating Liquidation Report</h2>
    <p>This may take a few seconds for large datasets — keep this tab open and we'll
       open the print dialog as soon as it's ready.</p>
  </div>
</body>
</html>`;

interface UseReportQueueResult {
    queueReport: (format: ReportFormat, payload: Record<string, string | string[]>) => void;
    pendingFormat: ReportFormat | null;
}

export function useReportQueue(): UseReportQueueResult {
    const [pending, setPending] = useState<PendingReport | null>(null);
    const intervalRef = useRef<number | null>(null);
    const pendingRef = useRef<PendingReport | null>(null);

    const stopPolling = useCallback(() => {
        if (intervalRef.current !== null) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const finishPending = useCallback(() => {
        stopPolling();
        pendingRef.current = null;
        setPending(null);
    }, [stopPolling]);

    /**
     * Trigger the actual download / print once a notification has been claimed.
     */
    const deliver = useCallback(
        async (current: PendingReport, notification: ReportNotification): Promise<void> => {
            const downloadUrl = `/reports/download/${notification.id}`;

            if (current.format === 'print') {
                if (current.printTab && !current.printTab.closed) {
                    current.printTab.location.href = downloadUrl;
                } else {
                    // Tab was closed mid-poll — best effort. May be popup-blocked, in
                    // which case the notification dropdown still has the manual link.
                    window.open(downloadUrl, '_blank');
                }
                finishPending();
                return;
            }

            try {
                const res = await fetch(downloadUrl, { credentials: 'same-origin' });
                if (!res.ok) {
                    throw new Error(`Download failed (${res.status}).`);
                }
                const disposition = res.headers.get('Content-Disposition') || '';
                const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
                const filename = match
                    ? decodeURIComponent(match[1])
                    : notification.metadata?.file_name ?? 'liquidation-report';

                const blob = await res.blob();
                const blobUrl = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = blobUrl;
                anchor.download = filename;
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
                URL.revokeObjectURL(blobUrl);
            } catch {
                toast.error('Could not download the report. Open the notification to retry.');
            } finally {
                finishPending();
            }
        },
        [finishPending],
    );

    /**
     * One polling tick: look for a fresh report_ready notification matching the
     * pending format, race other tabs to claim it, then deliver.
     */
    const tick = useCallback(async () => {
        const current = pendingRef.current;
        if (!current) {
            stopPolling();
            return;
        }

        if (Date.now() - current.startedMs > MAX_POLL_DURATION_MS) {
            toast.info('Report is taking longer than expected. Check the notifications panel later.');
            finishPending();
            return;
        }

        try {
            const { data } = await axios.get('/notifications/recent');
            const notifications: ReportNotification[] = data?.notifications ?? [];

            const match = notifications.find(
                (n) =>
                    n.action === 'report_ready' &&
                    n.metadata?.kind === current.format &&
                    n.metadata?.auto_delivered === false &&
                    n.created_at > current.queuedAt,
            );

            if (!match) return;

            try {
                await axios.post(`/reports/notifications/${match.id}/claim-delivery`);
                await deliver(current, match);
            } catch (err: unknown) {
                const axiosErr = err as { response?: { status?: number } };
                if (axiosErr.response?.status === 409) {
                    // Another tab won the race. Tidy up.
                    if (current.printTab && !current.printTab.closed) {
                        current.printTab.close();
                    }
                    finishPending();
                }
                // Other errors: keep polling — transient network blips are common.
            }
        } catch {
            // /notifications/recent failed; retry next tick.
        }
    }, [deliver, finishPending, stopPolling]);

    const startPolling = useCallback(() => {
        // Fire one immediate tick so fast jobs don't wait the full interval.
        void tick();
        intervalRef.current = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    }, [tick]);

    const queueReport = useCallback(
        (format: ReportFormat, payload: Record<string, string | string[]>) => {
            if (pendingRef.current) {
                toast.error('Another report is already being prepared. Please wait for it to finish.');
                return;
            }

            // Open the print tab inside the user gesture — only way to dodge the popup blocker.
            let printTab: Window | null = null;
            if (format === 'print') {
                printTab = window.open('about:blank', '_blank');
                if (printTab) {
                    printTab.document.write(SPINNER_HTML);
                    printTab.document.close();
                }
            }

            const next: PendingReport = {
                format,
                queuedAt: new Date().toISOString(),
                printTab,
                startedMs: Date.now(),
            };
            pendingRef.current = next;
            setPending(next);

            router.post(route('reports.queue'), { format, ...payload }, {
                preserveScroll: true,
                preserveState: true,
                onError: () => {
                    if (printTab && !printTab.closed) printTab.close();
                    toast.error('Could not queue the report. Please try again.');
                    finishPending();
                },
                onSuccess: () => {
                    startPolling();
                },
            });
        },
        [finishPending, startPolling],
    );

    // Clear the polling interval on unmount. Don't close the print tab — the
    // user may have intentionally navigated away, and the notification dropdown
    // still surfaces the report when the worker finishes.
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
