<?php

use App\Http\Controllers\ActivityLogController;
use App\Models\ActivityLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function viewerWith(string $permission): User
{
    $role = Role::create(['name' => 'Insights Tester '.uniqid(), 'description' => 't']);
    $perm = Permission::firstOrCreate(
        ['name' => $permission],
        ['module' => 'Activity Logs', 'description' => $permission]
    );
    $role->permissions()->attach($perm->id);

    return User::factory()->create(['role_id' => $role->id]);
}

/**
 * Creating Roles and Users fires the LogsActivity trait, which writes its own
 * activity_logs rows. Clear them so each test counts only what it seeded.
 */
function clearLogs(): void
{
    ActivityLog::query()->delete();
}

function seedLogs(User $actor, int $count, string $action, ?string $module = null): void
{
    for ($i = 0; $i < $count; $i++) {
        ActivityLog::create([
            'user_id' => $actor->id,
            'user_name' => $actor->name,
            'action' => $action,
            'description' => "{$action} #{$i}",
            'module' => $module,
        ]);
    }
}

it('chart totals equal the number of rows the table would show', function () {
    $viewer = viewerWith('view_activity_logs');
    $other = User::factory()->create();

    clearLogs();

    seedLogs($viewer, 5, 'created', 'Liquidation');
    seedLogs($other, 3, 'updated', 'Users');
    seedLogs($other, 4, 'logout');            // excluded by default

    // The page itself must still render with the new deferred prop attached.
    $this->actingAs($viewer)->get('/activity-logs')->assertSuccessful();

    // Then check the aggregates directly, which is where the drift would happen.
    $controller = new ActivityLogController;
    $ref = new ReflectionClass($controller);

    $trend = $ref->getMethod('activityTrend');
    $trend->setAccessible(true);
    $actions = $ref->getMethod('actionsBreakdown');
    $actions->setAccessible(true);

    $trendTotal = collect($trend->invoke($controller, [], $viewer, false))->sum('count');
    $actionsTotal = collect($actions->invoke($controller, [], $viewer, false))->sum('count');

    // 5 created + 3 updated = 8. The 4 logout rows must NOT be counted.
    expect($trendTotal)->toBe(8)
        ->and($actionsTotal)->toBe(8);
});

it('includes logout rows only when the user filters for them', function () {
    $viewer = viewerWith('view_activity_logs');
    clearLogs();

    seedLogs($viewer, 2, 'created');
    seedLogs($viewer, 6, 'logout');

    $controller = new ActivityLogController;
    $m = new ReflectionMethod($controller, 'actionsBreakdown');
    $m->setAccessible(true);

    $default = collect($m->invoke($controller, [], $viewer, false))->sum('count');
    $filtered = collect($m->invoke($controller, ['action' => 'logout'], $viewer, false))->sum('count');

    expect($default)->toBe(2)      // logout hidden
        ->and($filtered)->toBe(6); // logout explicitly requested
});

it('locks a self-scoped viewer to their own activity', function () {
    $viewer = viewerWith('view_own_activity_logs');
    $other = User::factory()->create();

    clearLogs();

    seedLogs($viewer, 3, 'created');
    seedLogs($other, 9, 'created');

    $controller = new ActivityLogController;
    $m = new ReflectionMethod($controller, 'actionsBreakdown');
    $m->setAccessible(true);

    // Even when explicitly asking for the other user, scoping must win.
    $total = collect($m->invoke($controller, ['user' => $other->id], $viewer, true))->sum('count');

    expect($total)->toBe(3);
});

it('buckets a late-evening Manila action into the correct day', function () {
    $viewer = viewerWith('view_activity_logs');

    clearLogs();

    // 2026-08-08 16:30 UTC == 2026-08-09 00:30 Manila -> must land on Aug 9.
    $log = ActivityLog::create([
        'user_id' => $viewer->id,
        'user_name' => $viewer->name,
        'action' => 'created',
        'description' => 'late night',
    ]);
    $log->forceFill(['created_at' => '2026-08-08 16:30:00'])->saveQuietly();

    $controller = new ActivityLogController;
    $m = new ReflectionMethod($controller, 'activityTrend');
    $m->setAccessible(true);

    $rows = $m->invoke($controller, ['date_from' => '2026-08-01', 'date_to' => '2026-08-31'], $viewer, false);

    expect(collect($rows)->pluck('date'))->toContain('2026-08-09')
        ->and(collect($rows)->pluck('date'))->not->toContain('2026-08-08');
});
