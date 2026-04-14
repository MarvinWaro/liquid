<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Liquidation;
use App\Models\LiquidationComment;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LiquidationCommentController extends Controller
{
    private const MAX_DEPTH = 2; // 3 levels: 0, 1, 2

    /**
     * List comments for a specific document requirement (lazy loaded).
     */
    public function index(Request $request, Liquidation $liquidation): JsonResponse
    {
        $requirementId = $request->query('document_requirement_id');

        $comments = LiquidationComment::where('liquidation_id', $liquidation->id)
            ->where('document_requirement_id', $requirementId)
            ->whereNull('parent_id')
            ->with(['user.role', 'replies.user.role', 'replies.replies.user.role'])
            ->orderBy('created_at')
            ->get()
            ->map(fn ($c) => $this->formatComment($c));

        return response()->json($comments);
    }

    /**
     * Store a new comment (or reply).
     */
    public function store(Request $request, Liquidation $liquidation): JsonResponse
    {
        $validated = $request->validate([
            'body' => 'nullable|string|max:2000',
            'parent_id' => 'nullable|uuid|exists:liquidation_comments,id',
            'document_requirement_id' => 'nullable|uuid|exists:document_requirements,id',
            'mentions' => 'nullable|array',
            'mentions.*' => 'uuid|exists:users,id',
            'attachments' => 'nullable|array|max:3',
            'attachments.*' => 'file|max:10240|mimes:pdf,jpg,jpeg,png,gif,webp',
        ]);

        $bodyText = trim($validated['body'] ?? '');
        $hasAttachments = $request->hasFile('attachments');

        if ($bodyText === '' && !$hasAttachments) {
            return response()->json(['message' => 'A comment must have text or at least one attachment.'], 422);
        }

        // Enforce max depth: if parent is at max depth, flatten to its parent
        $parentId = $validated['parent_id'] ?? null;
        if ($parentId) {
            $depth = $this->getCommentDepth($parentId);
            if ($depth >= self::MAX_DEPTH) {
                $parentId = LiquidationComment::find($parentId)?->parent_id ?? $parentId;
            }
        }

        $mentionIds = $validated['mentions'] ?? ($bodyText ? LiquidationComment::parseMentions($bodyText) : []);

        // Handle file attachments (up to 3)
        $attachments = [];
        if ($hasAttachments) {
            foreach ($request->file('attachments') as $file) {
                $fileName = time() . '_' . $file->getClientOriginalName();
                $filePath = $file->storeAs('comment_attachments/' . $liquidation->id, $fileName, 's3');
                $attachments[] = [
                    'path' => $filePath,
                    'name' => $file->getClientOriginalName(),
                    'size' => $file->getSize(),
                ];
            }
        }

        $comment = LiquidationComment::create([
            'liquidation_id' => $liquidation->id,
            'user_id' => $request->user()->id,
            'parent_id' => $parentId,
            'document_requirement_id' => $validated['document_requirement_id'] ?? null,
            'body' => $bodyText,
            'mentions' => !empty($mentionIds) ? $mentionIds : null,
            'attachments' => !empty($attachments) ? $attachments : null,
        ]);

        $actor = $request->user();
        $this->notifyMentionedUsers($comment, $liquidation, $actor, $mentionIds);
        $this->notifyThreadParticipants($comment, $liquidation, $actor, $mentionIds);
        $this->notifyLiquidationStakeholders($comment, $liquidation, $actor, $mentionIds);

        $comment->load('user.role');

        return response()->json([
            'success' => true,
            'comment' => $this->formatComment($comment),
        ]);
    }

    /**
     * Download a comment attachment by index.
     */
    public function downloadAttachment(LiquidationComment $comment, int $index): StreamedResponse
    {
        $attachments = $comment->attachments ?? [];

        if (!isset($attachments[$index]) || !Storage::disk('s3')->exists($attachments[$index]['path'])) {
            abort(404, 'Attachment not found.');
        }

        return Storage::disk('s3')->download($attachments[$index]['path'], $attachments[$index]['name']);
    }

    /**
     * Delete own comment.
     */
    public function destroy(Request $request, Liquidation $liquidation, LiquidationComment $comment): JsonResponse
    {
        if ($comment->user_id !== $request->user()->id && !$request->user()->isAdmin() && !$request->user()->isSuperAdmin()) {
            abort(403, 'You can only delete your own comments.');
        }

        $comment->delete();

        return response()->json(['success' => true]);
    }

    /**
     * Get mentionable users for a liquidation.
     */
    public function mentionableUsers(Request $request, Liquidation $liquidation): JsonResponse
    {
        $liquidation->loadMissing(['hei', 'program']);
        $currentUserId = $request->user()->id;
        $isSTUFAPSProgram = $liquidation->program && $liquidation->program->parent_id;

        $users = User::where('status', 'active')
            ->where('id', '!=', $currentUserId)
            ->where(function ($q) use ($liquidation, $isSTUFAPSProgram) {
                // HEI users for this liquidation's institution
                $q->where('hei_id', $liquidation->hei_id);
                // For STUFAPS sub-programs: show STUFAPS Focals assigned to the program
                if ($isSTUFAPSProgram) {
                    $q->orWhere(function ($sub) use ($liquidation) {
                        $sub->whereHas('role', fn ($r) => $r->where('name', 'STUFAPS Focal'))
                            ->whereHas('programs', fn ($r) => $r->where('programs.id', $liquidation->program_id));
                    });
                } else {
                    // For non-STUFAPS: show RCs for the same region
                    if ($liquidation->hei?->region_id) {
                        $q->orWhere(function ($sub) use ($liquidation) {
                            $sub->whereHas('role', fn ($r) => $r->where('name', 'Regional Coordinator'))
                                ->where('region_id', $liquidation->hei->region_id);
                        });
                    }
                }
                // Accountants and admins
                $q->orWhereHas('role', fn ($r) => $r->whereIn('name', ['Accountant', 'COA', 'Admin', 'Super Admin']));
            })
            ->with('role')
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
     * Notify mentioned users.
     */
    private function notifyMentionedUsers(LiquidationComment $comment, Liquidation $liquidation, User $actor, array $mentionIds): void
    {
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

        $liquidation->loadMissing('hei');
        $description = 'mentioned you in a comment on ' . $liquidation->control_no;
        $metadata = $comment->document_requirement_id
            ? json_encode(['document_requirement_id' => $comment->document_requirement_id])
            : null;

        $rows = $recipients->map(fn (User $user) => [
            'id' => Str::uuid()->toString(),
            'user_id' => $user->id,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'action' => 'mentioned_in_comment',
            'description' => $description,
            'subject_type' => Liquidation::class,
            'subject_id' => $liquidation->id,
            'subject_label' => $liquidation->control_no,
            'module' => 'Liquidation',
            'metadata' => $metadata,
            'created_at' => now(),
            'updated_at' => now(),
        ])->toArray();

        Notification::insert($rows);
    }

    /**
     * Calculate the depth of a comment in the tree (0 = top-level).
     */
    private function getCommentDepth(string $commentId): int
    {
        $depth = 0;
        $current = LiquidationComment::find($commentId);

        while ($current?->parent_id) {
            $depth++;
            $current = LiquidationComment::find($current->parent_id);
        }

        return $depth;
    }

    /**
     * Notify all participants in a comment thread (excluding mentioned users who already got notified).
     */
    private function notifyThreadParticipants(LiquidationComment $comment, Liquidation $liquidation, User $actor, array $mentionIds): void
    {
        if (!$comment->parent_id) {
            return; // Top-level comments don't trigger thread notifications
        }

        // Walk up to find the root comment
        $rootId = $comment->parent_id;
        $current = LiquidationComment::find($rootId);
        while ($current?->parent_id) {
            $rootId = $current->parent_id;
            $current = LiquidationComment::find($current->parent_id);
        }

        // Collect all comment IDs in this thread tree (3 levels max)
        $level0 = [$rootId];
        $level1 = LiquidationComment::whereIn('parent_id', $level0)->pluck('id')->toArray();
        $level2 = !empty($level1) ? LiquidationComment::whereIn('parent_id', $level1)->pluck('id')->toArray() : [];
        $allThreadIds = array_merge($level0, $level1, $level2);

        // Get unique user IDs from all thread comments, excluding actor and already-mentioned users
        $participantIds = LiquidationComment::whereIn('id', $allThreadIds)
            ->where('user_id', '!=', $actor->id)
            ->whereNotIn('user_id', $mentionIds)
            ->pluck('user_id')
            ->unique();

        if ($participantIds->isEmpty()) {
            return;
        }

        $recipients = User::whereIn('id', $participantIds)
            ->where('status', 'active')
            ->get();

        if ($recipients->isEmpty()) {
            return;
        }

        $liquidation->loadMissing('hei');
        $description = 'replied to a conversation on ' . $liquidation->control_no;
        $metadata = $comment->document_requirement_id
            ? json_encode(['document_requirement_id' => $comment->document_requirement_id])
            : null;

        $rows = $recipients->map(fn (User $user) => [
            'id' => Str::uuid()->toString(),
            'user_id' => $user->id,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'action' => 'replied_to_thread',
            'description' => $description,
            'subject_type' => Liquidation::class,
            'subject_id' => $liquidation->id,
            'subject_label' => $liquidation->control_no,
            'module' => 'Liquidation',
            'metadata' => $metadata,
            'created_at' => now(),
            'updated_at' => now(),
        ])->toArray();

        Notification::insert($rows);
    }

    /**
     * Notify liquidation stakeholders about new comments.
     * If the commenter is an RC/Accountant/Admin, notify the HEI users.
     * If the commenter is from the HEI, notify the relevant RC users.
     * Excludes users already notified via mentions or thread replies.
     */
    private function notifyLiquidationStakeholders(LiquidationComment $comment, Liquidation $liquidation, User $actor, array $mentionIds): void
    {
        $liquidation->loadMissing('hei');

        // Collect user IDs already notified (mentions + thread participants)
        $alreadyNotified = collect($mentionIds);
        if ($comment->parent_id) {
            // Thread participants were already notified by notifyThreadParticipants
            $rootId = $comment->parent_id;
            $current = LiquidationComment::find($rootId);
            while ($current?->parent_id) {
                $rootId = $current->parent_id;
                $current = LiquidationComment::find($current->parent_id);
            }
            $level0 = [$rootId];
            $level1 = LiquidationComment::whereIn('parent_id', $level0)->pluck('id')->toArray();
            $level2 = !empty($level1) ? LiquidationComment::whereIn('parent_id', $level1)->pluck('id')->toArray() : [];
            $threadUserIds = LiquidationComment::whereIn('id', array_merge($level0, $level1, $level2))
                ->pluck('user_id');
            $alreadyNotified = $alreadyNotified->merge($threadUserIds);
        }
        $alreadyNotified = $alreadyNotified->unique()->toArray();

        $isActorHei = $actor->hei_id && $actor->hei_id === $liquidation->hei_id;
        $actor->loadMissing('role');
        $liquidation->loadMissing('program');
        $isSTUFAPSProgram = $liquidation->program && $liquidation->program->parent_id;
        $isEndorsedToAccounting = $liquidation->reviewed_at !== null;
        $isEndorsedToCOA = $liquidation->coa_endorsed_at !== null;
        $actorRoleName = $actor->role?->name;

        $recipients = collect();

        // Helper to fetch RC/STUFAPS Focal users for this liquidation
        $getRcFocalUsers = function (array $excludeIds) use ($actor, $liquidation, $isSTUFAPSProgram) {
            if ($isSTUFAPSProgram) {
                return User::where('status', 'active')
                    ->where('id', '!=', $actor->id)
                    ->whereNotIn('id', $excludeIds)
                    ->whereHas('role', fn ($q) => $q->where('name', 'STUFAPS Focal'))
                    ->whereHas('programs', fn ($q) => $q->where('programs.id', $liquidation->program_id))
                    ->get();
            }
            return User::where('status', 'active')
                ->where('id', '!=', $actor->id)
                ->whereNotIn('id', $excludeIds)
                ->where('region_id', $liquidation->hei?->region_id)
                ->whereHas('role', fn ($q) => $q->where('name', 'Regional Coordinator'))
                ->get();
        };

        // Helper to fetch Accountant users
        $getAccountants = function (array $excludeIds) use ($actor) {
            return User::where('status', 'active')
                ->where('id', '!=', $actor->id)
                ->whereNotIn('id', $excludeIds)
                ->whereHas('role', fn ($q) => $q->where('name', 'Accountant'))
                ->get();
        };

        // Helper to fetch COA users
        $getCOAUsers = function (array $excludeIds) use ($actor) {
            return User::where('status', 'active')
                ->where('id', '!=', $actor->id)
                ->whereNotIn('id', $excludeIds)
                ->whereHas('role', fn ($q) => $q->where('name', 'COA'))
                ->get();
        };

        // Helper to fetch HEI users for this liquidation
        $getHeiUsers = function (array $excludeIds) use ($actor, $liquidation) {
            return User::where('status', 'active')
                ->where('id', '!=', $actor->id)
                ->whereNotIn('id', $excludeIds)
                ->where('hei_id', $liquidation->hei_id)
                ->get();
        };

        if ($isActorHei) {
            // HEI commented → notify RC/STUFAPS Focal
            $recipients = $getRcFocalUsers($alreadyNotified);

            // Also notify Accountants if endorsed to Accounting
            if ($isEndorsedToAccounting) {
                $recipients = $recipients->merge($getAccountants(array_merge($alreadyNotified, $recipients->pluck('id')->toArray())));
            }
            // Also notify COA if endorsed to COA
            if ($isEndorsedToCOA) {
                $recipients = $recipients->merge($getCOAUsers(array_merge($alreadyNotified, $recipients->pluck('id')->toArray())));
            }
        } elseif ($actorRoleName === 'COA') {
            // COA commented → notify Accountant, RC/STUFAPS Focal, and HEI
            $heiUsers = $getHeiUsers($alreadyNotified);
            $rcUsers = $getRcFocalUsers(array_merge($alreadyNotified, $heiUsers->pluck('id')->toArray()));
            $accountants = $getAccountants(array_merge($alreadyNotified, $heiUsers->pluck('id')->toArray(), $rcUsers->pluck('id')->toArray()));
            $recipients = $heiUsers->merge($rcUsers)->merge($accountants);
        } elseif ($actorRoleName === 'Accountant') {
            // Accountant commented → notify HEI users AND RC/STUFAPS Focal
            $heiUsers = $getHeiUsers($alreadyNotified);
            $rcUsers = $getRcFocalUsers(array_merge($alreadyNotified, $heiUsers->pluck('id')->toArray()));
            $recipients = $heiUsers->merge($rcUsers);

            // Also notify COA if endorsed to COA
            if ($isEndorsedToCOA) {
                $recipients = $recipients->merge($getCOAUsers(array_merge($alreadyNotified, $recipients->pluck('id')->toArray())));
            }
        } else {
            // RC/Admin/STUFAPS Focal commented → notify HEI users
            $recipients = $getHeiUsers($alreadyNotified);

            // Also notify Accountants if endorsed to Accounting
            if ($isEndorsedToAccounting) {
                $recipients = $recipients->merge($getAccountants(array_merge($alreadyNotified, $recipients->pluck('id')->toArray())));
            }
            // Also notify COA if endorsed to COA
            if ($isEndorsedToCOA) {
                $recipients = $recipients->merge($getCOAUsers(array_merge($alreadyNotified, $recipients->pluck('id')->toArray())));
            }
        }

        if ($recipients->isEmpty()) {
            return;
        }

        $description = 'commented on a document requirement on ' . $liquidation->control_no;
        $metadata = $comment->document_requirement_id
            ? json_encode(['document_requirement_id' => $comment->document_requirement_id])
            : null;

        $rows = $recipients->map(fn (User $user) => [
            'id' => Str::uuid()->toString(),
            'user_id' => $user->id,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'action' => 'commented_on_requirement',
            'description' => $description,
            'subject_type' => Liquidation::class,
            'subject_id' => $liquidation->id,
            'subject_label' => $liquidation->control_no,
            'module' => 'Liquidation',
            'metadata' => $metadata,
            'created_at' => now(),
            'updated_at' => now(),
        ])->toArray();

        Notification::insert($rows);
    }

    private function formatComment(LiquidationComment $comment): array
    {
        return [
            'id' => $comment->id,
            'user_id' => $comment->user_id,
            'user_name' => $comment->user?->name ?? 'Unknown',
            'user_avatar_url' => $comment->user?->avatar_url,
            'user_role' => $comment->user?->role?->name,
            'parent_id' => $comment->parent_id,
            'body' => $comment->body,
            'mentions' => $comment->mentions,
            'attachments' => collect($comment->attachments ?? [])->map(fn ($att, $i) => [
                'url' => url('liquidation-comments/' . $comment->id . '/attachment/' . $i),
                'name' => $att['name'],
                'size' => $att['size'],
            ])->toArray(),
            'created_at' => $comment->created_at->toIso8601String(),
            'time_ago' => $comment->created_at->diffForHumans(),
            'replies' => $comment->relationLoaded('replies')
                ? $comment->replies->map(fn ($r) => $this->formatComment($r))->toArray()
                : [],
        ];
    }
}
