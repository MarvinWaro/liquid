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
            ->with(['user.role', 'reactions', 'allReplies.user.role', 'allReplies.reactions', 'allReplies.allReplies.user.role', 'allReplies.allReplies.reactions'])
            ->orderBy('created_at')
            ->paginate($perPage, ['*'], 'page', $page);

        $viewerId = $request->user()?->id;

        return response()->json([
            'data'     => collect($paginator->items())->map(fn ($c) => $c->format($viewerId))->values(),
            'has_more' => $paginator->hasMorePages(),
            'total'    => $paginator->total(),
        ]);
    }

    /**
     * Post a new comment or reply.
     */
    public function store(Request $request, Announcement $announcement): JsonResponse
    {
        $this->ensureVisible($request, $announcement);

        $validated = $request->validate([
            'body'       => ['required', 'string', 'max:2000'],
            'parent_id'  => ['nullable', 'uuid', 'exists:announcement_comments,id'],
            'mentions'   => ['nullable', 'array'],
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
            'user_id'         => $request->user()->id,
            'parent_id'       => $parentId,
            'body'            => $body,
            'mentions'        => !empty($mentionIds) ? $mentionIds : null,
        ]);

        $actor = $request->user();
        $this->notifyMentionedUsers($comment, $announcement, $actor, $mentionIds);
        $this->notifyThreadParticipants($comment, $announcement, $actor, $mentionIds);

        $comment->load('user.role', 'reactions');

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
                'id'   => $u->id,
                'name' => $u->name,
                'role' => $u->role?->name,
            ]);

        return response()->json($users);
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
                'user_id'    => $user->id,
            ]);
            $reacted = true;
        }

        $count = AnnouncementCommentReaction::where('comment_id', $comment->id)->count();

        return response()->json([
            'success'     => true,
            'has_reacted' => $reacted,
            'reactions_count' => $count,
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
        $hasExpired      = $announcement->end_date && $announcement->end_date->lt($now);
        $hiddenFromHei   = $role === 'HEI' && !$announcement->show_to_hei;

        abort_if($notYetPublished || $hasExpired || $hiddenFromHei, 404);
    }

    private function getCommentDepth(string $commentId): int
    {
        // Preload the parent chain in 2 eager-load queries instead of N separate finds.
        // MAX_DEPTH = 2 means 3 levels max, so 'parent.parent' covers the full chain.
        $comment = AnnouncementComment::with('parent.parent')->find($commentId);
        if (!$comment) {
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
    ): void {
        if (empty($mentionIds)) {
            return;
        }

        $recipients = User::whereIn('id', $mentionIds)
            ->where('id', '!=', $actor->id)
            ->where('status', 'active')
            ->get();

        if ($recipients->isEmpty()) {
            return;
        }

        $rows = $recipients->map(fn (User $user) => [
            'id'            => Str::uuid()->toString(),
            'user_id'       => $user->id,
            'actor_id'      => $actor->id,
            'actor_name'    => $actor->name,
            'action'        => 'mentioned_in_announcement_comment',
            'description'   => 'mentioned you in a comment on "' . $announcement->title . '"',
            'subject_type'  => Announcement::class,
            'subject_id'    => $announcement->id,
            'subject_label' => $announcement->title,
            'module'        => 'Announcement',
            'metadata'      => json_encode(['comment_id' => $comment->id, 'slug' => $announcement->slug]),
            'created_at'    => now(),
            'updated_at'    => now(),
        ])->toArray();

        Notification::insert($rows);
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
    ): void {
        if (!$comment->parent_id) {
            return; // top-level comment — no thread to notify
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
        $level2 = !empty($level1) ? AnnouncementComment::whereIn('parent_id', $level1)->pluck('id')->toArray() : [];
        $allThreadIds = array_merge($level0, $level1, $level2);

        $participantIds = AnnouncementComment::whereIn('id', $allThreadIds)
            ->where('user_id', '!=', $actor->id)
            ->whereNotIn('user_id', $mentionIds)
            ->pluck('user_id')
            ->unique();

        if ($participantIds->isEmpty()) {
            return;
        }

        $recipients = User::whereIn('id', $participantIds)->where('status', 'active')->get();
        if ($recipients->isEmpty()) {
            return;
        }

        $rows = $recipients->map(fn (User $user) => [
            'id'            => Str::uuid()->toString(),
            'user_id'       => $user->id,
            'actor_id'      => $actor->id,
            'actor_name'    => $actor->name,
            'action'        => 'replied_to_announcement_thread',
            'description'   => 'replied to a discussion on "' . $announcement->title . '"',
            'subject_type'  => Announcement::class,
            'subject_id'    => $announcement->id,
            'subject_label' => $announcement->title,
            'module'        => 'Announcement',
            'metadata'      => json_encode(['comment_id' => $comment->id, 'slug' => $announcement->slug]),
            'created_at'    => now(),
            'updated_at'    => now(),
        ])->toArray();

        Notification::insert($rows);
    }

}
