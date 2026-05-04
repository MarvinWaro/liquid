<?php

namespace App\Observers;

use App\Models\LiquidationDocument;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Auto-cleanup observer for LiquidationDocument.
 *
 * Skips GDrive-linked rows — those have no S3 file (only an external link).
 * Mirrors the existing skip-on-gdrive pattern in
 * LiquidationController::deleteDocument and bulkDeleteDocuments.
 */
class LiquidationDocumentObserver
{
    public function deleted(LiquidationDocument $document): void
    {
        if ($document->is_gdrive || ! $document->file_path) {
            return;
        }

        try {
            Storage::disk(config('filesystems.default'))->delete($document->file_path);
        } catch (\Throwable $e) {
            Log::warning('LiquidationDocumentObserver: file delete failed', [
                'document_id' => $document->id,
                'path'        => $document->file_path,
                'error'       => $e->getMessage(),
            ]);
        }
    }
}
