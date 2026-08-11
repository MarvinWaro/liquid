<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\ImportBatch;
use Illuminate\Console\Command;

/**
 * Credits historical bulk-import log entries to the person who ran them.
 *
 * Bulk imports run in a queued job, where there is no logged-in session. Until
 * ActivityLog::log() gained an explicit actor, those entries recorded "System"
 * and, because the queue has no browser, a "Symfony" client at 127.0.0.1.
 *
 * The information was never lost — the log points at its ImportBatch, and that
 * row still records user_id — so the real actor can be restored. Rows imported
 * after the fix already carry the right name and are skipped.
 *
 * Defaults to a dry run: rewriting audit history should be something you look at
 * before it happens, not a side effect of a deploy.
 */
class BackfillBulkImportActorsCommand extends Command
{
    protected $signature = 'activity-logs:backfill-import-actors
                            {--apply : Write the changes. Without this the command only reports what it would do.}';

    protected $description = 'Attribute old "System" bulk-import activity log entries to the user who ran the import.';

    public function handle(): int
    {
        $apply = (bool) $this->option('apply');

        $candidates = ActivityLog::query()
            ->where('action', 'bulk_imported')
            ->whereNull('user_id')
            ->where('subject_type', ImportBatch::class)
            ->whereNotNull('subject_id')
            ->get();

        if ($candidates->isEmpty()) {
            $this->info('Nothing to backfill — every bulk-import entry already names its actor.');

            return self::SUCCESS;
        }

        $batches = ImportBatch::with('user:id,name')
            ->whereIn('id', $candidates->pluck('subject_id'))
            ->get()
            ->keyBy('id');

        $rows = [];
        $updated = 0;
        $orphaned = 0;

        foreach ($candidates as $log) {
            $batch = $batches->get($log->subject_id);
            $actor = $batch?->user;

            if (! $actor) {
                // The batch or its user was deleted. "System" is then the honest
                // answer, so leave the row alone rather than inventing a name.
                $orphaned++;
                $rows[] = [substr($log->id, 0, 8).'…', 'System', '— batch or user missing, skipped'];

                continue;
            }

            $rows[] = [substr($log->id, 0, 8).'…', 'System', $actor->name];

            if ($apply) {
                $log->forceFill([
                    'user_id' => $actor->id,
                    'user_name' => $actor->name,
                    // The queue had no browser. Now that the row names a real
                    // person, leaving these in place would read as though they
                    // had genuinely browsed from the server.
                    'ip_address' => null,
                    'user_agent' => null,
                ])->saveQuietly();

                $updated++;
            }
        }

        $this->table(['Log', 'Currently', 'Should be'], $rows);

        if (! $apply) {
            $this->newLine();
            $this->warn(sprintf(
                '%d entr%s would be updated. Nothing was written.',
                count($rows) - $orphaned,
                (count($rows) - $orphaned) === 1 ? 'y' : 'ies',
            ));
            $this->line('Re-run with --apply to write the changes.');

            return self::SUCCESS;
        }

        $this->newLine();
        $this->info("Updated {$updated} entr".($updated === 1 ? 'y' : 'ies').'.');

        if ($orphaned > 0) {
            $this->warn("Left {$orphaned} entr".($orphaned === 1 ? 'y' : 'ies').' as System — the batch or its user no longer exists.');
        }

        return self::SUCCESS;
    }
}
