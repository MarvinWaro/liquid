<?php

namespace App\Console\Commands;

use App\Models\DocumentRequirement;
use App\Models\LiquidationDocument;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class CleanOrphanedStorage extends Command
{
    protected $signature = 'storage:clean-orphans
                            {--dry-run : List files that would be deleted without actually deleting them}';

    protected $description = 'Delete storage files that have no matching database record';

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->info('[DRY RUN] No files will be deleted.');
        }

        $totalDeleted = 0;
        $totalSize = 0;

        // --- 1. Liquidation documents ---
        $this->info('');
        $this->info('Scanning liquidation_documents/...');

        $knownPaths = LiquidationDocument::whereNotNull('file_path')
            ->where('is_gdrive', false)
            ->pluck('file_path')
            ->flip(); // use as set for O(1) lookup

        $files = Storage::disk('public')->allFiles('liquidation_documents');

        foreach ($files as $file) {
            if (!$knownPaths->has($file)) {
                $size = Storage::disk('public')->size($file);
                $totalSize += $size;
                $totalDeleted++;

                $this->line("  <fg=red>orphan:</> {$file} (" . $this->formatBytes($size) . ')');

                if (!$dryRun) {
                    Storage::disk('public')->delete($file);
                }
            }
        }

        // Clean up empty directories left behind
        if (!$dryRun) {
            $this->pruneEmptyDirs('liquidation_documents');
        }

        // --- 2. Document requirement reference images ---
        $this->info('');
        $this->info('Scanning document_requirements/...');

        $knownImages = DocumentRequirement::whereNotNull('reference_image_path')
            ->pluck('reference_image_path')
            ->flip();

        $imageFiles = Storage::disk('public')->allFiles('document_requirements');

        foreach ($imageFiles as $file) {
            if (!$knownImages->has($file)) {
                $size = Storage::disk('public')->size($file);
                $totalSize += $size;
                $totalDeleted++;

                $this->line("  <fg=red>orphan:</> {$file} (" . $this->formatBytes($size) . ')');

                if (!$dryRun) {
                    Storage::disk('public')->delete($file);
                }
            }
        }

        if (!$dryRun) {
            $this->pruneEmptyDirs('document_requirements');
        }

        // --- Summary ---
        $this->info('');

        if ($totalDeleted === 0) {
            $this->info('No orphaned files found. Storage is clean.');
        } elseif ($dryRun) {
            $this->warn("[DRY RUN] Would delete {$totalDeleted} file(s) freeing " . $this->formatBytes($totalSize) . '.');
            $this->warn('Run without --dry-run to actually delete them.');
        } else {
            $this->info("Deleted {$totalDeleted} orphaned file(s), freed " . $this->formatBytes($totalSize) . '.');
        }

        return self::SUCCESS;
    }

    /**
     * Remove empty directories inside a given storage path.
     */
    private function pruneEmptyDirs(string $directory): void
    {
        $disk = Storage::disk('public');
        foreach ($disk->directories($directory) as $dir) {
            if (empty($disk->allFiles($dir))) {
                $disk->deleteDirectory($dir);
                $this->line("  <fg=yellow>removed empty dir:</> {$dir}");
            }
        }
    }

    private function formatBytes(int $bytes): string
    {
        if ($bytes < 1024) return "{$bytes} B";
        if ($bytes < 1048576) return round($bytes / 1024, 1) . ' KB';
        return round($bytes / 1048576, 2) . ' MB';
    }
}
