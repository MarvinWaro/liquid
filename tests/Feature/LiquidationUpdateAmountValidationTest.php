<?php

use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\LiquidationFinancial;
use App\Models\Permission;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

/**
 * The create paths refuse to liquidate more than was disbursed
 * (LiquidationAmountValidationTest). Editing has to hold the same line: the
 * Edit Liquidation modal posts a bare amount_received, so lowering it under the
 * amount already liquidated left amount_received - amount_liquidated negative,
 * and that difference is SUM()'d into the dashboard and table totals.
 *
 * Helpers are declared here rather than borrowed: Pest helpers are global but
 * only exist once their file loads, so a borrowed one breaks whenever the files
 * land in different --parallel processes.
 */
function updateAmountWorld(): array
{
    Cache::store('file')->flush();

    $region = Region::create(['code' => 'R12-UPD', 'name' => 'Region XII Update', 'status' => 'active']);
    $role = Role::create(['name' => 'Admin', 'description' => 'Admin']);

    foreach (['view_liquidation', 'edit_liquidation'] as $name) {
        $permission = Permission::firstOrCreate(
            ['name' => $name],
            ['module' => 'Liquidation', 'description' => 'test'],
        );
        $role->permissions()->attach($permission->id);
    }

    $user = User::factory()->create(['role_id' => $role->id, 'status' => 'active']);

    $hei = HEI::create([
        'uii' => '54321',
        'name' => 'Update Test College',
        'type' => 'Private',
        'region_id' => $region->id,
        'status' => 'active',
    ]);

    $program = Program::create(['code' => 'TES-UPD', 'name' => 'TES', 'status' => 'active']);

    return ['user' => $user, 'hei' => $hei, 'program' => $program];
}

/** A liquidation carrying the given received / liquidated figures. */
function updateAmountLiquidation(array $w, float $received, float $liquidated): Liquidation
{
    $liquidation = Liquidation::create([
        'control_no' => 'TES-2026-'.fake()->unique()->numerify('####'),
        'hei_id' => $w['hei']->id,
        'program_id' => $w['program']->id,
        'created_by' => $w['user']->id,
    ]);

    LiquidationFinancial::create([
        'liquidation_id' => $liquidation->id,
        'amount_received' => $received,
        'amount_disbursed' => $received,
        'amount_liquidated' => $liquidated,
    ]);

    return $liquidation;
}

it('refuses to drop the received amount below what is already liquidated', function () {
    // The exact reported case: 800 liquidated, received edited down to 500.
    $w = updateAmountWorld();
    $liquidation = updateAmountLiquidation($w, 1000, 800);

    $this->actingAs($w['user'])
        ->from(route('liquidation.index'))
        ->put(route('liquidation.update', $liquidation), ['amount_received' => 500])
        ->assertSessionHasErrors('amount_received');

    $financial = $liquidation->fresh()->financial;

    expect((float) $financial->amount_received)->toBe(1000.0)
        ->and((float) $financial->amount_received - (float) $financial->amount_liquidated)
        ->toBeGreaterThanOrEqual(0.0);
});

it('refuses to raise the liquidated amount above what was received', function () {
    $w = updateAmountWorld();
    $liquidation = updateAmountLiquidation($w, 1000, 800);

    $this->actingAs($w['user'])
        ->from(route('liquidation.index'))
        ->put(route('liquidation.update', $liquidation), ['liquidated_amount' => 1500])
        ->assertSessionHasErrors('liquidated_amount');

    expect((float) $liquidation->fresh()->financial->amount_liquidated)->toBe(800.0);
});

it('still allows lowering the received amount down to the liquidated amount', function () {
    // Fully liquidated is the goal state, so equal figures must pass.
    $w = updateAmountWorld();
    $liquidation = updateAmountLiquidation($w, 1000, 800);

    $this->actingAs($w['user'])
        ->from(route('liquidation.index'))
        ->put(route('liquidation.update', $liquidation), ['amount_received' => 800])
        ->assertSessionHasNoErrors();

    expect((float) $liquidation->fresh()->financial->amount_received)->toBe(800.0);
});

it('still allows an ordinary edit that leaves the balance healthy', function () {
    $w = updateAmountWorld();
    $liquidation = updateAmountLiquidation($w, 1000, 800);

    $this->actingAs($w['user'])
        ->from(route('liquidation.index'))
        ->put(route('liquidation.update', $liquidation), ['amount_received' => 2000])
        ->assertSessionHasNoErrors();

    expect((float) $liquidation->fresh()->financial->amount_received)->toBe(2000.0);
});

it('still allows edits that do not touch the money at all', function () {
    $w = updateAmountWorld();
    $liquidation = updateAmountLiquidation($w, 1000, 800);

    $this->actingAs($w['user'])
        ->from(route('liquidation.index'))
        ->put(route('liquidation.update', $liquidation), ['remarks' => 'Checked with the RC.'])
        ->assertSessionHasNoErrors();

    expect($liquidation->fresh()->remarks)->toBe('Checked with the RC.');
});

it('allows both amounts to move together in one save', function () {
    $w = updateAmountWorld();
    $liquidation = updateAmountLiquidation($w, 1000, 800);

    $this->actingAs($w['user'])
        ->from(route('liquidation.index'))
        ->put(route('liquidation.update', $liquidation), [
            'amount_received' => 600,
            'liquidated_amount' => 500,
        ])
        ->assertSessionHasNoErrors();

    $financial = $liquidation->fresh()->financial;

    expect((float) $financial->amount_received)->toBe(600.0)
        ->and((float) $financial->amount_liquidated)->toBe(500.0);
});
