<?php

use App\Services\DashboardCache;
use Illuminate\Support\Facades\Cache;

/**
 * The dashboard cached pre-import figures and kept serving them after a bulk
 * import, while uncached panels on the same page showed the new data.
 *
 * flush() seeded the version key with 1 when it was missing — the same value
 * key() falls back to — so the first flush after a cache clear moved nothing.
 * A deploy clears the cache, which is why a deploy followed by an import was the
 * combination that surfaced it.
 */
beforeEach(function () {
    // The post-deploy state: cache wiped, no version key. This is the condition
    // the bug needed, so every test starts from it deliberately.
    Cache::flush();
    DashboardCache::$flushEnabled = true;
});

it('invalidates on the very first flush after a cache clear', function () {
    expect(Cache::has('dashboard:version'))->toBeFalse();

    $scope = ['role' => 'STUFAPS Focal'];

    // Cached before the write — the zeros a user would have loaded.
    $before = DashboardCache::remember('totalStats', $scope, fn () => 'stale');
    expect($before)->toBe('stale');

    DashboardCache::flush();

    // Must recompute. Returning 'stale' here is the reported bug.
    $after = DashboardCache::remember('totalStats', $scope, fn () => 'fresh');
    expect($after)->toBe('fresh');
});

it('keeps incrementing once the version key exists', function () {
    $scope = ['role' => 'Admin'];

    DashboardCache::remember('totalStats', $scope, fn () => 'first');
    DashboardCache::flush();

    DashboardCache::remember('totalStats', $scope, fn () => 'second');
    DashboardCache::flush();

    // The already-seeded path has to keep working, not just the first flush.
    expect(DashboardCache::remember('totalStats', $scope, fn () => 'third'))->toBe('third');
});

it('suppresses flushes inside withoutFlushing but invalidates once at the end', function () {
    $scope = ['role' => 'Admin'];

    DashboardCache::remember('totalStats', $scope, fn () => 'stale');

    DashboardCache::withoutFlushing(function () {
        // Stands in for the thousands of model-event flushes a bulk import fires.
        DashboardCache::flush();
        DashboardCache::flush();

        // Still suppressed, so the old value is intact at this point.
        expect(DashboardCache::remember('totalStats', ['role' => 'Admin'], fn () => 'ignored'))
            ->toBe('stale');
    });

    expect(DashboardCache::remember('totalStats', $scope, fn () => 'fresh'))->toBe('fresh');
});

it('still invalidates when the bulk operation throws', function () {
    $scope = ['role' => 'Admin'];

    DashboardCache::remember('totalStats', $scope, fn () => 'stale');

    // A partly completed import changed the data, so the dashboard must refresh
    // even though the job failed.
    try {
        DashboardCache::withoutFlushing(function () {
            throw new RuntimeException('import blew up halfway');
        });
    } catch (RuntimeException) {
        // expected
    }

    expect(DashboardCache::$flushEnabled)->toBeTrue()
        ->and(DashboardCache::remember('totalStats', $scope, fn () => 'fresh'))->toBe('fresh');
});

it('keeps separate scopes isolated from each other', function () {
    // Guards the other half of the key: one role's figures must never be served
    // to another, which is what the scope hash is for.
    $focal = DashboardCache::remember('totalStats', ['role' => 'STUFAPS Focal'], fn () => 'focal-data');
    $hei = DashboardCache::remember('totalStats', ['role' => 'HEI'], fn () => 'hei-data');

    expect($focal)->toBe('focal-data')
        ->and($hei)->toBe('hei-data');
});
