<?php

use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\Notification;
use App\Models\Permission;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * STUFAPS Focals never received comment notifications, even with their programs
 * ticked on their user record.
 *
 * LiquidationPolicy scopes a Focal through User::getParentScopedProgramIds(), which
 * covers the assigned programs PLUS the sibling sub-programs under the same parent
 * (and, for an assigned parent, its children). LiquidationCommentController kept its
 * own stricter copy of that rule — `programs.id = $liquidation->program_id` — so a
 * Focal ticked against the parent or a sibling could open the record and still never
 * be picked as a recipient.
 *
 * Program tree used here:
 *   STUFAPS (parent)
 *     ├── TES
 *     └── TDP   ← the liquidation under test
 *   OTHER (parent)
 *     └── OTHER-SUB
 *
 * @return array<string, mixed>
 */
function focalNotifyFixture(): array
{
    $region = Region::create(['code' => 'R12-FOC', 'name' => 'Region XII Focal', 'status' => 'active']);

    $focalRole = Role::firstOrCreate(['name' => 'STUFAPS Focal'], ['description' => 'test']);
    $heiRole = Role::firstOrCreate(['name' => 'HEI'], ['description' => 'test']);
    $rcRole = Role::firstOrCreate(['name' => 'Regional Coordinator'], ['description' => 'test']);

    $viewPermission = Permission::firstOrCreate(
        ['name' => 'view_liquidation'],
        ['module' => 'Liquidation', 'description' => 'Test view_liquidation']
    );

    foreach ([$focalRole, $heiRole, $rcRole] as $role) {
        $role->permissions()->syncWithoutDetaching([$viewPermission->id]);
    }

    $stufaps = Program::create(['code' => 'FOC-STUFAPS', 'name' => 'STUFAPS', 'status' => 'active']);
    $tes = Program::create(['code' => 'FOC-TES', 'name' => 'TES', 'parent_id' => $stufaps->id, 'status' => 'active']);
    $tdp = Program::create(['code' => 'FOC-TDP', 'name' => 'TDP', 'parent_id' => $stufaps->id, 'status' => 'active']);

    $otherParent = Program::create(['code' => 'FOC-OTHER', 'name' => 'Other Umbrella', 'status' => 'active']);
    $otherSub = Program::create(['code' => 'FOC-OSUB', 'name' => 'Other Sub', 'parent_id' => $otherParent->id, 'status' => 'active']);

    $hei = HEI::create([
        'uii' => 'FOCAL-HEI',
        'code' => 'FOC-HEI',
        'name' => 'Focal Test University',
        'type' => 'SUC',
        'region_id' => $region->id,
        'status' => 'active',
    ]);

    $makeFocal = function (Program $assigned) use ($focalRole, $region) {
        $user = User::factory()->create([
            'role_id' => $focalRole->id,
            'region_id' => $region->id,
            'status' => 'active',
        ]);
        $user->programs()->attach($assigned->id);

        return $user;
    };

    // Ticked against the umbrella program, not the specific sub-program.
    $focalParent = $makeFocal($stufaps);
    // Ticked against a sibling of the liquidation's program.
    $focalSibling = $makeFocal($tes);
    // Ticked against the liquidation's own program — worked before the fix too.
    $focalDirect = $makeFocal($tdp);
    // Ticked under a different umbrella entirely — must stay out.
    $focalUnrelated = $makeFocal($otherSub);

    $heiUser = User::factory()->create([
        'role_id' => $heiRole->id,
        'region_id' => $region->id,
        'hei_id' => $hei->id,
        'status' => 'active',
    ]);

    $rc = User::factory()->create([
        'role_id' => $rcRole->id,
        'region_id' => $region->id,
        'status' => 'active',
    ]);

    $liquidation = Liquidation::create([
        'control_no' => 'FOC-2026-0001',
        'hei_id' => $hei->id,
        'processing_region_id' => $region->id,
        'program_id' => $tdp->id,
        'created_by' => $heiUser->id,
    ]);

    return compact(
        'liquidation', 'heiUser', 'region', 'rcRole', 'rc',
        'focalParent', 'focalSibling', 'focalDirect', 'focalUnrelated',
    );
}

/**
 * The shape that was still broken after the first fix: a TOP-LEVEL program with no
 * parent and no children, like the real TES and TDP rows.
 *
 * The controller used to pick RCs *or* Focals based on the program having a parent,
 * so a liquidation here queried RCs only and no Focal could be mentioned or notified.
 *
 * @return array<string, mixed>
 */
function standaloneProgramFixture(): array
{
    $region = Region::create(['code' => 'R12-STD', 'name' => 'Region XII Standalone', 'status' => 'active']);

    $focalRole = Role::firstOrCreate(['name' => 'STUFAPS Focal'], ['description' => 'test']);
    $heiRole = Role::firstOrCreate(['name' => 'HEI'], ['description' => 'test']);
    $rcRole = Role::firstOrCreate(['name' => 'Regional Coordinator'], ['description' => 'test']);

    $viewPermission = Permission::firstOrCreate(
        ['name' => 'view_liquidation'],
        ['module' => 'Liquidation', 'description' => 'Test view_liquidation']
    );

    foreach ([$focalRole, $heiRole, $rcRole] as $role) {
        $role->permissions()->syncWithoutDetaching([$viewPermission->id]);
    }

    // No parent, no children — exactly how TES and TDP are stored.
    $standalone = Program::create(['code' => 'STD-TES', 'name' => 'TES Standalone', 'status' => 'active']);
    $otherStandalone = Program::create(['code' => 'STD-OTHER', 'name' => 'Other Standalone', 'status' => 'active']);

    $hei = HEI::create([
        'uii' => 'STANDALONE-HEI',
        'code' => 'STD-HEI',
        'name' => 'Standalone Test University',
        'type' => 'SUC',
        'region_id' => $region->id,
        'status' => 'active',
    ]);

    $makeFocal = function (Program $assigned) use ($focalRole, $region) {
        $user = User::factory()->create([
            'role_id' => $focalRole->id,
            'region_id' => $region->id,
            'status' => 'active',
        ]);
        $user->programs()->attach($assigned->id);

        return $user;
    };

    $focal = $makeFocal($standalone);
    $focalOther = $makeFocal($otherStandalone);

    $heiUser = User::factory()->create([
        'role_id' => $heiRole->id,
        'region_id' => $region->id,
        'hei_id' => $hei->id,
        'status' => 'active',
    ]);

    $rc = User::factory()->create([
        'role_id' => $rcRole->id,
        'region_id' => $region->id,
        'status' => 'active',
    ]);

    // Admin and Super Admin sit in their own clause of the picker query, untouched by
    // this change — these two exist so a test can prove that rather than assume it.
    $adminRole = Role::firstOrCreate(['name' => 'Admin'], ['description' => 'test']);
    $superAdminRole = Role::firstOrCreate(['name' => 'Super Admin'], ['description' => 'test']);
    foreach ([$adminRole, $superAdminRole] as $role) {
        $role->permissions()->syncWithoutDetaching([$viewPermission->id]);
    }

    $admin = User::factory()->create(['role_id' => $adminRole->id, 'status' => 'active']);
    $superAdmin = User::factory()->create(['role_id' => $superAdminRole->id, 'status' => 'active']);

    $liquidation = Liquidation::create([
        'control_no' => 'STD-2026-0001',
        'hei_id' => $hei->id,
        'processing_region_id' => $region->id,
        'program_id' => $standalone->id,
        'created_by' => $heiUser->id,
    ]);

    return compact('liquidation', 'heiUser', 'rc', 'focal', 'focalOther', 'admin', 'superAdmin');
}

/** The ids the @ picker offers $actor on $liquidation. */
function mentionableIds(User $actor, Liquidation $liquidation): array
{
    return collect(
        test()->actingAs($actor)
            ->getJson("/liquidation/{$liquidation->id}/mentionable-users")
            ->assertSuccessful()
            ->json()
    )->pluck('id')->all();
}

/** Post a comment as $actor and return the user ids notified about it. */
function commentAndCollectNotified(User $actor, Liquidation $liquidation): array
{
    test()->actingAs($actor)
        ->post("/liquidation/{$liquidation->id}/comments", ['body' => 'Please review this document.'])
        ->assertSuccessful();

    return Notification::where('subject_id', $liquidation->id)
        ->where('action', 'commented_on_requirement')
        ->pluck('user_id')
        ->all();
}

it('notifies a Focal assigned to the parent program', function () {
    ['liquidation' => $liquidation, 'heiUser' => $heiUser, 'focalParent' => $focalParent] = focalNotifyFixture();

    // Ticked against STUFAPS, liquidation is on TDP. The policy lets them open it,
    // so the notification must reach them too. Fails before the fix.
    expect(commentAndCollectNotified($heiUser, $liquidation))->toContain($focalParent->id);
});

it('notifies a Focal assigned to a sibling sub-program', function () {
    ['liquidation' => $liquidation, 'heiUser' => $heiUser, 'focalSibling' => $focalSibling] = focalNotifyFixture();

    // Ticked against TES, liquidation is on TDP — same umbrella. Fails before the fix.
    expect(commentAndCollectNotified($heiUser, $liquidation))->toContain($focalSibling->id);
});

it('still notifies a Focal assigned to the exact program', function () {
    ['liquidation' => $liquidation, 'heiUser' => $heiUser, 'focalDirect' => $focalDirect] = focalNotifyFixture();

    // The one case that already worked. It must keep working.
    expect(commentAndCollectNotified($heiUser, $liquidation))->toContain($focalDirect->id);
});

it('leaves out a Focal under a different umbrella program', function () {
    ['liquidation' => $liquidation, 'heiUser' => $heiUser, 'focalUnrelated' => $focalUnrelated] = focalNotifyFixture();

    // Proves the fix defers to the policy rather than notifying every Focal in the
    // system. Without this the change would be a blanket broadcast.
    expect(commentAndCollectNotified($heiUser, $liquidation))->not->toContain($focalUnrelated->id);
});

it('offers the same Focals to the mention picker', function () {
    [
        'liquidation' => $liquidation, 'heiUser' => $heiUser,
        'focalParent' => $focalParent, 'focalSibling' => $focalSibling, 'focalUnrelated' => $focalUnrelated,
    ] = focalNotifyFixture();

    // The @ dropdown carried a second copy of the same narrow rule, so these Focals
    // could not be mentioned either. Recipients and mentionables must agree.
    $ids = mentionableIds($heiUser, $liquidation);

    expect($ids)->toContain($focalParent->id)
        ->and($ids)->toContain($focalSibling->id)
        ->and($ids)->not->toContain($focalUnrelated->id);
});

it('keeps RCs out of a sub-program liquidation', function () {
    ['liquidation' => $liquidation, 'heiUser' => $heiUser, 'rc' => $rc] = focalNotifyFixture();

    // LiquidationPolicy refuses an RC on a sub-program (`! $liquidation->program->parent_id`).
    // Gathering RCs and Focals together must not smuggle the RC past that rule.
    expect(mentionableIds($heiUser, $liquidation))->not->toContain($rc->id)
        ->and(commentAndCollectNotified($heiUser, $liquidation))->not->toContain($rc->id);
});

it('mentions and notifies a Focal on a top-level program like TES', function () {
    ['liquidation' => $liquidation, 'heiUser' => $heiUser, 'focal' => $focal] = standaloneProgramFixture();

    // The reported case. The program has no parent, so the old either/or gate queried
    // RCs only and this Focal was invisible to both paths. Fails before the fix.
    expect(mentionableIds($heiUser, $liquidation))->toContain($focal->id)
        ->and(commentAndCollectNotified($heiUser, $liquidation))->toContain($focal->id);
});

it('still leaves out a Focal assigned to a different top-level program', function () {
    ['liquidation' => $liquidation, 'heiUser' => $heiUser, 'focalOther' => $focalOther] = standaloneProgramFixture();

    // Proves the widened query still defers to the policy rather than listing every
    // Focal in the system.
    expect(mentionableIds($heiUser, $liquidation))->not->toContain($focalOther->id)
        ->and(commentAndCollectNotified($heiUser, $liquidation))->not->toContain($focalOther->id);
});

it('keeps RCs working on a top-level program', function () {
    ['liquidation' => $liquidation, 'heiUser' => $heiUser, 'rc' => $rc] = standaloneProgramFixture();

    // The behaviour that already worked and must not regress — this is the path the
    // BARMM and R12 records take.
    expect(mentionableIds($heiUser, $liquidation))->toContain($rc->id)
        ->and(commentAndCollectNotified($heiUser, $liquidation))->toContain($rc->id);
});

it('returns the mention list as a JSON array, not a keyed object', function () {
    ['liquidation' => $liquidation, 'heiUser' => $heiUser] = standaloneProgramFixture();

    // The dropdown renders on `mentionUsers.length`, which is undefined for a JSON
    // object — so a keyed shape shows nothing at all, with no error anywhere.
    // Collection::filter() preserves keys, so one rejected candidate at index 0 is
    // enough to turn the whole payload into {"1":…,"2":…}.
    //
    // Asserting on the decoded value is not enough: collect() and pluck() accept both
    // shapes, which is exactly how this slipped past the other tests here.
    $payload = test()->actingAs($heiUser)
        ->getJson("/liquidation/{$liquidation->id}/mentionable-users")
        ->assertSuccessful()
        ->json();

    expect($payload)->not->toBeEmpty()
        ->and(array_is_list($payload))->toBeTrue();
});

it('keeps Admins and Super Admins mentionable', function () {
    [
        'liquidation' => $liquidation, 'heiUser' => $heiUser,
        'admin' => $admin, 'superAdmin' => $superAdmin,
    ] = standaloneProgramFixture();

    // They live in their own clause of the picker query. Restructuring the RC/Focal
    // clauses around them must leave them exactly where they were.
    $ids = mentionableIds($heiUser, $liquidation);

    expect($ids)->toContain($admin->id)
        ->and($ids)->toContain($superAdmin->id);
});

it('lets an Admin mention a Focal and an RC on a top-level program', function () {
    [
        'liquidation' => $liquidation, 'admin' => $admin,
        'focal' => $focal, 'rc' => $rc,
    ] = standaloneProgramFixture();

    // The exact combination reported as broken: an Admin opening the @ list on a
    // TES-shaped record and finding no Focal. Both sides must be there now.
    $ids = mentionableIds($admin, $liquidation);

    expect($ids)->toContain($focal->id)
        ->and($ids)->toContain($rc->id);
});

it('lets a Focal mention a co-Focal', function () {
    ['liquidation' => $liquidation, 'focal' => $focal] = standaloneProgramFixture();

    // A second Focal on the same program — the "co-STUFAPS Focal" case.
    $coFocal = User::factory()->create([
        'role_id' => $focal->role_id,
        'region_id' => $focal->region_id,
        'status' => 'active',
    ]);
    $coFocal->programs()->attach($liquidation->program_id);

    expect(mentionableIds($focal, $liquidation))->toContain($coFocal->id);
});

it('does not notify anyone twice when a Focal is also mentioned', function () {
    ['liquidation' => $liquidation, 'heiUser' => $heiUser, 'focalParent' => $focalParent] = focalNotifyFixture();

    test()->actingAs($heiUser)
        ->post("/liquidation/{$liquidation->id}/comments", [
            'body' => "@[{$focalParent->name}]({$focalParent->id}) please check",
            'mentions' => [$focalParent->id],
        ])
        ->assertSuccessful();

    // A mention already notified them, so the stakeholder sweep must skip them —
    // one bell entry, not two.
    expect(Notification::where('user_id', $focalParent->id)->where('subject_id', $liquidation->id)->count())
        ->toBe(1);
});
