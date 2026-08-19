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

test('operational table totals overlap across a transfer while official report totals stay non-overlapping', function () {
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
    ])
        // Official reporting credits each record to the region that processed it:
        // the former region keeps its own work, the current region reports only
        // what it processed, and the two sum to the true national total.
        ->and($formerOfficial['totals'])->toMatchArray([
            'grantees' => 10,
            'disbursements' => 1000.0,
            'liquidated' => 400.0,
            'unliquidated' => 600.0,
        ])->and($formerOfficial['programSummary'])->toHaveCount(1)
        ->and($formerOfficial['programSummary'][0])->toMatchArray([
            'program_code' => 'ATTR-TES',
            'count' => 1,
            'grantees' => 10,
            'disbursements' => 1000.0,
            'liquidated' => 400.0,
            'unliquidated' => 600.0,
        ])
        ->and($currentOfficial['totals'])->toMatchArray([
            'grantees' => 20,
            'disbursements' => 2000.0,
            'liquidated' => 1500.0,
            'unliquidated' => 500.0,
        ])->and($currentOfficial['programSummary'])->toHaveCount(1)
        ->and($currentOfficial['programSummary'][0])->toMatchArray([
            'program_code' => 'ATTR-TES',
            'count' => 1,
            'grantees' => 20,
            'disbursements' => 2000.0,
            'liquidated' => 1500.0,
            'unliquidated' => 500.0,
        ]);

    // The defining property of the reporting scope: no record is counted twice.
    expect($formerOfficial['totals']['disbursements'] + $currentOfficial['totals']['disbursements'])
        ->toBe(3000.0);
});

test('the dashboard credits each region only for the liquidations it processed', function () {
    // The rule the Region 12 coordinator asked for: a transfer must not move
    // anyone's accomplishments. The former region keeps the totals it earned,
    // and the receiving region starts from zero on that HEI — credited only for
    // entries it opens itself. Both can still open and help with the shared
    // history; that is access, and it is asserted separately.
    //
    // This deliberately replaces an earlier expectation that the current region
    // "sees everything" on its dashboard. Under that rule BARMM inherited
    // Region 12's figures the moment an HEI moved, which reads as BARMM having
    // disbursed money it never handled.
    $scenario = officialAttributionScenario();

    // Processed one record before the transfer; keeps it rather than dropping to
    // zero the moment the HEI moves away.
    $this->actingAs($scenario['formerRc'])
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('totalStats', fn ($stats): bool => (int) $stats['total_liquidations'] === 1
                && (float) $stats['total_disbursed'] === 1000.0
                && (float) $stats['total_liquidated'] === 400.0
                && (float) $stats['total_unliquidated'] === 600.0
            )
        );

    // Owns the HEI now, but is credited only for the entry it started itself.
    $this->actingAs($scenario['currentRc'])
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('totalStats', fn ($stats): bool => (int) $stats['total_liquidations'] === 1
                && (float) $stats['total_disbursed'] === 2000.0
                && (float) $stats['total_liquidated'] === 1500.0
                && (float) $stats['total_unliquidated'] === 500.0
            )
        );

    // The dashboard now holds the same property the official report always did:
    // the two regions sum to the national total, with nothing double-counted.
    // 1000 + 2000 = 3000.
});
