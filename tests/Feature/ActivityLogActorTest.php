<?php

use App\Models\ActivityLog;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('credits the actor passed explicitly instead of falling back to System', function () {
    $emily = User::factory()->create(['name' => 'Albino, Emily']);

    ActivityLog::query()->delete();

    // No auth()->user() here — exactly the situation inside a queue worker.
    $log = ActivityLog::log(
        'bulk_imported',
        'Bulk imported 1205 liquidation(s)',
        null,
        'Liquidation',
        actor: $emily,
    );

    expect($log->user_name)->toBe('Albino, Emily')
        ->and($log->user_id)->toBe($emily->id);
});

it('still says System when nobody is known', function () {
    ActivityLog::query()->delete();

    $log = ActivityLog::log('bulk_imported', 'something automated', null, 'Liquidation');

    expect($log->user_name)->toBe('System')
        ->and($log->user_id)->toBeNull();
});

it('does not invent a browser and IP for work that had no request', function () {
    $emily = User::factory()->create(['name' => 'Albino, Emily']);

    ActivityLog::query()->delete();

    $log = ActivityLog::log(
        'bulk_imported',
        'Bulk imported 1205 liquidation(s)',
        null,
        'Liquidation',
        actor: $emily,
    );

    // Previously recorded a "Symfony" client at 127.0.0.1, which read like a real
    // session and would now look like Emily had browsed from the server itself.
    expect($log->ip_address)->toBeNull()
        ->and($log->user_agent)->toBeNull()
        ->and($log->device)->toBeNull();
});

it('does not start sending duplicate notifications', function () {
    $emily = User::factory()->create(['name' => 'Albino, Emily']);

    ActivityLog::query()->delete();
    Notification::query()->delete();

    // bulk_imported is a notifiable action, but NotificationService::dispatch()
    // requires auth(). Passing an actor must not quietly switch that on, because
    // BulkImportLiquidationsJob already inserts its own notifications.
    ActivityLog::log(
        'bulk_imported',
        'Bulk imported 1205 liquidation(s)',
        null,
        'Liquidation',
        actor: $emily,
    );

    expect(Notification::count())->toBe(0);
});

it('leaves normal in-request logging untouched', function () {
    $user = User::factory()->create(['name' => 'Root']);

    ActivityLog::query()->delete();

    $this->actingAs($user)->get('/dashboard');

    $log = ActivityLog::log('created', 'made something', null, 'Liquidation');

    expect($log->user_name)->toBe('Root')
        ->and($log->user_id)->toBe($user->id);
});
