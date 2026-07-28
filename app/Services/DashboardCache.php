<?php

declare(strict_types=1);

namespace App\Services;

use Closure;
use Illuminate\Support\Facades\Cache;

/**
 * Versioned dashboard cache.
 *
 * Dashboard aggregates (role-scoped totals, charts, etc.) are expensive to
 * compute but tolerate a few minutes of staleness. This helper wraps them in
 * a short-TTL cache keyed by a monotonically increasing version counter.
 *
 * On any liquidation write (see `Liquidation` / `LiquidationFinancial` model
 * events) we call {@see self::flush()}, which bumps the version. Existing
 * cache entries become orphaned and are reaped naturally by their TTL.
 *
 * This pattern is driver-agnostic — unlike cache tags, it works on file,
 * database, redis, and memcached equally.
 */
class DashboardCache
{
    private const VERSION_KEY = 'dashboard:version';
    private const TTL_SECONDS = 300; // 5 minutes

    /**
     * When false, {@see self::flush()} is a no-op.
     *
     * Bulk operations save thousands of models, and every save triggers a flush
     * via the model events. Bumping the version 8,000 times has exactly the same
     * effect as bumping it once, so callers wrap the batch in
     * {@see self::withoutFlushing()} and flush a single time at the end.
     *
     * Mirrors the `Liquidation::$loggingEnabled` toggle used for activity logs.
     */
    public static bool $flushEnabled = true;

    /**
     * Remember a computed value under a versioned, scope-specific key.
     *
     * @param string $tag   Logical name of the payload (e.g. 'totalStats').
     * @param array  $scope Scope values that affect the result
     *                      (region_id, hei_id, program_ids, flags, …).
     */
    public static function remember(string $tag, array $scope, Closure $callback): mixed
    {
        $key = self::key($tag, $scope);
        return Cache::remember($key, self::TTL_SECONDS, $callback);
    }

    /**
     * Invalidate every cached dashboard payload by bumping the version.
     * Cheap (single atomic increment); stale entries expire via TTL.
     *
     * Silently does nothing while suppressed — see {@see self::$flushEnabled}.
     */
    public static function flush(): void
    {
        if (!self::$flushEnabled) {
            return;
        }

        if (!Cache::has(self::VERSION_KEY)) {
            Cache::forever(self::VERSION_KEY, 1);
            return;
        }
        Cache::increment(self::VERSION_KEY);
    }

    /**
     * Run $callback with per-save flushing suppressed, then flush exactly once.
     *
     * The single trailing flush is guaranteed even if $callback throws — a partly
     * completed bulk write still changed the data, so the dashboard must refresh.
     */
    public static function withoutFlushing(Closure $callback): mixed
    {
        $previous = self::$flushEnabled;
        self::$flushEnabled = false;

        try {
            return $callback();
        } finally {
            self::$flushEnabled = $previous;
            self::flush();
        }
    }

    private static function key(string $tag, array $scope): string
    {
        $version = Cache::get(self::VERSION_KEY, 1);
        $scopeHash = md5(serialize($scope));
        return "dashboard:v{$version}:{$tag}:{$scopeHash}";
    }
}
