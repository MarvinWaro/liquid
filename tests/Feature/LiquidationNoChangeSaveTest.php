<?php

use App\Models\ActivityLog;
use App\Models\DocumentStatus;
use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\LiquidationStatus;
use App\Models\Notification;
use App\Models\Permission;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Pressing Save on Document Tracking or Running Data used to log an update and
 * notify the HEI even when nothing had changed, so institutions were pinged for
 * no reason. Both save methods already computed a list of changed fields; these
 * cover that list now gating the log (and therefore the notification).
 *
 * @return array{liquidation: Liquidation, rc: User, hei_user: User}
 */
function noChangeSaveFixture(): array
{
    $region = Region::create(['code' => 'R12', 'name' => 'Region XII', 'status' => 'active']);

    $rcRole = Role::firstOrCreate(['name' => 'Super Admin'], ['description' => 'test']);
    $heiRole = Role::firstOrCreate(['name' => 'HEI'], ['description' => 'test']);

    $permissions = collect(['view_liquidation', 'edit_liquidation', 'review_liquidation'])
        ->map(fn (string $name) => Permission::firstOrCreate(
            ['name' => $name],
            ['module' => 'Liquidation', 'description' => "Test {$name}"]
        ));
    $rcRole->permissions()->sync($permissions->pluck('id'));

    $hei = HEI::create([
        'uii' => 'NOCHANGE-HEI',
        'code' => 'NC-HEI',
        'name' => 'No Change Test University',
        'type' => 'SUC',
        'region_id' => $region->id,
        'status' => 'active',
    ]);
    $program = Program::create(['code' => 'NC-TES', 'name' => 'No Change Program', 'status' => 'active']);

    $rc = User::factory()->create(['role_id' => $rcRole->id, 'region_id' => $region->id, 'status' => 'active']);
    $heiUser = User::factory()->create([
        'role_id' => $heiRole->id,
        'region_id' => $region->id,
        'hei_id' => $hei->id,
        'status' => 'active',
    ]);

    // The lookup tables are populated by migration, so reuse whatever is there
    // rather than fighting the unique constraint on `code`.
    $docNone = DocumentStatus::firstOrCreate(
        ['code' => DocumentStatus::CODE_NONE],
        ['name' => 'None', 'sort_order' => 1, 'is_active' => true]
    );
    $liqUnliquidated = LiquidationStatus::firstOrCreate(
        ['code' => LiquidationStatus::CODE_UNLIQUIDATED],
        ['name' => 'Unliquidated', 'sort_order' => 1, 'is_active' => true]
    );

    $liquidation = Liquidation::create([
        'control_no' => 'NC-2026-0001',
        'hei_id' => $hei->id,
        'processing_region_id' => $region->id,
        'program_id' => $program->id,
        'created_by' => $rc->id,
    ]);

    return [
        'liquidation' => $liquidation,
        'rc' => $rc,
        'hei_user' => $heiUser,
        'doc_status' => $docNone->name,
        'liq_status' => $liqUnliquidated->name,
    ];
}

function trackingPayload(array $overrides = []): array
{
    // Read the status names out of the lookup tables rather than hardcoding them,
    // so the payload matches whatever the migration seeded (the NONE code is named
    // "No Submission", not "None").
    return ['entries' => [array_merge([
        'id' => null,
        'document_status' => DocumentStatus::where('code', DocumentStatus::CODE_NONE)->value('name'),
        'received_by' => 'Ana Reyes',
        'date_received' => '2026-08-01',
        'document_location' => '',
        'reviewed_by' => '',
        'date_reviewed' => null,
        'rc_note' => '',
        'date_endorsement' => null,
        'liquidation_status' => LiquidationStatus::where('code', LiquidationStatus::CODE_UNLIQUIDATED)->value('name'),
    ], $overrides)]];
}

function saveTracking(User $actor, Liquidation $liquidation, array $payload)
{
    return test()->actingAs($actor)
        ->post("/liquidation/{$liquidation->id}/tracking-entries", $payload);
}

function saveRunning(User $actor, Liquidation $liquidation, array $payload)
{
    return test()->actingAs($actor)
        ->post("/liquidation/{$liquidation->id}/running-data", $payload);
}

function existingTrackingPayload(Liquidation $liquidation): array
{
    // Re-send exactly what is already stored, which is what the UI does when a
    // user opens the record and presses Save without touching anything.
    $entry = $liquidation->trackingEntries()->first();

    return trackingPayload([
        'id' => $entry->id,
        'date_received' => $entry->date_received?->toDateString(),
    ]);
}

it('logs and notifies the HEI when document tracking actually changes', function () {
    ['liquidation' => $liquidation, 'rc' => $rc, 'hei_user' => $heiUser] = noChangeSaveFixture();

    saveTracking($rc, $liquidation, trackingPayload())->assertSessionHas('success');

    expect(ActivityLog::where('action', 'updated_tracking')->count())->toBe(1)
        ->and(Notification::where('user_id', $heiUser->id)->where('action', 'updated_tracking')->count())->toBe(1);
});

it('does not log or notify when Save is pressed with no document tracking changes', function () {
    ['liquidation' => $liquidation, 'rc' => $rc, 'hei_user' => $heiUser] = noChangeSaveFixture();

    saveTracking($rc, $liquidation, trackingPayload());

    ActivityLog::query()->delete();
    Notification::query()->delete();

    // Second save, identical data — the habit press that used to ping the HEI.
    saveTracking($rc, $liquidation, existingTrackingPayload($liquidation))
        ->assertSessionHas('info', 'No changes to save.')
        ->assertSessionMissing('success');

    expect(ActivityLog::where('action', 'updated_tracking')->count())->toBe(0)
        ->and(Notification::where('user_id', $heiUser->id)->count())->toBe(0);
});

it('still names the changed field when one value is edited', function () {
    ['liquidation' => $liquidation, 'rc' => $rc] = noChangeSaveFixture();

    saveTracking($rc, $liquidation, trackingPayload());
    ActivityLog::query()->delete();

    $entry = $liquidation->trackingEntries()->first();
    saveTracking($rc, $liquidation, trackingPayload([
        'id' => $entry->id,
        'date_received' => $entry->date_received?->toDateString(),
        'reviewed_by' => 'Juan Dela Cruz',
    ]))->assertSessionHas('success');

    expect(ActivityLog::where('action', 'updated_tracking')->value('description'))
        ->toContain('Reviewed by');
});

it('treats a removed tracking entry as a change', function () {
    ['liquidation' => $liquidation, 'rc' => $rc] = noChangeSaveFixture();

    saveTracking($rc, $liquidation, trackingPayload());
    ActivityLog::query()->delete();

    // Send an unrelated new entry, dropping the stored one.
    saveTracking($rc, $liquidation, trackingPayload(['id' => null, 'received_by' => 'Someone Else']))
        ->assertSessionHas('success');

    expect(ActivityLog::where('action', 'updated_tracking')->count())->toBe(1);
});

it('does not invent a status change when the status name does not resolve', function () {
    ['liquidation' => $liquidation, 'rc' => $rc] = noChangeSaveFixture();

    // An unrecognised status name is *written* as the NONE / UNLIQUIDATED fallback.
    // The comparison used to fall back to '' instead, so it saw the stored UUID as a
    // difference and reported "Status of Documents" changed on every single save.
    saveTracking($rc, $liquidation, trackingPayload([
        'document_status' => 'Not A Real Status',
        'liquidation_status' => 'Also Not Real',
    ]));

    ActivityLog::query()->delete();

    $entry = $liquidation->trackingEntries()->first();
    saveTracking($rc, $liquidation, trackingPayload([
        'id' => $entry->id,
        'date_received' => $entry->date_received?->toDateString(),
        'document_status' => 'Not A Real Status',
        'liquidation_status' => 'Also Not Real',
    ]))->assertSessionHas('info', 'No changes to save.');

    expect(ActivityLog::where('action', 'updated_tracking')->count())->toBe(0);
});

it('does not log or notify when Save is pressed with no running data changes', function () {
    ['liquidation' => $liquidation, 'rc' => $rc, 'hei_user' => $heiUser] = noChangeSaveFixture();

    $payload = ['entries' => [[
        'id' => null,
        'grantees_liquidated' => 5,
        'amount_complete_docs' => 1000,
        'amount_refunded' => 0,
        'refund_or_no' => 'OR-1',
        'total_amount_liquidated' => 1000,
        'transmittal_ref_no' => 'TR-1',
        'group_transmittal_ref_no' => '',
    ]]];

    saveRunning($rc, $liquidation, $payload)->assertSessionHas('success');

    ActivityLog::query()->delete();
    Notification::query()->delete();

    $entry = $liquidation->runningData()->first();
    $payload['entries'][0]['id'] = $entry->id;

    saveRunning($rc, $liquidation, $payload)
        ->assertSessionHas('info', 'No changes to save.')
        ->assertSessionMissing('success');

    expect(ActivityLog::where('action', 'updated_running_data')->count())->toBe(0)
        ->and(Notification::where('user_id', $heiUser->id)->count())->toBe(0);
});

it('logs and notifies when a running data amount changes', function () {
    ['liquidation' => $liquidation, 'rc' => $rc, 'hei_user' => $heiUser] = noChangeSaveFixture();

    $payload = ['entries' => [[
        'id' => null,
        'grantees_liquidated' => 5,
        'amount_complete_docs' => 1000,
        'amount_refunded' => 0,
        'refund_or_no' => 'OR-1',
        'total_amount_liquidated' => 1000,
        'transmittal_ref_no' => 'TR-1',
        'group_transmittal_ref_no' => '',
    ]]];

    saveRunning($rc, $liquidation, $payload);
    ActivityLog::query()->delete();
    Notification::query()->delete();

    $entry = $liquidation->runningData()->first();
    $payload['entries'][0]['id'] = $entry->id;
    $payload['entries'][0]['amount_refunded'] = 250;
    $payload['entries'][0]['total_amount_liquidated'] = 1250;

    saveRunning($rc, $liquidation, $payload)->assertSessionHas('success');

    expect(ActivityLog::where('action', 'updated_running_data')->count())->toBe(1)
        ->and(Notification::where('user_id', $heiUser->id)->where('action', 'updated_running_data')->count())->toBe(1);
});
