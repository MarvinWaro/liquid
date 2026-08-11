<?php

use App\Models\ActivityLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Filtering Activity Logs to a date returned nothing, while the unfiltered list
 * showed entries stamped with that same date.
 *
 * Timestamps are stored in UTC and displayed in Manila, but scopeByDateRange
 * compared the raw column — so a login at 06:19 Manila (22:19 UTC the day before)
 * fell outside a filter for the date the table had just printed. Everything logged
 * between 08:00 and 23:59 Manila was affected.
 */
function logViewer(): User
{
    $role = Role::firstOrCreate(['name' => 'Super Admin'], ['description' => 'test']);
    foreach (['view_activity_logs', 'access_activity_logs'] as $name) {
        $perm = Permission::firstOrCreate(
            ['name' => $name],
            ['module' => 'Activity Logs', 'description' => 'test']
        );
        $role->permissions()->syncWithoutDetaching([$perm->id]);
    }

    return User::factory()->create(['role_id' => $role->id, 'status' => 'active']);
}

/** A log row written at an exact UTC instant. */
function logAt(User $actor, string $utc, string $action = 'created'): ActivityLog
{
    $log = ActivityLog::create([
        'user_id' => $actor->id,
        'user_name' => $actor->name,
        'action' => $action,
        'description' => "logged at {$utc} UTC",
        'module' => 'Liquidation',
    ]);

    // created_at is set by the model, so overwrite it to pin the instant exactly.
    ActivityLog::where('id', $log->id)->update(['created_at' => $utc]);

    return $log->refresh();
}

function filteredLogIds(User $viewer, string $from, string $to): array
{
    $props = test()->actingAs($viewer)
        ->get("/activity-logs?date_from={$from}&date_to={$to}")
        ->assertSuccessful()
        ->viewData('page')['props'];

    return collect($props['logs']['data'] ?? [])->pluck('id')->all();
}

it('finds a log by the Manila date the table displays, not the UTC date', function () {
    $viewer = logViewer();
    ActivityLog::query()->delete();

    // 2026-08-11 22:19 UTC is 2026-08-12 06:19 in Manila — the exact case reported.
    $log = logAt($viewer, '2026-08-11 22:19:39');

    expect(filteredLogIds($viewer, '2026-08-12', '2026-08-12'))->toContain($log->id);
});

it('does not return that log under its UTC date', function () {
    $viewer = logViewer();
    ActivityLog::query()->delete();

    $log = logAt($viewer, '2026-08-11 22:19:39');

    // The row belongs to Aug 12 in Manila, so Aug 11 must not claim it.
    expect(filteredLogIds($viewer, '2026-08-11', '2026-08-11'))->not->toContain($log->id);
});

it('handles the other boundary — just after Manila midnight', function () {
    $viewer = logViewer();
    ActivityLog::query()->delete();

    // 2026-08-11 16:30 UTC is 2026-08-12 00:30 Manila.
    $log = logAt($viewer, '2026-08-11 16:30:00');

    expect(filteredLogIds($viewer, '2026-08-12', '2026-08-12'))->toContain($log->id)
        ->and(filteredLogIds($viewer, '2026-08-11', '2026-08-11'))->not->toContain($log->id);
});

it('keeps a log that is genuinely on the earlier Manila day', function () {
    $viewer = logViewer();
    ActivityLog::query()->delete();

    // 2026-08-11 15:00 UTC is 2026-08-11 23:00 Manila — still the 11th.
    $log = logAt($viewer, '2026-08-11 15:00:00');

    expect(filteredLogIds($viewer, '2026-08-11', '2026-08-11'))->toContain($log->id)
        ->and(filteredLogIds($viewer, '2026-08-12', '2026-08-12'))->not->toContain($log->id);
});

it('returns every entry of a Manila day across the UTC boundary', function () {
    $viewer = logViewer();
    ActivityLog::query()->delete();

    // All three are 2026-08-12 in Manila, but straddle two UTC dates.
    $early = logAt($viewer, '2026-08-11 16:30:00');   // 00:30 Manila
    $morning = logAt($viewer, '2026-08-11 22:19:39'); // 06:19 Manila
    $evening = logAt($viewer, '2026-08-12 09:00:00'); // 17:00 Manila

    expect(filteredLogIds($viewer, '2026-08-12', '2026-08-12'))
        ->toContain($early->id, $morning->id, $evening->id);
});

it('agrees with the insights panel for the same range', function () {
    $viewer = logViewer();
    ActivityLog::query()->delete();

    logAt($viewer, '2026-08-11 22:19:39');
    logAt($viewer, '2026-08-12 09:00:00');
    logAt($viewer, '2026-08-10 09:00:00');   // outside the range

    // The table and the charts share filteredQuery(), so a range that returns two
    // rows must also break down into two actions. Them disagreeing is the symptom
    // the user actually saw.
    $rows = filteredLogIds($viewer, '2026-08-12', '2026-08-12');

    $first = test()->flushHeaders()->actingAs($viewer)
        ->get('/activity-logs?date_from=2026-08-12&date_to=2026-08-12')
        ->assertSuccessful();

    $insights = test()->actingAs($viewer)
        ->withHeaders([
            'X-Inertia' => 'true',
            'X-Inertia-Version' => $first->viewData('page')['version'],
            'X-Inertia-Partial-Component' => 'activity-logs/index',
            'X-Inertia-Partial-Data' => 'insights',
        ])
        ->get('/activity-logs?date_from=2026-08-12&date_to=2026-08-12')
        ->assertSuccessful()
        ->json('props.insights.actions');

    expect(collect($insights)->sum('count'))->toBe(count($rows));
});
