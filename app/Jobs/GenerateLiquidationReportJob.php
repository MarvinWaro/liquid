<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Exceptions\ReportStorageException;
use App\Exports\LiquidationReportExporter;
use App\Models\Notification;
use App\Models\User;
use App\Services\LiquidationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\View;
use Illuminate\Support\Str;
use League\Flysystem\FilesystemException;
use Throwable;

/**
 * Generate a liquidation print/excel/csv report off the request lifecycle, store
 * it on the configured filesystem, and notify the requesting user when it's ready.
 *
 * Survives page refreshes — once dispatched it lives on the queue worker until
 * complete or failed; the user is informed via the existing notification dropdown.
 */
class GenerateLiquidationReportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Avoid duplicate "report ready" notifications on retry. */
    public int $tries = 1;

    /** 30-minute ceiling — comfortable for the 50k row cap. */
    public int $timeout = 1800;

    public function __construct(
        public readonly string $userId,
        public readonly string $format,    // 'print' | 'excel' | 'csv'
        public readonly array $filters,
        public readonly ?string $requestId = null,
    ) {
    }

    public function handle(LiquidationService $service): void
    {
        $user = User::findOrFail($this->userId);
        $data = $service->buildReportPayload($user, $this->filters);

        $timestamp = now()->format('Ymd-His');
        $rand = Str::lower(Str::random(8));

        $extension = match ($this->format) {
            'excel' => 'xlsx',
            'csv'   => 'csv',
            'print' => 'html',
            default => 'bin',
        };

        $filename = "liquidation-report-{$timestamp}.{$extension}";
        $relativePath = "liquidation_reports/{$this->userId}/{$timestamp}-{$rand}-{$this->format}.{$extension}";

        [$disk, $storageDisk] = $this->resolveReportDisk();

        if ($this->format === 'print') {
            // Pre-render the Blade and inject auto-print so opening the link in
            // a new tab triggers the browser print dialog without an extra click.
            $html = View::make('reports.liquidation-print', $data)->render();
            $html .= "\n<script>window.addEventListener('load', () => setTimeout(() => window.print(), 250));</script>\n";
            $this->store($disk, $storageDisk, $relativePath, $html);
        } else {
            // OpenSpout writes binary; use a tmp file then upload (S3 doesn't support fopen-as-stream).
            $tmp = tempnam(sys_get_temp_dir(), 'liqrpt_');
            try {
                (new LiquidationReportExporter())->writeToFile(
                    $data,
                    $this->format === 'excel' ? 'xlsx' : 'csv',
                    $tmp,
                );
                $stream = fopen($tmp, 'rb');
                try {
                    $this->store($disk, $storageDisk, $relativePath, $stream);
                } finally {
                    if (is_resource($stream)) {
                        fclose($stream);
                    }
                }
            } finally {
                if (is_file($tmp)) {
                    @unlink($tmp);
                }
            }
        }

        Notification::create([
            'user_id'     => $this->userId,
            'actor_id'    => $this->userId,
            'actor_name'  => $user->name,
            'action'      => 'report_ready',
            'description' => $this->describeReady((int) ($data['totalMatching'] ?? 0)),
            'module'      => 'Report',
            'metadata'    => [
                'kind'            => $this->format,
                'file_path'       => $relativePath,
                'file_name'       => $filename,
                'storage_disk'    => $storageDisk,
                'row_count'       => (int) ($data['totalMatching'] ?? 0),
                'truncated'       => (bool) ($data['truncated'] ?? false),
                'expires_at'      => now()->addDays(7)->toIso8601String(),
                'filter_summary'  => $data['activeFilters'] ?? '',
                'request_id'      => $this->safeRequestId(),
                // Auto-delivery flag — flipped to true by the first browser tab
                // that claims the notification via POST /reports/notifications/{id}/claim-delivery.
                'auto_delivered'  => false,
            ],
        ]);
    }

    /**
     * Surface the failure to the user via a notification rather than a silent loss.
     *
     * Nothing in here may throw: an exception raised from failed() replaces the
     * original one in failed_jobs and leaves the user with no notification at
     * all, so the frontend polls until it gives up.
     */
    public function failed(Throwable $e): void
    {
        Log::error('Liquidation report generation failed.', [
            'user_id'     => $this->userId,
            'format'      => $this->format,
            'request_id'  => $this->safeRequestId(),
            'filter_keys' => isset($this->filters) ? array_keys(array_filter($this->filters)) : [],
            'exception'   => $e,
        ]);

        try {
            $user = User::find($this->userId);
            if (!$user) {
                return;
            }

            Notification::create([
                'user_id'     => $this->userId,
                'actor_id'    => $this->userId,
                'actor_name'  => $user->name,
                'action'      => 'report_failed',
                'description' => $this->describeFailure($e),
                'module'      => 'Report',
                'metadata'    => [
                    'kind'       => $this->format,
                    'error'      => Str::limit($e->getMessage(), 200),
                    'request_id' => $this->safeRequestId(),
                ],
            ]);
        } catch (Throwable $notifyError) {
            Log::error('Could not record the report failure notification.', [
                'user_id'    => $this->userId,
                'request_id' => $this->safeRequestId(),
                'exception'  => $notifyError,
            ]);
        }
    }

    /**
     * Resolve the disk reports are written to, degrading to `local` when the
     * configured one cannot be built — a missing/rotated S3 credential set
     * otherwise takes down exporting and printing entirely.
     *
     * @return array{0: Filesystem, 1: string}
     */
    private function resolveReportDisk(): array
    {
        $configured = (string) config('filesystems.reports', 'local');

        try {
            $disk = Storage::disk($configured);
            // Touch the disk so a lazily-constructed client (S3) fails here,
            // where we can still recover, rather than mid-write.
            $disk->exists('liquidation_reports');

            return [$disk, $configured];
        } catch (Throwable $e) {
            if ($configured === 'local') {
                throw $e;
            }

            Log::warning('Report disk unusable — falling back to the local disk.', [
                'configured_disk' => $configured,
                'error'           => $e->getMessage(),
                'request_id'      => $this->safeRequestId(),
            ]);

            return [Storage::disk('local'), 'local'];
        }
    }

    /**
     * Write the report and verify it landed. The `local` disk is configured with
     * `throw => false`, so a rejected write returns false instead of raising —
     * without this check the user gets a "ready" notification for a file that
     * was never created.
     *
     * @param  string|resource  $contents
     */
    private function store(Filesystem $disk, string $diskName, string $path, mixed $contents): void
    {
        if ($disk->put($path, $contents, 'private') === false) {
            throw new ReportStorageException(
                "Could not write the report to the [{$diskName}] disk at [{$path}]."
            );
        }
    }

    /**
     * Payloads queued before $requestId existed deserialize without it, and a
     * readonly promoted property does not get its default back on unserialize —
     * isset() is the only safe probe (`?? null` still throws).
     */
    private function safeRequestId(): ?string
    {
        return isset($this->requestId) ? $this->requestId : null;
    }

    private function describeFailure(Throwable $e): string
    {
        $kindLabel = $this->kindLabel();

        if ($e instanceof FilesystemException || $e instanceof ReportStorageException) {
            return "We couldn't save your {$kindLabel} report — report storage is unavailable. Please contact an administrator.";
        }

        return "Your {$kindLabel} report could not be generated. Please try again. If the problem continues, contact an administrator.";
    }

    private function describeReady(int $rowCount): string
    {
        $kindLabel = $this->kindLabel();

        return "Your {$kindLabel} report is ready ({$rowCount} record" . ($rowCount === 1 ? '' : 's') . ').';
    }

    private function kindLabel(): string
    {
        return match ($this->format) {
            'excel' => 'Excel',
            'csv'   => 'CSV',
            'print' => 'Print view',
            default => 'Report',
        };
    }
}
