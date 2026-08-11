<?php

use App\Models\ActivityLog;
use App\Models\DocumentRequirement;
use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\LiquidationDocument;
use App\Models\Notification;
use App\Models\Permission;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

/**
 * An RC letter lives in its own card, not under Document Requirements, but its
 * activity was logged as a plain 'uploaded_document'. The HEI clicking that
 * notification landed on the requirements list instead of the letter.
 *
 * The action is what the frontend maps to a section anchor
 * (resources/js/lib/liquidation-section.ts), so these lock in the split.
 *
 * @return array{liquidation: Liquidation, rc: User, hei_user: User, requirement: DocumentRequirement}
 */
function rcLetterFixture(): array
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
        'uii' => 'RCLETTER-HEI',
        'code' => 'RC-HEI',
        'name' => 'RC Letter Test University',
        'type' => 'SUC',
        'region_id' => $region->id,
        'status' => 'active',
    ]);
    $program = Program::create(['code' => 'RC-TES', 'name' => 'RC Letter Program', 'status' => 'active']);

    $rc = User::factory()->create(['role_id' => $rcRole->id, 'region_id' => $region->id, 'status' => 'active']);
    $heiUser = User::factory()->create([
        'role_id' => $heiRole->id,
        'region_id' => $region->id,
        'hei_id' => $hei->id,
        'status' => 'active',
    ]);

    $liquidation = Liquidation::create([
        'control_no' => 'RC-2026-0001',
        'hei_id' => $hei->id,
        'processing_region_id' => $region->id,
        'program_id' => $program->id,
        'created_by' => $rc->id,
    ]);

    $requirement = DocumentRequirement::create([
        'program_id' => $program->id,
        'code' => 'COE',
        'name' => 'Certificate of Enrolment',
        'is_active' => true,
        'sort_order' => 1,
    ]);

    return compact('liquidation', 'rc', 'heiUser', 'requirement') + ['hei_user' => $heiUser];
}

it('logs an RC letter upload under its own action so it can deep-link', function () {
    Storage::fake('s3');
    ['liquidation' => $liquidation, 'rc' => $rc, 'hei_user' => $heiUser] = rcLetterFixture();

    test()->actingAs($rc)
        ->post("/liquidation/{$liquidation->id}/upload-document", [
            'file' => UploadedFile::fake()->create('rc-letter.pdf', 100, 'application/pdf'),
            'document_type' => 'RC Letter',
        ])
        ->assertSuccessful();

    expect(ActivityLog::where('action', 'uploaded_rc_letter')->count())->toBe(1)
        ->and(ActivityLog::where('action', 'uploaded_document')->count())->toBe(0);

    // The HEI must still be told — only where the link points has changed.
    expect(Notification::where('user_id', $heiUser->id)->where('action', 'uploaded_rc_letter')->count())
        ->toBe(1);
});

it('keeps a requirement document on the original action', function () {
    Storage::fake('s3');
    ['liquidation' => $liquidation, 'rc' => $rc, 'requirement' => $requirement] = rcLetterFixture();

    test()->actingAs($rc)
        ->post("/liquidation/{$liquidation->id}/upload-document", [
            'file' => UploadedFile::fake()->create('enrolment.pdf', 100, 'application/pdf'),
            'document_requirement_id' => $requirement->id,
        ])
        ->assertSuccessful();

    // The existing behaviour for everything under Document Requirements is untouched.
    expect(ActivityLog::where('action', 'uploaded_document')->count())->toBe(1)
        ->and(ActivityLog::where('action', 'uploaded_rc_letter')->count())->toBe(0);
});

it('splits the delete action the same way', function () {
    Storage::fake('s3');
    ['liquidation' => $liquidation, 'rc' => $rc, 'requirement' => $requirement] = rcLetterFixture();

    $rcLetter = LiquidationDocument::create([
        'liquidation_id' => $liquidation->id,
        'document_requirement_id' => null,
        'document_type' => 'RC Letter',
        'file_name' => 'letter.pdf',
        'file_path' => 'liquidation_documents/letter.pdf',
        'file_type' => 'application/pdf',
        'file_size' => 100,
        'is_gdrive' => false,
        'uploaded_by' => $rc->id,
    ]);
    $requirementDoc = LiquidationDocument::create([
        'liquidation_id' => $liquidation->id,
        'document_requirement_id' => $requirement->id,
        'document_type' => 'Certificate of Enrolment',
        'file_name' => 'enrolment.pdf',
        'file_path' => 'liquidation_documents/enrolment.pdf',
        'file_type' => 'application/pdf',
        'file_size' => 100,
        'is_gdrive' => false,
        'uploaded_by' => $rc->id,
    ]);

    test()->actingAs($rc)->delete("/liquidation-documents/{$rcLetter->id}");
    test()->actingAs($rc)->delete("/liquidation-documents/{$requirementDoc->id}");

    expect(ActivityLog::where('action', 'deleted_rc_letter')->count())->toBe(1)
        ->and(ActivityLog::where('action', 'deleted_document')->count())->toBe(1);
});
