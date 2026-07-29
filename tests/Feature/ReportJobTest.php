<?php

use App\Exceptions\ReportStorageException;
use App\Jobs\GenerateLiquidationReportJob;
use App\Models\Notification;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\LiquidationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

function reportJobUser(): User
{
    $role = Role::create([
        'name' => 'Admin',
        'description' => 'Admin',
    ]);

    $permission = Permission::create([
        'name' => 'view_liquidation',
        'module' => 'Liquidation',
        'description' => 'View liquidations',
    ]);
    $role->permissions()->attach($permission);

    return User::factory()->create([
        'role_id' => $role->id,
        'status' => 'active',
    ]);
}

/** The shape LiquidationService::buildReportPayload() returns for a zero-row result. */
function emptyReportPayload(User $user): array
{
    return [
        'liquidations' => collect(),
        'programSummary' => collect(),
        'totals' => [
            'grantees' => 0,
            'disbursements' => 0,
            'liquidated' => 0,
            'unliquidated' => 0,
            'for_endorsement' => 0,
        ],
        'activeFilters' => '',
        'regionName' => 'Central Office',
        'printedBy' => $user->name,
        'truncated' => false,
        'totalMatching' => 0,
        'rowCap' => LiquidationService::REPORT_ROW_CAP,
    ];
}

test('queuing a report returns a server-issued request id and dispatches it with the job', function () {
    Queue::fake();
    $user = reportJobUser();

    $response = $this->actingAs($user)->postJson(route('reports.queue'), [
        'format' => 'print',
        'search' => 'TES-2026',
    ]);

    $response
        ->assertStatus(202)
        ->assertJsonPath('queued', true)
        ->assertJsonStructure(['request_id']);

    $requestId = $response->json('request_id');

    expect(Str::isUuid($requestId))->toBeTrue();

    Queue::assertPushed(
        GenerateLiquidationReportJob::class,
        fn (GenerateLiquidationReportJob $job) => $job->userId === $user->id
            && $job->format === 'print'
            && $job->requestId === $requestId
            && $job->filters['search'] === 'TES-2026',
    );
});

test('report status follows the exact request and is scoped to its owner', function () {
    $user = reportJobUser();
    $otherUser = User::factory()->create([
        'role_id' => $user->role_id,
        'status' => 'active',
    ]);
    $requestId = (string) Str::uuid();

    $this->actingAs($user)
        ->getJson(route('reports.status', $requestId))
        ->assertOk()
        ->assertExactJson(['status' => 'pending']);

    $notification = Notification::create([
        'user_id' => $user->id,
        'actor_id' => $user->id,
        'actor_name' => $user->name,
        'action' => 'report_ready',
        'description' => 'Your Print view report is ready (12 records).',
        'module' => 'Report',
        'metadata' => [
            'kind' => 'print',
            'file_path' => 'liquidation_reports/example.html',
            'file_name' => 'liquidation-report.html',
            'request_id' => $requestId,
            'auto_delivered' => false,
        ],
    ]);

    $this->actingAs($user)
        ->getJson(route('reports.status', $requestId))
        ->assertOk()
        ->assertJsonPath('status', 'ready')
        ->assertJsonPath('notification.id', $notification->id)
        ->assertJsonPath('notification.metadata.request_id', $requestId);

    $this->actingAs($otherUser)
        ->getJson(route('reports.status', $requestId))
        ->assertOk()
        ->assertExactJson(['status' => 'pending']);
});

test('report status exposes a correlated generation failure', function () {
    $user = reportJobUser();
    $requestId = (string) Str::uuid();

    Notification::create([
        'user_id' => $user->id,
        'actor_id' => $user->id,
        'actor_name' => $user->name,
        'action' => 'report_failed',
        'description' => 'Your print report could not be generated.',
        'module' => 'Report',
        'metadata' => [
            'kind' => 'print',
            'request_id' => $requestId,
        ],
    ]);

    $this->actingAs($user)
        ->getJson(route('reports.status', $requestId))
        ->assertOk()
        ->assertJsonPath('status', 'failed')
        ->assertJsonPath('notification.description', 'Your print report could not be generated.');
});

test('report generation uses its dedicated disk instead of the global upload disk', function () {
    config()->set('filesystems.default', 's3');
    config()->set('filesystems.reports', 'local');
    Storage::fake('local');

    $user = reportJobUser();
    $requestId = (string) Str::uuid();
    $service = Mockery::mock(LiquidationService::class);
    $service->shouldReceive('buildReportPayload')
        ->once()
        ->withArgs(fn (User $requestedBy, array $filters) => $requestedBy->is($user) && $filters === [])
        ->andReturn(emptyReportPayload($user));

    (new GenerateLiquidationReportJob(
        userId: $user->id,
        format: 'csv',
        filters: [],
        requestId: $requestId,
    ))->handle($service);

    $notification = Notification::where('action', 'report_ready')->sole();

    expect($notification->metadata['storage_disk'])->toBe('local')
        ->and($notification->metadata['request_id'])->toBe($requestId);
    Storage::disk('local')->assertExists($notification->metadata['file_path']);
});

test('report generation falls back to the local disk when the configured one cannot be built', function () {
    // Mirrors a deleted S3 bucket: the disk is configured but has no credentials,
    // so the AWS client throws before a single row is written.
    config()->set('filesystems.reports', 's3');
    config()->set('filesystems.disks.s3.key', null);
    config()->set('filesystems.disks.s3.secret', null);
    config()->set('filesystems.disks.s3.region', null);
    config()->set('filesystems.disks.s3.bucket', null);
    Storage::fake('local');

    $user = reportJobUser();
    $service = Mockery::mock(LiquidationService::class);
    $service->shouldReceive('buildReportPayload')
        ->once()
        ->andReturn(emptyReportPayload($user));

    (new GenerateLiquidationReportJob(
        userId: $user->id,
        format: 'csv',
        filters: [],
        requestId: (string) Str::uuid(),
    ))->handle($service);

    $notification = Notification::where('action', 'report_ready')->sole();

    expect($notification->metadata['storage_disk'])->toBe('local');
    Storage::disk('local')->assertExists($notification->metadata['file_path']);
});

test('a job queued before request ids existed still records a failure notification', function () {
    $user = reportJobUser();

    // Payloads serialized against the old class shape deserialize without
    // $requestId; a readonly promoted property does not get its default back.
    $job = (new ReflectionClass(GenerateLiquidationReportJob::class))->newInstanceWithoutConstructor();
    foreach (['userId' => $user->id, 'format' => 'print', 'filters' => []] as $property => $value) {
        $reflected = new ReflectionProperty(GenerateLiquidationReportJob::class, $property);
        $reflected->setValue($job, $value);
    }

    $job->failed(new RuntimeException('boom'));

    $notification = Notification::where('action', 'report_failed')->sole();

    expect($notification->metadata['request_id'])->toBeNull()
        ->and($notification->metadata['error'])->toBe('boom')
        ->and($notification->description)->toContain('Print view');
});

test('a storage failure tells the user to contact an administrator instead of retrying', function () {
    $user = reportJobUser();

    (new GenerateLiquidationReportJob(
        userId: $user->id,
        format: 'excel',
        filters: [],
        requestId: (string) Str::uuid(),
    ))->failed(new ReportStorageException('disk gone'));

    $notification = Notification::where('action', 'report_failed')->sole();

    expect($notification->description)
        ->toBe("We couldn't save your Excel report — report storage is unavailable. Please contact an administrator.");
});

test('report downloads use the disk captured during generation', function () {
    config()->set('filesystems.default', 's3');
    config()->set('filesystems.reports', 'local');
    Storage::fake('local');

    $user = reportJobUser();
    $path = "liquidation_reports/{$user->id}/report.html";
    Storage::disk('local')->put($path, '<html><body>Report ready</body></html>');

    $notification = Notification::create([
        'user_id' => $user->id,
        'actor_id' => $user->id,
        'actor_name' => $user->name,
        'action' => 'report_ready',
        'description' => 'Your Print view report is ready (1 record).',
        'module' => 'Report',
        'metadata' => [
            'kind' => 'print',
            'file_path' => $path,
            'file_name' => 'liquidation-report.html',
            'storage_disk' => 'local',
            'request_id' => (string) Str::uuid(),
            'auto_delivered' => false,
        ],
    ]);

    $this->actingAs($user)
        ->get(route('reports.download', $notification))
        ->assertOk()
        ->assertHeader('content-type', 'text/html; charset=UTF-8')
        ->assertStreamedContent('<html><body>Report ready</body></html>');
});

test('downloading a report whose disk no longer exists returns 410 rather than 500', function () {
    config()->set('filesystems.reports', 's3');
    config()->set('filesystems.disks.s3.key', null);
    config()->set('filesystems.disks.s3.secret', null);
    config()->set('filesystems.disks.s3.region', null);
    config()->set('filesystems.disks.s3.bucket', null);

    $user = reportJobUser();

    // Pre-dates the storage_disk metadata, so download() falls back to config.
    $notification = Notification::create([
        'user_id' => $user->id,
        'actor_id' => $user->id,
        'actor_name' => $user->name,
        'action' => 'report_ready',
        'description' => 'Your Excel report is ready (5 records).',
        'module' => 'Report',
        'metadata' => [
            'kind' => 'excel',
            'file_path' => "liquidation_reports/{$user->id}/legacy.xlsx",
            'file_name' => 'liquidation-report.xlsx',
            'auto_delivered' => false,
        ],
    ]);

    $this->actingAs($user)
        ->get(route('reports.download', $notification))
        ->assertStatus(410);
});
