<?php

use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\User;
use App\Services\LiquidationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

/**
 * @return array{formerRc: User, currentRc: User}
 */
function officialAttributionScenario(): array
{
    $regionTwelve = Region::create([
        'code' => 'R12-ATTRIBUTION',
        'name' => 'Region XII Attribution Test',
        'status' => 'active',
    ]);
    $barmm = Region::create([
        'code' => 'BARMM-ATTRIBUTION',
        'name' => 'BARMM Attribution Test',
        'status' => 'active',
    ]);

    $role = Role::create([
        'name' => 'Regional Coordinator',
        'description' => 'Regional Coordinator attribution test role',
    ]);
    $formerRc = User::factory()->create([
        'role_id' => $role->id,
        'region_id' => $regionTwelve->id,
        'status' => 'active',
    ]);
    $currentRc = User::factory()->create([
        'role_id' => $role->id,
        'region_id' => $barmm->id,
        'status' => 'active',
    ]);

    // This is the post-transfer state: BARMM is the HEI's official owner.
    $hei = HEI::create([
        'uii' => 'ATTRIBUTION-HEI',
        'code' => 'ATTRIBUTION-HEI',
        'name' => 'Cotabato State University Attribution Test',
        'type' => 'SUC',
        'region_id' => $barmm->id,
        'status' => 'active',
    ]);
    $program = Program::create([
        'code' => 'ATTR-TES',
        'name' => 'Attribution Test Program',
        'status' => 'active',
    ]);

    $historical = Liquidation::create([
        'control_no' => 'ATTR-2026-0001',
        'hei_id' => $hei->id,
        'processing_region_id' => $regionTwelve->id,
        'program_id' => $program->id,
        'created_by' => $formerRc->id,
    ]);
    $historical->createOrUpdateFinancial([
        'amount_received' => 1000,
        'amount_disbursed' => 1000,
        'amount_liquidated' => 400,
        'number_of_grantees' => 10,
    ]);

    $current = Liquidation::create([
        'control_no' => 'ATTR-2026-0002',
        'hei_id' => $hei->id,
        'processing_region_id' => $barmm->id,
        'program_id' => $program->id,
        'created_by' => $currentRc->id,
    ]);
    $current->createOrUpdateFinancial([
        'amount_received' => 2000,
        'amount_disbursed' => 2000,
        'amount_liquidated' => 1500,
        'number_of_grantees' => 20,
    ]);

    return compact('formerRc', 'currentRc');
}

test('operational table totals retain historical access while official report totals follow current ownership', function () {
    $scenario = officialAttributionScenario();
    $service = app(LiquidationService::class);

    $formerOperational = $service->getTableSummary($scenario['formerRc']);
    $currentOperational = $service->getTableSummary($scenario['currentRc']);
    $formerOfficial = $service->getReportAggregates($scenario['formerRc']);
    $currentOfficial = $service->getReportAggregates($scenario['currentRc']);

    expect($formerOperational)->toMatchArray([
        'total_records' => 1,
        'total_grantees' => 10,
        'total_disbursed' => 1000.0,
        'total_liquidated' => 400.0,
        'total_unliquidated' => 600.0,
    ])->and($currentOperational)->toMatchArray([
        'total_records' => 2,
        'total_grantees' => 30,
        'total_disbursed' => 3000.0,
        'total_liquidated' => 1900.0,
        'total_unliquidated' => 1100.0,
    ])->and($formerOfficial['totals'])->toMatchArray([
        'grantees' => 0,
        'disbursements' => 0.0,
        'liquidated' => 0.0,
        'unliquidated' => 0.0,
    ])->and($formerOfficial['programSummary'])->toBeEmpty()
        ->and($currentOfficial['totals'])->toMatchArray([
            'grantees' => 30,
            'disbursements' => 3000.0,
            'liquidated' => 1900.0,
            'unliquidated' => 1100.0,
        ])->and($currentOfficial['programSummary'])->toHaveCount(1)
        ->and($currentOfficial['programSummary'][0])->toMatchArray([
            'program_code' => 'ATTR-TES',
            'count' => 2,
            'grantees' => 30,
            'disbursements' => 3000.0,
            'liquidated' => 1900.0,
            'unliquidated' => 1100.0,
        ]);
});

test('regional dashboard totals attribute both historical and new records only to the current HEI region', function () {
    $scenario = officialAttributionScenario();

    $this->actingAs($scenario['formerRc'])
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('totalStats', fn ($stats): bool =>
                (int) $stats['total_liquidations'] === 0
                && (float) $stats['total_disbursed'] === 0.0
                && (float) $stats['total_liquidated'] === 0.0
            )
        );

    $this->actingAs($scenario['currentRc'])
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('totalStats', fn ($stats): bool =>
                (int) $stats['total_liquidations'] === 2
                && (float) $stats['total_disbursed'] === 3000.0
                && (float) $stats['total_liquidated'] === 1900.0
                && (float) $stats['total_unliquidated'] === 1100.0
            )
        );
});
