<?php

use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\LiquidationComment;
use App\Models\Permission;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * @return array{
 *     historical: Liquidation,
 *     processing_rc: User,
 *     current_rc: User,
 *     unrelated_rc: User
 * }
 */
function directAccessHistoricalLiquidationFixture(): array
{
    $processingRegion = Region::create([
        'code' => 'R12',
        'name' => 'Region XII',
        'status' => 'active',
    ]);
    $currentRegion = Region::create([
        'code' => 'BARMM',
        'name' => 'Bangsamoro Autonomous Region in Muslim Mindanao',
        'status' => 'active',
    ]);
    $unrelatedRegion = Region::create([
        'code' => 'R11',
        'name' => 'Region XI',
        'status' => 'active',
    ]);

    $role = Role::create([
        'name' => 'Regional Coordinator',
        'description' => 'Regional Coordinator test role',
    ]);

    $permissions = collect([
        'view_liquidation',
        'edit_liquidation',
        'review_liquidation',
    ])->map(fn (string $name) => Permission::create([
        'name' => $name,
        'module' => 'Liquidation',
        'description' => "Test {$name}",
    ]));

    $role->permissions()->sync($permissions->pluck('id'));

    $makeRc = fn (Region $region): User => User::factory()->create([
        'role_id' => $role->id,
        'region_id' => $region->id,
        'status' => 'active',
    ]);

    $processingRc = $makeRc($processingRegion);
    $currentRc = $makeRc($currentRegion);
    $unrelatedRc = $makeRc($unrelatedRegion);

    $hei = HEI::create([
        'uii' => 'DIRECT-ACCESS-HEI',
        'code' => 'DA-HEI',
        'name' => 'Historical Access Test University',
        'type' => 'SUC',
        'region_id' => $currentRegion->id,
        'status' => 'active',
    ]);
    $program = Program::create([
        'code' => 'DA-TES',
        'name' => 'Direct Access Test Program',
        'status' => 'active',
    ]);

    $historical = Liquidation::create([
        'control_no' => 'DA-2026-0001',
        'hei_id' => $hei->id,
        'processing_region_id' => $processingRegion->id,
        'program_id' => $program->id,
        'created_by' => $processingRc->id,
    ]);

    return [
        'historical' => $historical,
        'processing_rc' => $processingRc,
        'current_rc' => $currentRc,
        'unrelated_rc' => $unrelatedRc,
    ];
}

test('an unrelated RC is denied direct access to every historical liquidation endpoint', function () {
    $fixture = directAccessHistoricalLiquidationFixture();
    $liquidation = $fixture['historical'];

    $this->actingAs($fixture['unrelated_rc']);

    $this->get(route('liquidation.show', $liquidation))->assertForbidden();
    $this->putJson(route('liquidation.update', $liquidation), [
        'amount_received' => 'not-a-number',
    ])->assertForbidden();

    $this->getJson(route('liquidation.comments.index', $liquidation))->assertForbidden();
    $this->postJson(route('liquidation.comments.store', $liquidation), [
        'body' => null,
    ])->assertForbidden();
    $this->getJson(route('liquidation.mentionable-users', $liquidation))->assertForbidden();
    $this->postJson(route('liquidation.upload-document', $liquidation), [])->assertForbidden();
    $this->postJson(route('liquidation.store-gdrive-link', $liquidation), [])->assertForbidden();
    $this->postJson(route('liquidation.endorse-to-accounting', $liquidation), [])->assertForbidden();
    $this->postJson(route('liquidation.return-to-hei', $liquidation), [])->assertForbidden();

    $this->post(route('liquidation.toggle-pin', $liquidation))->assertForbidden();
    $this->postJson(route('liquidation.save-tracking-entries', $liquidation), [
        'entries' => 'not-an-array',
    ])->assertForbidden();
    $this->postJson(route('liquidation.save-running-data', $liquidation), [
        'entries' => 'not-an-array',
    ])->assertForbidden();
    $this->get(route('liquidation.download-beneficiary-template', $liquidation))->assertForbidden();

    expect($fixture['unrelated_rc']->pinnedLiquidations()->exists())->toBeFalse()
        ->and(LiquidationComment::where('liquidation_id', $liquidation->id)->exists())->toBeFalse()
        ->and($liquidation->trackingEntries()->exists())->toBeFalse()
        ->and($liquidation->runningData()->exists())->toBeFalse()
        ->and($liquidation->fresh()->financial)->toBeNull();
});

test('the original processing RC and current owning RC both pass historical-record policy checks', function () {
    $fixture = directAccessHistoricalLiquidationFixture();
    $liquidation = $fixture['historical'];

    foreach (['processing_rc', 'current_rc'] as $key) {
        $rc = $fixture[$key];

        expect($rc->can('view', $liquidation))->toBeTrue()
            ->and($rc->can('edit', $liquidation))->toBeTrue()
            ->and($rc->can('review', $liquidation))->toBeTrue()
            ->and($rc->can('comment', $liquidation))->toBeTrue()
            ->and($rc->can('manageInternalData', $liquidation))->toBeTrue()
            ->and($rc->can('uploadDocument', $liquidation))->toBeTrue();
    }

    expect($fixture['unrelated_rc']->can('view', $liquidation))->toBeFalse()
        ->and($fixture['unrelated_rc']->can('edit', $liquidation))->toBeFalse()
        ->and($fixture['unrelated_rc']->can('review', $liquidation))->toBeFalse()
        ->and($fixture['unrelated_rc']->can('comment', $liquidation))->toBeFalse()
        ->and($fixture['unrelated_rc']->can('manageInternalData', $liquidation))->toBeFalse()
        ->and($fixture['unrelated_rc']->can('uploadDocument', $liquidation))->toBeFalse();
});

test('the processing RC can edit a historical record without reassigning it outside scope', function () {
    $fixture = directAccessHistoricalLiquidationFixture();
    $liquidation = $fixture['historical'];

    $this->actingAs($fixture['processing_rc'])
        ->put(route('liquidation.update', $liquidation), [
            'hei_id' => $liquidation->hei_id,
            'remarks' => 'Historical record reviewed by its original processing region.',
        ])
        ->assertRedirect();

    expect($liquidation->fresh()->remarks)
        ->toBe('Historical record reviewed by its original processing region.');

    $outsideHei = HEI::create([
        'uii' => 'OUTSIDE-SCOPE-HEI',
        'code' => 'OUTSIDE',
        'name' => 'Outside Scope University',
        'type' => 'SUC',
        'region_id' => $fixture['unrelated_rc']->region_id,
        'status' => 'active',
    ]);

    $this->actingAs($fixture['processing_rc'])
        ->put(route('liquidation.update', $liquidation), [
            'hei_id' => $outsideHei->id,
        ])
        ->assertSessionHasErrors('hei_id');

    expect($liquidation->fresh()->hei_id)->not->toBe($outsideHei->id);
});

test('explicit bulk endorsement rejects a mixed-scope selection atomically', function () {
    $fixture = directAccessHistoricalLiquidationFixture();
    $historical = $fixture['historical'];
    $historical->update(['date_submitted' => now()]);

    $current = Liquidation::create([
        'control_no' => 'DA-2026-0002',
        'hei_id' => $historical->hei_id,
        'processing_region_id' => $fixture['current_rc']->region_id,
        'program_id' => $historical->program_id,
        'created_by' => $fixture['current_rc']->id,
        'date_submitted' => now(),
    ]);

    $this->actingAs($fixture['processing_rc'])
        ->post(route('liquidation.bulk-endorse-to-accounting'), [
            'liquidation_ids' => [$historical->id, $current->id],
        ])
        ->assertForbidden();

    expect($historical->fresh()->reviewed_at)->toBeNull()
        ->and($current->fresh()->reviewed_at)->toBeNull();

    $this->actingAs($fixture['processing_rc'])
        ->post(route('liquidation.bulk-endorse-to-accounting'), [
            'liquidation_ids' => [$historical->id],
        ])
        ->assertRedirect();

    expect($historical->fresh()->reviewed_at)->not->toBeNull()
        ->and($current->fresh()->reviewed_at)->toBeNull();
});
