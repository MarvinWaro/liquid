<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Exports\LiquidationReportExporter;
use App\Models\Notification;
use App\Models\User;
use App\Services\LiquidationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\View;
use Illuminate\Support\Str;
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

        $disk = Storage::disk(config('filesystems.default'));

        if ($this->format === 'print') {
            // Pre-render the Blade and inject auto-print so opening the link in
            // a new tab triggers the browser print dialog without an extra click.
            $html = View::make('reports.liquidation-print', $data)->render();
            $html .= "\n<script>window.addEventListener('load', () => setTimeout(() => window.print(), 250));</script>\n";
            $disk->put($relativePath, $html, 'private');
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
                $disk->put($relativePath, $stream, 'private');
                if (is_resource($stream)) {
                    fclose($stream);
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
                'row_count'       => (int) ($data['totalMatching'] ?? 0),
                'truncated'       => (bool) ($data['truncated'] ?? false),
                'expires_at'      => now()->addDays(7)->toIso8601String(),
                'filter_summary'  => $data['activeFilters'] ?? '',
                // Auto-delivery flag — flipped to true by the first browser tab
                // that claims the notification via POST /reports/notifications/{id}/claim-delivery.
                'auto_delivered'  => false,
            ],
        ]);
    }

    /**
     * Surface the failure to the user via a notification rather than a silent loss.
     */
    public function failed(Throwable $e): void
    {
        $user = User::find($this->userId);
        if (!$user) {
            return;
        }

        Notification::create([
            'user_id'     => $this->userId,
            'actor_id'    => $this->userId,
            'actor_name'  => $user->name,
            'action'      => 'report_failed',
            'description' => "Your {$this->format} report could not be generated. Please try again or narrow your filters.",
            'module'      => 'Report',
            'metadata'    => [
                'kind'  => $this->format,
                'error' => Str::limit($e->getMessage(), 200),
            ],
        ]);
    }

    private function describeReady(int $rowCount): string
    {
        $kindLabel = match ($this->format) {
            'excel' => 'Excel',
            'csv'   => 'CSV',
            'print' => 'Print view',
            default => 'Report',
        };

        return "Your {$kindLabel} report is ready ({$rowCount} record" . ($rowCount === 1 ? '' : 's') . ').';
    }
}
