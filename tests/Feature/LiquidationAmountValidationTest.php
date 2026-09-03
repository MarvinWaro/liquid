<?php

use App\Models\AcademicYear;
use App\Models\HEI;
use App\Models\Permission;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\Semester;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

/**
 * Liquidating more than was disbursed leaves amount_received - amount_liquidated
 * negative, and that difference is summed into the table and dashboard totals, so a
 * single bad row drags a whole region's figures down. These cover the ceiling on all
 * three paths that create a liquidation.
 *
 * Helpers are declared here rather than borrowed from another test file: Pest helpers
 * are global but only exist once their file loads, so a borrowed one breaks whenever
 * the files land in different --parallel processes.
 */
function amountRuleWorld(): array
{
    Cache::store('file')->flush();

    $region = Region::create(['code' => 'R12', 'name' => 'Region XII', 'status' => 'active']);
    $role = Role::create(['name' => 'Admin', 'description' => 'Admin']);

    foreach (['view_liquidation', 'create_liquidation'] as $name) {
        $permission = Permission::firstOrCreate(
            ['name' => $name],
            ['module' => 'Liquidation', 'description' => 'test'],
        );
        $role->permissions()->attach($permission->id);
    }

    $user = User::factory()->create(['role_id' => $role->id, 'status' => 'active']);

    return [
        'user' => $user,
        'region' => $region,
        'hei' => HEI::create([
            'uii' => '12345',
            'name' => 'Test College',
            'type' => 'Private',
            'region_id' => $region->id,
            'status' => 'active',
        ]),
        'program' => Program::create(['code' => 'TES', 'name' => 'Tertiary Education Subsidy', 'status' => 'active']),
        'academicYear' => AcademicYear::create(['code' => '2025-2026', 'name' => 'AY 2025-2026']),
    ];
}

/** A single-entry payload, amounts overridable. */
function amountRulePayload(array $w, string $disbursed, ?string $liquidated, string $controlNo = ''): array
{
    $payload = [
        'program_id' => $w['program']->id,
        'uii' => '12345',
        'academic_year_id' => $w['academicYear']->id,
        'date_fund_released' => '2026-01-15',
        'total_disbursements' => $disbursed,
    ];

    if ($liquidated !== null) {
        $payload['total_amount_liquidated'] = $liquidated;
    }

    if ($controlNo !== '') {
        $payload['dv_control_no'] = $controlNo;
    }

    return $payload;
}

it('rejects a single entry liquidating more than was disbursed', function () {
    $w = amountRuleWorld();

    $this->actingAs($w['user'])
        ->postJson('/liquidation', amountRulePayload($w, '1000', '2000'))
        ->assertStatus(422)
        ->assertJsonValidationErrors('total_amount_liquidated')
        ->assertJsonFragment([
            'total_amount_liquidated' => ['Total Amount Liquidated cannot be more than Total Disbursements.'],
        ]);
});

it('accepts a single entry liquidated in full', function () {
    $w = amountRuleWorld();

    // 100% liquidated is the goal state, so equal amounts must pass - lte, not lt.
    $this->actingAs($w['user'])
        ->postJson('/liquidation', amountRulePayload($w, '1000', '1000'))
        ->assertOk();
});

it('accepts a single entry with no liquidated amount at all', function () {
    $w = amountRuleWorld();

    // nullable short-circuits the comparison; an omitted amount is not a violation.
    $this->actingAs($w['user'])
        ->postJson('/liquidation', amountRulePayload($w, '1000', null))
        ->assertOk();
});

it('accepts a single entry liquidated below the disbursement', function () {
    $w = amountRuleWorld();

    $this->actingAs($w['user'])
        ->postJson('/liquidation', amountRulePayload($w, '1000', '250.50'))
        ->assertOk();
});

it('flags the offending bulk row and compares it against its own disbursement', function () {
    $w = amountRuleWorld();

    // Row 0 is deliberately larger than row 1's disbursement. If the wildcard resolved
    // against row 0 instead of each row's own value, row 1 would wrongly pass and row 0
    // would wrongly fail - so this pins the per-row behaviour, not just "an error".
    $response = $this->actingAs($w['user'])->postJson('/liquidation/bulk-store', [
        'entries' => [
            amountRulePayload($w, '9000', '9000', 'TES-2026-0001'),
            amountRulePayload($w, '1000', '2000', 'TES-2026-0002'),
        ],
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors('entries.1.total_amount_liquidated')
        ->assertJsonMissingValidationErrors('entries.0.total_amount_liquidated');

    // :position is 1-based, so the second row reads as "row 2" to the user.
    expect(json_encode($response->json('errors')))->toContain('row 2');
});

it('accepts a bulk batch where every row is within its disbursement', function () {
    $w = amountRuleWorld();

    $this->actingAs($w['user'])->postJson('/liquidation/bulk-store', [
        'entries' => [
            amountRulePayload($w, '1000', '1000', 'TES-2026-0001'),
            amountRulePayload($w, '5000', '10', 'TES-2026-0002'),
        ],
    ])->assertOk();
});

it('flags an over-liquidated row in an Excel import', function () {
    $w = amountRuleWorld();
    Semester::firstOrCreate(['code' => '1ST'], ['name' => 'First Semester']);

    $row = [
        'row' => 1,
        'seq' => '1',
        'program' => 'TES',
        'uii' => '12345',
        'hei_name' => 'Test College',
        'academic_year' => '2025-2026',
        'semester' => '1ST',
        'batch_no' => '1',
        'control_no' => '',
        'grantees' => '10',
        'disbursements' => '1000',
        'amount_liquidated' => '2000',
        'date_fund_released' => '2026-05-28',
        'due_date' => '',
        'doc_status' => '',
        'rc_notes' => '',
    ];

    $response = $this->actingAs($w['user'])
        ->postJson('/liquidation/validate-parsed-import', ['rows' => [$row], 'file_name' => 'test.xlsx'])
        ->assertOk();

    expect(json_encode($response->json()))
        ->toContain('cannot be more than Total Disbursements');
});
