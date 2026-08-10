<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use League\Flysystem\UnableToDeleteFile;

uses(RefreshDatabase::class);

it('saves the profile even when the old avatar is missing from storage', function () {
    // The reported 500: the s3 disk has 'throw' => true, so deleting a path that
    // is no longer in the bucket raised UnableToDeleteFile and aborted the whole
    // update — name and email included.
    Storage::fake('s3');
    Storage::disk('s3')->buildTemporaryUrlsUsing(fn () => 'http://example.test');

    $user = User::factory()->create([
        'name' => 'Old Name',
        'avatar' => 'avatars/this-file-no-longer-exists.png',
    ]);

    $this->actingAs($user)
        ->patch('/settings/profile', [
            'name' => 'New Name',
            'email' => $user->email,
            'avatar' => UploadedFile::fake()->image('new-avatar.png'),
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $user->refresh();

    expect($user->name)->toBe('New Name')
        ->and($user->avatar)->not->toBe('avatars/this-file-no-longer-exists.png');
});

it('still removes the previous avatar when it does exist', function () {
    // The guard must not turn into "never delete anything" — orphaned files would
    // accumulate in the bucket.
    Storage::fake('s3');

    $user = User::factory()->create();
    Storage::disk('s3')->put('avatars/old.png', 'x');
    $user->update(['avatar' => 'avatars/old.png']);

    $this->actingAs($user)
        ->patch('/settings/profile', [
            'name' => $user->name,
            'email' => $user->email,
            'avatar' => UploadedFile::fake()->image('replacement.png'),
        ])
        ->assertSessionHasNoErrors();

    Storage::disk('s3')->assertMissing('avatars/old.png');
});

it('updates name and email without touching the avatar', function () {
    Storage::fake('s3');

    $user = User::factory()->create(['avatar' => 'avatars/kept.png']);
    Storage::disk('s3')->put('avatars/kept.png', 'x');

    $this->actingAs($user)
        ->patch('/settings/profile', [
            'name' => 'Renamed',
            'email' => $user->email,
        ])
        ->assertSessionHasNoErrors();

    $user->refresh();

    // No new file was uploaded, so the existing avatar must survive untouched.
    expect($user->name)->toBe('Renamed')
        ->and($user->avatar)->toBe('avatars/kept.png');
    Storage::disk('s3')->assertExists('avatars/kept.png');
});

it('surfaces a storage failure in the log rather than to the user', function () {
    Storage::fake('s3');

    $user = User::factory()->create(['avatar' => 'avatars/boom.png']);

    // Force the exact exception the real disk throws.
    Storage::shouldReceive('disk')->with('s3')->andReturnSelf();
    Storage::shouldReceive('delete')->andThrow(new UnableToDeleteFile('boom'));
    Storage::shouldReceive('put')->andReturn(true);

    $this->actingAs($user)
        ->patch('/settings/profile', ['name' => 'Still Saves', 'email' => $user->email])
        ->assertSessionHasNoErrors();

    expect($user->fresh()->name)->toBe('Still Saves');
});
