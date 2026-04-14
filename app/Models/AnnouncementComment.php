<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

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

    public function reactions(): HasMany
    {
        return $this->hasMany(AnnouncementCommentReaction::class, 'comment_id');
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
     * Format this comment for API / Inertia responses.
     * Prefer the allReplies relation (includes trashed) when loaded, fall back to replies.
     */
    public function format(?string $viewerId = null): array
    {
        $reactions = $this->relationLoaded('reactions') ? $this->reactions : collect();
        $isDeleted = !is_null($this->deleted_at);

        $repliesKey = match (true) {
            $this->relationLoaded('allReplies') => 'allReplies',
            $this->relationLoaded('replies')    => 'replies',
            default                             => null,
        };

        return [
            'id'              => $this->id,
            'parent_id'       => $this->parent_id,
            'user_id'         => $this->user_id,
            'user_name'       => $isDeleted ? null : ($this->user?->name ?? 'Unknown'),
            'user_avatar_url' => $isDeleted ? null : $this->user?->avatar_url,
            'user_role'       => $isDeleted ? null : $this->user?->role?->name,
            'is_deleted'      => $isDeleted,
            'body'            => $isDeleted ? null : $this->body,
            'mentions'        => $isDeleted ? null : $this->mentions,
            'created_at'      => $this->created_at->toIso8601String(),
            'time_ago'        => $this->created_at->diffForHumans(),
            'reactions_count' => $isDeleted ? 0 : $reactions->count(),
            'has_reacted'     => $isDeleted ? false : ($viewerId ? $reactions->contains('user_id', $viewerId) : false),
            'replies'         => $repliesKey
                ? $this->$repliesKey->map(fn ($r) => $r->format($viewerId))->toArray()
                : [],
        ];
    }
}
