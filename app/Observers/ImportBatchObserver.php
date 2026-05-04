<?php

namespace App\Observers;

use App\Models\ImportBatch;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Auto-cleanup observer for ImportBatch.
 *
 * Fires for any deletion path: $model->delete(), cascade deletes, factory
 * tearDown, etc. Existing UI flows (e.g. undoImportBatch) handle their own
 * S3 cleanup before nulling file_path, so this observer only matters for
 * deletions that bypass that path — ensuring no S3 file is ever orphaned.
 */
class ImportBatchObserver
{
    public function deleted(ImportBatch $batch): void
    {
        if (! $batch->file_path) {
            return;
        }

        try {
            Storage::disk(config('filesystems.default'))->delete($batch->file_path);
        } catch (\Throwable $e) {
            // Don't block the row delete if storage cleanup fails — just log it
            // so an operator can reconcile manually.
            Log::warning('ImportBatchObserver: source file delete failed', [
                'batch_id' => $batch->id,
                'path'     => $batch->file_path,
                'error'    => $e->getMessage(),
            ]);
        }
    }
}
