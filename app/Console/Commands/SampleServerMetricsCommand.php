<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\ServerMetrics;
use App\Services\ServerMetricsHistory;
use Illuminate\Console\Command;

/**
 * Records one CPU/memory sample so Server Monitoring can draw a trend line.
 *
 * Scheduled every minute. The alternative — having the browser poll every few
 * seconds — was rejected deliberately: each poll is a full Laravel boot, it
 * multiplies by the number of open tabs, and it collects nothing while nobody is
 * looking. Sampling here costs one small task a minute regardless of who is
 * watching, and the history is already there when someone opens the page.
 */
class SampleServerMetricsCommand extends Command
{
    protected $signature = 'server:sample-metrics';

    protected $description = 'Record a CPU and memory sample for the Server Monitoring trend graph.';

    public function handle(ServerMetrics $metrics, ServerMetricsHistory $history): int
    {
        if (! $metrics->isAvailable()) {
            // Windows and macOS have no /proc. Nothing to sample, and nothing
            // worth failing over — the scheduler should stay green locally.
            $this->comment('Server metrics are only available on Linux — nothing sampled.');

            return self::SUCCESS;
        }

        $history->record($metrics->cpu(), $metrics->memory());

        return self::SUCCESS;
    }
}
