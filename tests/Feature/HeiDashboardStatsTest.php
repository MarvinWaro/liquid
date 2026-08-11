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
 * The HEI dashboard's "%Age of Submission" card rendered 0.00% for every HEI.
 *
 * getHEITotalStats() never returned `total_with_submission`, and the frontend's
 * `?? 0` fallback turned the missing key into a zero percentage. Every other role
 * goes through getTotalStats(), which has always included it — only HEIs were hit.
 */
function heiDashboardFixture(): array
{
    $region = Region::create(['code' => 'R12', 'name' => 'Region XII', 'status' => 'active']);

    $heiRole = Role::firstOrCreate(['name' => 'HEI'], ['description' => 'test']);
    $perm = Permission::firstOrCreate(
        ['name' => 'view_dashboard'],
        ['module' => 'Dashboard', 'description' => 'test']
    );
    $heiRole->permissions()->syncWithoutDetaching([$perm->id]);

    $hei = HEI::create([
        'uii' => 'DASH-HEI',
        'code' => 'DH',
        'name' => 'Dashboard Test College',
        'type' => 'SUC',
        'region_id' => $region->id,
        'status' => 'active',
    ]);
    $program = Program::create(['code' => 'DH-TDP', 'name' => 'Dashboard Program', 'status' => 'active']);

    $heiUser = User::factory()->create([
        'role_id' => $heiRole->id,
        'region_id' => $region->id,
        'hei_id' => $hei->id,
        'status' => 'active',
    ]);

    return compact('region', 'hei', 'program', 'heiUser');
}

/**
 * One liquidation with a financial row, carrying the given RC note status.
 */
function heiLiquidation(array $f, string $rcNoteCode, float $received, float $liquidated): Liquidation
{
    $status = RcNoteStatus::firstOrCreate(
        ['code' => $rcNoteCode],
        ['name' => ucwords(strtolower(str_replace('_', ' ', $rcNoteCode))), 'sort_order' => 1, 'is_active' => true]
    );

    $liquidation = Liquidation::create([
        'control_no' => 'DH-'.uniqid(),
        'hei_id' => $f['hei']->id,
        'processing_region_id' => $f['region']->id,
        'program_id' => $f['program']->id,
        'created_by' => $f['heiUser']->id,
        'rc_note_status_id' => $status->id,
    ]);

    LiquidationFinancial::create([
        'liquidation_id' => $liquidation->id,
        'amount_received' => $received,
        'amount_liquidated' => $liquidated,
    ]);

    return $liquidation;
}

function heiTotalStats(User $viewer): array
{
    return test()->actingAs($viewer)
        ->get('/dashboard')
        ->assertSuccessful()
        ->viewData('page')['props']['totalStats'];
}

it('includes total_with_submission for an HEI', function () {
    $f = heiDashboardFixture();

    heiLiquidation($f, RcNoteStatus::CODE_FULLY_ENDORSED, 1000, 400);
    heiLiquidation($f, RcNoteStatus::CODE_FOR_COMPLIANCE, 500, 100);

    $stats = heiTotalStats($f['heiUser']);

    // The key existing at all is the fix: its absence is what produced 0.00%.
    expect($stats)->toHaveKey('total_with_submission');

    // Liquidated (endorsed only) 400 + for_endorsement 0 + for_compliance 400 = 800
    expect((float) $stats['total_with_submission'])->toBe(800.0);
});

it('equals liquidated + for endorsement + for compliance', function () {
    $f = heiDashboardFixture();

    heiLiquidation($f, RcNoteStatus::CODE_FULLY_ENDORSED, 2000, 1500);
    heiLiquidation($f, RcNoteStatus::CODE_FOR_ENDORSEMENT, 800, 300);
    heiLiquidation($f, RcNoteStatus::CODE_FOR_COMPLIANCE, 600, 100);

    $stats = heiTotalStats($f['heiUser']);

    $expected = (float) $stats['total_liquidated']
        + (float) $stats['for_endorsement']
        + (float) $stats['for_compliance'];

    expect((float) $stats['total_with_submission'])->toBe($expected);
});

it('counts only endorsed amounts as liquidated, matching the cards beside it', function () {
    $f = heiDashboardFixture();

    // FOR_REVIEW is not endorsed, so its liquidated amount must not inflate either
    // total_liquidated or total_with_submission — otherwise the percentage would
    // disagree with the Total Liquidated card on the same screen.
    heiLiquidation($f, RcNoteStatus::CODE_FULLY_ENDORSED, 1000, 700);
    heiLiquidation($f, RcNoteStatus::CODE_FOR_REVIEW, 1000, 900);

    $stats = heiTotalStats($f['heiUser']);

    expect((float) $stats['total_liquidated'])->toBe(700.0)
        ->and((float) $stats['total_with_submission'])->toBe(700.0);
});

it('keeps Liquidated + Unliquidated reconciling to the amount received', function () {
    $f = heiDashboardFixture();

    heiLiquidation($f, RcNoteStatus::CODE_FULLY_ENDORSED, 1000, 400);
    heiLiquidation($f, RcNoteStatus::CODE_FOR_COMPLIANCE, 500, 100);

    $stats = heiTotalStats($f['heiUser']);

    // This identity is what proves the new column did not disturb the others.
    expect((float) $stats['total_liquidated'] + (float) $stats['total_unliquidated'])
        ->toBe((float) $stats['total_disbursed']);
});
