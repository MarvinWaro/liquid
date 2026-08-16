<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Exceptions\LiquidationImportValidationException;
use App\Models\ActivityLog;
use App\Models\ImportBatch;
use App\Models\Notification;
use App\Models\User;
use App\Services\DashboardCache;
use App\Services\LiquidationImportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Inserts a validated import in the background.
 *
 * The controller used to drive this from the browser with ~22 sequential
 * requests, so closing the tab or refreshing mid-import left the batch half
 * written with no way to resume. Progress now lives on the ImportBatch row
 * (imported_count / total_rows), which the client polls — meaning a refresh
 * simply picks the same batch back up.
 *
 * Rows come from the validate-step cache, keyed by the import token. Only rows
 * the user saw marked valid in the preview are in there.
 *
 * NOTE: run `php artisan queue:restart` after changing this class or anything it
 * touches. A long-lived worker holding older code has already caused one incident
 * where the import succeeded but the batch was never closed out.
 *
 * Even so, nothing here is the only line of defence: ImportBatch::reconcileIfStalled()
 * closes out a batch whose worker dies for any reason, including reasons this class
 * cannot catch (killed process, OOM, stale code breaking the handler below).
 */
class BulkImportLiquidationsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Re-running a partly-inserted batch would duplicate rows. Fail loudly instead. */
    public int $tries = 1;

    /** Generous ceiling — 50k rows insert in well under this. */
    public int $timeout = 1800;

    /** Rows per transaction. Small enough that one failure rolls back little. */
    private const CHUNK_SIZE = 500;

    public function __construct(
        public readonly string $userId,
        public readonly string $importToken,
        public readonly string $batchId,
        public readonly string $cacheKey,
    ) {}

    public function handle(LiquidationImportService $importer): void
    {
        $batch = ImportBatch::find($this->batchId);
        $user = User::find($this->userId);

        if (! $batch || ! $user) {
            Log::warning('BulkImportLiquidationsJob: batch or user missing; nothing to do.', [
                'batch_id' => $this->batchId,
                'user_id' => $this->userId,
            ]);

            return;
        }

        $fileCache = Cache::store('file');
        $cached = $fileCache->get($this->cacheKey);

        if (! $cached || ! isset($cached['rows'])) {
            $this->markFailed($batch, 'The validated rows expired before the import could start. Please re-validate the file.');

            return;
        }

        $rows = $cached['rows'];
        $errors = [];

        try {
            // One dashboard-cache flush for the whole import rather than one per
            // chunk — see DashboardCache::withoutFlushing().
            DashboardCache::withoutFlushing(function () use ($rows, $user, $batch, $importer, &$errors) {
                foreach (array_chunk($rows, self::CHUNK_SIZE) as $chunk) {
                    $result = $importer->importChunk($chunk, $user, $batch->id);

                    $errors = array_merge($errors, $result['errors']);

                    // Persist progress after every chunk. This is what the client
                    // polls, and what makes progress survive a page refresh.
                    $batch->increment('imported_count', $result['imported']);
                }
            });
        } catch (LiquidationImportValidationException $e) {
            Log::warning('Bulk import stopped because validated ownership changed.', [
                'batch_id' => $batch->id,
                'error' => $e->getMessage(),
            ]);

            $this->markFailed($batch, $e->getMessage());

            return;
        } catch (\Throwable $e) {
            Log::error('BulkImportLiquidationsJob failed.', [
                'batch_id' => $batch->id,
                'error' => $e->getMessage(),
            ]);

            $this->markFailed($batch, 'The import stopped unexpectedly. Any rows already imported are kept — undo the batch to roll them back.');

            return;
        }

        $this->finish($batch, $user, $errors);
    }

    /**
     * Laravel calls this when the job throws past its retry budget or times out —
     * covers the cases handle()'s own catch cannot, such as the worker being killed.
     */
    public function failed(\Throwable $e): void
    {
        // Compared by literal, not by ImportBatch::STATUS_PROCESSING — see markFailed().
        $batch = ImportBatch::find($this->batchId);

        if ($batch && $batch->status === 'processing') {
            $imported = (int) $batch->imported_count;

            $this->markFailed(
                $batch,
                $imported > 0
                    ? "The import stopped after {$imported} of {$batch->total_rows} row(s). Those records were saved — undo this batch to roll them back, then re-import."
                    : 'The import did not start. No records were saved, so you can simply try again.',
            );
        }
    }

    /**
     * Close out a completed batch: record the outcome, release the cached rows,
     * and notify. Mirrors what the old synchronous `is_last` branch did.
     *
     * @param  array<int, array<string, mixed>>  $errors
     */
    private function finish(ImportBatch $batch, User $user, array $errors): void
    {
        // Status first, and on its own. Everything after this is audit trail and
        // notifications — useful, but not worth leaving a batch stuck in
        // `processing` over, which is what an unguarded failure here would do.
        $batch->update([
            'status' => 'active',
            'failed_reason' => $errors === [] ? null : $this->summariseErrors($errors),
        ]);

        try {
            $fileCache = Cache::store('file');
            $fileCache->forget($this->cacheKey);
            $fileCache->forget($this->cacheKey.'_ledgers');

            $totalImported = (int) $batch->fresh()->imported_count;

            if ($totalImported < 1) {
                // Nothing landed. This used to return silently, which made a
                // wholly rejected import the one outcome nobody was told about:
                // the job succeeds, so Horizon and Queue Health stay green, the
                // log stays empty, and the dialog had already closed. The person
                // who ran it is the one who needs to know.
                $this->notifyImportFailed($batch, $user);

                return;
            }

            ActivityLog::log(
                'bulk_imported',
                "Bulk imported {$totalImported} liquidation(s) (batch: {$batch->id})",
                $batch,
                'Liquidation',
                // Named so the entry credits the person who started the import.
                // Without it this runs with no session and the log reads "System".
                actor: $user,
            );

            $recipients = User::whereHas('role', fn ($q) => $q->whereIn('name', ['Admin', 'Super Admin']))
                ->where('status', 'active')
                ->where('id', '!=', $user->id)
                ->get();

            if ($recipients->isEmpty()) {
                return;
            }

            $description = "{$user->name} bulk imported {$totalImported} liquidation record(s) from {$batch->file_name}";
            $now = now();

            Notification::insert($recipients->map(fn ($recipient) => [
                'id' => Str::uuid()->toString(),
                'user_id' => $recipient->id,
                'actor_id' => $user->id,
                'actor_name' => $user->name,
                'action' => 'bulk_imported',
                'description' => $description,
                'subject_type' => null,
                'subject_id' => null,
                'subject_label' => null,
                'module' => 'Liquidation',
                'created_at' => $now,
                'updated_at' => $now,
            ])->toArray());
        } catch (\Throwable $e) {
            // The rows are in and the batch is closed; the user is unaffected.
            Log::warning('Bulk import finished but post-import bookkeeping failed.', [
                'batch_id' => $batch->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Tell the uploader that their import produced nothing.
     *
     * Addressed to the uploader specifically. The success path deliberately
     * excludes them — they were watching the dialog — but a total rejection is
     * exactly the case where that dialog is gone before they understood why, so
     * here they are the required recipient rather than the excluded one.
     */
    private function notifyImportFailed(ImportBatch $batch, User $user): void
    {
        // Already set in memory by the update() at the top of finish() — no
        // need to go back to the database for it.
        $reason = $batch->failed_reason ?: 'No rows could be imported.';

        $now = now();

        Notification::insert([[
            'id' => Str::uuid()->toString(),
            'user_id' => $user->id,
            'actor_id' => $user->id,
            'actor_name' => $user->name,
            'action' => 'bulk_import_failed',
            'description' => "No records were imported from {$batch->file_name}. {$reason}",
            'subject_type' => null,
            'subject_id' => null,
            'subject_label' => null,
            'module' => 'Liquidation',
            'created_at' => $now,
            'updated_at' => $now,
        ]]);
    }

    /**
     * Literal status rather than ImportBatch::STATUS_FAILED on purpose: this runs
     * on the failure path, and it must not depend on resolving something that may
     * be the very thing that just failed.
     */
    private function markFailed(ImportBatch $batch, string $reason): void
    {
        $batch->update([
            'status' => 'failed',
            'failed_reason' => $reason,
        ]);
    }

    /**
     * Condense per-row failures into one operator-readable line stored on the batch.
     *
     * @param  array<int, array<string, mixed>>  $errors
     */
    private function summariseErrors(array $errors): string
    {
        $count = count($errors);
        $first = $errors[0]['error'] ?? 'Unknown error.';

        return $count === 1
            ? "1 row could not be imported: {$first}"
            : "{$count} rows could not be imported. First error: {$first}";
    }
}
