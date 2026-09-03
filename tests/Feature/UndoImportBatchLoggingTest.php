<?php

use App\Models\AcademicYear;
use App\Models\ActivityLog;
use App\Models\HEI;
use App\Models\ImportBatch;
use App\Models\Liquidation;
use App\Models\LiquidationDocument;
use App\Models\LiquidationRunningData;
use App\Models\LiquidationStatus;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

/**
 * Undoing an import used to write one "deleted" activity entry per record, so a
 * 4,000-row batch buried every other event in the log. These cover the single
 * summary entry that replaced them.
 *
 * Helpers are declared here rather than borrowed from another test file: Pest
 * helpers are global but only exist once their file loads, so a borrowed one
 * breaks whenever the files land in different --parallel processes.
 */
function undoLogWorld(): array
{
    $region = Region::create(['code' => 'R12', 'name' => 'Region XII', 'status' => 'active']);
    $role = Role::create(['name' => 'Admin', 'description' => 'Admin']);
    $user = User::factory()->create(['role_id' => $role->id, 'status' => 'active']);

    $hei = HEI::create([
        'uii' => '12345',
        'name' => 'Test College',
        'type' => 'Private',
        'region_id' => $region->id,
        'status' => 'active',
    ]);

    return [
        'user' => $user,
        'region' => $region,
        'hei' => $hei,
        'program' => Program::create(['code' => 'TES', 'name' => 'Tertiary Education Subsidy', 'status' => 'active']),
        'academicYear' => AcademicYear::create(['code' => '2025-2026', 'name' => 'AY 2025-2026']),
        'batch' => ImportBatch::create([
            'user_id' => $user->id,
            'file_name' => 'TES-2026-Q1.xlsx',
            'total_rows' => 3,
            'imported_count' => 3,
            'status' => 'active',
        ]),
    ];
}

function undoLogLiquidation(array $w, string $controlNo, ?string $dateSubmitted = null): Liquidation
{
    $liquidation = Liquidation::create([
        'control_no' => $controlNo,
        'hei_id' => $w['hei']->id,
        'processing_region_id' => $w['region']->id,
        'program_id' => $w['program']->id,
        'academic_year_id' => $w['academicYear']->id,
        'liquidation_status_id' => LiquidationStatus::unliquidated()?->id,
        'created_by' => $w['user']->id,
        'import_batch_id' => $w['batch']->id,
        'date_submitted' => $dateSubmitted,
    ]);

    $liquidation->createOrUpdateFinancial([
        'date_fund_released' => '2026-01-15',
        'amount_received' => 100000,
        'amount_disbursed' => 100000,
        'amount_liquidated' => 0,
        'number_of_grantees' => 10,
    ]);

    return $liquidation;
}

it('records an undone import as one summary entry, not one per record', function () {
    $w = undoLogWorld();
    collect(['TES-2026-0001', 'TES-2026-0002', 'TES-2026-0003'])
        ->each(fn ($no) => undoLogLiquidation($w, $no));

    ActivityLog::query()->delete(); // ignore the setup's own entries

    $response = $this->actingAs($w['user'])
        ->postJson("/liquidation/import-batches/{$w['batch']->id}/undo")
        ->assertOk();

    expect($response->json('deleted'))->toBe(3)
        ->and($response->json('skipped'))->toBe(0);

    // The whole point: three deletions, one log entry.
    expect(ActivityLog::count())->toBe(1)
        ->and(ActivityLog::where('action', 'deleted')->count())->toBe(0);

    $entry = ActivityLog::first();

    expect($entry->action)->toBe('undo_import_batch')
        ->and($entry->module)->toBe('Liquidation')
        ->and($entry->description)->toContain('TES-2026-Q1.xlsx')
        ->and($entry->description)->toContain('deleted 3 liquidation(s)')
        // Subject makes the entry linkable back to the import history. The column
        // holds the FQCN; ActivityLogController class_basename()s it on the way out,
        // which is the "ImportBatch" key the frontend's subjectRouteMap expects.
        ->and($entry->subject_type)->toBe(ImportBatch::class)
        ->and(class_basename($entry->subject_type))->toBe('ImportBatch')
        ->and($entry->subject_id)->toBe($w['batch']->id);

    // Both sides are needed or the log UI hides the "View changes" panel.
    expect($entry->old_values)->not->toBeNull()
        ->and($entry->new_values)->not->toBeNull()
        ->and($entry->old_values['Liquidations in batch'])->toContain('TES-2026-0001');

    expect(Liquidation::withTrashed()->where('import_batch_id', $w['batch']->id)->count())->toBe(0)
        ->and($w['batch']->fresh()->status)->toBe('undone');
});

it('keeps already-submitted records and says so in the same one entry', function () {
    $w = undoLogWorld();
    undoLogLiquidation($w, 'TES-2026-0001');
    undoLogLiquidation($w, 'TES-2026-0002', dateSubmitted: '2026-02-01');

    ActivityLog::query()->delete();

    $response = $this->actingAs($w['user'])
        ->postJson("/liquidation/import-batches/{$w['batch']->id}/undo")
        ->assertOk();

    expect($response->json('deleted'))->toBe(1)
        ->and($response->json('skipped'))->toBe(1);

    expect(ActivityLog::count())->toBe(1);

    $entry = ActivityLog::first();

    expect($entry->description)->toContain('deleted 1 liquidation(s)')
        ->and($entry->description)->toContain('skipped 1 already submitted');

    // The submitted one survives; only the draft row is gone.
    expect(Liquidation::where('import_batch_id', $w['batch']->id)->pluck('control_no')->all())
        ->toBe(['TES-2026-0002']);
});

it('caps the control numbers it lists so a big batch cannot bloat one column', function () {
    $w = undoLogWorld();
    foreach (range(1, 105) as $i) {
        undoLogLiquidation($w, sprintf('TES-2026-%04d', $i));
    }

    ActivityLog::query()->delete();

    $this->actingAs($w['user'])
        ->postJson("/liquidation/import-batches/{$w['batch']->id}/undo")
        ->assertOk();

    $listed = ActivityLog::first()->old_values['Liquidations in batch'];

    expect(substr_count($listed, 'TES-2026-'))->toBe(100)
        ->and($listed)->toContain('(+5 more)');
});

/**
 * Bump updated_at past created_at without going through Eloquent, so the change is
 * deterministic (an immediate ->update() can land in the same second) and fires no
 * model events of its own.
 */
function undoLogMarkEdited(Liquidation $liquidation): void
{
    DB::table('liquidations')
        ->where('id', $liquidation->id)
        ->update(['updated_at' => $liquidation->created_at->copy()->addMinutes(5)]);
}

function undoLogPreview(User $user, string $batchId): array
{
    return test()->actingAs($user)
        ->getJson("/liquidation/import-batches/{$batchId}/undo-preview")
        ->assertOk()
        ->json();
}

it('does not flag records the import only just created', function () {
    $w = undoLogWorld();
    undoLogLiquidation($w, 'TES-2026-0001');
    undoLogLiquidation($w, 'TES-2026-0002');

    $preview = undoLogPreview($w['user'], $w['batch']->id);

    expect($preview['deletable'])->toBe(2)
        ->and($preview['modified_count'])->toBe(0)
        ->and($preview['modified_samples'])->toBe([]);
});

it('flags a record whose own row was edited after import', function () {
    $w = undoLogWorld();
    undoLogLiquidation($w, 'TES-2026-0001');
    undoLogMarkEdited(undoLogLiquidation($w, 'TES-2026-0002'));

    $preview = undoLogPreview($w['user'], $w['batch']->id);

    expect($preview['modified_count'])->toBe(1)
        ->and($preview['modified_samples'])->toBe(['TES-2026-0002']);
});

it('flags a record that only has attached work, with no field edit', function () {
    $w = undoLogWorld();
    $untouched = undoLogLiquidation($w, 'TES-2026-0001');
    $withRunningData = undoLogLiquidation($w, 'TES-2026-0002');
    $withDocument = undoLogLiquidation($w, 'TES-2026-0003');

    // Neither of these bumps the liquidation row itself - the point is that the
    // attached work alone is enough to flag it.
    LiquidationRunningData::create([
        'liquidation_id' => $withRunningData->id,
        'total_amount_liquidated' => 500,
    ]);

    LiquidationDocument::create([
        'liquidation_id' => $withDocument->id,
        'document_type' => 'Receipt',
        'file_name' => 'receipt.pdf',
        'file_path' => 'docs/receipt.pdf',
        'uploaded_by' => $w['user']->id,
    ]);

    $preview = undoLogPreview($w['user'], $w['batch']->id);

    expect($preview['modified_count'])->toBe(2)
        ->and($preview['modified_samples'])->toBe(['TES-2026-0002', 'TES-2026-0003'])
        ->and($untouched->fresh())->not->toBeNull();
});

it('counts an edited but already-submitted record as skipped, not at risk', function () {
    $w = undoLogWorld();
    undoLogMarkEdited(undoLogLiquidation($w, 'TES-2026-0001', dateSubmitted: '2026-02-01'));

    $preview = undoLogPreview($w['user'], $w['batch']->id);

    // It is edited, but undo would never touch it, so it is not something at risk.
    expect($preview['skipped'])->toBe(1)
        ->and($preview['deletable'])->toBe(0)
        ->and($preview['modified_count'])->toBe(0);
});

it('caps how many edited control numbers the confirmation names', function () {
    $w = undoLogWorld();
    foreach (range(1, 8) as $i) {
        undoLogMarkEdited(undoLogLiquidation($w, sprintf('TES-2026-%04d', $i)));
    }

    $preview = undoLogPreview($w['user'], $w['batch']->id);

    expect($preview['modified_count'])->toBe(8)
        ->and($preview['modified_samples'])->toHaveCount(5);
});

it('refuses a preview of a batch the user cannot undo', function () {
    $w = undoLogWorld();
    undoLogLiquidation($w, 'TES-2026-0001');

    $otherRole = Role::create(['name' => 'Regional Coordinator', 'description' => 'RC']);
    $outsider = User::factory()->create(['role_id' => $otherRole->id, 'status' => 'active']);

    $this->actingAs($outsider)
        ->getJson("/liquidation/import-batches/{$w['batch']->id}/undo-preview")
        ->assertForbidden();
});

it('records how many edited records an undo took with it', function () {
    $w = undoLogWorld();
    undoLogLiquidation($w, 'TES-2026-0001');
    undoLogMarkEdited(undoLogLiquidation($w, 'TES-2026-0002'));

    ActivityLog::query()->delete();

    $this->actingAs($w['user'])
        ->postJson("/liquidation/import-batches/{$w['batch']->id}/undo")
        ->assertOk();

    expect(ActivityLog::count())->toBe(1)
        ->and(ActivityLog::first()->description)
        ->toContain('1 of which had been edited since import');
});
