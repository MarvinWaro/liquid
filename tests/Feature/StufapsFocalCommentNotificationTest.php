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

    $liquidation = Liquidation::create([
        'control_no' => 'FOC-2026-0001',
        'hei_id' => $hei->id,
        'processing_region_id' => $region->id,
        'program_id' => $tdp->id,
        'created_by' => $heiUser->id,
    ]);

    return compact(
        'liquidation', 'heiUser', 'region', 'rcRole',
        'focalParent', 'focalSibling', 'focalDirect', 'focalUnrelated',
    );
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
    $ids = collect(
        test()->actingAs($heiUser)
            ->getJson("/liquidation/{$liquidation->id}/mentionable-users")
            ->assertSuccessful()
            ->json()
    )->pluck('id')->all();

    expect($ids)->toContain($focalParent->id)
        ->and($ids)->toContain($focalSibling->id)
        ->and($ids)->not->toContain($focalUnrelated->id);
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
