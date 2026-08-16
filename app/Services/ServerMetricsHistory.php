<?php

declare(strict_types=1);

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * A rolling hour of CPU and memory samples, for the Server Monitoring graph.
 *
 * /proc reports the present and nothing else, so a trend line needs something
 * to remember for it. That "something" is deliberately the cache rather than a
 * database table:
 *
 *  - No migration, no rows, no growth to prune. Metrics are disposable — losing
 *    them costs a gap in a graph, not data.
 *  - Driver-agnostic, the same reasoning QueueHealthController applies to the
 *    queue. This works on Redis in production and on the file/array store on a
 *    Windows dev machine, with no branch in the code.
 *
 * Sized for a 1 GB droplet: 60 points of three small numbers is roughly 3 KB,
 * against a 64 MB Redis cap. Production runs `allkeys-lru`, so under real memory
 * pressure this key can be evicted — which is the correct outcome. Metrics
 * should be the first thing dropped to keep sessions and the queue alive, and an
 * empty history simply renders as "collecting".
 */
class ServerMetricsHistory
{
    private const KEY = 'server_metrics:history';

    /** One point per minute, so 60 points is the last hour. */
    private const MAX_POINTS = 60;

    /**
     * Comfortably longer than the window it holds. If sampling stops, the whole
     * series ages out on its own instead of leaving an hour of stale readings
     * looking current.
     */
    private const TTL_MINUTES = 120;

    /**
     * Append one sample. Called once a minute by server:sample-metrics.
     *
     * @param  array{user: float, system: float, idle: float}|null  $cpu
     * @param  array{totalBytes: int, usedBytes: int, reclaimableBytes: int, unusedBytes: int, availableBytes: int}|null  $memory
     */
    public function record(?array $cpu, ?array $memory): void
    {
        // Nothing readable — record nothing. A row of zeroes would be a lie
        // that looks exactly like a genuinely idle server.
        if ($cpu === null && $memory === null) {
            return;
        }

        $points = $this->points();

        $points[] = [
            't' => Carbon::now()->getTimestamp(),
            'cpu' => $cpu !== null ? round($cpu['user'] + $cpu['system'], 1) : null,
            'memory' => $memory !== null && $memory['totalBytes'] > 0
                ? (int) round($memory['usedBytes'] / $memory['totalBytes'] * 100)
                : null,
        ];

        // Trim from the front: the window slides, it does not grow.
        $points = array_slice($points, -self::MAX_POINTS);

        Cache::put(self::KEY, $points, now()->addMinutes(self::TTL_MINUTES));
    }

    /**
     * The stored series, oldest first, ready for the chart.
     *
     * Timestamps leave here as ISO 8601 with an offset — a bare "Y-m-d H:i:s"
     * would be read by the browser as its own local time and slide the whole
     * graph by hours.
     *
     * @return array<int, array{at: string, cpu: float|null, memory: int|null}>
     */
    public function all(): array
    {
        return array_values(array_map(fn (array $point) => [
            'at' => Carbon::createFromTimestamp($point['t'])
                ->setTimezone('Asia/Manila')
                ->toIso8601String(),
            'cpu' => $point['cpu'],
            'memory' => $point['memory'],
        ], $this->points()));
    }

    /**
     * @return array<int, array{t: int, cpu: float|null, memory: int|null}>
     */
    private function points(): array
    {
        try {
            $stored = Cache::get(self::KEY, []);
        } catch (\Throwable) {
            // A cache backend that is down should cost the graph, not the page.
            return [];
        }

        return is_array($stored) ? $stored : [];
    }
}
