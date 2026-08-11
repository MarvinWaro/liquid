<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Collection;

class AnnouncementComment extends Model
{
    use HasUuid, SoftDeletes;

    protected $fillable = [
        'announcement_id',
        'user_id',
        'parent_id',
        'body',
        'mentions',
    ];

    protected function casts(): array
    {
        return [
            'mentions' => 'array',
        ];
    }

    public function announcement(): BelongsTo
    {
        return $this->belongsTo(Announcement::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('created_at');
    }

    /**
     * Like replies() but includes soft-deleted comments so threads stay intact
     * and deleted parents can be rendered as "[comment deleted]" placeholders.
     */
    public function allReplies(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')
            ->withTrashed()
            ->orderBy('created_at');
    }

    /**
     * How many reactor names are sent to the client. The tooltip shows these and
     * summarises the rest as "and N others", so the payload stays flat no matter
     * how popular a comment gets.
     */
    public const REACTOR_NAMES_LIMIT = 10;

    public function reactions(): HasMany
    {
        // Oldest first, so the names in the tooltip stay in a stable order
        // between page loads instead of shuffling with whatever the DB returns.
        return $this->hasMany(AnnouncementCommentReaction::class, 'comment_id')
            ->orderBy('created_at');
    }

    /**
     * Extract mentioned user IDs from @[Name](userId) markers.
     */
    public static function parseMentions(string $body): array
    {
        preg_match_all('/@\[.+?\]\(([a-f0-9\-]+)\)/', $body, $matches);

        return array_values(array_unique($matches[1] ?? []));
    }

    /**
     * Names to show in the "who reacted" tooltip, capped at REACTOR_NAMES_LIMIT.
     *
     * The viewer is listed first as "You", the way Facebook does it, so someone
     * can tell at a glance whether their own like registered. Everyone else keeps
     * their oldest-first order.
     *
     * Expects the reactions' `user` relation to be loaded; a reaction whose user
     * row is gone is skipped rather than rendered as a blank line.
     *
     * @param  Collection<int, AnnouncementCommentReaction>  $reactions
     * @return list<string>
     */
    public static function reactorNames(Collection $reactions, ?string $viewerId): array
    {
        $viewerReacted = $viewerId && $reactions->contains('user_id', $viewerId);

        $others = $reactions
            ->reject(fn ($reaction) => $viewerId && $reaction->user_id === $viewerId)
            ->map(fn ($reaction) => $reaction->user?->name)
            ->filter()
            ->values()
            ->all();

        $names = $viewerReacted ? ['You', ...$others] : $others;

        return array_slice($names, 0, self::REACTOR_NAMES_LIMIT);
    }

    /**
     * Format this comment for API / Inertia responses.
     * Prefer the allReplies relation (includes trashed) when loaded, fall back to replies.
     */
    public function format(?string $viewerId = null): array
    {
        $reactions = $this->relationLoaded('reactions') ? $this->reactions : collect();
        $isDeleted = ! is_null($this->deleted_at);

        $repliesKey = match (true) {
            $this->relationLoaded('allReplies') => 'allReplies',
            $this->relationLoaded('replies') => 'replies',
            default => null,
        };

        return [
            'id' => $this->id,
            'parent_id' => $this->parent_id,
            'user_id' => $this->user_id,
            'user_name' => $isDeleted ? null : ($this->user?->name ?? 'Unknown'),
            'user_avatar_url' => $isDeleted ? null : $this->user?->avatar_url,
            'user_role' => $isDeleted ? null : $this->user?->role?->name,
            'is_deleted' => $isDeleted,
            'body' => $isDeleted ? null : $this->body,
            'mentions' => $isDeleted ? null : $this->mentions,
            'created_at' => $this->created_at->toIso8601String(),
            'time_ago' => $this->created_at->diffForHumans(),
            'reactions_count' => $isDeleted ? 0 : $reactions->count(),
            'has_reacted' => $isDeleted ? false : ($viewerId ? $reactions->contains('user_id', $viewerId) : false),
            'reactor_names' => $isDeleted ? [] : self::reactorNames($reactions, $viewerId),
            'replies' => $repliesKey
                ? $this->$repliesKey->map(fn ($r) => $r->format($viewerId))->toArray()
                : [],
        ];
    }
}
