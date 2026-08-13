<?php

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

/**
 * Bulk imports and report exports run on the queue, so a failed job used to be
 * invisible without SSH access. This page surfaces it in the app.
 *
 * Access is deliberately Super Admin only and role-based rather than
 * permission-based: the payload and exception text can carry record ids and
 * internal paths, so it must not be grantable by editing a role.
 */
function queueHealthUser(string $roleName): User
{
    $role = Role::firstOrCreate(['name' => $roleName], ['description' => 'test']);

    // Give a broad permission so a rejection can only be about the role, never
    // about the user lacking unrelated access.
    $perm = Permission::firstOrCreate(
        ['name' => 'view_liquidation'],
        ['module' => 'Liquidation', 'description' => 'test']
    );
    $role->permissions()->syncWithoutDetaching([$perm->id]);

    return User::factory()->create(['role_id' => $role->id, 'status' => 'active']);
}

/** Insert a failed job the same shape Laravel's database failer writes. */
function insertFailedJob(string $uuid, string $displayName = 'App\\Jobs\\BulkImportLiquidationsJob'): void
{
    DB::table('failed_jobs')->insert([
        'uuid' => $uuid,
        'connection' => 'database',
        'queue' => 'default',
        'payload' => json_encode(['displayName' => $displayName, 'job' => $displayName]),
        'exception' => "RuntimeException: Import blew up halfway\n#0 /app/foo.php(1)\n#1 /app/bar.php(2)",
        'failed_at' => now(),
    ]);
}

/** Fetch a deferred Inertia prop, which is absent from the first response. */
function queueHealthDeferred(User $user, string $prop): mixed
{
    $first = test()->actingAs($user)->get('/settings/queue-health')->assertSuccessful();

    return test()->actingAs($user)
        ->withHeaders([
            'X-Inertia' => 'true',
            'X-Inertia-Version' => $first->viewData('page')['version'],
            'X-Inertia-Partial-Component' => 'settings/queue-health',
            'X-Inertia-Partial-Data' => $prop,
        ])
        ->get('/settings/queue-health')
        ->assertSuccessful()
        ->json("props.{$prop}");
}

it('lets a Super Admin open the page', function () {
    test()->actingAs(queueHealthUser('Super Admin'))
        ->get('/settings/queue-health')
        ->assertSuccessful();
});

it('refuses everyone who is not a Super Admin', function (string $role) {
    test()->flushHeaders()->actingAs(queueHealthUser($role))
        ->get('/settings/queue-health')
        ->assertForbidden();
})->with(['Admin', 'Regional Coordinator', 'STUFAPS Focal', 'HEI', 'Accountant']);

it('reports queue depth and failure counts', function () {
    $admin = queueHealthUser('Super Admin');
    insertFailedJob('uuid-1');
    insertFailedJob('uuid-2');

    $stats = queueHealthDeferred($admin, 'stats');

    // pending comes from Queue::size(), which is driver-agnostic — the reason this
    // page keeps working if the queue moves from database to redis.
    expect($stats)->toHaveKeys(['pending', 'failedTotal', 'failedRecent'])
        ->and($stats['failedTotal'])->toBe(2)
        ->and($stats['failedRecent'])->toBe(2);
});

it('lists a failed job with a readable reason', function () {
    $admin = queueHealthUser('Super Admin');
    insertFailedJob('uuid-abc');

    $failures = queueHealthDeferred($admin, 'recentFailures');

    expect($failures)->toHaveCount(1)
        ->and($failures[0]['uuid'])->toBe('uuid-abc')
        ->and($failures[0]['job'])->toBe('App\\Jobs\\BulkImportLiquidationsJob')
        // Only the message, not the whole stack trace — the trace belongs in logs.
        ->and($failures[0]['exception'])->toContain('Import blew up halfway')
        ->and($failures[0]['exception'])->not->toContain('#0 /app/foo.php');
});

it('lets a Super Admin dismiss a failed job', function () {
    $admin = queueHealthUser('Super Admin');
    insertFailedJob('uuid-gone');

    test()->actingAs($admin)
        ->delete('/settings/queue-health/uuid-gone')
        ->assertRedirect();

    expect(DB::table('failed_jobs')->where('uuid', 'uuid-gone')->exists())->toBeFalse();
});

it('refuses a non-Super-Admin trying to dismiss a job directly', function () {
    insertFailedJob('uuid-protected');

    test()->actingAs(queueHealthUser('Admin'))
        ->delete('/settings/queue-health/uuid-protected')
        ->assertForbidden();

    // The guard has to actually protect the data, not just hide the button.
    expect(DB::table('failed_jobs')->where('uuid', 'uuid-protected')->exists())->toBeTrue();
});
