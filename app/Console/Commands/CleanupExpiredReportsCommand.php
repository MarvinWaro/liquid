<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Notification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Removes generated report files past their `expires_at` and flags the matching
 * notification as expired so the dropdown still surfaces the history but the
 * download link returns 410.
 */
class CleanupExpiredReportsCommand extends Command
{
    protected $signature = 'reports:cleanup-expired
                            {--dry-run : List files that would be deleted without actually deleting them}';

    protected $description = 'Delete liquidation report files older than their metadata.expires_at and flag the notification.';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $disk = Storage::disk(config('filesystems.default'));

        // Only cursor over notifications that (a) have an expires_at, (b) haven't
        // been marked expired yet, and (c) whose expiry timestamp is in the past.
        // Doing this in SQL keeps the cursor small even as the table grows.
        $candidates = Notification::where('action', 'report_ready')
            ->whereNotNull('metadata')
            ->whereRaw("JSON_EXTRACT(metadata, '$.expires_at') IS NOT NULL")
            ->whereRaw("(JSON_EXTRACT(metadata, '$.expired') IS NULL OR JSON_EXTRACT(metadata, '$.expired') != 1)")
            ->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.expires_at')) <= ?", [now()->toIso8601String()])
            ->cursor();

        $deleted = 0;
        $skipped = 0;

        foreach ($candidates as $notification) {
            $meta = $notification->metadata ?? [];
            $path = $meta['file_path'] ?? null;

            // Guard: file_path missing means no S3 object to delete (edge case).
            if (!$path) {
                $skipped++;
                continue;
            }

            $this->line(($dryRun ? '[DRY] ' : '') . "Expiring {$path}");

            if (!$dryRun) {
                if ($disk->exists($path)) {
                    $disk->delete($path);
                }
                // Strip the file pointer so download() returns 410 immediately,
                // but keep the row so the user still sees the historical entry.
                $notification->update([
                    'metadata' => array_merge($meta, ['file_path' => null, 'expired' => true]),
                    'description' => '(Expired) ' . $notification->description,
                ]);
            }

            $deleted++;
        }

        $this->info(($dryRun ? '[DRY RUN] ' : '') . "Expired {$deleted} report(s); skipped {$skipped}.");
        return self::SUCCESS;
    }
}
