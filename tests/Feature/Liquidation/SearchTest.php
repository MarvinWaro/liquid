<?php

use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\User;
use App\Services\LiquidationService;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

beforeEach(function () {
    $adminRole = Role::create(['name' => 'Admin']);
    $region = Region::create(['code' => 'R12', 'name' => 'Region XII', 'status' => 'active']);
    $program = Program::create(['code' => 'TES', 'name' => 'Tertiary Education Subsidy', 'status' => 'active']);

    $this->admin = User::factory()->create(['role_id' => $adminRole->id]);

    $southpoint = HEI::create([
        'uii' => '12146', 'name' => 'SOUTHPOINT COLLEGE OF ARTS AND TECHNOLOGY', 'type' => 'Private',
        'region_id' => $region->id, 'status' => 'active',
    ]);
    $antonio = HEI::create([
        'uii' => '12097', 'name' => 'ANTONIO R. PACHECO COLLEGE, INC.', 'type' => 'Private',
        'region_id' => $region->id, 'status' => 'active',
    ]);

    $make = fn (HEI $hei, string $controlNo) => Liquidation::create([
        'control_no' => $controlNo, 'hei_id' => $hei->id,
        'region_id' => $region->id, 'program_id' => $program->id,
        'created_by' => $this->admin->id,
    ]);

    $this->southpointShared = $make($southpoint, 'TES-2023-001');
    $this->antonioShared = $make($antonio, 'TES-2023-001');
    $this->antonioOther = $make($antonio, 'TES-2025-099');

    $this->searchIds = fn (string $search) => app(LiquidationService::class)
        ->getPaginatedLiquidations($this->admin, ['search' => $search])
        ->getCollection()->pluck('id')->all();
});

test('single-term search matches control number across all records', function () {
    expect(($this->searchIds)('2023-001'))
        ->toContain($this->southpointShared->id, $this->antonioShared->id)
        ->not->toContain($this->antonioOther->id);
});

test('multi-term search narrows control number by HEI name', function () {
    expect(($this->searchIds)('2023-001 antonio'))
        ->toContain($this->antonioShared->id)
        ->not->toContain($this->southpointShared->id, $this->antonioOther->id);
});

test('search matches HEI UII', function () {
    expect(($this->searchIds)('12097'))
        ->toContain($this->antonioShared->id, $this->antonioOther->id)
        ->not->toContain($this->southpointShared->id);
});

test('term order does not matter', function () {
    expect(($this->searchIds)('antonio 2023-001'))
        ->toBe(($this->searchIds)('2023-001 antonio'));
});

test('date range filters match against the financial record dates', function () {
    $this->southpointShared->createOrUpdateFinancial([
        'date_fund_released' => '2024-11-13', 'due_date' => '2025-02-11',
        'amount_received' => 1000, 'amount_disbursed' => 1000, 'amount_liquidated' => 0,
    ]);
    $this->antonioShared->createOrUpdateFinancial([
        'date_fund_released' => '2024-04-26', 'due_date' => '2024-07-25',
        'amount_received' => 1000, 'amount_disbursed' => 1000, 'amount_liquidated' => 0,
    ]);

    $filterIds = fn (array $filters) => app(LiquidationService::class)
        ->getPaginatedLiquidations($this->admin, $filters)
        ->getCollection()->pluck('id')->all();

    // Fund-released range picks only the November record
    expect($filterIds(['date_from' => '2024-11-01', 'date_to' => '2024-11-30']))
        ->toContain($this->southpointShared->id)
        ->not->toContain($this->antonioShared->id);

    // Open-ended "from" picks everything since the date
    expect($filterIds(['date_from' => '2024-05-01']))
        ->toContain($this->southpointShared->id)
        ->not->toContain($this->antonioShared->id);

    // Due-date range picks only the July-due record
    expect($filterIds(['due_from' => '2024-07-01', 'due_to' => '2024-07-31']))
        ->toContain($this->antonioShared->id)
        ->not->toContain($this->southpointShared->id);

    // Invalid date strings are ignored (no crash, no filtering)
    expect($filterIds(['date_from' => 'not-a-date']))
        ->toContain($this->southpointShared->id, $this->antonioShared->id);
});
