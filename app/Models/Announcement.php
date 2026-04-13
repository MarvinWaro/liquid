<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * @property string $id
 * @property string $title
 * @property string $slug
 * @property string $category
 * @property string|null $tag_color
 * @property string|null $excerpt
 * @property string $content
 * @property string|null $cover_original_path
 * @property string|null $cover_display_path
 * @property string|null $cover_thumb_path
 * @property bool $is_featured
 * @property bool $show_to_hei
 * @property \Carbon\Carbon|null $published_at
 * @property \Carbon\Carbon|null $end_date
 * @property string|null $created_by
 */
class Announcement extends Model
{
    use HasFactory, HasUuid, SoftDeletes;

    public const CATEGORIES = ['news', 'event', 'important', 'update'];

    protected $fillable = [
        'title', 'slug', 'category', 'tag_color', 'excerpt', 'content',
        'cover_original_path', 'cover_display_path', 'cover_thumb_path',
        'is_featured', 'show_to_hei', 'published_at', 'end_date', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'is_featured' => 'boolean',
            'show_to_hei' => 'boolean',
            'published_at' => 'datetime',
            'end_date' => 'datetime',
        ];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Only posts that are currently visible:
     *  - published_at <= now
     *  - end_date is null OR end_date > now
     */
    public function scopeVisible(Builder $query): Builder
    {
        return $query
            ->where('published_at', '<=', now())
            ->where(function ($q) {
                $q->whereNull('end_date')
                  ->orWhere('end_date', '>', now());
            });
    }

    /**
     * Generate a unique slug from the title.
     */
    public static function uniqueSlug(string $title, ?string $ignoreId = null): string
    {
        $base = Str::slug($title) ?: Str::random(8);
        $slug = $base;
        $i = 2;

        while (static::where('slug', $slug)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->exists()
        ) {
            $slug = "{$base}-{$i}";
            $i++;
        }

        return $slug;
    }

    public function getCoverThumbUrlAttribute(): ?string
    {
        return $this->cover_thumb_path ? '/storage/' . $this->cover_thumb_path : null;
    }

    public function getCoverDisplayUrlAttribute(): ?string
    {
        return $this->cover_display_path ? '/storage/' . $this->cover_display_path : null;
    }

    public function getCoverOriginalUrlAttribute(): ?string
    {
        return $this->cover_original_path ? '/storage/' . $this->cover_original_path : null;
    }

    /**
     * Delete every cover variant from the public disk.
     */
    public function deleteCoverFiles(): void
    {
        $disk = Storage::disk('public');
        foreach (['cover_original_path', 'cover_display_path', 'cover_thumb_path'] as $field) {
            if ($this->{$field} && $disk->exists($this->{$field})) {
                $disk->delete($this->{$field});
            }
        }
    }
}
