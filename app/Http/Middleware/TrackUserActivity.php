<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Heartbeat: stamps the authenticated user's `last_active_at` once per minute.
 *
 * The DB write is throttled via cache so a busy user (many requests/sec) only
 * triggers one UPDATE per minute. We use a direct query builder UPDATE rather
 * than touching the model so the LogsActivity trait does not record this as a
 * "user updated" entry on every page load.
 */
class TrackUserActivity
{
    /** Cache TTL between heartbeat writes (seconds). Slightly under 1 minute. */
    private const HEARTBEAT_TTL = 55;

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $user = $request->user();
        if (! $user) {
            return $response;
        }

        $cacheKey = 'presence:'.$user->getKey();
        if (Cache::has($cacheKey)) {
            return $response;
        }

        Cache::put($cacheKey, true, self::HEARTBEAT_TTL);

        DB::table('users')
            ->where('id', $user->getKey())
            ->update(['last_active_at' => now()]);

        return $response;
    }
}
