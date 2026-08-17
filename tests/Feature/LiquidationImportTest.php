<?php

use App\Jobs\BulkImportLiquidationsJob;
use App\Models\AcademicYear;
use App\Models\HEI;
use App\Models\ImportBatch;
use App\Models\Liquidation;
use App\Models\LiquidationFinancial;
use App\Models\Permission;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\User;
use App\Services\DashboardCache;
use App\Services\HEIRegionTransferService;
use App\Services\LiquidationImportService;
use App\Services\LiquidationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

/**
 * The import cache is pinned to the file store (not the array store phpunit.xml
 * configures), so it survives between tests unless we clear it.
 */
beforeEach(function () {
    Cache::store('file')->flush();
});

function importUser(): User
{
    $role = Role::create(['name' => 'Admin', 'description' => 'Admin']);

    return User::factory()->create(['role_id' => $role->id, 'status' => 'active']);
}

/**
 * Minimum reference data for a row to validate cleanly.
 */
function importReferenceData(): array
{
    $region = Region::create(['code' => 'R12', 'name' => 'Region XII', 'status' => 'active']);

    return [
        'hei' => HEI::create([
            'uii' => '12345',
            'code' => 'TESTHEI',
            'name' => 'Test College',
            'type' => 'Private',
            'region_id' => $region->id,
            'status' => 'active',
        ]),
        'program' => Program::create(['code' => 'TES', 'name' => 'Tertiary Education Subsidy', 'status' => 'active']),
        'academicYear' => AcademicYear::create([
            'code' => '2025-2026',
            'name' => 'AY 2025-2026',
            'start_date' => '2025-08-01',
            'end_date' => '2026-07-31',
            'sort_order' => 1,
            'is_active' => true,
        ]),
    ];
}

/**
 * A structured row in the shape the frontend worker posts.
 */
function importRow(int $row, string $controlNo = '', string $uii = '12345'): array
{
    return [
        'row' => $row,
        'seq' => (string) $row,
        'program' => 'TES',
        'uii' => $uii,
        'hei_name' => 'Test College',
        'academic_year' => '2025-2026',
        'semester' => '1ST',
        'batch_no' => '1',
        'control_no' => $controlNo,
        'grantees' => '10',
        'disbursements' => '100000',
        'amount_liquidated' => '0',
        'date_fund_released' => '2026-05-28',
        'due_date' => '',
        'doc_status' => '',
        'rc_notes' => '',
    ];
}

/**
 * A cache-ready row in the shape validateParsedImport() stores for the import step.
 */
function importableRow(array $refs, int $row): array
{
    return [
        'hei_id' => $refs['hei']->id,
        'hei_name' => 'Test College',
        'program_id' => $refs['program']->id,
        'academic_year_id' => $refs['academicYear']->id,
        'semester_id' => null,
        'batch_no' => '1',
        'document_status_id' => null,
        'rc_note_status_id' => null,
        'liquidation_status_id' => null,
        'explicit_control_no' => null,
        'date_fund_released' => '2026-05-28',
        'due_date' => '2026-08-26',
        'number_of_grantees' => 10,
        'ledger_breakdown' => null,
        'amount_received' => 100000,
        'amount_disbursed' => 100000,
        'amount_liquidated' => 0,
        'row_no' => $row + 1,
        'seq' => (string) $row,
        'program_code' => 'TES',
        'uii' => '12345',
    ];
}

// ── Import session token ──────────────────────────────────────────────────────

test('the import token stays a uuid when rows carry control numbers', function () {
    // Regression: the ledger dedup loop used to reuse the $token variable, so the
    // returned "token" became the last ledger number in the chunk.
    $this->actingAs(importUser());

    $response = $this->postJson(route('liquidation.validate-parsed-import'), [
        'rows' => [importRow(2, 'TES-2026-0001')],
        'file_name' => 'import.xlsx',
    ])->assertOk();

    expect(Str::isUuid($response->json('token')))->toBeTrue();
});

test('chunks accumulate under one token instead of overwriting each other', function () {
    // Regression: a corrupted token meant each chunk wrote to a different cache
    // key, so only the final chunk survived to the import step.
    $this->actingAs(importUser());
    importReferenceData();

    $first = $this->postJson(route('liquidation.validate-parsed-import'), [
        'rows' => [importRow(2, 'TES-2026-0001'), importRow(3, 'TES-2026-0002')],
        'file_name' => 'import.xlsx',
    ])->assertOk();

    $token = $first->json('token');
    expect($first->json('summary.valid'))->toBe(2)
        ->and($first->json('row_count'))->toBe(2);

    $second = $this->postJson(route('liquidation.validate-parsed-import'), [
        'rows' => [importRow(4, 'TES-2026-0003')],
        'file_name' => 'import.xlsx',
        'import_token' => $token,
        'seen_control_nos' => $first->json('seen_control_nos'),
    ])->assertOk();

    // Same session, and the server now holds every valid row — not just the last chunk.
    expect($second->json('token'))->toBe($token)
        ->and($second->json('row_count'))->toBe(3);
});

test('a continuation chunk with an unknown token is rejected', function () {
    $this->actingAs(importUser());

    $this->postJson(route('liquidation.validate-parsed-import'), [
        'rows' => [importRow(2)],
        'import_token' => Str::uuid()->toString(),
    ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Import session expired. Please re-validate your file.');
});

test('a non-uuid import token is rejected by both import endpoints', function () {
    $this->actingAs(importUser());

    $this->postJson(route('liquidation.validate-parsed-import'), [
        'rows' => [importRow(2)],
        'import_token' => 'TES-2026-0001',
    ])->assertStatus(422);

    $this->postJson(route('liquidation.bulk-import'), [
        'import_token' => 'TES-2026-0001',
    ])->assertStatus(422);
});

test('within-file duplicate ledgers are still flagged across chunks', function () {
    $this->actingAs(importUser());
    importReferenceData();

    $first = $this->postJson(route('liquidation.validate-parsed-import'), [
        'rows' => [importRow(2, 'TES-2026-0001')],
    ])->assertOk();

    $second = $this->postJson(route('liquidation.validate-parsed-import'), [
        'rows' => [importRow(3, 'TES-2026-0001')],
        'import_token' => $first->json('token'),
        'seen_control_nos' => $first->json('seen_control_nos'),
    ])->assertOk();

    expect($second->json('summary.errors'))->toBe(1)
        ->and($second->json('rows.0.errors.0'))->toContain('appears more than once in this file');
});

// ── Preflight reconciliation ──────────────────────────────────────────────────

test('the import aborts before writing when the cache no longer matches the preview', function () {
    $user = importUser();
    $token = Str::uuid()->toString();

    // Two cached rows, but the client approved a preview of five.
    Cache::store('file')->put("liquidation_import_{$user->id}_{$token}", [
        'user_id' => $user->id,
        'file_name' => 'import.xlsx',
        'rows' => [['row_no' => 2], ['row_no' => 3]],
    ], now()->addMinutes(30));

    $this->actingAs($user)
        ->postJson(route('liquidation.bulk-import'), [
            'import_token' => $token,
            'offset' => 0,
            'limit' => 200,
            'expected_rows' => 5,
        ])
        ->assertStatus(422)
        ->assertJsonPath('success', false);

    // Nothing was attempted — no batch, no records.
    expect(ImportBatch::count())->toBe(0)
        ->and(Liquidation::withTrashed()->count())->toBe(0);
});

test('an import matching the preview is queued and completes', function () {
    // QUEUE_CONNECTION=sync in phpunit.xml, so dispatch runs the job inline and
    // the rows are already written by the time the response comes back.
    $user = importUser();
    $refs = importReferenceData();

    $token = Str::uuid()->toString();
    Cache::store('file')->put("liquidation_import_{$user->id}_{$token}", [
        'user_id' => $user->id,
        'file_name' => 'import.xlsx',
        'rows' => [importableRow($refs, 1)],
    ], now()->addMinutes(30));

    $response = $this->actingAs($user)
        ->postJson(route('liquidation.bulk-import'), [
            'import_token' => $token,
            'expected_rows' => 1,
        ])
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('total_rows', 1);

    $liquidation = Liquidation::sole();
    expect(Liquidation::count())->toBe(1)
        ->and($liquidation->processing_region_id)->toBe($refs['hei']->region_id);

    $batch = ImportBatch::find($response->json('batch_id'));
    expect($batch->status)->toBe(ImportBatch::STATUS_ACTIVE)
        ->and($batch->imported_count)->toBe(1)
        ->and($batch->failed_reason)->toBeNull();

    // The cached rows are released once the job finishes.
    expect(Cache::store('file')->has("liquidation_import_{$user->id}_{$token}"))->toBeFalse();
});

test('the import is dispatched to the queue rather than run in the request', function () {
    Queue::fake();

    $user = importUser();
    $refs = importReferenceData();

    $token = Str::uuid()->toString();
    Cache::store('file')->put("liquidation_import_{$user->id}_{$token}", [
        'user_id' => $user->id,
        'file_name' => 'import.xlsx',
        'rows' => [importableRow($refs, 1)],
    ], now()->addMinutes(30));

    $response = $this->actingAs($user)
        ->postJson(route('liquidation.bulk-import'), [
            'import_token' => $token,
            'expected_rows' => 1,
        ])
        ->assertOk();

    // Batch exists and is marked in-flight, but nothing is written yet.
    $batch = ImportBatch::find($response->json('batch_id'));
    expect($batch->status)->toBe(ImportBatch::STATUS_PROCESSING)
        ->and(Liquidation::count())->toBe(0);

    Queue::assertPushed(
        BulkImportLiquidationsJob::class,
        fn (BulkImportLiquidationsJob $job) => $job->importToken === $token
            && $job->batchId === $batch->id
            && $job->userId === $user->id,
    );
});

test('a regional import is rejected when the hei transfers after validation but before the queued job runs', function () {
    Queue::fake();

    $refs = importReferenceData();
    $barmm = Region::create([
        'code' => 'BARMM',
        'name' => 'Bangsamoro Autonomous Region in Muslim Mindanao',
        'status' => 'active',
    ]);
    $role = Role::create([
        'name' => 'Regional Coordinator',
        'description' => 'Regional Coordinator',
    ]);
    $user = User::factory()->create([
        'role_id' => $role->id,
        'region_id' => $refs['hei']->region_id,
        'status' => 'active',
    ]);

    $token = Str::uuid()->toString();
    Cache::store('file')->put("liquidation_import_{$user->id}_{$token}", [
        'user_id' => $user->id,
        'file_name' => 'region-12-import.xlsx',
        'rows' => [importableRow($refs, 1)],
    ], now()->addMinutes(30));

    $batchId = $this->actingAs($user)
        ->postJson(route('liquidation.bulk-import'), [
            'import_token' => $token,
            'expected_rows' => 1,
        ])
        ->assertOk()
        ->json('batch_id');

    $queuedJob = null;
    Queue::assertPushed(BulkImportLiquidationsJob::class, function (BulkImportLiquidationsJob $job) use (&$queuedJob) {
        $queuedJob = $job;

        return true;
    });

    // The preview was valid for Region XII, but ownership changed before a worker
    // picked it up. The worker must re-check current ownership at insert time.
    $adminRole = Role::create(['name' => 'Admin', 'description' => 'Admin']);
    $adminRole->permissions()->attach(
        Permission::where('name', 'transfer_hei_region')->value('id'),
    );
    $admin = User::factory()->create(['role_id' => $adminRole->id, 'status' => 'active']);

    $this->actingAs($admin);
    app(HEIRegionTransferService::class)->update(
        $refs['hei'],
        ['region_id' => $barmm->id],
        $admin,
        [
            'effective_date' => now()->toDateString(),
            'reason' => 'Ownership changed before the queued import executed.',
            'memo_reference' => 'TEST-MEMO',
        ],
    );
    $queuedJob->handle(app(LiquidationImportService::class));

    $batch = ImportBatch::findOrFail($batchId);
    expect(Liquidation::withTrashed()->count())->toBe(0)
        ->and($batch->status)->toBe(ImportBatch::STATUS_FAILED)
        ->and($batch->imported_count)->toBe(0)
        ->and($batch->failed_reason)->toContain('transferred')
        ->and($batch->failed_reason)->toContain('re-validate');
});

test('progress for an in-flight import is resumable without knowing the batch id', function () {
    // This is what lets a refreshed page re-attach to a running import.
    Queue::fake();

    $user = importUser();
    $refs = importReferenceData();

    $token = Str::uuid()->toString();
    Cache::store('file')->put("liquidation_import_{$user->id}_{$token}", [
        'user_id' => $user->id,
        'file_name' => 'import.xlsx',
        'rows' => [importableRow($refs, 1), importableRow($refs, 2)],
    ], now()->addMinutes(30));

    $this->actingAs($user)->postJson(route('liquidation.bulk-import'), [
        'import_token' => $token,
        'expected_rows' => 2,
    ])->assertOk();

    $this->actingAs($user)
        ->getJson(route('liquidation.import-progress'))
        ->assertOk()
        ->assertJsonPath('found', true)
        ->assertJsonPath('status', ImportBatch::STATUS_PROCESSING)
        ->assertJsonPath('total', 2)
        ->assertJsonPath('done', false);
});

test('a finished import is not rediscovered without a batch id', function () {
    // The banner polls in discovery mode. If a completed batch kept coming back,
    // it would announce the same import over and over on every page load.
    $user = importUser();
    $refs = importReferenceData();

    $token = Str::uuid()->toString();
    Cache::store('file')->put("liquidation_import_{$user->id}_{$token}", [
        'user_id' => $user->id,
        'file_name' => 'import.xlsx',
        'rows' => [importableRow($refs, 1)],
    ], now()->addMinutes(30));

    // Runs inline (QUEUE_CONNECTION=sync), so it is already complete.
    $batchId = $this->actingAs($user)->postJson(route('liquidation.bulk-import'), [
        'import_token' => $token,
        'expected_rows' => 1,
    ])->assertOk()->json('batch_id');

    $this->actingAs($user)
        ->getJson(route('liquidation.import-progress'))
        ->assertOk()
        ->assertJsonPath('found', false);

    // Still reachable by id, which is how a watcher sees the final result.
    $this->actingAs($user)
        ->getJson(route('liquidation.import-progress', ['batch_id' => $batchId]))
        ->assertOk()
        ->assertJsonPath('found', true)
        ->assertJsonPath('done', true)
        ->assertJsonPath('imported', 1);
});

test('a second import is refused while one is still running', function () {
    Queue::fake();

    $user = importUser();
    $refs = importReferenceData();

    foreach ([1, 2] as $attempt) {
        $token = Str::uuid()->toString();
        Cache::store('file')->put("liquidation_import_{$user->id}_{$token}", [
            'user_id' => $user->id,
            'file_name' => 'import.xlsx',
            'rows' => [importableRow($refs, $attempt)],
        ], now()->addMinutes(30));

        $response = $this->actingAs($user)->postJson(route('liquidation.bulk-import'), [
            'import_token' => $token,
            'expected_rows' => 1,
        ]);

        $attempt === 1
            ? $response->assertOk()
            : $response->assertStatus(422)->assertJsonPath('success', false);
    }

    expect(ImportBatch::count())->toBe(1);
});

test('undo is refused while the batch is still importing', function () {
    Queue::fake();

    $user = importUser();
    $refs = importReferenceData();

    $token = Str::uuid()->toString();
    Cache::store('file')->put("liquidation_import_{$user->id}_{$token}", [
        'user_id' => $user->id,
        'file_name' => 'import.xlsx',
        'rows' => [importableRow($refs, 1)],
    ], now()->addMinutes(30));

    $batchId = $this->actingAs($user)->postJson(route('liquidation.bulk-import'), [
        'import_token' => $token,
        'expected_rows' => 1,
    ])->assertOk()->json('batch_id');

    $this->actingAs($user)
        ->postJson(route('liquidation.undo-import-batch', ['batchId' => $batchId]))
        ->assertStatus(422)
        ->assertJsonPath('success', false);
});

// ── Recovering from a dead worker ─────────────────────────────────────────────

/**
 * Simulate a worker that vanished: the batch is left `processing` with its
 * updated_at frozen in the past. Written with a raw update so the timestamp
 * isn't touched by Eloquent.
 */
function stalledBatch(User $user, int $imported, int $total): ImportBatch
{
    $batch = ImportBatch::create([
        'user_id' => $user->id,
        'file_name' => 'import.xlsx',
        'total_rows' => $total,
        'imported_count' => $imported,
        'status' => ImportBatch::STATUS_PROCESSING,
    ]);

    DB::table('import_batches')
        ->where('id', $batch->id)
        ->update(['updated_at' => now()->subMinutes(5)]);

    return $batch->fresh();
}

test('a stalled batch that finished inserting is completed, not left hanging', function () {
    // The exact production incident: all rows written, but the job died before it
    // could flip the status, so the client polled an end that never came.
    $user = importUser();
    $batch = stalledBatch($user, 4334, 4334);

    $this->actingAs($user)
        ->getJson(route('liquidation.import-progress', ['batch_id' => $batch->id]))
        ->assertOk()
        ->assertJsonPath('done', true)
        ->assertJsonPath('failed', false)
        ->assertJsonPath('percent', 100)
        ->assertJsonPath('status', ImportBatch::STATUS_ACTIVE);

    expect($batch->fresh()->status)->toBe(ImportBatch::STATUS_ACTIVE)
        ->and($batch->fresh()->failed_reason)->toBeNull();
});

test('a stalled batch that stopped part-way is marked failed with a reason', function () {
    $user = importUser();
    $batch = stalledBatch($user, 1200, 4334);

    $response = $this->actingAs($user)
        ->getJson(route('liquidation.import-progress', ['batch_id' => $batch->id]))
        ->assertOk()
        ->assertJsonPath('done', true)
        ->assertJsonPath('failed', true);

    expect($response->json('failed_reason'))->toContain('1200 of 4334')
        ->and($batch->fresh()->status)->toBe(ImportBatch::STATUS_FAILED);
});

/** A batch still in `processing` whose last progress write was $seconds ago. */
function batchSilentFor(User $user, int $seconds, int $imported, int $total): ImportBatch
{
    $batch = ImportBatch::create([
        'user_id' => $user->id,
        'file_name' => 'import.xlsx',
        'total_rows' => $total,
        'imported_count' => $imported,
        'status' => ImportBatch::STATUS_PROCESSING,
    ]);

    DB::table('import_batches')
        ->where('id', $batch->id)
        ->update(['updated_at' => now()->subSeconds($seconds)]);

    return $batch->fresh();
}

test('a slow chunk is not mistaken for a dead worker', function () {
    // The regression that destroyed a real 4,334-row import. Progress can only be
    // written *between* chunks, because each chunk is a single transaction — so
    // the silence the client observes is exactly one chunk's duration. A chunk
    // that falls back to per-row inserts, or whose control-number scan runs
    // against a large table, can easily take a minute. Under the old 30-second
    // threshold the 2-second progress poll then declared a healthy, actively
    // inserting import dead, and the client killed its own job.
    $user = importUser();
    $batch = batchSilentFor($user, 60, 500, 4334);

    $this->actingAs($user)
        ->getJson(route('liquidation.import-progress', ['batch_id' => $batch->id]))
        ->assertOk()
        ->assertJsonPath('failed', false)
        ->assertJsonPath('done', false)
        ->assertJsonPath('status', ImportBatch::STATUS_PROCESSING);

    expect($batch->fresh()->status)->toBe(ImportBatch::STATUS_PROCESSING)
        ->and($batch->fresh()->failed_reason)->toBeNull();
});

test('a worker that really is gone is still caught', function () {
    // The other half: being generous with slow chunks must not mean a dead
    // worker leaves a batch stuck in `processing` forever, blocking undo and the
    // next import.
    $user = importUser();
    $batch = batchSilentFor($user, 600, 1200, 4334);

    $this->actingAs($user)
        ->getJson(route('liquidation.import-progress', ['batch_id' => $batch->id]))
        ->assertOk()
        ->assertJsonPath('failed', true);

    expect($batch->fresh()->status)->toBe(ImportBatch::STATUS_FAILED);
});

test('the queue cannot release a job that could still be running', function () {
    // retry_after must exceed the longest job's timeout. When it does not, the
    // queue decides a slow job was lost and hands it to a second worker — and
    // production runs two Horizon processes, so one is waiting. The result is the
    // same file imported twice. Pinned as a test because it is a silent,
    // data-corrupting failure that only shows up under load.
    $timeout = (new BulkImportLiquidationsJob('u', 't', 'b', 'k'))->timeout;

    foreach (['redis', 'database'] as $connection) {
        expect(config("queue.connections.{$connection}.retry_after"))
            ->toBeGreaterThan($timeout, "{$connection} retry_after must exceed the job timeout");
    }
});

test('a batch that reported progress recently is left alone', function () {
    // Guards against declaring a healthy, actively-working import dead.
    $user = importUser();
    $batch = ImportBatch::create([
        'user_id' => $user->id,
        'file_name' => 'import.xlsx',
        'total_rows' => 4334,
        'imported_count' => 500,
        'status' => ImportBatch::STATUS_PROCESSING,
    ]);

    $this->actingAs($user)
        ->getJson(route('liquidation.import-progress', ['batch_id' => $batch->id]))
        ->assertOk()
        ->assertJsonPath('done', false)
        ->assertJsonPath('status', ImportBatch::STATUS_PROCESSING);

    expect($batch->fresh()->status)->toBe(ImportBatch::STATUS_PROCESSING);
});

test('a fully inserted batch reports 100 percent but is not yet done', function () {
    // The percentage stays honest; `done` is what separates "finalising" from
    // "finished". Capping this at 99 instead produced "4,334 of 4,334 · 99%".
    $user = importUser();
    $batch = ImportBatch::create([
        'user_id' => $user->id,
        'file_name' => 'import.xlsx',
        'total_rows' => 4334,
        'imported_count' => 4334,
        'status' => ImportBatch::STATUS_PROCESSING,
    ]);

    expect($batch->progressPercent())->toBe(100);

    $this->actingAs($user)
        ->getJson(route('liquidation.import-progress', ['batch_id' => $batch->id]))
        ->assertOk()
        ->assertJsonPath('percent', 100)
        ->assertJsonPath('done', false)
        ->assertJsonPath('processed', 4334)
        ->assertJsonPath('total', 4334);
});

test('insert progress is reported proportionally part-way through', function () {
    $user = importUser();
    $batch = ImportBatch::create([
        'user_id' => $user->id,
        'file_name' => 'import.xlsx',
        'total_rows' => 4000,
        'imported_count' => 1000,
        'status' => ImportBatch::STATUS_PROCESSING,
    ]);

    expect($batch->progressPercent())->toBe(25);
});

test('a stalled batch stops blocking undo and further imports', function () {
    Queue::fake();

    $user = importUser();
    $refs = importReferenceData();
    stalledBatch($user, 4334, 4334);

    // Previously this returned "Another import is still running" for good.
    $token = Str::uuid()->toString();
    Cache::store('file')->put("liquidation_import_{$user->id}_{$token}", [
        'user_id' => $user->id,
        'file_name' => 'import.xlsx',
        'rows' => [importableRow($refs, 1)],
    ], now()->addMinutes(30));

    $this->actingAs($user)->postJson(route('liquidation.bulk-import'), [
        'import_token' => $token,
        'expected_rows' => 1,
    ])->assertOk();
});

test('undo becomes available once a stalled batch is reconciled', function () {
    $user = importUser();
    $batch = stalledBatch($user, 4334, 4334);

    // No longer rejected as "still running" — it reconciles to active and undoes.
    $this->actingAs($user)
        ->postJson(route('liquidation.undo-import-batch', ['batchId' => $batch->id]))
        ->assertOk();

    expect($batch->fresh()->status)->toBe(ImportBatch::STATUS_UNDONE);
});

// ── Control number allocation ─────────────────────────────────────────────────

test('generateControlNos allocates a run of numbers and fills gaps', function () {
    $user = importUser();
    $refs = importReferenceData();

    // Occupy 0001, 0002 and 0004, leaving 0003 as a gap.
    foreach (['TES-2026-0001', 'TES-2026-0002', 'TES-2026-0004'] as $controlNo) {
        Liquidation::create([
            'control_no' => $controlNo,
            'hei_id' => $refs['hei']->id,
            'program_id' => $refs['program']->id,
            'academic_year_id' => $refs['academicYear']->id,
            'created_by' => $user->id,
        ]);
    }

    $service = app(LiquidationService::class);

    expect($service->generateControlNos($refs['program']->id, 2026, 3))
        ->toBe(['TES-2026-0003', 'TES-2026-0005', 'TES-2026-0006']);

    // The single-number API is the same call with a count of one.
    expect($service->generateControlNo($refs['program']->id, 2026))->toBe('TES-2026-0003');
    expect($service->generateControlNos($refs['program']->id, 2026, 0))->toBe([]);
});

test('a bulk import chunk assigns a distinct control number to every row', function () {
    $user = importUser();
    $refs = importReferenceData();

    $token = Str::uuid()->toString();
    Cache::store('file')->put("liquidation_import_{$user->id}_{$token}", [
        'user_id' => $user->id,
        'file_name' => 'import.xlsx',
        'rows' => collect(range(1, 5))
            ->map(fn (int $i) => importableRow($refs, $i))
            ->all(),
    ], now()->addMinutes(30));

    $this->actingAs($user)
        ->postJson(route('liquidation.bulk-import'), [
            'import_token' => $token,
            'expected_rows' => 5,
        ])
        ->assertOk();

    expect(Liquidation::pluck('control_no')->sort()->values()->all())
        ->toBe(['TES-2026-0001', 'TES-2026-0002', 'TES-2026-0003', 'TES-2026-0004', 'TES-2026-0005']);
});

test('a bulk import writes financials and links every row to the batch', function () {
    $user = importUser();
    $refs = importReferenceData();

    $token = Str::uuid()->toString();
    Cache::store('file')->put("liquidation_import_{$user->id}_{$token}", [
        'user_id' => $user->id,
        'file_name' => 'import.xlsx',
        'rows' => collect(range(1, 3))->map(fn (int $i) => importableRow($refs, $i))->all(),
    ], now()->addMinutes(30));

    $batchId = $this->actingAs($user)->postJson(route('liquidation.bulk-import'), [
        'import_token' => $token,
        'expected_rows' => 3,
    ])->assertOk()->json('batch_id');

    // Bulk INSERTs bypass Eloquent, so assert the fields the model events would
    // otherwise have filled in.
    expect(Liquidation::where('import_batch_id', $batchId)->count())->toBe(3)
        ->and(LiquidationFinancial::count())->toBe(3);

    $liquidation = Liquidation::with('financial')->first();
    expect($liquidation->id)->not->toBeEmpty()
        ->and($liquidation->created_by)->toBe($user->id)
        ->and($liquidation->created_at)->not->toBeNull()
        ->and((float) $liquidation->financial->amount_received)->toBe(100000.0)
        ->and($liquidation->financial->number_of_grantees)->toBe(10)
        ->and($liquidation->financial->date_fund_released->format('Y-m-d'))->toBe('2026-05-28');
});

test('the dashboard cache is flushed once per import, not once per row', function () {
    $user = importUser();
    $refs = importReferenceData();

    $token = Str::uuid()->toString();
    Cache::store('file')->put("liquidation_import_{$user->id}_{$token}", [
        'user_id' => $user->id,
        'file_name' => 'import.xlsx',
        'rows' => collect(range(1, 10))->map(fn (int $i) => importableRow($refs, $i))->all(),
    ], now()->addMinutes(30));

    // Seed the version key so flushes are increments we can count.
    DashboardCache::flush();
    $before = (int) Cache::get('dashboard:version');

    $this->actingAs($user)->postJson(route('liquidation.bulk-import'), [
        'import_token' => $token,
        'expected_rows' => 10,
    ])->assertOk();

    // 10 rows = 20 model saves before; exactly one bump now.
    expect((int) Cache::get('dashboard:version') - $before)->toBe(1);
});

test('a bulk import stays within a bounded number of queries', function () {
    // Guards the optimisation: the old path cost 3 queries per row, so 50 rows
    // was ~150 queries plus ~200 cache round trips.
    $user = importUser();
    $refs = importReferenceData();

    $token = Str::uuid()->toString();
    Cache::store('file')->put("liquidation_import_{$user->id}_{$token}", [
        'user_id' => $user->id,
        'file_name' => 'import.xlsx',
        'rows' => collect(range(1, 50))->map(fn (int $i) => importableRow($refs, $i))->all(),
    ], now()->addMinutes(30));

    $queries = 0;
    DB::listen(function () use (&$queries) {
        $queries++;
    });

    $this->actingAs($user)->postJson(route('liquidation.bulk-import'), [
        'import_token' => $token,
        'expected_rows' => 50,
    ])->assertOk();

    // Measured at 18 — a fixed cost that does not scale with row count. The old
    // per-row path cost ~150 queries for the same 50 rows.
    expect(Liquidation::count())->toBe(50)
        ->and($queries)->toBeLessThan(25);
});

// ── Validation must see what the insert sees ──────────────────────────────────

test('a soft-deleted control number is flagged during validation, not at insert', function () {
    $user = importUser();
    $refs = importReferenceData();

    $liquidation = Liquidation::create([
        'control_no' => 'TES-2026-0001',
        'hei_id' => $refs['hei']->id,
        'program_id' => $refs['program']->id,
        'academic_year_id' => $refs['academicYear']->id,
        'created_by' => $user->id,
    ]);
    $liquidation->delete();

    // The number is still reserved by the unique index, so the preview must say so.
    $response = $this->actingAs($user)
        ->postJson(route('liquidation.validate-parsed-import'), [
            'rows' => [importRow(2, 'TES-2026-0001')],
        ])->assertOk();

    expect($response->json('summary.errors'))->toBe(1)
        ->and($response->json('rows.0.errors.0'))->toContain('already exists');
});
