<?php

use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\LiquidationComment;
use App\Models\LiquidationDocument;
use App\Models\Permission;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\SupportTicket;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * @param  list<string>  $permissions
 */
function guardTestUser(string $roleName, array $permissions = []): User
{
    $role = Role::firstOrCreate(
        ['name' => $roleName],
        ['description' => "{$roleName} test role"],
    );

    foreach ($permissions as $permissionName) {
        $permission = Permission::firstOrCreate(
            ['name' => $permissionName],
            ['module' => 'Test', 'description' => "Test {$permissionName}"],
        );

        $role->permissions()->syncWithoutDetaching([$permission->id]);
    }

    return User::factory()->create([
        'role_id' => $role->id,
        'status' => 'active',
    ]);
}

function guardTestLiquidation(User $creator): Liquidation
{
    $region = Region::create([
        'code' => fake()->unique()->bothify('R##'),
        'name' => fake()->unique()->city(),
        'status' => 'active',
    ]);

    $hei = HEI::create([
        'uii' => fake()->unique()->numerify('#####'),
        'code' => fake()->unique()->bothify('HEI-####'),
        'name' => 'TEST STATE UNIVERSITY',
        'type' => 'SUC',
        'region_id' => $region->id,
        'status' => 'active',
    ]);

    $program = Program::create([
        'code' => fake()->unique()->bothify('TES-###'),
        'name' => 'Tertiary Education Subsidy',
        'status' => 'active',
    ]);

    return Liquidation::create([
        'control_no' => fake()->unique()->bothify('TES-2026-####'),
        'hei_id' => $hei->id,
        'program_id' => $program->id,
        'created_by' => $creator->id,
    ]);
}

test('deleting a user who created liquidations is refused and destroys nothing', function () {
    $admin = guardTestUser('Admin', ['delete_users']);
    $author = guardTestUser('Encoder');
    $liquidation = guardTestLiquidation($author);

    $this->actingAs($admin)
        ->delete(route('users.destroy', $author->id))
        ->assertSessionHas('error');

    expect(User::find($author->id))->not->toBeNull()
        ->and(Liquidation::find($liquidation->id))->not->toBeNull();
});

test('a soft-deleted liquidation still protects its author', function () {
    $admin = guardTestUser('Admin', ['delete_users']);
    $author = guardTestUser('Encoder');
    $liquidation = guardTestLiquidation($author);
    $liquidation->delete();

    expect($author->deletionBlockers())->toHaveKey('liquidation');

    $this->actingAs($admin)
        ->delete(route('users.destroy', $author->id))
        ->assertSessionHas('error');

    expect(User::find($author->id))->not->toBeNull()
        ->and(Liquidation::withTrashed()->find($liquidation->id))->not->toBeNull();
});

test('a user with no records is still deletable', function () {
    $admin = guardTestUser('Admin', ['delete_users']);
    $spare = guardTestUser('Viewer');

    expect($spare->deletionBlockers())->toBe([]);

    $this->actingAs($admin)
        ->delete(route('users.destroy', $spare->id))
        ->assertSessionHas('success');

    expect(User::find($spare->id))->toBeNull();
});

test('the database keeps liquidations even when a user row is deleted outright', function () {
    // The net behind the controller guard: liquidations.created_by used to
    // cascade, so a delete from tinker, a seeder or any future code path took
    // the records with it. It is SET NULL now, and Liquidation::creator is
    // already read null-safely everywhere.
    $author = guardTestUser('Encoder');
    $liquidation = guardTestLiquidation($author);

    User::query()->whereKey($author->id)->delete();

    $survivor = Liquidation::find($liquidation->id);

    expect($survivor)->not->toBeNull()
        ->and($survivor->created_by)->toBeNull();
});

test('an HEI account that uploaded documents cannot be deleted, and the uploads stay', function () {
    // The realistic HEI case: the account creates no liquidations of its own, so
    // created_by does not protect it - the uploads have to.
    $admin = guardTestUser('Admin', ['delete_users']);
    $heiUser = guardTestUser('HEI');
    $liquidation = guardTestLiquidation($admin);

    $document = LiquidationDocument::create([
        'liquidation_id' => $liquidation->id,
        'document_type' => 'Receipt',
        'file_name' => 'or-2026-001.pdf',
        'file_path' => 'documents/or-2026-001.pdf',
        'uploaded_by' => $heiUser->id,
    ]);

    expect($heiUser->deletionBlockers())->toBe(['uploaded document' => 1])
        ->and($heiUser->describeDeletionBlockers())->toBe('1 uploaded document');

    $this->actingAs($admin)
        ->delete(route('users.destroy', $heiUser->id))
        ->assertSessionHas('error');

    expect(User::find($heiUser->id))->not->toBeNull()
        ->and(LiquidationDocument::find($document->id))->not->toBeNull()
        ->and(LiquidationDocument::find($document->id)->uploaded_by)->toBe($heiUser->id);
});

test('the database refuses to drop a user whose uploads still exist', function () {
    // Behind the guard: liquidation_documents.uploaded_by is RESTRICT, so even a
    // delete that skips the controller cannot take the uploads with it.
    $admin = guardTestUser('Admin');
    $heiUser = guardTestUser('HEI');
    $liquidation = guardTestLiquidation($admin);

    $document = LiquidationDocument::create([
        'liquidation_id' => $liquidation->id,
        'document_type' => 'Receipt',
        'file_name' => 'or-2026-002.pdf',
        'file_path' => 'documents/or-2026-002.pdf',
        'uploaded_by' => $heiUser->id,
    ]);

    expect(fn () => User::query()->whereKey($heiUser->id)->delete())
        ->toThrow(QueryException::class);

    expect(LiquidationDocument::find($document->id))->not->toBeNull();
});

test('a comment on a liquidation protects its author, and the words survive', function () {
    // liquidation_comments stores no copy of the author's name, so the cascade
    // used to take the message text with the account.
    $admin = guardTestUser('Admin', ['delete_users']);
    $author = guardTestUser('HEI');
    $liquidation = guardTestLiquidation($admin);

    $comment = LiquidationComment::create([
        'liquidation_id' => $liquidation->id,
        'user_id' => $author->id,
        'body' => 'Attaching the revised OR for item 3.',
    ]);

    expect($author->describeDeletionBlockers())->toBe('1 liquidation comment');

    $this->actingAs($admin)
        ->delete(route('users.destroy', $author->id))
        ->assertSessionHas('error');

    expect(User::find($author->id))->not->toBeNull()
        ->and(LiquidationComment::find($comment->id)?->body)
        ->toBe('Attaching the revised OR for item 3.');
});

test('a support ticket protects the account that raised it', function () {
    $admin = guardTestUser('Admin', ['delete_users']);
    $requester = guardTestUser('HEI');

    $ticket = SupportTicket::create([
        'ticket_number' => 'TCK-000001',
        'requester_id' => $requester->id,
        'category' => 'account',
        'subject' => 'Cannot upload a document',
        'description' => 'The upload button does nothing on my liquidation.',
    ]);

    expect($requester->describeDeletionBlockers())->toBe('1 support ticket');

    $this->actingAs($admin)
        ->delete(route('users.destroy', $requester->id))
        ->assertSessionHas('error');

    expect(User::find($requester->id))->not->toBeNull()
        ->and(SupportTicket::find($ticket->id))->not->toBeNull();
});

test('several kinds of record are listed together in one message', function () {
    $author = guardTestUser('HEI');
    $liquidation = guardTestLiquidation($author);

    LiquidationComment::create([
        'liquidation_id' => $liquidation->id,
        'user_id' => $author->id,
        'body' => 'Noted, revising now.',
    ]);

    expect($author->describeDeletionBlockers())
        ->toBe('1 liquidation and 1 liquidation comment');
});

test('the blocker message names what is attached', function () {
    $author = guardTestUser('Encoder');
    guardTestLiquidation($author);

    expect($author->describeDeletionBlockers())->toBe('1 liquidation');

    guardTestLiquidation($author);

    expect($author->fresh()->describeDeletionBlockers())->toBe('2 liquidations');
});
