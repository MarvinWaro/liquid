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
     */
    public static function flush(): void
    {
        if (!Cache::has(self::VERSION_KEY)) {
            Cache::forever(self::VERSION_KEY, 1);
            return;
        }
        Cache::increment(self::VERSION_KEY);
    }

    private static function key(string $tag, array $scope): string
    {
        $version = Cache::get(self::VERSION_KEY, 1);
        $scopeHash = md5(serialize($scope));
        return "dashboard:v{$version}:{$tag}:{$scopeHash}";
    }
}
