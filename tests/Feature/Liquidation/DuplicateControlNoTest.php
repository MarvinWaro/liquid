<?php

use App\Models\AcademicYear;
use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\User;
use App\Services\LiquidationService;
use App\Services\ReportAssistantQueryService;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

beforeEach(function () {
    $this->rcRole = Role::create(['name' => 'Regional Coordinator']);
    $this->adminRole = Role::create(['name' => 'Admin']);

    $this->region = Region::create(['code' => 'R12', 'name' => 'Region XII', 'status' => 'active']);
    $this->program = Program::create(['code' => 'TES', 'name' => 'Tertiary Education Subsidy', 'status' => 'active']);
    $this->academicYear = AcademicYear::create(['code' => '2023-2024', 'name' => '2023-2024']);

    $this->heiA = HEI::create([
        'uii' => '12146', 'name' => 'SOUTHPOINT COLLEGE', 'type' => 'Private',
        'region_id' => $this->region->id, 'status' => 'active',
    ]);
    $this->heiB = HEI::create([
        'uii' => '11038', 'name' => 'KINGS COLLEGE OF MARBEL', 'type' => 'Private',
        'region_id' => $this->region->id, 'status' => 'active',
    ]);

    $this->rc = User::factory()->create(['role_id' => $this->rcRole->id, 'region_id' => $this->region->id]);
    $this->admin = User::factory()->create(['role_id' => $this->adminRole->id]);

    // Structured row as the frontend Worker sends it to validate-parsed-import
    $this->makeRow = function (int $rowNo, HEI $hei, array $overrides = []) {
        return array_merge([
            'row' => $rowNo,
            'seq' => (string) $rowNo,
            'program' => 'TES',
            'uii' => $hei->uii,
            'hei_name' => $hei->name,
            'date_fund_released' => '2024-11-13',
            'due_date' => '',
            'academic_year' => '2023-2024',
            'semester' => '',
            'batch_no' => 'Batch 13',
            'control_no' => '2023-001',
            'grantees' => '5',
            'disbursements' => '50500',
            'amount_liquidated' => '50500',
            'doc_status' => '',
            'rc_notes' => '',
        ], $overrides);
    };
});

test('two liquidations with the same control number can both persist', function () {
    $first = Liquidation::create([
        'control_no' => 'TES-2023-001', 'hei_id' => $this->heiA->id,
        'region_id' => $this->region->id, 'program_id' => $this->program->id,
        'created_by' => $this->rc->id,
    ]);
    $second = Liquidation::create([
        'control_no' => 'TES-2023-001', 'hei_id' => $this->heiB->id,
        'region_id' => $this->region->id, 'program_id' => $this->program->id,
        'created_by' => $this->rc->id,
    ]);

    expect(Liquidation::where('control_no', 'TES-2023-001')->count())->toBe(2)
        ->and($first->id)->not->toBe($second->id);
});

test('manual create accepts a control number that already exists', function () {
    $this->actingAs($this->rc);
    $service = app(LiquidationService::class);

    $base = [
        'dv_control_no' => 'TES-2023-001',
        'program_id' => $this->program->id,
        'academic_year_id' => $this->academicYear->id,
        'date_fund_released' => '2024-11-13',
        'total_disbursements' => 50500,
    ];

    $service->createLiquidation($base + ['uii' => $this->heiA->uii], $this->rc);
    $service->createLiquidation($base + ['uii' => $this->heiB->uii], $this->rc);

    expect(Liquidation::where('control_no', 'TES-2023-001')->count())->toBe(2);
});

test('import validation accepts rows sharing a control number across different HEIs', function () {
    $response = $this->actingAs($this->rc)->postJson(route('liquidation.validate-parsed-import'), [
        'rows' => [
            ($this->makeRow)(2, $this->heiA),
            ($this->makeRow)(3, $this->heiB),
        ],
        'file_name' => 'test.xlsx',
    ]);

    $response->assertOk();
    $rows = $response->json('rows');

    expect($rows[0]['valid'])->toBeTrue()
        ->and($rows[1]['valid'])->toBeTrue()
        ->and($response->json('summary.valid'))->toBe(2)
        ->and($response->json('seen_fingerprints'))->not->toBeEmpty();
});

test('import validation rejects a row identical to an existing record', function () {
    $existing = Liquidation::create([
        'control_no' => 'TES-2023-001', 'hei_id' => $this->heiA->id,
        'region_id' => $this->region->id, 'program_id' => $this->program->id,
        'academic_year_id' => $this->academicYear->id, 'batch_no' => 'Batch 13',
        'created_by' => $this->rc->id,
    ]);
    $existing->createOrUpdateFinancial([
        'date_fund_released' => '2024-11-13', 'number_of_grantees' => 5,
        'amount_received' => 50500, 'amount_disbursed' => 50500, 'amount_liquidated' => 50500,
    ]);

    $response = $this->actingAs($this->rc)->postJson(route('liquidation.validate-parsed-import'), [
        'rows' => [
            ($this->makeRow)(2, $this->heiA),                       // exact duplicate of existing
            ($this->makeRow)(3, $this->heiB),                       // same control no, different HEI — OK
            ($this->makeRow)(4, $this->heiA, ['batch_no' => 'Batch 14']), // same HEI, different batch — OK
        ],
        'file_name' => 'test.xlsx',
    ]);

    $response->assertOk();
    $rows = $response->json('rows');

    expect($rows[0]['valid'])->toBeFalse()
        ->and(implode(' ', $rows[0]['errors']))->toContain('already exists')
        ->and($rows[1]['valid'])->toBeTrue()
        ->and($rows[2]['valid'])->toBeTrue();
});

test('rows with identical headers but different amounts are distinct records, not duplicates', function () {
    // Real-world case: same HEI, control no, date, batch, and semester — but
    // different grantees/amounts (two separate disbursements under one DV)
    $response = $this->actingAs($this->rc)->postJson(route('liquidation.validate-parsed-import'), [
        'rows' => [
            ($this->makeRow)(2, $this->heiA, ['grantees' => '2', 'disbursements' => '20200', 'amount_liquidated' => '20200']),
            ($this->makeRow)(3, $this->heiA, ['grantees' => '5', 'disbursements' => '50500', 'amount_liquidated' => '50500']),
        ],
        'file_name' => 'test.xlsx',
    ]);

    $response->assertOk();
    $rows = $response->json('rows');

    expect($rows[0]['valid'])->toBeTrue()
        ->and($rows[1]['valid'])->toBeTrue()
        ->and($response->json('summary.valid'))->toBe(2);
});

test('import validation rejects the same row appearing twice in one upload', function () {
    $response = $this->actingAs($this->rc)->postJson(route('liquidation.validate-parsed-import'), [
        'rows' => [
            ($this->makeRow)(2, $this->heiA),
            ($this->makeRow)(3, $this->heiA), // identical fingerprint, different row no
        ],
        'file_name' => 'test.xlsx',
    ]);

    $response->assertOk();
    $rows = $response->json('rows');

    expect($rows[0]['valid'])->toBeTrue()
        ->and($rows[1]['valid'])->toBeFalse()
        ->and(implode(' ', $rows[1]['errors']))->toContain('duplicate of row 2');
});

test('cross-chunk duplicate detection works via the seen_fingerprints relay', function () {
    $first = $this->actingAs($this->rc)->postJson(route('liquidation.validate-parsed-import'), [
        'rows' => [($this->makeRow)(2, $this->heiA)],
        'file_name' => 'test.xlsx',
    ]);
    $first->assertOk();

    $second = $this->actingAs($this->rc)->postJson(route('liquidation.validate-parsed-import'), [
        'rows' => [($this->makeRow)(3, $this->heiA)], // same fingerprint as chunk 1
        'file_name' => 'test.xlsx',
        'import_token' => $first->json('token'),
        'seen_fingerprints' => $first->json('seen_fingerprints'),
    ]);
    $second->assertOk();

    expect($second->json('rows.0.valid'))->toBeFalse()
        ->and(implode(' ', $second->json('rows.0.errors')))->toContain('duplicate of row 2');
});

test('find_liquidation returns multiple matches for a shared control number', function () {
    foreach ([$this->heiA, $this->heiB] as $hei) {
        Liquidation::create([
            'control_no' => 'TES-2023-001', 'hei_id' => $hei->id,
            'region_id' => $this->region->id, 'program_id' => $this->program->id,
            'created_by' => $this->rc->id,
        ]);
    }

    $result = app(ReportAssistantQueryService::class)
        ->findLiquidation($this->admin, ['control_no' => 'TES-2023-001']);

    expect($result['found'])->toBeTrue()
        ->and($result['multiple_matches'] ?? false)->toBeTrue()
        ->and($result['count'])->toBe(2)
        ->and($result['records'])->toHaveCount(2);
});
