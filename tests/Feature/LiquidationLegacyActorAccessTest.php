<?php

use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\LiquidationStatus;
use App\Models\Permission;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

uses(RefreshDatabase::class);

/**
 * @param  list<string>  $permissionNames
 */
function legacyActorAccessUser(string $roleName, array $permissionNames, ?Region $region = null): User
{
    $role = Role::create([
        'name' => $roleName,
        'description' => "{$roleName} regression test role",
    ]);

    $permissions = collect($permissionNames)->map(fn (string $name) => Permission::create([
        'name' => $name,
        'module' => 'Liquidation',
        'description' => "Test {$name}",
    ]));

    $role->permissions()->sync($permissions->pluck('id'));

    return User::factory()->create([
        'role_id' => $role->id,
        'region_id' => $region?->id,
        'status' => 'active',
    ]);
}

function legacyActorAccessRegion(string $code, string $name): Region
{
    return Region::create([
        'code' => $code,
        'name' => $name,
        'status' => 'active',
    ]);
}

function legacyActorAccessHei(string $uii, Region $region): HEI
{
    return HEI::create([
        'uii' => $uii,
        'code' => $uii,
        'name' => "{$uii} University",
        'type' => 'SUC',
        'region_id' => $region->id,
        'status' => 'active',
    ]);
}

function legacyActorAccessProgram(): Program
{
    return Program::create([
        'code' => 'LEGACY-ACTOR-TES',
        'name' => 'Legacy Actor Access Program',
        'status' => 'active',
    ]);
}

test('a processing-only RC cannot reassign a historical liquidation to another HEI in its region', function () {
    $processingRegion = legacyActorAccessRegion('R12', 'Region XII');
    $currentRegion = legacyActorAccessRegion('BARMM', 'Bangsamoro Autonomous Region in Muslim Mindanao');
    $processingRc = legacyActorAccessUser(
        'Regional Coordinator',
        ['view_liquidation', 'edit_liquidation'],
        $processingRegion,
    );

    $transferredHei = legacyActorAccessHei('TRANSFERRED-HEI', $currentRegion);
    $otherProcessingRegionHei = legacyActorAccessHei('OTHER-R12-HEI', $processingRegion);
    $liquidation = Liquidation::create([
        'control_no' => 'LEGACY-ACTOR-0001',
        'hei_id' => $transferredHei->id,
        'processing_region_id' => $processingRegion->id,
        'program_id' => legacyActorAccessProgram()->id,
        'created_by' => $processingRc->id,
    ]);

    expect($processingRc->can('edit', $liquidation))->toBeTrue();

    $this->actingAs($processingRc)
        ->putJson(route('liquidation.update', $liquidation), [
            'hei_id' => $otherProcessingRegionHei->id,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('hei_id');

    expect($liquidation->fresh()->hei_id)->toBe($transferredHei->id);
});

test('an Encoder can edit an editable liquidation it created', function () {
    $region = legacyActorAccessRegion('R12', 'Region XII');
    $encoder = legacyActorAccessUser('Encoder', ['view_liquidation', 'edit_liquidation'], $region);
    $hei = legacyActorAccessHei('ENCODER-HEI', $region);
    $unliquidated = LiquidationStatus::where('code', LiquidationStatus::CODE_UNLIQUIDATED)->firstOrFail();
    $liquidation = Liquidation::create([
        'control_no' => 'LEGACY-ACTOR-0002',
        'hei_id' => $hei->id,
        'processing_region_id' => $region->id,
        'program_id' => legacyActorAccessProgram()->id,
        'liquidation_status_id' => $unliquidated->id,
        'created_by' => $encoder->id,
    ]);

    expect($liquidation->isEditableByHEI())->toBeTrue()
        ->and($encoder->can('edit', $liquidation))->toBeTrue();

    $this->actingAs($encoder)
        ->put(route('liquidation.update', $liquidation), [
            'remarks' => 'Updated by the Encoder who created this record.',
        ])
        ->assertRedirect();

    expect($liquidation->fresh()->remarks)->toBe('Updated by the Encoder who created this record.');
});

test('an Encoder can import beneficiaries into an editable liquidation it created', function () {
    $region = legacyActorAccessRegion('R12', 'Region XII');
    $encoder = legacyActorAccessUser('Encoder', ['view_liquidation', 'edit_liquidation'], $region);
    $hei = legacyActorAccessHei('ENCODER-BENEFICIARY-HEI', $region);
    $unliquidated = LiquidationStatus::where('code', LiquidationStatus::CODE_UNLIQUIDATED)->firstOrFail();
    $liquidation = Liquidation::create([
        'control_no' => 'LEGACY-ACTOR-0003',
        'hei_id' => $hei->id,
        'processing_region_id' => $region->id,
        'program_id' => legacyActorAccessProgram()->id,
        'liquidation_status_id' => $unliquidated->id,
        'created_by' => $encoder->id,
    ]);

    $spreadsheet = new Spreadsheet;
    $spreadsheet->getActiveSheet()->fromArray([
        ['Student No.', 'Last Name', 'First Name', 'Middle Name', 'Extension Name', 'Award No.', 'Date Disbursed', 'Amount', 'Remarks'],
        ['2026-0001', 'Santos', 'Ana', '', '', 'AWARD-001', '2026-07-15', 1250.50, 'Imported by Encoder'],
    ]);

    $path = storage_path('framework/testing/encoder-beneficiaries-'.Str::uuid().'.xlsx');
    (new Xlsx($spreadsheet))->save($path);
    $spreadsheet->disconnectWorksheets();

    try {
        $response = $this->actingAs($encoder)->post(
            route('liquidation.import-beneficiaries', $liquidation),
            [
                'beneficiary_file' => new UploadedFile(
                    $path,
                    'beneficiaries.xlsx',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    null,
                    true,
                ),
            ],
        );

        $response->assertRedirect()->assertSessionHas('success');
    } finally {
        if (is_file($path)) {
            unlink($path);
        }
    }

    $this->assertDatabaseHas('liquidation_beneficiaries', [
        'liquidation_id' => $liquidation->id,
        'student_no' => '2026-0001',
        'last_name' => 'Santos',
        'first_name' => 'Ana',
        'award_no' => 'AWARD-001',
        'amount' => 1250.50,
    ]);

    expect((float) $liquidation->fresh()->financial?->amount_liquidated)->toBe(1250.50);
});
