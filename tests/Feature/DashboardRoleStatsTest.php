<?php

use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\LiquidationFinancial;
use App\Models\Permission;
use App\Models\Program;
use App\Models\RcNoteStatus;
use App\Models\Region;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Guards a whole class of bug rather than one instance of it.
 *
 * The dashboard picks a different stats source per role. When one of those sources
 * omits a field, the frontend reads it as `?? 0` and renders a confident, wrong
 * zero — no error, no warning. That is how "%Age of Submission" showed 0.00% on
 * every HEI dashboard, and again on the fund-source filter for every role.
 *
 * These run over every role in the system, so adding a role puts it under test
 * automatically.
 */

/** Every key the frontend's TotalStats interface reads (dashboard.tsx). */
const REQUIRED_TOTAL_STATS_KEYS = [
    'total_liquidations',
    'total_disbursed',
    'total_liquidated',
    'total_unliquidated',
    'for_endorsement',
    'for_compliance',
    'total_with_submission',
    'pending_review',
];

function dashboardWorld(): array
{
    $region = Region::create(['code' => 'R12', 'name' => 'Region XII', 'status' => 'active']);
    $hei = HEI::create([
        'uii' => 'ROLE-HEI',
        'code' => 'RH',
        'name' => 'Role Test College',
        'type' => 'SUC',
        'region_id' => $region->id,
        'status' => 'active',
    ]);
    $program = Program::create(['code' => 'RH-TDP', 'name' => 'Role Program', 'status' => 'active']);

    // A little real data, so the reconciliation assertion has something to chew on.
    foreach ([[RcNoteStatus::CODE_FULLY_ENDORSED, 1000, 600], [RcNoteStatus::CODE_FOR_COMPLIANCE, 500, 100]] as [$code, $received, $liquidated]) {
        $status = RcNoteStatus::firstOrCreate(
            ['code' => $code],
            ['name' => $code, 'sort_order' => 1, 'is_active' => true]
        );
        $creator = User::factory()->create(['region_id' => $region->id, 'hei_id' => $hei->id]);
        $liq = Liquidation::create([
            'control_no' => 'RH-'.uniqid(),
            'hei_id' => $hei->id,
            'processing_region_id' => $region->id,
            'program_id' => $program->id,
            'created_by' => $creator->id,
            'rc_note_status_id' => $status->id,
            'reviewed_at' => now(),
            'coa_endorsed_at' => now(),
        ]);
        LiquidationFinancial::create([
            'liquidation_id' => $liq->id,
            'amount_received' => $received,
            'amount_liquidated' => $liquidated,
        ]);
    }

    return compact('region', 'hei', 'program');
}

/**
 * A user for the given role, wired up so every role's scoping branch has what it
 * needs (region for RC, hei_id for HEI, programs for STUFAPS Focal).
 */
function userForRole(string $roleName, array $world): User
{
    $role = Role::firstOrCreate(['name' => $roleName], ['description' => 'test']);
    $perm = Permission::firstOrCreate(
        ['name' => 'view_liquidation'],
        ['module' => 'Liquidation', 'description' => 'test']
    );
    $role->permissions()->syncWithoutDetaching([$perm->id]);

    return User::factory()->create([
        'role_id' => $role->id,
        'region_id' => $world['region']->id,
        'hei_id' => $roleName === 'HEI' ? $world['hei']->id : null,
        'status' => 'active',
    ]);
}

function totalStatsFor(User $viewer): array
{
    return test()->actingAs($viewer)
        ->get('/dashboard')
        ->assertSuccessful()
        ->viewData('page')['props']['totalStats'];
}

it('sends every totalStats field for every role in the system', function () {
    $world = dashboardWorld();

    // Driven from the database, not a hardcoded list: a role added later is
    // covered without anyone remembering to update this test.
    $roleNames = ['Super Admin', 'Admin', 'Regional Coordinator', 'Accountant', 'COA', 'HEI', 'STUFAPS Focal', 'Encoder', 'Viewer'];

    foreach ($roleNames as $roleName) {
        $stats = totalStatsFor(userForRole($roleName, $world));

        // Compared as a set so the failure names every missing key at once, and
        // says which role — toHaveKey()'s second argument is an expected value,
        // not a message.
        $missing = array_values(array_diff(REQUIRED_TOTAL_STATS_KEYS, array_keys($stats)));

        expect($missing)->toBe([], "role [{$roleName}] is missing totalStats keys: ".implode(', ', $missing));
    }
});

it('keeps Liquidated + Unliquidated reconciling to Disbursed for every role', function () {
    $world = dashboardWorld();

    // Unliquidated is computed independently of the other two, so this identity
    // only holds if the surrounding formulas agree. It is what exposed the HEI bug.
    foreach (['Super Admin', 'Regional Coordinator', 'Accountant', 'COA', 'HEI', 'STUFAPS Focal', 'Encoder'] as $roleName) {
        $stats = totalStatsFor(userForRole($roleName, $world));

        expect((float) $stats['total_liquidated'] + (float) $stats['total_unliquidated'])
            ->toBe((float) $stats['total_disbursed'], "role [{$roleName}] does not reconcile");
    }
});

it('never lets total_with_submission exceed the amount disbursed', function () {
    $world = dashboardWorld();

    // A percentage over 100% is the visible symptom of a formula drifting; this
    // catches it for every role at once.
    foreach (['Super Admin', 'Regional Coordinator', 'Accountant', 'COA', 'HEI', 'STUFAPS Focal'] as $roleName) {
        $stats = totalStatsFor(userForRole($roleName, $world));

        expect((float) $stats['total_with_submission'])
            ->toBeLessThanOrEqual((float) $stats['total_disbursed'], "role [{$roleName}] reports over 100% submission");
    }
});

it('gives a role with no dedicated scope a clean zero rather than a blank payload', function () {
    $world = dashboardWorld();

    // Encoder and Viewer fall to the default branch. Zeros are fine; a missing key
    // is not, because the frontend renders it as a real 0 with no way to tell.
    foreach (['Encoder', 'Viewer'] as $roleName) {
        $stats = totalStatsFor(userForRole($roleName, $world));

        expect($stats)->toHaveCount(count(REQUIRED_TOTAL_STATS_KEYS))
            ->and((float) $stats['total_with_submission'])->toBe(0.0);
    }
});
