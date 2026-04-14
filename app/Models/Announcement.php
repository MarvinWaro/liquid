<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
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
    use HasFactory, HasUuid, LogsActivity, SoftDeletes;

    public const CATEGORIES = ['news', 'event', 'important', 'update'];

    protected $fillable = [
        'title', 'slug', 'category', 'tag_color', 'excerpt', 'content',
        'cover_original_path', 'cover_display_path', 'cover_thumb_path',
        'cover_focal_x', 'cover_focal_y',
        'is_featured', 'show_to_hei', 'published_at', 'end_date', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'is_featured' => 'boolean',
            'show_to_hei' => 'boolean',
            'published_at' => 'datetime',
            'end_date' => 'datetime',
            'cover_focal_x' => 'integer',
            'cover_focal_y' => 'integer',
        ];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(AnnouncementComment::class);
    }

    /**
     * Hide machine-y fields from the change diff in activity logs.
     */
    protected static function getActivityHiddenFields(): array
    {
        return ['slug', 'cover_original_path', 'cover_display_path', 'cover_thumb_path'];
    }

    protected static function getActivityFieldLabels(): array
    {
        return [
            'is_featured'   => 'Featured',
            'show_to_hei'   => 'Visible to HEI',
            'end_date'      => 'End Date',
            'published_at'  => 'Publish Date',
            'cover_focal_x' => 'Focal X',
            'cover_focal_y' => 'Focal Y',
        ];
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
        return $this->s3TempUrl($this->cover_thumb_path);
    }

    public function getCoverDisplayUrlAttribute(): ?string
    {
        return $this->s3TempUrl($this->cover_display_path);
    }

    public function getCoverOriginalUrlAttribute(): ?string
    {
        return $this->s3TempUrl($this->cover_original_path);
    }

    private function s3TempUrl(?string $path): ?string
    {
        if (!$path) {
            return null;
        }
        try {
            return Storage::disk('s3')->temporaryUrl($path, now()->addHours(2));
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Delete every cover variant from the public disk.
     */
    public function deleteCoverFiles(): void
    {
        $disk = Storage::disk('s3'); // Changed from 'public' to 's3'

        foreach (['cover_original_path', 'cover_display_path', 'cover_thumb_path'] as $field) {
            if ($this->{$field} && $disk->exists($this->{$field})) {
                $disk->delete($this->{$field});
            }
        }
    }
}
