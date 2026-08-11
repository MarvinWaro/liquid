<?php

use App\Models\Announcement;
use App\Models\AnnouncementComment;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * The announcement module loaded every post and every reply at once, and re-signed
 * an S3 URL (~4 ms) for each avatar and cover on every request. These cover the
 * three things that fixed: URL caching, list pagination and reply preview.
 */
function scalingUser(string $name = 'Poster'): User
{
    $role = Role::firstOrCreate(['name' => 'Super Admin'], ['description' => 'test']);
    $perm = Permission::firstOrCreate(
        ['name' => 'view_announcements'],
        ['module' => 'Announcements', 'description' => 'view']
    );
    $role->permissions()->syncWithoutDetaching([$perm->id]);

    return User::factory()->create(['role_id' => $role->id, 'name' => $name]);
}

function makeAnnouncement(User $author, array $overrides = []): Announcement
{
    return Announcement::create(array_merge([
        'title' => 'Post '.uniqid(),
        'slug' => 'post-'.uniqid(),
        'content' => '<p>body</p>',
        'category' => 'news',
        'created_by' => $author->id,
        'published_at' => now()->subMinute(),
    ], $overrides));
}

it('sends only the first page of announcements, with the featured post first', function () {
    $author = scalingUser();

    foreach (range(1, 20) as $i) {
        makeAnnouncement($author, ['published_at' => now()->subMinutes(30 - $i)]);
    }
    $featured = makeAnnouncement($author, ['title' => 'Pinned', 'is_featured' => true]);

    $props = test()->actingAs($author)
        ->get('/announcement')
        ->assertSuccessful()
        ->viewData('page')['props'];

    // 21 posts exist; the page must not ship all of them.
    expect($props['posts'])->toHaveCount(12)
        ->and($props['pagination']['total'])->toBe(21)
        ->and($props['pagination']['has_more'])->toBeTrue()
        ->and($props['posts'][0]['id'])->toBe($featured->id);
});

it('returns the remaining announcements on the next page', function () {
    $author = scalingUser();
    foreach (range(1, 15) as $i) {
        makeAnnouncement($author, ['published_at' => now()->subMinutes(20 - $i)]);
    }

    $props = test()->actingAs($author)
        ->get('/announcement?page=2')
        ->assertSuccessful()
        ->viewData('page')['props'];

    expect($props['posts'])->toHaveCount(3)
        ->and($props['pagination']['has_more'])->toBeFalse();
});

it('ships only a preview of a comment thread and reports the true total', function () {
    $author = scalingUser();
    $announcement = makeAnnouncement($author);

    $parent = AnnouncementComment::create([
        'announcement_id' => $announcement->id,
        'user_id' => $author->id,
        'body' => 'Parent',
    ]);
    foreach (range(1, 10) as $i) {
        AnnouncementComment::create([
            'announcement_id' => $announcement->id,
            'user_id' => $author->id,
            'parent_id' => $parent->id,
            'body' => "Reply {$i}",
        ]);
    }

    $body = test()->actingAs($author)
        ->getJson("/announcement/{$announcement->slug}/comments")
        ->assertSuccessful()
        ->json('data.0');

    // Only the preview travels, but the label still shows all 10.
    expect($body['replies'])->toHaveCount(AnnouncementComment::REPLIES_PREVIEW)
        ->and($body['replies_total'])->toBe(10)
        ->and($body['replies_has_more'])->toBeTrue();
});

it('serves the full reply list from the replies endpoint', function () {
    $author = scalingUser();
    $announcement = makeAnnouncement($author);

    $parent = AnnouncementComment::create([
        'announcement_id' => $announcement->id,
        'user_id' => $author->id,
        'body' => 'Parent',
    ]);
    foreach (range(1, 10) as $i) {
        AnnouncementComment::create([
            'announcement_id' => $announcement->id,
            'user_id' => $author->id,
            'parent_id' => $parent->id,
            'body' => "Reply {$i}",
        ]);
    }

    $replies = test()->actingAs($author)
        ->getJson("/announcement/{$announcement->slug}/comments/{$parent->id}/replies")
        ->assertSuccessful()
        ->json('replies');

    expect($replies)->toHaveCount(10);
});

it('leaves a short thread untouched', function () {
    $author = scalingUser();
    $announcement = makeAnnouncement($author);

    $parent = AnnouncementComment::create([
        'announcement_id' => $announcement->id,
        'user_id' => $author->id,
        'body' => 'Parent',
    ]);
    AnnouncementComment::create([
        'announcement_id' => $announcement->id,
        'user_id' => $author->id,
        'parent_id' => $parent->id,
        'body' => 'Only reply',
    ]);

    $body = test()->actingAs($author)
        ->getJson("/announcement/{$announcement->slug}/comments")
        ->assertSuccessful()
        ->json('data.0');

    // Under the cap nothing is withheld, so no extra request is ever needed.
    expect($body['replies'])->toHaveCount(1)
        ->and($body['replies_total'])->toBe(1)
        ->and($body['replies_has_more'])->toBeFalse();
});

it('refuses the replies endpoint for an announcement the comment does not belong to', function () {
    $author = scalingUser();
    $announcement = makeAnnouncement($author);
    $other = makeAnnouncement($author);

    $comment = AnnouncementComment::create([
        'announcement_id' => $announcement->id,
        'user_id' => $author->id,
        'body' => 'Parent',
    ]);

    test()->actingAs($author)
        ->getJson("/announcement/{$other->slug}/comments/{$comment->id}/replies")
        ->assertNotFound();
});
