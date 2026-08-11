<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

/**
 * Caches temporary S3 URLs.
 *
 * Signing costs a measured ~4 ms per call, and nothing used to cache it, so a
 * page paid that price once per row: every avatar in a comment thread, every
 * cover in the announcement list. A busy thread spent a quarter of a second
 * building URLs before rendering anything.
 *
 * Two levels, because the cache driver here is `database` — caching each URL
 * individually would only trade signing cost for query cost:
 *
 *  - a per-request memo, which collapses repeats within one response (a thread
 *    where eight people wrote sixty comments signs eight URLs, not sixty), and
 *  - the persistent cache, which covers distinct paths across requests, which is
 *    what a list of separate cover images needs.
 */
class SignedUrlCache
{
    /**
     * How long a generated URL stays valid.
     */
    private const URL_TTL_MINUTES = 120;

    /**
     * How long it is cached. Deliberately shorter than the URL's own lifetime so
     * a cached entry can never be handed out already expired.
     */
    private const CACHE_TTL_MINUTES = 90;

    /**
     * Per-request memo, keyed by storage path.
     *
     * @var array<string, string|null>
     */
    private static array $memo = [];

    /**
     * A temporary URL for a stored object, or null when there is no path or the
     * disk cannot sign it.
     *
     * Signing failures stay non-fatal: a missing avatar must never take down the
     * page that displays it.
     */
    public static function get(?string $path, string $disk = 's3'): ?string
    {
        if (! $path) {
            return null;
        }

        $memoKey = $disk.'|'.$path;

        if (array_key_exists($memoKey, self::$memo)) {
            return self::$memo[$memoKey];
        }

        $url = Cache::remember(
            'signed_url:'.sha1($memoKey),
            now()->addMinutes(self::CACHE_TTL_MINUTES),
            fn () => self::sign($path, $disk),
        );

        return self::$memo[$memoKey] = $url;
    }

    /**
     * Drop the per-request memo. Only needed in tests, where several requests run
     * inside one PHP process and would otherwise share it.
     */
    public static function flushMemo(): void
    {
        self::$memo = [];
    }

    private static function sign(string $path, string $disk): ?string
    {
        try {
            return Storage::disk($disk)->temporaryUrl($path, now()->addMinutes(self::URL_TTL_MINUTES));
        } catch (\Throwable) {
            return null;
        }
    }
}
