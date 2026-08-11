<?php

use App\Models\Announcement;
use App\Models\AnnouncementComment;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Reactions used to expose only a count, so nobody could tell who had liked a
 * comment. These cover the name list that backs the tooltip.
 *
 * Reuses announcementWithComment() from CommentReactionNotificationTest — Pest
 * helpers are global, so redeclaring it would be a fatal error.
 */
function namedReactor(string $name): User
{
    $role = Role::firstOrCreate(['name' => 'Reactor'], ['description' => 'test']);
    $perm = Permission::firstOrCreate(
        ['name' => 'view_announcements'],
        ['module' => 'Announcements', 'description' => 'view']
    );
    $role->permissions()->syncWithoutDetaching([$perm->id]);

    return User::factory()->create(['role_id' => $role->id, 'name' => $name]);
}

function reactAndRead(User $actor, Announcement $a, AnnouncementComment $c): array
{
    return test()->actingAs($actor)
        ->postJson("/announcement/{$a->slug}/comments/{$c->id}/react")
        ->assertSuccessful()
        ->json();
}

function firstCommentFor(User $viewer, Announcement $a): array
{
    return test()->actingAs($viewer)
        ->getJson("/announcement/{$a->slug}/comments")
        ->assertSuccessful()
        ->json('data.0');
}

it('names the person who reacted so the tooltip can show them', function () {
    $author = namedReactor('Ana Reyes');
    $maria = namedReactor('Maria Santos');
    [$announcement, $comment] = announcementWithComment($author, $author);

    reactAndRead($maria, $announcement, $comment);

    $body = firstCommentFor($author, $announcement);

    expect($body['reactions_count'])->toBe(1)
        ->and($body['reactor_names'])->toBe(['Maria Santos']);
});

it('lists the viewer first as "You"', function () {
    $author = namedReactor('Ana Reyes');
    $maria = namedReactor('Maria Santos');
    [$announcement, $comment] = announcementWithComment($author, $author);

    reactAndRead($maria, $announcement, $comment);
    $response = reactAndRead($author, $announcement, $comment);

    // Ana reacted second but sees herself at the top — that is how she confirms
    // her own like registered.
    expect($response['reactions_count'])->toBe(2)
        ->and($response['reactor_names'])->toBe(['You', 'Maria Santos'])
        ->and($response['has_reacted'])->toBeTrue();
});

it('drops the name again when the reaction is toggled off', function () {
    $author = namedReactor('Ana Reyes');
    [$announcement, $comment] = announcementWithComment($author, $author);

    reactAndRead($author, $announcement, $comment);
    $response = reactAndRead($author, $announcement, $comment);

    expect($response['has_reacted'])->toBeFalse()
        ->and($response['reactions_count'])->toBe(0)
        ->and($response['reactor_names'])->toBe([]);
});

it('caps the names sent and leaves the remainder to the count', function () {
    $author = namedReactor('Ana Reyes');
    [$announcement, $comment] = announcementWithComment($author, $author);

    $limit = AnnouncementComment::REACTOR_NAMES_LIMIT;

    // Two past the cap, so the frontend has to summarise the rest as "and N others".
    foreach (range(1, $limit + 2) as $i) {
        reactAndRead(namedReactor("Reactor {$i}"), $announcement, $comment);
    }

    $body = firstCommentFor($author, $announcement);

    expect($body['reactions_count'])->toBe($limit + 2)
        ->and($body['reactor_names'])->toHaveCount($limit);
});

it('reports no reactors for a deleted reply', function () {
    $author = namedReactor('Ana Reyes');
    $maria = namedReactor('Maria Santos');
    [$announcement, $parent] = announcementWithComment($author, $author);

    // A deleted top-level comment drops out of the list entirely. Replies are the
    // case that survives as a "[comment deleted]" placeholder, so that is what
    // must not leak who reacted.
    $reply = AnnouncementComment::create([
        'announcement_id' => $announcement->id,
        'user_id' => $author->id,
        'parent_id' => $parent->id,
        'body' => 'A reply',
    ]);

    reactAndRead($maria, $announcement, $reply);
    $reply->delete();

    $body = firstCommentFor($author, $announcement);

    expect($body['replies'][0]['is_deleted'])->toBeTrue()
        ->and($body['replies'][0]['reactions_count'])->toBe(0)
        ->and($body['replies'][0]['reactor_names'])->toBe([]);
});
