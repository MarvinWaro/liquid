<?php

use App\Models\ActivityLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * The donut folds everything past the top five into an "Other" wedge, and that
 * wedge is now expandable in the browser. That only works because the controller
 * sends every action rather than a truncated list — these pin that contract, so a
 * later "optimisation" that limits the query cannot silently empty the expansion.
 */
function breakdownViewer(): User
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

function logAction(User $actor, string $action, int $times = 1): void
{
    foreach (range(1, $times) as $i) {
        ActivityLog::create([
            'user_id' => $actor->id,
            'user_name' => $actor->name,
            'action' => $action,
            'description' => "{$action} #{$i}",
            'module' => 'Liquidation',
        ]);
    }
}

function breakdownFor(User $viewer, array $query = []): array
{
    $url = '/activity-logs'.($query ? '?'.http_build_query($query) : '');

    // `insights` is an Inertia deferred prop, so it is absent from the first
    // response and arrives on the follow-up partial request the browser makes.
    // Asking for it the same way is the only way to see it — and the version has
    // to come from a real response, or Inertia answers 409 for a stale asset
    // version instead of the data.
    // withHeaders() sticks to the test instance, so a previous call in the same
    // test would make this plain request look like an Inertia one and return JSON.
    $first = test()->flushHeaders()->actingAs($viewer)->get($url)->assertSuccessful();
    $version = $first->viewData('page')['version'];

    $response = test()->actingAs($viewer)
        ->withHeaders([
            'X-Inertia' => 'true',
            'X-Inertia-Version' => $version,
            'X-Inertia-Partial-Component' => 'activity-logs/index',
            'X-Inertia-Partial-Data' => 'insights',
        ])
        ->get($url)
        ->assertSuccessful();

    return $response->json('props.insights.actions') ?? [];
}

it('sends every action, not just the top few, so Other can be expanded', function () {
    $viewer = breakdownViewer();
    ActivityLog::query()->delete();

    // Eight distinct actions: five would show, three would fold into "Other".
    logAction($viewer, 'created', 20);
    logAction($viewer, 'updated', 15);
    logAction($viewer, 'added_gdrive_link', 12);
    logAction($viewer, 'updated_tracking', 9);
    logAction($viewer, 'updated_running_data', 7);
    logAction($viewer, 'deleted', 4);
    logAction($viewer, 'transferred_region', 2);
    logAction($viewer, 'endorsed_to_accounting', 1);

    $actions = collect(breakdownFor($viewer));

    // The audit-sensitive tail must be present, or expanding shows nothing.
    expect($actions)->toHaveCount(8)
        ->and($actions->pluck('action'))->toContain('deleted', 'transferred_region', 'endorsed_to_accounting');
});

it('orders the breakdown by count so the top five are genuinely the biggest', function () {
    $viewer = breakdownViewer();
    ActivityLog::query()->delete();

    logAction($viewer, 'small', 1);
    logAction($viewer, 'largest', 30);
    logAction($viewer, 'middle', 10);

    $counts = collect(breakdownFor($viewer))->pluck('count')->all();

    expect($counts)->toBe([30, 10, 1]);
});

it('narrows the breakdown when an action filter is applied', function () {
    $viewer = breakdownViewer();
    ActivityLog::query()->delete();

    logAction($viewer, 'created', 5);
    logAction($viewer, 'deleted', 3);

    // Clicking a slice sets this filter, and charts share the table's query.
    $actions = collect(breakdownFor($viewer, ['action' => 'deleted']));

    expect($actions)->toHaveCount(1)
        ->and($actions->first()['action'])->toBe('deleted')
        ->and($actions->first()['count'])->toBe(3);
});

it('keeps logout out of the breakdown unless it is the chosen filter', function () {
    $viewer = breakdownViewer();
    ActivityLog::query()->delete();

    logAction($viewer, 'created', 4);
    logAction($viewer, 'login', 3);
    logAction($viewer, 'logout', 6);

    // login is a normal, filterable slice; logout stays out of the default feed.
    $default = collect(breakdownFor($viewer))->pluck('action');

    expect($default)->toContain('login')
        ->and($default)->not->toContain('logout');

    $filtered = collect(breakdownFor($viewer, ['action' => 'logout']))->pluck('action');

    expect($filtered)->toContain('logout');
});
