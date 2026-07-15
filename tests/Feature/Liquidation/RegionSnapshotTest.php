<?php

use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\Permission;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\User;
use App\Services\LiquidationService;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

beforeEach(function () {
    $this->rcRole = Role::create(['name' => 'Regional Coordinator']);

    $viewPermission = Permission::create(['name' => 'view_liquidation', 'module' => 'Liquidation']);
    $this->rcRole->permissions()->attach($viewPermission->id);

    $this->r12 = Region::create(['code' => 'R12', 'name' => 'Region XII', 'status' => 'active']);
    $this->barmm = Region::create(['code' => 'BARMM', 'name' => 'BARMM', 'status' => 'active']);
    $this->r11 = Region::create(['code' => 'R11', 'name' => 'Region XI', 'status' => 'active']);

    $this->program = Program::create(['code' => 'TES', 'name' => 'TES', 'status' => 'active']);

    $this->hei = HEI::create([
        'uii' => 'HEI-0001',
        'name' => 'COTABATO STATE UNIVERSITY',
        'type' => 'SUC',
        'region_id' => $this->r12->id,
        'status' => 'active',
    ]);

    $this->rc12 = User::factory()->create(['role_id' => $this->rcRole->id, 'region_id' => $this->r12->id]);
    $this->rcBarmm = User::factory()->create(['role_id' => $this->rcRole->id, 'region_id' => $this->barmm->id]);
    $this->rc11 = User::factory()->create(['role_id' => $this->rcRole->id, 'region_id' => $this->r11->id]);

    $this->makeLiquidation = function (array $overrides = []) {
        static $seq = 0;
        $seq++;

        return Liquidation::create(array_merge([
            'control_no' => 'TEST-' . $seq . '-' . uniqid(),
            'hei_id' => $this->hei->id,
            'region_id' => $this->hei->region_id,
            'program_id' => $this->program->id,
            'created_by' => $this->rc12->id,
            'date_submitted' => now(),
        ], $overrides));
    };
});

test('creating a liquidation via the service stamps the HEI current region as snapshot', function () {
    $this->actingAs($this->rc12);

    $liquidation = app(LiquidationService::class)->createLiquidation([
        'uii' => 'HEI-0001',
        'dv_control_no' => 'DV-0001',
        'program_id' => $this->program->id,
        'academic_year_id' => null,
        'date_fund_released' => '2026-01-01',
        'total_disbursements' => 1000,
    ], $this->rc12);

    expect($liquidation->region_id)->toBe($this->r12->id);
});

test('old region keeps read access and new region sees everything after an HEI transfer', function () {
    $old1 = ($this->makeLiquidation)();
    $old2 = ($this->makeLiquidation)();

    // BARMM takes over the HEI
    $this->hei->update(['region_id' => $this->barmm->id]);

    $new = ($this->makeLiquidation)(['region_id' => $this->barmm->id]);

    $service = app(LiquidationService::class);

    $idsFor = fn (User $user) => $service->getPaginatedLiquidations($user, [])
        ->getCollection()->pluck('id')->all();

    // R12 still sees the records it processed, but not BARMM's new one
    expect($idsFor($this->rc12))
        ->toContain($old1->id, $old2->id)
        ->not->toContain($new->id);

    // BARMM sees the HEI's full history, old and new
    expect($idsFor($this->rcBarmm))
        ->toContain($old1->id, $old2->id, $new->id);

    // Unrelated regions see nothing
    expect($idsFor($this->rc11))->toBeEmpty();
});

test('RC of the new region can act on records processed under the old region', function () {
    $old = ($this->makeLiquidation)();
    $this->hei->update(['region_id' => $this->barmm->id]);

    $this->actingAs($this->rcBarmm)
        ->post(route('liquidation.endorse-to-accounting', $old->id))
        ->assertRedirect(route('liquidation.index'));

    expect($old->fresh()->reviewed_by)->toBe($this->rcBarmm->id);
});

test('RC of an unrelated region cannot endorse the record', function () {
    $old = ($this->makeLiquidation)();
    $this->hei->update(['region_id' => $this->barmm->id]);

    $this->actingAs($this->rc11)
        ->post(route('liquidation.endorse-to-accounting', $old->id))
        ->assertForbidden();

    expect($old->fresh()->reviewed_at)->toBeNull();
});

test('RC of the old region can still finish in-flight records after the HEI transfer', function () {
    $old = ($this->makeLiquidation)();
    $this->hei->update(['region_id' => $this->barmm->id]);

    $this->actingAs($this->rc12)
        ->post(route('liquidation.endorse-to-accounting', $old->id))
        ->assertRedirect(route('liquidation.index'));

    expect($old->fresh()->reviewed_by)->toBe($this->rc12->id);
});

test('bulk endorse filters out client-supplied IDs from an unrelated region', function () {
    $old = ($this->makeLiquidation)();
    $this->hei->update(['region_id' => $this->barmm->id]);
    $new = ($this->makeLiquidation)(['region_id' => $this->barmm->id]);

    // BARMM now owns the HEI, so it can endorse both old and new records
    $this->actingAs($this->rcBarmm)
        ->post(route('liquidation.bulk-endorse-to-accounting'), [
            'liquidation_ids' => [$old->id, $new->id],
        ])
        ->assertRedirect();

    expect($old->fresh()->reviewed_at)->not->toBeNull()
        ->and($new->fresh()->reviewed_at)->not->toBeNull();

    // An unrelated region's RC gets nothing endorsed even with valid IDs
    $third = ($this->makeLiquidation)(['region_id' => $this->barmm->id]);
    $this->actingAs($this->rc11)
        ->post(route('liquidation.bulk-endorse-to-accounting'), [
            'liquidation_ids' => [$third->id],
        ])
        ->assertRedirect();

    expect($third->fresh()->reviewed_at)->toBeNull();
});

test('bulk endorse select-all covers the transferred HEI records for the new region', function () {
    $old = ($this->makeLiquidation)();
    $this->hei->update(['region_id' => $this->barmm->id]);
    $new = ($this->makeLiquidation)(['region_id' => $this->barmm->id]);

    $this->actingAs($this->rcBarmm)
        ->post(route('liquidation.bulk-endorse-to-accounting'), ['select_all' => true])
        ->assertRedirect();

    expect($old->fresh()->reviewed_at)->not->toBeNull()
        ->and($new->fresh()->reviewed_at)->not->toBeNull();
});

test('bulk endorse select-all for the old region still covers its in-flight records', function () {
    $old = ($this->makeLiquidation)();
    $this->hei->update(['region_id' => $this->barmm->id]);
    $new = ($this->makeLiquidation)(['region_id' => $this->barmm->id]);

    $this->actingAs($this->rc12)
        ->post(route('liquidation.bulk-endorse-to-accounting'), ['select_all' => true])
        ->assertRedirect();

    expect($old->fresh()->reviewed_at)->not->toBeNull()
        ->and($new->fresh()->reviewed_at)->toBeNull();
});

test('records without a snapshot fall back to the HEI current region for action rights', function () {
    $legacy = ($this->makeLiquidation)(['region_id' => null]);
    $this->hei->update(['region_id' => $this->barmm->id]);
    $legacy->refresh();

    expect($legacy->isActionableByRegion($this->rcBarmm))->toBeTrue()
        ->and($legacy->isActionableByRegion($this->rc12))->toBeFalse();
});

test('viewing is scoped: processing region and current region may view, others may not', function () {
    $old = ($this->makeLiquidation)();
    $this->hei->update(['region_id' => $this->barmm->id]);

    $this->actingAs($this->rc12)->get(route('liquidation.show', $old->id))->assertOk();
    $this->actingAs($this->rcBarmm)->get(route('liquidation.show', $old->id))->assertOk();
    $this->actingAs($this->rc11)->get(route('liquidation.show', $old->id))->assertForbidden();
});

test('tracking and running data writes are blocked for unrelated regions only', function () {
    $old = ($this->makeLiquidation)();
    $this->hei->update(['region_id' => $this->barmm->id]);

    $entries = ['entries' => []];

    // Unrelated region: blocked (and cannot even view)
    $this->actingAs($this->rc11)
        ->post(route('liquidation.save-tracking-entries', $old->id), $entries)
        ->assertForbidden();

    $this->actingAs($this->rc11)
        ->post(route('liquidation.save-running-data', $old->id), $entries)
        ->assertForbidden();

    // Both the processing region and the HEI's current region may write
    expect($old->isActionableByRegion($this->rc12))->toBeTrue()
        ->and($old->isActionableByRegion($this->rcBarmm))->toBeTrue();
});
