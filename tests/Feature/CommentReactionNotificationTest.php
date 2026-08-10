<?php

use App\Models\Announcement;
use App\Models\AnnouncementComment;
use App\Models\Notification;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function reactor(): User
{
    $role = Role::firstOrCreate(['name' => 'Reactor'], ['description' => 'test']);
    $perm = Permission::firstOrCreate(
        ['name' => 'view_announcements'],
        ['module' => 'Announcements', 'description' => 'view']
    );
    $role->permissions()->syncWithoutDetaching([$perm->id]);

    return User::factory()->create(['role_id' => $role->id]);
}

function announcementWithComment(User $poster, User $commenter): array
{
    $announcement = Announcement::create([
        'title' => 'Reaction Test',
        'slug' => 'reaction-test-'.uniqid(),
        'content' => '<p>body</p>',
        'category' => 'news',
        'created_by' => $poster->id,
        'published_at' => now(),
    ]);

    $comment = AnnouncementComment::create([
        'announcement_id' => $announcement->id,
        'user_id' => $commenter->id,
        'body' => 'A comment',
    ]);

    return [$announcement, $comment];
}

function toggleReaction(User $actor, Announcement $a, AnnouncementComment $c): void
{
    test()->actingAs($actor)
        ->postJson("/announcement/{$a->slug}/comments/{$c->id}/react")
        ->assertSuccessful();
}

function reactionNotifications(User $user): int
{
    return Notification::where('user_id', $user->id)
        ->where('action', 'reacted_to_comment')
        ->count();
}

it('notifies the comment author when someone reacts', function () {
    $author = reactor();
    $other = reactor();
    [$announcement, $comment] = announcementWithComment($other, $author);

    Notification::query()->delete();

    toggleReaction($other, $announcement, $comment);

    expect(reactionNotifications($author))->toBe(1);
});

it('does not pile up notifications when the reaction is toggled repeatedly', function () {
    $author = reactor();
    $other = reactor();
    [$announcement, $comment] = announcementWithComment($other, $author);

    Notification::query()->delete();

    // on, off, on, off, on — a naive implementation would send three.
    toggleReaction($other, $announcement, $comment);
    toggleReaction($other, $announcement, $comment);
    toggleReaction($other, $announcement, $comment);
    toggleReaction($other, $announcement, $comment);
    toggleReaction($other, $announcement, $comment);

    expect(reactionNotifications($author))->toBe(1);
});

it('allows a fresh notification once the previous one has been read', function () {
    $author = reactor();
    $other = reactor();
    [$announcement, $comment] = announcementWithComment($other, $author);

    Notification::query()->delete();

    toggleReaction($other, $announcement, $comment);          // notifies
    Notification::where('user_id', $author->id)->update(['read_at' => now()]);

    toggleReaction($other, $announcement, $comment);          // un-react, silent
    toggleReaction($other, $announcement, $comment);          // react again

    // The guard suppresses repeats, it does not silence the author forever.
    expect(reactionNotifications($author))->toBe(2);
});

it('does not notify you for reacting to your own comment', function () {
    $author = reactor();
    [$announcement, $comment] = announcementWithComment($author, $author);

    Notification::query()->delete();

    toggleReaction($author, $announcement, $comment);

    expect(reactionNotifications($author))->toBe(0);
});

it('never notifies on un-reacting alone', function () {
    $author = reactor();
    $other = reactor();
    [$announcement, $comment] = announcementWithComment($other, $author);

    toggleReaction($other, $announcement, $comment);   // react
    Notification::query()->delete();                   // forget that one
    toggleReaction($other, $announcement, $comment);   // un-react

    expect(reactionNotifications($author))->toBe(0);
});

it('leaves the reaction endpoint response untouched', function () {
    $author = reactor();
    $other = reactor();
    [$announcement, $comment] = announcementWithComment($other, $author);

    // The frontend reads these three keys to flip the button and count.
    test()->actingAs($other)
        ->postJson("/announcement/{$announcement->slug}/comments/{$comment->id}/react")
        ->assertSuccessful()
        ->assertJson(['success' => true, 'has_reacted' => true, 'reactions_count' => 1]);
});
