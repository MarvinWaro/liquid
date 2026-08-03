<?php

use App\Models\ActivityLog;
use App\Models\HEI;
use App\Models\HEIRegionTransfer;
use App\Models\Liquidation;
use App\Models\Permission;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\User;
use App\Services\CacheService;
use App\Services\DashboardCache;
use App\Services\LiquidationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

function transferTestRegion(string $code, string $name, string $status = 'active'): Region
{
    return Region::create([
        'code' => $code,
        'name' => $name,
        'status' => $status,
    ]);
}

/**
 * @param  list<string>  $permissions
 */
function transferTestUser(string $roleName, array $permissions, ?Region $region = null): User
{
    $role = Role::create([
        'name' => $roleName,
        'description' => "{$roleName} test role",
    ]);

    foreach ($permissions as $permissionName) {
        $permission = Permission::firstOrCreate(
            ['name' => $permissionName],
            ['module' => 'Test', 'description' => "Test {$permissionName}"],
        );

        $role->permissions()->attach($permission->id);
    }

    return User::factory()->create([
        'role_id' => $role->id,
        'region_id' => $region?->id,
        'status' => 'active',
    ]);
}

function transferTestHei(Region $region): HEI
{
    return HEI::create([
        'uii' => fake()->unique()->numerify('#####'),
        'code' => fake()->unique()->bothify('HEI-####'),
        'name' => 'COTABATO STATE UNIVERSITY',
        'type' => 'SUC',
        'region_id' => $region->id,
        'status' => 'active',
    ]);
}

function transferTestProgram(): Program
{
    return Program::create([
        'code' => fake()->unique()->bothify('TES-###'),
        'name' => 'Tertiary Education Subsidy',
        'status' => 'active',
    ]);
}

function transferTestLiquidation(
    HEI $hei,
    Program $program,
    User $creator,
    ?Region $processingRegion,
    string $controlNo,
): Liquidation {
    return Liquidation::create([
        'control_no' => $controlNo,
        'hei_id' => $hei->id,
        'processing_region_id' => $processingRegion?->id,
        'program_id' => $program->id,
        'created_by' => $creator->id,
    ]);
}

function transferTestPayload(HEI $hei, Region $destination, array $overrides = []): array
{
    return array_merge([
        'uii' => $hei->uii,
        'name' => $hei->name,
        'type' => $hei->type,
        'region_id' => $destination->id,
        'status' => $hei->status,
        'transfer_effective_date' => now()->toDateString(),
        'transfer_reason' => 'Regional responsibility transferred under the new office memorandum.',
        'transfer_memo_reference' => 'MEMO-2026-08',
    ], $overrides);
}

test('an authorized HEI transfer is audited and preserves historical processing ownership', function () {
    $regionTwelve = transferTestRegion('R12', 'Region XII');
    $barmm = transferTestRegion('BARMM', 'Bangsamoro Autonomous Region in Muslim Mindanao');
    $admin = transferTestUser('Admin', ['edit_hei', 'transfer_hei_region']);
    $hei = transferTestHei($regionTwelve);
    $program = transferTestProgram();

    $historical = transferTestLiquidation(
        $hei,
        $program,
        $admin,
        $regionTwelve,
        'TES-2026-0001',
    );
    $legacy = transferTestLiquidation($hei, $program, $admin, null, 'TES-2026-0002');

    $liquidationService = app(LiquidationService::class);
    $cacheService = app(CacheService::class);
    expect($liquidationService->findHEIByUII($hei->uii)?->region_id)->toBe($regionTwelve->id)
        ->and($cacheService->getHEIByUII($hei->uii)?->region_id)->toBe($regionTwelve->id);

    DashboardCache::flush();
    $dashboardVersion = (int) Cache::get('dashboard:version');

    ActivityLog::query()->delete();

    $this->actingAs($admin)
        ->put(route('hei.update', $hei), transferTestPayload($hei, $barmm))
        ->assertRedirect()
        ->assertSessionHas('success', 'HEI region transferred successfully.');

    expect($hei->fresh()->region_id)->toBe($barmm->id)
        ->and($historical->fresh()->processing_region_id)->toBe($regionTwelve->id)
        ->and($legacy->fresh()->processing_region_id)->toBe($regionTwelve->id)
        ->and(HEIRegionTransfer::count())->toBe(1)
        ->and($liquidationService->findHEIByUII($hei->uii)?->region_id)->toBe($barmm->id)
        ->and($cacheService->getHEIByUII($hei->uii)?->region_id)->toBe($barmm->id)
        ->and((int) Cache::get('dashboard:version'))->toBeGreaterThan($dashboardVersion);

    $transfer = HEIRegionTransfer::firstOrFail();

    expect($transfer->hei_id)->toBe($hei->id)
        ->and($transfer->from_region_id)->toBe($regionTwelve->id)
        ->and($transfer->to_region_id)->toBe($barmm->id)
        ->and($transfer->effective_date->toDateString())->toBe(now()->toDateString())
        ->and($transfer->memo_reference)->toBe('MEMO-2026-08')
        ->and($transfer->transferred_by)->toBe($admin->id)
        ->and($transfer->reason)->toContain('new office memorandum');

    $this->assertDatabaseHas('activity_logs', [
        'user_id' => $admin->id,
        'action' => 'transferred_region',
        'subject_type' => HEI::class,
        'subject_id' => $hei->id,
        'module' => 'HEI',
    ]);

    expect(fn () => $transfer->update(['reason' => 'Rewritten history']))
        ->toThrow(LogicException::class, 'immutable')
        ->and(fn () => $transfer->delete())
        ->toThrow(LogicException::class, 'cannot be deleted')
        ->and(fn () => $historical->update(['processing_region_id' => $barmm->id]))
        ->toThrow(LogicException::class, 'immutable')
        ->and(fn () => $hei->fresh()->update(['region_id' => $regionTwelve->id]))
        ->toThrow(LogicException::class, 'audited transfer workflow');
});

test('an ordinary HEI editor cannot transfer a school but can edit its other fields', function () {
    $regionTwelve = transferTestRegion('R12', 'Region XII');
    $barmm = transferTestRegion('BARMM', 'Bangsamoro Autonomous Region in Muslim Mindanao');
    $editor = transferTestUser('Encoder', ['edit_hei']);
    $hei = transferTestHei($regionTwelve);

    $this->actingAs($editor)
        ->put(route('hei.update', $hei), transferTestPayload($hei, $barmm))
        ->assertForbidden();

    expect($hei->fresh()->region_id)->toBe($regionTwelve->id)
        ->and(HEIRegionTransfer::count())->toBe(0);

    $this->actingAs($editor)
        ->put(route('hei.update', $hei), [
            'uii' => $hei->uii,
            'name' => 'Cotabato State University - Updated',
            'type' => $hei->type,
            'region_id' => $regionTwelve->id,
            'status' => $hei->status,
        ])
        ->assertRedirect()
        ->assertSessionHas('success', 'HEI updated successfully.');

    expect($hei->fresh()->name)->toBe('COTABATO STATE UNIVERSITY - UPDATED')
        ->and($hei->fresh()->region_id)->toBe($regionTwelve->id)
        ->and(HEIRegionTransfer::count())->toBe(0);
});

test('a region change requires complete valid transfer audit details', function () {
    $regionTwelve = transferTestRegion('R12', 'Region XII');
    $barmm = transferTestRegion('BARMM', 'Bangsamoro Autonomous Region in Muslim Mindanao');
    $inactiveRegion = transferTestRegion('R11', 'Region XI', 'inactive');
    $admin = transferTestUser('Admin', ['edit_hei', 'transfer_hei_region']);
    $hei = transferTestHei($regionTwelve);

    $this->actingAs($admin)
        ->from(route('hei.index'))
        ->put(route('hei.update', $hei), transferTestPayload($hei, $barmm, [
            'transfer_effective_date' => null,
            'transfer_reason' => null,
        ]))
        ->assertRedirect(route('hei.index'))
        ->assertSessionHasErrors(['transfer_effective_date', 'transfer_reason']);

    $this->actingAs($admin)
        ->from(route('hei.index'))
        ->put(route('hei.update', $hei), transferTestPayload($hei, $barmm, [
            'transfer_effective_date' => now()->addDay()->toDateString(),
            'transfer_reason' => str_repeat('x', 2001),
            'transfer_memo_reference' => str_repeat('m', 256),
        ]))
        ->assertRedirect(route('hei.index'))
        ->assertSessionHasErrors([
            'transfer_effective_date',
            'transfer_reason',
            'transfer_memo_reference',
        ]);

    $this->actingAs($admin)
        ->from(route('hei.index'))
        ->put(route('hei.update', $hei), transferTestPayload($hei, $inactiveRegion))
        ->assertRedirect(route('hei.index'))
        ->assertSessionHasErrors('region_id');

    $this->actingAs($admin)
        ->from(route('hei.index'))
        ->put(route('hei.update', $hei), transferTestPayload($hei, $barmm, [
            'region_id' => null,
        ]))
        ->assertRedirect(route('hei.index'))
        ->assertSessionHasErrors('region_id');

    expect($hei->fresh()->region_id)->toBe($regionTwelve->id)
        ->and(HEIRegionTransfer::count())->toBe(0);
});

test('both current and original processing RCs can manage historical records while unrelated RCs cannot', function () {
    $regionTwelve = transferTestRegion('R12', 'Region XII');
    $barmm = transferTestRegion('BARMM', 'Bangsamoro Autonomous Region in Muslim Mindanao');
    $unrelatedRegion = transferTestRegion('R11', 'Region XI');
    $permissions = ['view_liquidation', 'edit_liquidation', 'review_liquidation'];
    $formerRc = transferTestUser('Regional Coordinator', $permissions, $regionTwelve);

    // Role names are unique, so the remaining RC users share the first RC role.
    $rcRole = $formerRc->role;
    $currentRc = User::factory()->create([
        'role_id' => $rcRole->id,
        'region_id' => $barmm->id,
        'status' => 'active',
    ]);
    $unrelatedRc = User::factory()->create([
        'role_id' => $rcRole->id,
        'region_id' => $unrelatedRegion->id,
        'status' => 'active',
    ]);

    $hei = transferTestHei($barmm);
    $program = transferTestProgram();
    $historical = transferTestLiquidation(
        $hei,
        $program,
        $formerRc,
        $regionTwelve,
        'TES-2026-0101',
    );
    $current = transferTestLiquidation($hei, $program, $currentRc, $barmm, 'TES-2026-0102');

    foreach (['view', 'edit', 'review'] as $ability) {
        expect($formerRc->can($ability, $historical))->toBeTrue()
            ->and($currentRc->can($ability, $historical))->toBeTrue()
            ->and($unrelatedRc->can($ability, $historical))->toBeFalse();
    }

    expect($formerRc->can('view', $current))->toBeFalse()
        ->and($currentRc->can('view', $current))->toBeTrue()
        ->and($unrelatedRc->can('view', $current))->toBeFalse();

    expect(Liquidation::managedByRegion($regionTwelve->id)->pluck('id')->all())
        ->toBe([$historical->id])
        ->and(Liquidation::managedByRegion($barmm->id)->pluck('id')->sort()->values()->all())
        ->toBe(collect([$historical->id, $current->id])->sort()->values()->all())
        ->and(Liquidation::managedByRegion($unrelatedRegion->id)->exists())->toBeFalse();

    $liquidationService = app(LiquidationService::class);
    $formerOperationalQuery = Liquidation::query();
    $formerLookupQuery = Liquidation::query();
    $currentLookupQuery = Liquidation::query();

    $liquidationService->applyOperationalRoleScope($formerOperationalQuery, $formerRc);
    $liquidationService->applyRoleScope($formerLookupQuery, $formerRc);
    $liquidationService->applyRoleScope($currentLookupQuery, $currentRc);

    // Exact-record lookup follows the policy, not report attribution: both sides
    // of the transfer can still resolve the shared historical record.
    expect($formerOperationalQuery->pluck('id')->all())->toBe([$historical->id])
        ->and($formerLookupQuery->pluck('id')->all())->toBe([$historical->id])
        ->and($currentLookupQuery->pluck('id')->sort()->values()->all())
        ->toBe(collect([$historical->id, $current->id])->sort()->values()->all());
});

test('an HEI user with a direct management permission never receives region transfer history', function () {
    $regionTwelve = transferTestRegion('R12', 'Region XII');
    $barmm = transferTestRegion('BARMM', 'Bangsamoro Autonomous Region in Muslim Mindanao');
    $hei = transferTestHei($barmm);

    HEIRegionTransfer::create([
        'hei_id' => $hei->id,
        'from_region_id' => $regionTwelve->id,
        'to_region_id' => $barmm->id,
        'effective_date' => now()->toDateString(),
        'memo_reference' => 'CONFIDENTIAL-MEMO-REFERENCE',
        'reason' => 'CONFIDENTIAL-TRANSFER-REASON',
    ]);

    $heiRole = Role::create([
        'name' => 'HEI',
        'description' => 'HEI test role',
    ]);
    $viewHei = Permission::firstOrCreate(
        ['name' => 'view_hei'],
        ['module' => 'Test', 'description' => 'Test view_hei'],
    );
    $heiUser = User::factory()->create([
        'role_id' => $heiRole->id,
        'hei_id' => $hei->id,
        'status' => 'active',
    ]);
    $heiUser->permissions()->attach($viewHei->id);

    $this->actingAs($heiUser)
        ->get(route('hei.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('hei/index')
            ->has('heis', 1)
            ->where('heis.0.id', $hei->id)
            ->missing('heis.0.region_transfers')
        );
});

test('an ordinary HEI edit preserves an unchanged inactive current region', function () {
    $inactiveRegion = transferTestRegion('R12', 'Region XII', 'inactive');
    $editor = transferTestUser('Encoder', ['edit_hei']);
    $hei = transferTestHei($inactiveRegion);

    $this->actingAs($editor)
        ->from(route('hei.index'))
        ->put(route('hei.update', $hei), [
            'uii' => $hei->uii,
            'name' => 'Cotabato State University - Updated While Region Inactive',
            'type' => $hei->type,
            'region_id' => $inactiveRegion->id,
            'status' => $hei->status,
        ])
        ->assertRedirect(route('hei.index'))
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'HEI updated successfully.');

    expect($hei->fresh()->name)->toBe('COTABATO STATE UNIVERSITY - UPDATED WHILE REGION INACTIVE')
        ->and($hei->fresh()->region_id)->toBe($inactiveRegion->id)
        ->and(HEIRegionTransfer::count())->toBe(0);
});

test('an HEI with immutable region transfer history cannot be hard deleted', function () {
    $regionTwelve = transferTestRegion('R12', 'Region XII');
    $barmm = transferTestRegion('BARMM', 'Bangsamoro Autonomous Region in Muslim Mindanao');
    $admin = transferTestUser('Admin', ['delete_hei']);
    $hei = transferTestHei($barmm);
    $transfer = HEIRegionTransfer::create([
        'hei_id' => $hei->id,
        'from_region_id' => $regionTwelve->id,
        'to_region_id' => $barmm->id,
        'effective_date' => now()->toDateString(),
        'reason' => 'Permanent transfer audit record.',
        'transferred_by' => $admin->id,
    ]);

    $this->actingAs($admin)
        ->from(route('hei.index'))
        ->delete(route('hei.destroy', $hei))
        ->assertRedirect(route('hei.index'))
        ->assertSessionHas('error');

    $this->assertDatabaseHas('heis', ['id' => $hei->id]);
    $this->assertDatabaseHas('hei_region_transfers', [
        'id' => $transfer->id,
        'hei_id' => $hei->id,
    ]);
});

test('deleting a region referenced by transfer history returns a controlled response', function () {
    $regionTwelve = transferTestRegion('R12', 'Region XII');
    $barmm = transferTestRegion('BARMM', 'Bangsamoro Autonomous Region in Muslim Mindanao');
    $admin = transferTestUser('Admin', ['delete_regions']);
    $hei = transferTestHei($barmm);
    $transfer = HEIRegionTransfer::create([
        'hei_id' => $hei->id,
        'from_region_id' => $regionTwelve->id,
        'to_region_id' => $barmm->id,
        'effective_date' => now()->toDateString(),
        'reason' => 'Permanent transfer audit record.',
        'transferred_by' => $admin->id,
    ]);

    $this->actingAs($admin)
        ->from(route('regions.index'))
        ->delete(route('regions.destroy', $regionTwelve))
        ->assertRedirect(route('regions.index'))
        ->assertSessionHas('error');

    $this->assertDatabaseHas('regions', ['id' => $regionTwelve->id]);
    $this->assertDatabaseHas('hei_region_transfers', [
        'id' => $transfer->id,
        'from_region_id' => $regionTwelve->id,
    ]);
});
