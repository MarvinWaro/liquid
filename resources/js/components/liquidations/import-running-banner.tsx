import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { importPhase, type ImportProgress } from '@/hooks/use-import-progress';

/**
 * Non-blocking strip shown while a bulk import is running on the worker.
 *
 * Exists because the import outlives the page: without it, refreshing during an
 * import looks like nothing is happening, and users assume they need to import
 * again. Deliberately not a modal — the page stays usable while it runs.
 */
export function ImportRunningBanner({
    progress,
    stalling = false,
    onView,
}: {
    progress: ImportProgress;
    stalling?: boolean;
    onView: () => void;
}) {
    const { processed, total, percent, file_name } = progress;
    const finalising = importPhase(progress) === 'finalising';

    return (
        <div
            role="status"
            aria-live="polite"
            className="mb-4 rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/30"
        >
            <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />

                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                            {finalising
                                ? `Finalising ${total.toLocaleString()} record(s)`
                                : `Importing ${processed.toLocaleString()} of ${total.toLocaleString()}`}
                        </p>
                        <span className="font-mono text-xs tabular-nums text-blue-700 dark:text-blue-300">
                            {percent}%
                        </span>
                    </div>
                    <p className="truncate text-xs text-blue-700/80 dark:text-blue-300/80">
                        {stalling
                            ? 'Taking longer than usual — still working on the server.'
                            : `${file_name} — runs in the background, safe to leave this page`}
                    </p>
                </div>

                <Button variant="outline" size="sm" onClick={onView} className="shrink-0">
                    View
                </Button>
            </div>

            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-blue-200/60 dark:bg-blue-900/60">
                <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-300 ease-out dark:bg-blue-500"
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    );
}
