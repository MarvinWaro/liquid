<?php

use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\LiquidationFinancial;
use App\Models\Permission;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * @param  list<string>  $permissions
 */
function heiGuardUser(string $roleName, array $permissions = [], array $attributes = []): User
{
    $role = Role::firstOrCreate(
        ['name' => $roleName],
        ['description' => "{$roleName} test role"],
    );

    foreach ($permissions as $permissionName) {
        $permission = Permission::firstOrCreate(
            ['name' => $permissionName],
            ['module' => 'Test', 'description' => "Test {$permissionName}"],
        );

        $role->permissions()->syncWithoutDetaching([$permission->id]);
    }

    return User::factory()->create(array_merge([
        'role_id' => $role->id,
        'status' => 'active',
    ], $attributes));
}

function heiGuardHei(): HEI
{
    $region = Region::create([
        'code' => fake()->unique()->bothify('R##'),
        'name' => fake()->unique()->city(),
        'status' => 'active',
    ]);

    return HEI::create([
        'uii' => fake()->unique()->numerify('#####'),
        'code' => fake()->unique()->bothify('HEI-####'),
        'name' => 'COTABATO STATE UNIVERSITY',
        'type' => 'SUC',
        'region_id' => $region->id,
        'status' => 'active',
    ]);
}

function heiGuardLiquidation(HEI $hei, User $creator): Liquidation
{
    $program = Program::create([
        'code' => fake()->unique()->bothify('TES-###'),
        'name' => 'Tertiary Education Subsidy',
        'status' => 'active',
    ]);

    return Liquidation::create([
        'control_no' => fake()->unique()->bothify('TES-2026-####'),
        'hei_id' => $hei->id,
        'program_id' => $program->id,
        'created_by' => $creator->id,
    ]);
}

test('an HEI with a liquidation cannot be deleted, and the whole record survives', function () {
    $admin = heiGuardUser('Admin', ['delete_hei']);
    $hei = heiGuardHei();
    $liquidation = heiGuardLiquidation($hei, $admin);

    $financial = LiquidationFinancial::create([
        'liquidation_id' => $liquidation->id,
        'fund_source' => 'GAA 2026',
        'amount_received' => 500000,
        'amount_liquidated' => 500000,
        'number_of_grantees' => 100,
    ]);

    $this->actingAs($admin)
        ->from(route('hei.index'))
        ->delete(route('hei.destroy', $hei))
        ->assertRedirect(route('hei.index'))
        ->assertSessionHas('error');

    expect(HEI::find($hei->id))->not->toBeNull()
        ->and(Liquidation::find($liquidation->id))->not->toBeNull()
        ->and(LiquidationFinancial::find($financial->id))->not->toBeNull();
});

test('a soft-deleted liquidation still protects its HEI', function () {
    // The case a naive guard misses: the row is archived, but the database
    // cascade never consulted deleted_at, so it would have been destroyed.
    $admin = heiGuardUser('Admin', ['delete_hei']);
    $hei = heiGuardHei();
    $liquidation = heiGuardLiquidation($hei, $admin);
    $liquidation->delete();

    expect($hei->deletionBlockers())->toHaveKey('liquidation');

    $this->actingAs($admin)
        ->from(route('hei.index'))
        ->delete(route('hei.destroy', $hei))
        ->assertSessionHas('error');

    expect(HEI::find($hei->id))->not->toBeNull()
        ->and(Liquidation::withTrashed()->find($liquidation->id))->not->toBeNull();
});

test('an HEI with only a user account attached is refused, and the account keeps its institution', function () {
    // users.hei_id is SET NULL, so the delete would not destroy the account - it
    // would orphan it, leaving an HEI role pointing at no institution.
    $admin = heiGuardUser('Admin', ['delete_hei']);
    $hei = heiGuardHei();
    $heiUser = heiGuardUser('HEI', [], ['hei_id' => $hei->id]);

    expect($hei->deletionBlockers())->toBe(['user account' => 1])
        ->and($hei->describeDeletionBlockers())->toBe('1 user account');

    $this->actingAs($admin)
        ->from(route('hei.index'))
        ->delete(route('hei.destroy', $hei))
        ->assertSessionHas('error');

    expect(HEI::find($hei->id))->not->toBeNull()
        ->and($heiUser->fresh()->hei_id)->toBe($hei->id);
});

test('an HEI with nothing attached is still deletable', function () {
    $admin = heiGuardUser('Admin', ['delete_hei']);
    $hei = heiGuardHei();

    expect($hei->deletionBlockers())->toBe([]);

    $this->actingAs($admin)
        ->from(route('hei.index'))
        ->delete(route('hei.destroy', $hei))
        ->assertSessionHas('success');

    expect(HEI::find($hei->id))->toBeNull();
});

test('the database refuses to drop an HEI whose liquidations still exist', function () {
    // The net behind the controller guard: liquidations.hei_id is RESTRICT now,
    // so a delete from tinker, a seeder or any future code path cannot take the
    // liquidation history with it.
    $admin = heiGuardUser('Admin');
    $hei = heiGuardHei();
    $liquidation = heiGuardLiquidation($hei, $admin);

    expect(fn () => HEI::query()->whereKey($hei->id)->delete())
        ->toThrow(QueryException::class);

    expect(Liquidation::find($liquidation->id))->not->toBeNull();
});

test('the blocker message names every kind of record attached', function () {
    $admin = heiGuardUser('Admin');
    $hei = heiGuardHei();
    heiGuardLiquidation($hei, $admin);
    heiGuardUser('HEI', [], ['hei_id' => $hei->id]);

    expect($hei->describeDeletionBlockers())
        ->toBe('1 liquidation and 1 user account');

    heiGuardLiquidation($hei, $admin);

    expect($hei->fresh()->describeDeletionBlockers())
        ->toBe('2 liquidations and 1 user account');
});
