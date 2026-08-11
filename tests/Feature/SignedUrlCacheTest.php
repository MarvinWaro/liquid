<?php

use App\Models\User;
use App\Services\SignedUrlCache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

/**
 * Signing an S3 URL measured ~4 ms and nothing cached it, so a page paid that
 * once per row — every avatar in a thread, every cover in the list.
 */
beforeEach(function () {
    // Several requests share one PHP process here, so the per-request memo has to
    // be cleared or a test would see the previous one's answer.
    SignedUrlCache::flushMemo();
    Cache::flush();
});

it('signs a path once and reuses the result', function () {
    Storage::fake('s3');
    $calls = 0;
    Storage::disk('s3')->buildTemporaryUrlsUsing(function () use (&$calls) {
        $calls++;

        return 'https://example.test/signed-'.$calls;
    });

    $first = SignedUrlCache::get('avatars/ana.png');
    $second = SignedUrlCache::get('avatars/ana.png');
    $third = SignedUrlCache::get('avatars/ana.png');

    expect($calls)->toBe(1)
        ->and($second)->toBe($first)
        ->and($third)->toBe($first);
});

it('keeps different paths apart', function () {
    Storage::fake('s3');
    Storage::disk('s3')->buildTemporaryUrlsUsing(fn (string $path) => 'https://example.test/'.$path);

    expect(SignedUrlCache::get('avatars/ana.png'))->toBe('https://example.test/avatars/ana.png')
        ->and(SignedUrlCache::get('avatars/juan.png'))->toBe('https://example.test/avatars/juan.png');
});

it('returns null for an empty path without touching the disk', function () {
    Storage::fake('s3');
    $calls = 0;
    Storage::disk('s3')->buildTemporaryUrlsUsing(function () use (&$calls) {
        $calls++;

        return 'https://example.test/signed';
    });

    expect(SignedUrlCache::get(null))->toBeNull()
        ->and(SignedUrlCache::get(''))->toBeNull()
        ->and($calls)->toBe(0);
});

it('survives a signing failure instead of breaking the page', function () {
    Storage::fake('s3');
    Storage::disk('s3')->buildTemporaryUrlsUsing(function () {
        throw new RuntimeException('bucket unreachable');
    });

    // A missing avatar must never take down the page that displays it.
    expect(SignedUrlCache::get('avatars/gone.png'))->toBeNull();
});

it('serves a user avatar through the cache', function () {
    Storage::fake('s3');
    $calls = 0;
    Storage::disk('s3')->buildTemporaryUrlsUsing(function () use (&$calls) {
        $calls++;

        return 'https://example.test/avatar';
    });

    $user = User::factory()->create(['avatar' => 'avatars/ana.png']);

    // The same author writing many comments must not re-sign for each one.
    foreach (range(1, 5) as $ignored) {
        expect($user->avatar_url)->toBe('https://example.test/avatar');
    }

    expect($calls)->toBe(1);
});
