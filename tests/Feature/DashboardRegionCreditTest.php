<?php

use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\Permission;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\User;
use App\Services\HEIRegionTransferService;
use App\Services\LiquidationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

/**
 * The Cotabato State scenario.
 *
 * BARMM-origin HEIs sit under Region 12 because Region 12 processes them. When
 * they are handed back to BARMM, the coordinators' rule is:
 *
 *   - Region 12 keeps the accomplishments it earned — the work was theirs.
 *   - BARMM inherits none of those figures, only entries it starts itself.
 *   - BARMM can still open and help with the old records.
 *
 * "Credit" and "access" are therefore two different questions, and these tests
 * hold them apart. Everything here runs a real transfer through
 * HEIRegionTransferService rather than editing region_id directly, so the guards
 * and the audit trail are exercised too.
 *
 * @return array{r12: Region, barmm: Region, hei: HEI, program: Program, r12Rc: User, barmmRc: User, admin: User}
 */
function creditScenario(): array
{
    $r12 = Region::create(['code' => 'R12-CREDIT', 'name' => 'Region XII Credit Test', 'status' => 'active']);
    $barmm = Region::create(['code' => 'BARMM-CREDIT', 'name' => 'BARMM Credit Test', 'status' => 'active']);

    $rcRole = Role::create(['name' => 'Regional Coordinator', 'description' => 'credit test']);
    $adminRole = Role::create(['name' => 'Admin', 'description' => 'credit test']);

    $permission = fn (string $name, string $module) => Permission::firstOrCreate(
        ['name' => $name],
        ['module' => $module, 'description' => "Test {$name}"],
    );

    // LiquidationPolicy gates on these before it ever reaches the region rule,
    // so an RC without them is refused for a reason unrelated to the transfer.
    $rcRole->permissions()->attach([
        $permission('view_liquidation', 'Liquidation')->id,
        $permission('edit_liquidation', 'Liquidation')->id,
    ]);

    // The transfer service demands this permission plus an Admin/Super Admin role.
    $adminRole->permissions()->attach($permission('transfer_hei_region', 'HEI')->id);

    $r12Rc = User::factory()->create(['role_id' => $rcRole->id, 'region_id' => $r12->id, 'status' => 'active']);
    $barmmRc = User::factory()->create(['role_id' => $rcRole->id, 'region_id' => $barmm->id, 'status' => 'active']);
    $admin = User::factory()->create(['role_id' => $adminRole->id, 'status' => 'active']);

    // Filed under Region 12 today, exactly like Cotabato State.
    $hei = HEI::create([
        'uii' => 'CREDIT-HEI',
        'code' => 'CREDIT-HEI',
        'name' => 'Cotabato State University Credit Test',
        'type' => 'SUC',
        'region_id' => $r12->id,
        'status' => 'active',
    ]);

    $program = Program::create(['code' => 'CREDIT-TES', 'name' => 'Credit Test Program', 'status' => 'active']);

    return compact('r12', 'barmm', 'hei', 'program', 'r12Rc', 'barmmRc', 'admin');
}

/** A liquidation processed by $regionId, carrying $disbursed pesos. */
function creditLiquidation(array $scenario, Region $region, string $controlNo, float $disbursed, float $liquidated): Liquidation
{
    $liquidation = Liquidation::create([
        'control_no' => $controlNo,
        'hei_id' => $scenario['hei']->id,
        'processing_region_id' => $region->id,
        'program_id' => $scenario['program']->id,
        'created_by' => $scenario['r12Rc']->id,
    ]);

    $liquidation->createOrUpdateFinancial([
        'amount_received' => $disbursed,
        'amount_disbursed' => $disbursed,
        'amount_liquidated' => $liquidated,
        'number_of_grantees' => 10,
    ]);

    return $liquidation;
}

/** Move the HEI to BARMM through the real service. */
function runTransfer(array $scenario): void
{
    app(HEIRegionTransferService::class)->update(
        $scenario['hei'],
        [
            'uii' => $scenario['hei']->uii,
            'code' => $scenario['hei']->code,
            'name' => $scenario['hei']->name,
            'type' => $scenario['hei']->type,
            'status' => $scenario['hei']->status,
            'region_id' => $scenario['barmm']->id,
        ],
        $scenario['admin'],
        [
            'effective_date' => now()->toDateString(),
            'memo_reference' => 'MEMO-CREDIT-1',
            'reason' => 'Returned to BARMM jurisdiction',
        ],
    );
}

/** The dashboard's headline figures for one coordinator. */
function dashboardTotals(User $user): array
{
    $stats = null;

    test()->flushHeaders()->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(function (Assert $page) use (&$stats) {
            $stats = $page->toArray()['props']['totalStats'];
        });

    return $stats;
}

/**
 * Fetch a deferred dashboard prop. The calendar is loaded after first paint
 * (Inertia::defer(..., 'charts')), so it is absent from the initial response.
 */
function dashboardDeferred(User $user, string $prop): array
{
    $first = test()->flushHeaders()->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk();

    return test()->actingAs($user)
        ->withHeaders([
            'X-Inertia' => 'true',
            'X-Inertia-Version' => $first->viewData('page')['version'],
            'X-Inertia-Partial-Component' => 'dashboard',
            'X-Inertia-Partial-Data' => $prop,
        ])
        ->get(route('dashboard'))
        ->json("props.{$prop}") ?? [];
}

it('credits the processing region before any transfer', function () {
    $scenario = creditScenario();
    creditLiquidation($scenario, $scenario['r12'], 'CREDIT-2026-0001', 1000, 400);

    expect((float) dashboardTotals($scenario['r12Rc'])['total_disbursed'])->toBe(1000.0)
        ->and((float) dashboardTotals($scenario['barmmRc'])['total_disbursed'])->toBe(0.0);
});

it('leaves the former region its totals after the HEI is transferred away', function () {
    // The heart of the requirement. Region 12 disbursed this money; moving the
    // HEI must not take the accomplishment with it.
    $scenario = creditScenario();
    creditLiquidation($scenario, $scenario['r12'], 'CREDIT-2026-0001', 1000, 400);

    runTransfer($scenario);

    $r12 = dashboardTotals($scenario['r12Rc']);

    expect((int) $r12['total_liquidations'])->toBe(1)
        ->and((float) $r12['total_disbursed'])->toBe(1000.0)
        ->and((float) $r12['total_liquidated'])->toBe(400.0)
        ->and((float) $r12['total_unliquidated'])->toBe(600.0);
});

it('gives the receiving region nothing it did not process', function () {
    $scenario = creditScenario();
    creditLiquidation($scenario, $scenario['r12'], 'CREDIT-2026-0001', 1000, 400);

    runTransfer($scenario);

    $barmm = dashboardTotals($scenario['barmmRc']);

    expect((int) $barmm['total_liquidations'])->toBe(0)
        ->and((float) $barmm['total_disbursed'])->toBe(0.0);
});

it('credits the receiving region once it starts its own entry', function () {
    $scenario = creditScenario();
    creditLiquidation($scenario, $scenario['r12'], 'CREDIT-2026-0001', 1000, 400);
    runTransfer($scenario);

    // Created after the transfer, so it is stamped with BARMM.
    creditLiquidation($scenario, $scenario['barmm'], 'CREDIT-2026-0002', 2000, 1500);

    $r12 = dashboardTotals($scenario['r12Rc']);
    $barmm = dashboardTotals($scenario['barmmRc']);

    expect((float) $r12['total_disbursed'])->toBe(1000.0)
        ->and((float) $barmm['total_disbursed'])->toBe(2000.0)
        // Nothing counted twice: the regions still sum to the national total.
        ->and((float) $r12['total_disbursed'] + (float) $barmm['total_disbursed'])->toBe(3000.0);
});

it('still lets the receiving region open and help with the old record', function () {
    // Credit changed; access did not. If this breaks, BARMM cannot assist with
    // work in progress on an HEI it now owns.
    $scenario = creditScenario();
    $historical = creditLiquidation($scenario, $scenario['r12'], 'CREDIT-2026-0001', 1000, 400);

    runTransfer($scenario);

    // Re-read: the in-memory copy still carries the HEI relation as it was
    // before the move, which would make the policy answer on stale data.
    $historical = $historical->fresh();

    expect($scenario['barmmRc']->can('view', $historical))->toBeTrue()
        ->and($scenario['barmmRc']->can('edit', $historical))->toBeTrue()
        ->and($scenario['r12Rc']->can('view', $historical))->toBeTrue()
        ->and($scenario['r12Rc']->can('edit', $historical))->toBeTrue();
});

it('tells the receiving region which part of its list total is not its own', function () {
    // The list total must match the rows beneath it, so it includes the record
    // BARMM is assisting with — which is why it can exceed their dashboard. These
    // fields let the page explain that instead of leaving two screens disagreeing.
    $scenario = creditScenario();
    creditLiquidation($scenario, $scenario['r12'], 'CREDIT-2026-0001', 1000, 400);
    runTransfer($scenario);
    creditLiquidation($scenario, $scenario['barmm'], 'CREDIT-2026-0002', 2000, 1500);

    $service = app(LiquidationService::class);

    $barmm = $service->getTableSummary($scenario['barmmRc']);
    $r12 = $service->getTableSummary($scenario['r12Rc']);

    // Sees both; one of them is Region 12's. All three money figures are
    // reported, because one number only reconciles one card — subtracting the
    // disbursed amount from the liquidated column would give nonsense.
    expect($barmm['total_disbursed'])->toBe(3000.0)
        ->and($barmm['assisting_records'])->toBe(1)
        ->and($barmm['assisting_disbursed'])->toBe(1000.0)
        ->and($barmm['assisting_liquidated'])->toBe(400.0)
        ->and($barmm['assisting_unliquidated'])->toBe(600.0);

    // Each assisting figure must reconcile its own card against the dashboard.
    expect($barmm['total_disbursed'] - $barmm['assisting_disbursed'])->toBe(2000.0)
        ->and($barmm['total_liquidated'] - $barmm['assisting_liquidated'])->toBe(1500.0)
        ->and($barmm['total_unliquidated'] - $barmm['assisting_unliquidated'])->toBe(500.0);

    // Region 12 processed everything it can see, so nothing is "assisting".
    expect($r12['assisting_records'])->toBe(0)
        ->and($r12['assisting_disbursed'])->toBe(0.0)
        ->and($r12['assisting_liquidated'])->toBe(0.0)
        ->and($r12['assisting_unliquidated'])->toBe(0.0);
});

it('never marks anything as assisting for a role without a region', function () {
    // Admins see every region by design; "assisting" is meaningless for them and
    // the explanatory line must stay hidden.
    $scenario = creditScenario();
    creditLiquidation($scenario, $scenario['r12'], 'CREDIT-2026-0001', 1000, 400);
    runTransfer($scenario);

    $summary = app(LiquidationService::class)->getTableSummary($scenario['admin']);

    expect($summary['assisting_records'])->toBe(0)
        ->and($summary['assisting_disbursed'])->toBe(0.0);
});

it('warns both regions about the due date on a transferred record', function () {
    // A deadline is a warning, not a score. It is never summed, so showing it to
    // both sides costs nothing and stops either being blindsided.
    $scenario = creditScenario();
    $historical = creditLiquidation($scenario, $scenario['r12'], 'CREDIT-2026-0001', 1000, 400);
    $historical->financial->update(['due_date' => now()->addDays(20)->toDateString()]);

    runTransfer($scenario);

    foreach (['r12Rc', 'barmmRc'] as $who) {
        $found = collect(dashboardDeferred($scenario[$who], 'calendarDueDates'))
            ->contains(fn ($row) => ($row['control_no'] ?? null) === 'CREDIT-2026-0001');

        expect($found)->toBeTrue("{$who} should see the upcoming due date");
    }
});
