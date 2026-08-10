<?php

use App\Models\Announcement;
use App\Models\Notification;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function commenter(): User
{
    $role = Role::firstOrCreate(['name' => 'Commenter'], ['description' => 'test']);
    $perm = Permission::firstOrCreate(
        ['name' => 'view_announcements'],
        ['module' => 'Announcements', 'description' => 'view']
    );
    $role->permissions()->syncWithoutDetaching([$perm->id]);

    return User::factory()->create(['role_id' => $role->id]);
}

function announcementBy(User $author): Announcement
{
    return Announcement::create([
        'title' => 'Test Announcement',
        'slug' => 'test-announcement-'.uniqid(),
        'content' => '<p>body</p>',
        'category' => 'news',
        'created_by' => $author->id,
        'published_at' => now(),
    ]);
}

function postComment(User $actor, Announcement $a, array $payload = []): void
{
    test()->actingAs($actor)
        ->postJson("/announcement/{$a->slug}/comments", array_merge([
            'body' => 'A comment',
        ], $payload))
        ->assertSuccessful();
}

function authorNotifications(User $author): int
{
    return Notification::where('user_id', $author->id)->count();
}

it('notifies the author when someone leaves a top-level comment', function () {
    $author = commenter();
    $other = commenter();
    $announcement = announcementBy($author);

    Notification::query()->delete();

    postComment($other, $announcement);

    // Before this fix a plain comment notified nobody: mentions only fire when
    // someone is tagged, and the thread notifier returns early on top-level.
    expect(authorNotifications($author))->toBe(1)
        ->and(Notification::where('user_id', $author->id)->first()->action)
        ->toBe('commented_on_announcement');
});

it('does not notify you for commenting on your own announcement', function () {
    $author = commenter();
    $announcement = announcementBy($author);

    Notification::query()->delete();

    postComment($author, $announcement);

    expect(authorNotifications($author))->toBe(0);
});

it('sends exactly one notification when the author is also mentioned', function () {
    $author = commenter();
    $other = commenter();
    $announcement = announcementBy($author);

    Notification::query()->delete();

    // The author would otherwise be reached twice: once as a mention, once as
    // the announcement owner. Two notifications for one comment is worse than none.
    postComment($other, $announcement, [
        'body' => "@[{$author->name}]({$author->id}) look at this",
        'mentions' => [$author->id],
    ]);

    expect(authorNotifications($author))->toBe(1);
});

it('leaves the mention notification intact rather than replacing it', function () {
    $author = commenter();
    $other = commenter();
    $announcement = announcementBy($author);

    Notification::query()->delete();

    postComment($other, $announcement, [
        'body' => "@[{$author->name}]({$author->id}) hello",
        'mentions' => [$author->id],
    ]);

    // The mention is the more specific message, and it runs first.
    expect(Notification::where('user_id', $author->id)->first()->action)
        ->toBe('mentioned_in_announcement_comment');
});
