import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Watches a background liquidation import.
 *
 * The import runs on a queue worker and its progress lives on the ImportBatch row,
 * so this hook is only ever a reader — nothing here can stop or restart an import.
 * That is what makes progress survive a refresh: ask the server what is running and
 * pick up where the last page left off.
 *
 * Shared by the import dialog's progress view and the inline banner on the
 * liquidation page, so the two can never disagree about what is happening.
 */

export type ImportBatchStatus = 'processing' | 'active' | 'undone' | 'failed';

export interface ImportProgress {
    found: boolean;
    batch_id: string;
    file_name: string;
    status: ImportBatchStatus;
    processed: number;
    imported: number;
    total: number;
    /** Server-computed, capped at 99 while processing so 100 always means done. */
    percent: number;
    done: boolean;
    failed: boolean;
    failed_reason: string | null;
}

const POLL_INTERVAL_MS = 2000;

/** Stop watching after this long. The import itself keeps going regardless. */
const MAX_POLL_MS = 30 * 60 * 1000;

/**
 * Flag the import as slow once the row count has sat still this long.
 *
 * Rows land in chunks and the closing phase is sub-second, so silence this long
 * means something is wrong. Shorter than the server's stall threshold on purpose:
 * the user gets told before the server gives up, rather than after.
 */
const STALL_HINT_MS = 15000;

interface UseImportProgressOptions {
    /** Poll only while true — avoids a request on every page load. */
    enabled: boolean;
    /** Watch one specific batch. Omit to pick up whatever the user has in flight. */
    batchId?: string | null;
    /** Fired once, with the final state, when the batch stops processing. */
    onFinished?: (progress: ImportProgress) => void;
}

interface UseImportProgressResult {
    progress: ImportProgress | null;
    /** True until the first poll answers, so callers can avoid a flash of empty UI. */
    checking: boolean;
    /**
     * The import is still running but hasn't moved in a while. Lets the UI admit
     * something is off instead of spinning silently until the server reconciles.
     */
    stalling: boolean;
}

export function useImportProgress({
    enabled,
    batchId,
    onFinished,
}: UseImportProgressOptions): UseImportProgressResult {
    const [progress, setProgress] = useState<ImportProgress | null>(null);
    const [checking, setChecking] = useState(false);
    const [stalling, setStalling] = useState(false);

    // Last row count seen, and when it changed — the basis for the stall hint.
    const lastProcessedRef = useRef(-1);
    const lastMovedMsRef = useRef(0);

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startedMsRef = useRef(0);
    const finishedRef = useRef(false);

    /**
     * The batch this hook settled on.
     *
     * In discovery mode the endpoint only answers with a *processing* batch, so
     * once one is found we pin its id and poll that instead. Without this, the
     * poll that follows completion would come back empty and be indistinguishable
     * from "nothing was ever running" — the banner would disappear without ever
     * reporting the result or refreshing the table.
     */
    const trackedIdRef = useRef<string | null>(null);

    // Held in a ref so a caller passing an inline callback doesn't restart polling
    // on every render.
    const onFinishedRef = useRef(onFinished);
    onFinishedRef.current = onFinished;

    const stop = useCallback(() => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!enabled) {
            stop();
            setProgress(null);
            setChecking(false);
            setStalling(false);
            finishedRef.current = false;
            trackedIdRef.current = null;
            return;
        }

        finishedRef.current = false;
        trackedIdRef.current = null;
        startedMsRef.current = Date.now();
        lastProcessedRef.current = -1;
        lastMovedMsRef.current = Date.now();
        setStalling(false);
        setChecking(true);

        const tick = async () => {
            if (Date.now() - startedMsRef.current > MAX_POLL_MS) {
                stop();
                return;
            }

            try {
                const target = batchId ?? trackedIdRef.current;

                const { data } = await axios.get<ImportProgress>(route('liquidation.import-progress'), {
                    params: target ? { batch_id: target } : {},
                });

                if (!data.found) {
                    setProgress(null);
                    stop();
                    return;
                }

                trackedIdRef.current = data.batch_id;
                setProgress(data);

                if (data.done && !finishedRef.current) {
                    finishedRef.current = true;
                    setStalling(false);
                    stop();
                    onFinishedRef.current?.(data);
                    return;
                }

                if (data.processed !== lastProcessedRef.current) {
                    lastProcessedRef.current = data.processed;
                    lastMovedMsRef.current = Date.now();
                    setStalling(false);
                } else if (Date.now() - lastMovedMsRef.current > STALL_HINT_MS) {
                    setStalling(true);
                }
            } catch {
                // Transient network blip. The batch row is the source of truth and
                // isn't going anywhere, so just try again next tick.
            } finally {
                setChecking(false);
            }
        };

        void tick();
        intervalRef.current = setInterval(() => void tick(), POLL_INTERVAL_MS);

        return stop;
    }, [enabled, batchId, stop]);

    return { progress, checking, stalling };
}

/**
 * Which phase an in-flight import is in.
 *
 * Rows can all be inserted while the batch is still open — the job has closing
 * work to do — so the phase comes from comparing the counts rather than from the
 * percentage, which is why the percentage is free to be honest.
 */
export function importPhase(progress: ImportProgress): 'inserting' | 'finalising' | 'done' {
    if (progress.done) return 'done';

    return progress.total > 0 && progress.processed >= progress.total ? 'finalising' : 'inserting';
}
