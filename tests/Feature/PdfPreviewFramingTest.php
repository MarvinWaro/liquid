<?php

use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\LiquidationDocument;
use App\Models\Permission;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

/**
 * The PDF preview came up blank on production while Download worked.
 *
 * The dialog framed a `blob:` URL, which the production CSP blocks under
 * `frame-src`. It now frames the app's own view route instead — but that route
 * inherits `X-Frame-Options: DENY` from SecurityHeaders, and DENY refuses framing
 * by every origin including our own. So the response opts down to SAMEORIGIN and
 * the middleware was taught not to overwrite a header a response already set.
 *
 * These lock both halves in place: the one route that must be framable is, and
 * everything else still is not.
 *
 * @return array{viewer: User, outsider: User, document: LiquidationDocument}
 */
function pdfPreviewFixture(): array
{
    $region = Region::create(['code' => 'R12-PDF', 'name' => 'Region XII PDF', 'status' => 'active']);

    $adminRole = Role::firstOrCreate(['name' => 'Super Admin'], ['description' => 'test']);
    $heiRole = Role::firstOrCreate(['name' => 'HEI'], ['description' => 'test']);

    $viewPermission = Permission::firstOrCreate(
        ['name' => 'view_liquidation'],
        ['module' => 'Liquidation', 'description' => 'Test view_liquidation']
    );

    // Both roles can view liquidations, so the outsider below is refused for the
    // reason that matters — the record is not theirs — rather than for lacking
    // the permission outright.
    $adminRole->permissions()->syncWithoutDetaching([$viewPermission->id]);
    $heiRole->permissions()->syncWithoutDetaching([$viewPermission->id]);

    $hei = HEI::create([
        'uii' => 'PDFPREVIEW-HEI',
        'code' => 'PDF-HEI',
        'name' => 'PDF Preview Test University',
        'type' => 'SUC',
        'region_id' => $region->id,
        'status' => 'active',
    ]);

    $otherHei = HEI::create([
        'uii' => 'PDFPREVIEW-OTHER',
        'code' => 'PDF-OTHER',
        'name' => 'Unrelated University',
        'type' => 'SUC',
        'region_id' => $region->id,
        'status' => 'active',
    ]);

    $program = Program::create(['code' => 'PDF-TES', 'name' => 'PDF Preview Program', 'status' => 'active']);

    $viewer = User::factory()->create([
        'role_id' => $adminRole->id,
        'region_id' => $region->id,
        'status' => 'active',
    ]);

    $outsider = User::factory()->create([
        'role_id' => $heiRole->id,
        'region_id' => $region->id,
        'hei_id' => $otherHei->id,
        'status' => 'active',
    ]);

    $liquidation = Liquidation::create([
        'control_no' => 'PDF-2026-0001',
        'hei_id' => $hei->id,
        'processing_region_id' => $region->id,
        'program_id' => $program->id,
        'created_by' => $viewer->id,
    ]);

    $document = LiquidationDocument::create([
        'liquidation_id' => $liquidation->id,
        'document_requirement_id' => null,
        'document_type' => 'RC Letter',
        'file_name' => 'letter.pdf',
        'file_path' => 'liquidation_documents/letter.pdf',
        'file_type' => 'application/pdf',
        'file_size' => 100,
        'is_gdrive' => false,
        'uploaded_by' => $viewer->id,
    ]);

    Storage::disk('s3')->put($document->file_path, '%PDF-1.4 fake');

    return compact('viewer', 'outsider', 'document');
}

it('lets our own page frame the inline document stream', function () {
    Storage::fake('s3');
    ['viewer' => $viewer, 'document' => $document] = pdfPreviewFixture();

    // Fails before the fix: SecurityHeaders overwrote this with DENY, which blocks
    // same-origin framing too — the preview would be blank even with no CSP.
    $response = test()->actingAs($viewer)
        ->get("/liquidation-documents/{$document->id}/view")
        ->assertOk();

    // Every value, not just the first. assertHeader() reads only the first one, so
    // it stayed green while the response actually carried SAMEORIGIN *and* DENY —
    // and a browser seeing two that disagree falls back to deny and blanks the frame.
    expect($response->headers->all('X-Frame-Options'))->toBe(['SAMEORIGIN']);
});

it('still streams the document inline as a PDF', function () {
    Storage::fake('s3');
    ['viewer' => $viewer, 'document' => $document] = pdfPreviewFixture();

    // The framing change must not disturb what the browser is actually handed.
    $response = test()->actingAs($viewer)
        ->get("/liquidation-documents/{$document->id}/view")
        ->assertOk();

    expect($response->headers->get('Content-Type'))->toContain('application/pdf')
        ->and($response->headers->get('Content-Disposition'))->toContain('inline')
        ->and($response->headers->get('Content-Disposition'))->toContain('letter.pdf');
});

it('answers the HEAD preflight the dialog sends before framing', function () {
    Storage::fake('s3');
    ['viewer' => $viewer, 'document' => $document] = pdfPreviewFixture();

    // The dialog checks access with HEAD first so an expired session shows the
    // error card instead of an empty frame. If HEAD stopped working, every
    // preview would fail at that step and never reach the iframe.
    $response = test()->actingAs($viewer)
        ->call('HEAD', "/liquidation-documents/{$document->id}/view");

    expect($response->getStatusCode())->toBe(200)
        ->and($response->headers->get('Content-Type'))->toContain('application/pdf');
});

it('keeps DENY on the download route beside it', function () {
    Storage::fake('s3');
    ['viewer' => $viewer, 'document' => $document] = pdfPreviewFixture();

    // The sibling route shares the middleware and was not opted down. This is what
    // proves the relaxation is scoped to the one response that needs it.
    $response = test()->actingAs($viewer)
        ->get("/liquidation-documents/{$document->id}/download")
        ->assertOk();

    expect($response->headers->all('X-Frame-Options'))->toBe(['DENY']);
});

it('keeps DENY on ordinary pages', function () {
    // Guards the middleware default. Letting a response opt out must not turn into
    // "stop setting the header" for everything that does not set its own.
    $response = test()->get('/login')->assertOk();

    expect($response->headers->all('X-Frame-Options'))->toBe(['DENY']);
});

it('still refuses a user who may not see the liquidation', function () {
    Storage::fake('s3');
    ['outsider' => $outsider, 'document' => $document] = pdfPreviewFixture();

    // Framing is a browser concern; authorisation is unchanged and still runs first.
    test()->actingAs($outsider)
        ->get("/liquidation-documents/{$document->id}/view")
        ->assertForbidden();
});
