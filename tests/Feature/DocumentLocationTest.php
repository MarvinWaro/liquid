<?php

use App\Models\ActivityLog;
use App\Models\DocumentLocation;
use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\LiquidationTransmittal;
use App\Models\Permission;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Shelf locations are referenced by *name* in transmittal history JSON, and the
 * schema would silently destroy filing records on delete. These tests pin both
 * behaviours down.
 *
 * @param  list<string>  $permissions
 */
function locationUser(array $permissions): User
{
    $role = Role::create(['name' => 'Location Tester', 'description' => 'test role']);

    foreach ($permissions as $permissionName) {
        $permission = Permission::firstOrCreate(
            ['name' => $permissionName],
            ['module' => 'Test', 'description' => "Test {$permissionName}"],
        );

        $role->permissions()->attach($permission->id);
    }

    return User::factory()->create(['role_id' => $role->id, 'status' => 'active']);
}

/** Every location permission, for tests that are not about authorisation. */
function locationAdmin(): User
{
    return locationUser([
        'view_document_locations',
        'create_document_locations',
        'edit_document_locations',
        'delete_document_locations',
    ]);
}

function makeLocation(string $name, int $sortOrder = 0, bool $active = true): DocumentLocation
{
    return DocumentLocation::create([
        'name' => $name,
        'sort_order' => $sortOrder,
        'is_active' => $active,
    ]);
}

/** A transmittal carrying filing history that names $locationName. */
function transmittalFiledAt(DocumentLocation $location, User $creator, array $history): LiquidationTransmittal
{
    $region = Region::create(['code' => fake()->unique()->bothify('R##'), 'name' => 'Region', 'status' => 'active']);

    $hei = HEI::create([
        'uii' => fake()->unique()->numerify('#####'),
        'code' => fake()->unique()->bothify('HEI-####'),
        'name' => 'TEST UNIVERSITY',
        'type' => 'SUC',
        'region_id' => $region->id,
        'status' => 'active',
    ]);

    $program = Program::create([
        'code' => fake()->unique()->bothify('TES-###'),
        'name' => 'Tertiary Education Subsidy',
        'status' => 'active',
    ]);

    $liquidation = Liquidation::create([
        'control_no' => fake()->unique()->bothify('TES-2026-####'),
        'hei_id' => $hei->id,
        'program_id' => $program->id,
        'created_by' => $creator->id,
    ]);

    return LiquidationTransmittal::create([
        'liquidation_id' => $liquidation->id,
        'transmittal_reference_no' => fake()->unique()->bothify('REF-####'),
        'document_location_id' => $location->id,
        'location_history' => $history,
        'endorsed_by' => $creator->id,
        'endorsed_at' => now(),
        'received_at' => now(),
    ]);
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

it('lists locations for a user with permission', function () {
    makeLocation('Shelf 1-A-R1');

    test()->actingAs(locationAdmin())
        ->get(route('document-locations.index'))
        ->assertSuccessful();
});

it('refuses the page without permission', function () {
    test()->actingAs(locationUser(['view_liquidation']))
        ->get(route('document-locations.index'))
        ->assertForbidden();
});

it('creates a location', function () {
    test()->actingAs(locationAdmin())
        ->post(route('document-locations.store'), [
            'name' => 'Shelf 3-A-R1',
            'sort_order' => 10,
            'is_active' => true,
        ])
        ->assertRedirect();

    expect(DocumentLocation::where('name', 'Shelf 3-A-R1')->exists())->toBeTrue();
});

it('rejects a duplicate name', function () {
    makeLocation('Shelf 1-A-R1');

    test()->actingAs(locationAdmin())
        ->post(route('document-locations.store'), [
            'name' => 'Shelf 1-A-R1',
            'sort_order' => 0,
            'is_active' => true,
        ])
        ->assertSessionHasErrors('name');
});

it('archives a location without deleting it', function () {
    $location = makeLocation('Shelf 1-A-R1');

    test()->actingAs(locationAdmin())
        ->put(route('document-locations.update', $location->id), [
            'name' => 'Shelf 1-A-R1',
            'sort_order' => 0,
            'is_active' => false,
        ])
        ->assertRedirect();

    expect($location->fresh()->is_active)->toBeFalse()
        ->and(DocumentLocation::active()->count())->toBe(0);
});

it('deletes a location nothing is filed at', function () {
    $location = makeLocation('Shelf 9-Z-R9');

    test()->actingAs(locationAdmin())
        ->delete(route('document-locations.destroy', $location->id))
        ->assertRedirect();

    expect(DocumentLocation::find($location->id))->toBeNull();
});

// ── The delete guard ─────────────────────────────────────────────────────────

it('refuses to delete a location that records are filed at', function () {
    // Without this guard the database would happily accept the delete: the
    // transmittal FK is ON DELETE SET NULL and the tracking pivot is CASCADE,
    // so filing records would be blanked or destroyed with no warning.
    $admin = locationAdmin();
    $location = makeLocation('Shelf 1-A-R1');
    transmittalFiledAt($location, $admin, []);

    test()->actingAs($admin)
        ->delete(route('document-locations.destroy', $location->id))
        ->assertRedirect()
        ->assertSessionHas('error');

    expect(DocumentLocation::find($location->id))->not->toBeNull();
});

// ── The rename cascade ───────────────────────────────────────────────────────

it('rewrites the location name stored in transmittal history', function () {
    $admin = locationAdmin();
    $location = makeLocation('Shelf 1-A-R1');

    $transmittal = transmittalFiledAt($location, $admin, [
        ['location' => 'Shelf 1-A-R1', 'previous_location' => null, 'notes' => 'filed'],
        ['location' => 'Shelf 2-B-R2', 'previous_location' => 'Shelf 1-A-R1', 'notes' => 'moved'],
    ]);

    test()->actingAs($admin)
        ->put(route('document-locations.update', $location->id), [
            'name' => 'Shelf 1-A-R1 (Annex)',
            'sort_order' => 0,
            'is_active' => true,
        ])
        ->assertRedirect();

    $history = $transmittal->fresh()->location_history;

    // Both keys carry the name, so both have to move.
    expect($history[0]['location'])->toBe('Shelf 1-A-R1 (Annex)')
        ->and($history[1]['previous_location'])->toBe('Shelf 1-A-R1 (Annex)')
        // An unrelated shelf in the same history must be left alone.
        ->and($history[1]['location'])->toBe('Shelf 2-B-R2')
        // Non-name fields survive untouched.
        ->and($history[0]['notes'])->toBe('filed');
});

it('leaves history alone when the name did not change', function () {
    $admin = locationAdmin();
    $location = makeLocation('Shelf 1-A-R1');

    $transmittal = transmittalFiledAt($location, $admin, [
        ['location' => 'Shelf 1-A-R1', 'previous_location' => null],
    ]);

    $before = $transmittal->fresh()->updated_at;

    test()->actingAs($admin)
        ->put(route('document-locations.update', $location->id), [
            'name' => 'Shelf 1-A-R1',
            'sort_order' => 5,
            'is_active' => true,
        ])
        ->assertRedirect();

    expect($transmittal->fresh()->updated_at->eq($before))->toBeTrue()
        ->and($location->fresh()->sort_order)->toBe(5);
});

it('does not flood the activity log when a rename touches many records', function () {
    // A rename can reach thousands of transmittals. Logging each as an edit of
    // that liquidation would bury the log and misattribute the change.
    $admin = locationAdmin();
    $location = makeLocation('Shelf 1-A-R1');

    transmittalFiledAt($location, $admin, [['location' => 'Shelf 1-A-R1']]);
    transmittalFiledAt($location, $admin, [['location' => 'Shelf 1-A-R1']]);

    $before = ActivityLog::count();

    test()->actingAs($admin)
        ->put(route('document-locations.update', $location->id), [
            'name' => 'Shelf 1-A-R1 Renamed',
            'sort_order' => 0,
            'is_active' => true,
        ])
        ->assertRedirect();

    // Only the location's own update is logged, never the transmittals'.
    expect(ActivityLog::count() - $before)->toBeLessThanOrEqual(1);
});

// ── Authorisation on writes ──────────────────────────────────────────────────

it('refuses writes without the matching permission', function () {
    $viewer = locationUser(['view_document_locations']);
    $location = makeLocation('Shelf 1-A-R1');

    test()->actingAs($viewer)
        ->post(route('document-locations.store'), ['name' => 'X', 'sort_order' => 0, 'is_active' => true])
        ->assertForbidden();

    test()->actingAs($viewer)
        ->put(route('document-locations.update', $location->id), ['name' => 'Y', 'sort_order' => 0, 'is_active' => true])
        ->assertForbidden();

    test()->actingAs($viewer)
        ->delete(route('document-locations.destroy', $location->id))
        ->assertForbidden();
});
