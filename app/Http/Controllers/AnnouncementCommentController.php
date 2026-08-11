<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\AnnouncementComment;
use App\Models\AnnouncementCommentReaction;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AnnouncementCommentController extends Controller
{
    private const MAX_DEPTH = 2; // 3 levels: 0, 1, 2

    /**
     * List the full comment tree for an announcement.
     */
    public function index(Request $request, Announcement $announcement): JsonResponse
    {
        $this->ensureVisible($request, $announcement);

        $perPage = 10;
        $page = max(1, (int) $request->query('page', '1'));

        $paginator = AnnouncementComment::where('announcement_id', $announcement->id)
            ->whereNull('parent_id')
            ->with(['user.role', 'reactions.user:id,name', 'allReplies.user.role', 'allReplies.reactions.user:id,name', 'allReplies.allReplies.user.role', 'allReplies.allReplies.reactions.user:id,name'])
            ->orderBy('created_at')
            ->paginate($perPage, ['*'], 'page', $page);

        $viewerId = $request->user()?->id;

        return response()->json([
            'data' => collect($paginator->items())->map(fn ($c) => $c->format($viewerId))->values(),
            'has_more' => $paginator->hasMorePages(),
            'total' => $paginator->total(),
        ]);
    }

    /**
     * Post a new comment or reply.
     */
    public function store(Request $request, Announcement $announcement): JsonResponse
    {
        $this->ensureVisible($request, $announcement);

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
            'parent_id' => ['nullable', 'uuid', 'exists:announcement_comments,id'],
            'mentions' => ['nullable', 'array'],
            'mentions.*' => ['uuid', 'exists:users,id'],
        ]);

        $body = trim($validated['body']);

        // Flatten replies that would exceed MAX_DEPTH onto their nearest allowed ancestor.
        $parentId = $validated['parent_id'] ?? null;
        if ($parentId) {
            $depth = $this->getCommentDepth($parentId);
            if ($depth >= self::MAX_DEPTH) {
                $parentId = AnnouncementComment::find($parentId)?->parent_id ?? $parentId;
            }
        }

        $mentionIds = $validated['mentions'] ?? AnnouncementComment::parseMentions($body);

        $comment = AnnouncementComment::create([
            'announcement_id' => $announcement->id,
            'user_id' => $request->user()->id,
            'parent_id' => $parentId,
            'body' => $body,
            'mentions' => ! empty($mentionIds) ? $mentionIds : null,
        ]);

        $actor = $request->user();

        // Order matters: the author notifier needs to know who the first two
        // already reached, otherwise an author who was @mentioned — or who had
        // replied earlier in the thread — would get two notifications for one
        // comment. Two is a worse bug than none.
        $notified = array_merge(
            $this->notifyMentionedUsers($comment, $announcement, $actor, $mentionIds),
            $this->notifyThreadParticipants($comment, $announcement, $actor, $mentionIds),
        );

        $this->notifyAnnouncementAuthor($comment, $announcement, $actor, $notified);

        $comment->load('user.role', 'reactions.user:id,name');

        return response()->json([
            'success' => true,
            'comment' => $comment->format($actor->id),
        ]);
    }

    /**
     * Delete a comment — author, Admin, or Super Admin only.
     */
    public function destroy(Request $request, Announcement $announcement, AnnouncementComment $comment): JsonResponse
    {
        abort_unless($comment->announcement_id === $announcement->id, 404);

        $user = $request->user();
        $isOwner = $comment->user_id === $user->id;
        $isPrivileged = in_array($user->role?->name, ['Super Admin', 'Admin'], true);

        abort_unless($isOwner || $isPrivileged, 403, 'You can only delete your own comments.');

        $comment->delete();

        return response()->json(['success' => true]);
    }

    /**
     * Return the list of users this viewer can mention.
     * Rule: active users except yourself. HEI users are restricted to users
     * they'd realistically collaborate with (own HEI + RCs of their region + Admins).
     */
    public function mentionableUsers(Request $request, Announcement $announcement): JsonResponse
    {
        $this->ensureVisible($request, $announcement);

        $actor = $request->user();
        $query = User::where('status', 'active')->where('id', '!=', $actor->id);

        if ($actor->role?->name === 'HEI') {
            $query->where(function ($q) use ($actor) {
                $q->where('hei_id', $actor->hei_id)
                    ->orWhere(function ($sub) use ($actor) {
                        $sub->whereHas('role', fn ($r) => $r->where('name', 'Regional Coordinator'))
                            ->where('region_id', $actor->region_id);
                    })
                    ->orWhereHas('role', fn ($r) => $r->whereIn('name', ['Admin', 'Super Admin']));
            });
        }

        $users = $query->with('role')
            ->orderBy('name')
            ->get(['id', 'name', 'role_id'])
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'role' => $u->role?->name,
            ]);

        return response()->json($users);
    }

    /**
     * Every reply beneath one comment.
     *
     * The thread ships only the first few replies per comment (see
     * AnnouncementComment::REPLIES_PREVIEW). This backs the "View N replies"
     * toggle, so the full subtree is only ever built for the one comment a reader
     * actually opened.
     */
    public function replies(Request $request, Announcement $announcement, AnnouncementComment $comment): JsonResponse
    {
        abort_unless($comment->announcement_id === $announcement->id, 404);
        $this->ensureVisible($request, $announcement);

        $comment->load([
            'allReplies.user.role',
            'allReplies.reactions.user:id,name',
            'allReplies.allReplies.user.role',
            'allReplies.allReplies.reactions.user:id,name',
        ]);

        // null lifts the preview cap for this subtree only.
        $formatted = $comment->format($request->user()?->id, null);

        return response()->json([
            'success' => true,
            'replies' => $formatted['replies'],
        ]);
    }

    /**
     * Toggle heart reaction on a comment (like/unlike).
     */
    public function toggleReaction(Request $request, Announcement $announcement, AnnouncementComment $comment): JsonResponse
    {
        abort_unless($comment->announcement_id === $announcement->id, 404);
        $this->ensureVisible($request, $announcement);

        $user = $request->user();
        $existing = AnnouncementCommentReaction::where('comment_id', $comment->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            $existing->delete();
            $reacted = false;
        } else {
            AnnouncementCommentReaction::create([
                'comment_id' => $comment->id,
                'user_id' => $user->id,
            ]);
            $reacted = true;

            // Only on add. Un-reacting is not something the author needs told about,
            // and notifying on both halves of a toggle would double the noise.
            $this->notifyCommentReaction($comment, $announcement, $user);
        }

        // Re-read the reactions with their users so the response carries the
        // updated name list, letting the tooltip stay correct without a refetch.
        // This replaces the separate count query rather than adding to it.
        $comment->load('reactions.user:id,name');
        $reactions = $comment->reactions;

        return response()->json([
            'success' => true,
            'has_reacted' => $reacted,
            'reactions_count' => $reactions->count(),
            'reactor_names' => AnnouncementComment::reactorNames($reactions, $user->id),
        ]);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /**
     * Block access if the viewer isn't allowed to see the underlying announcement.
     * Admin/Super Admin always pass; everyone else must see a live + show_to_hei post.
     */
    private function ensureVisible(Request $request, Announcement $announcement): void
    {
        $user = $request->user();
        $role = $user?->role?->name;

        if (in_array($role, ['Super Admin', 'Admin'], true)) {
            return;
        }

        $now = now();
        $notYetPublished = $announcement->published_at && $announcement->published_at->gt($now);
        $hasExpired = $announcement->end_date && $announcement->end_date->lt($now);
        $hiddenFromHei = $role === 'HEI' && ! $announcement->show_to_hei;

        abort_if($notYetPublished || $hasExpired || $hiddenFromHei, 404);
    }

    private function getCommentDepth(string $commentId): int
    {
        // Preload the parent chain in 2 eager-load queries instead of N separate finds.
        // MAX_DEPTH = 2 means 3 levels max, so 'parent.parent' covers the full chain.
        $comment = AnnouncementComment::with('parent.parent')->find($commentId);
        if (! $comment) {
            return 0;
        }
        $depth = 0;
        $node = $comment;
        while ($node->parent_id !== null) {
            $depth++;
            $node = $node->parent;
            if ($node === null) {
                break;
            }
        }

        return $depth;
    }

    private function notifyMentionedUsers(
        AnnouncementComment $comment,
        Announcement $announcement,
        User $actor,
        array $mentionIds,
    ): array {
        if (empty($mentionIds)) {
            return [];
        }

        $recipients = User::whereIn('id', $mentionIds)
            ->where('id', '!=', $actor->id)
            ->where('status', 'active')
            ->get();

        if ($recipients->isEmpty()) {
            return [];
        }

        $rows = $recipients->map(fn (User $user) => [
            'id' => Str::uuid()->toString(),
            'user_id' => $user->id,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'action' => 'mentioned_in_announcement_comment',
            'description' => 'mentioned you in a comment on "'.$announcement->title.'"',
            'subject_type' => Announcement::class,
            'subject_id' => $announcement->id,
            'subject_label' => $announcement->title,
            'module' => 'Announcement',
            'metadata' => json_encode(['comment_id' => $comment->id, 'slug' => $announcement->slug]),
            'created_at' => now(),
            'updated_at' => now(),
        ])->toArray();

        Notification::insert($rows);

        return $recipients->pluck('id')->all();
    }

    /**
     * Notify everyone who previously commented in the same thread (excluding the
     * actor and users already notified via @mention).
     */
    private function notifyThreadParticipants(
        AnnouncementComment $comment,
        Announcement $announcement,
        User $actor,
        array $mentionIds,
    ): array {
        if (! $comment->parent_id) {
            return []; // top-level comment — no thread to notify
        }

        // Walk up to the root comment
        $rootId = $comment->parent_id;
        $current = AnnouncementComment::find($rootId);
        while ($current?->parent_id) {
            $rootId = $current->parent_id;
            $current = AnnouncementComment::find($current->parent_id);
        }

        // Collect all comment IDs in the thread tree (3 levels)
        $level0 = [$rootId];
        $level1 = AnnouncementComment::whereIn('parent_id', $level0)->pluck('id')->toArray();
        $level2 = ! empty($level1) ? AnnouncementComment::whereIn('parent_id', $level1)->pluck('id')->toArray() : [];
        $allThreadIds = array_merge($level0, $level1, $level2);

        $participantIds = AnnouncementComment::whereIn('id', $allThreadIds)
            ->where('user_id', '!=', $actor->id)
            ->whereNotIn('user_id', $mentionIds)
            ->pluck('user_id')
            ->unique();

        if ($participantIds->isEmpty()) {
            return [];
        }

        $recipients = User::whereIn('id', $participantIds)->where('status', 'active')->get();
        if ($recipients->isEmpty()) {
            return [];
        }

        $rows = $recipients->map(fn (User $user) => [
            'id' => Str::uuid()->toString(),
            'user_id' => $user->id,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'action' => 'replied_to_announcement_thread',
            'description' => 'replied to a discussion on "'.$announcement->title.'"',
            'subject_type' => Announcement::class,
            'subject_id' => $announcement->id,
            'subject_label' => $announcement->title,
            'module' => 'Announcement',
            'metadata' => json_encode(['comment_id' => $comment->id, 'slug' => $announcement->slug]),
            'created_at' => now(),
            'updated_at' => now(),
        ])->toArray();

        Notification::insert($rows);

        return $recipients->pluck('id')->all();
    }

    /**
     * Tell the announcement's author that someone commented on it.
     *
     * Without this a plain comment notified nobody at all: mentions only fire
     * when someone is tagged, and the thread notifier returns early on top-level
     * comments. The person who posted the announcement — the one who most wants
     * to know it drew a response — heard nothing.
     *
     * Fires for replies as well as top-level comments; a reply buried in a thread
     * is still activity on their announcement.
     *
     * @param  list<string>  $alreadyNotified  ids the mention/thread notifiers reached
     */
    private function notifyAnnouncementAuthor(
        AnnouncementComment $comment,
        Announcement $announcement,
        User $actor,
        array $alreadyNotified,
    ): void {
        $authorId = $announcement->created_by;

        // Commenting on your own announcement should not ping you, and anyone the
        // earlier notifiers already reached must not be told twice.
        if (! $authorId || $authorId === $actor->id || in_array($authorId, $alreadyNotified, true)) {
            return;
        }

        $author = User::where('id', $authorId)->where('status', 'active')->first();

        if (! $author) {
            return;
        }

        Notification::insert([[
            'id' => Str::uuid()->toString(),
            'user_id' => $author->id,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'action' => 'commented_on_announcement',
            'description' => 'commented on your announcement "'.$announcement->title.'"',
            'subject_type' => Announcement::class,
            'subject_id' => $announcement->id,
            'subject_label' => $announcement->title,
            'module' => 'Announcement',
            // slug drives the deep link to /announcement/{slug}#discussion.
            'metadata' => json_encode(['comment_id' => $comment->id, 'slug' => $announcement->slug]),
            'created_at' => now(),
            'updated_at' => now(),
        ]]);
    }

    /**
     * Tell a comment's author that someone reacted to it.
     *
     * Called only when a reaction is added, never when one is removed.
     *
     * A reaction is a toggle, so the obvious version of this is a spam source:
     * clicking the button four times would send four notifications. The unread
     * check below collapses that to one. Once the author has read it, a later
     * reaction from the same person is allowed to notify again — the intent is to
     * stop repeats, not to notify only ever once.
     */
    private function notifyCommentReaction(
        AnnouncementComment $comment,
        Announcement $announcement,
        User $actor,
    ): void {
        // Reacting to your own comment should not ping you.
        if ($comment->user_id === $actor->id) {
            return;
        }

        $author = User::where('id', $comment->user_id)->where('status', 'active')->first();

        if (! $author) {
            return;
        }

        // metadata is cast to array on the model, so this compares the JSON key
        // rather than the serialized blob.
        $alreadyPending = Notification::where('user_id', $author->id)
            ->where('actor_id', $actor->id)
            ->where('action', 'reacted_to_comment')
            ->whereNull('read_at')
            ->where('metadata->comment_id', $comment->id)
            ->exists();

        if ($alreadyPending) {
            return;
        }

        Notification::insert([[
            'id' => Str::uuid()->toString(),
            'user_id' => $author->id,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'action' => 'reacted_to_comment',
            'description' => 'reacted to your comment on "'.$announcement->title.'"',
            'subject_type' => Announcement::class,
            'subject_id' => $announcement->id,
            'subject_label' => $announcement->title,
            'module' => 'Announcement',
            'metadata' => json_encode(['comment_id' => $comment->id, 'slug' => $announcement->slug]),
            'created_at' => now(),
            'updated_at' => now(),
        ]]);
    }
}
