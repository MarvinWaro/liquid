<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;

class DocumentRequirement extends Model
{
    use HasFactory, HasUuid, LogsActivity;

    protected static function getActivityModule(): string
    {
        return 'Document Requirements';
    }

    protected static function getActivityForeignKeys(): array
    {
        return [
            'program_id' => ['program', 'name'],
        ];
    }

    protected static function getActivityFieldLabels(): array
    {
        return [
            'program_id' => 'Program',
            'code' => 'Code',
            'name' => 'Name',
            'description' => 'Description',
            'upload_message' => 'Upload Message',
            'sort_order' => 'Sort Order',
            'is_active' => 'Active',
            'is_required' => 'Required',
        ];
    }

    protected $fillable = [
        'program_id',
        'code',
        'name',
        'description',
        'reference_image_path',
        'upload_message',
        'sort_order',
        'is_active',
        'is_required',
    ];

    protected $appends = ['reference_image_url'];

    public function getReferenceImageUrlAttribute(): ?string
    {
        if (!$this->reference_image_path) {
            return null;
        }
        return '/storage/' . $this->reference_image_path;
    }

    protected static function getActivityHiddenFields(): array
    {
        return ['reference_image_path'];
    }

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_active' => 'boolean',
            'is_required' => 'boolean',
        ];
    }

    /**
     * Get the program this requirement belongs to.
     */
    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    /**
     * Get documents uploaded for this requirement.
     */
    public function documents(): HasMany
    {
        return $this->hasMany(LiquidationDocument::class);
    }

    /**
     * Scope to get only active requirements.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to order by sort order.
     */
    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('sort_order');
    }

    /**
     * Scope to filter by program.
     */
    public function scopeForProgram(Builder $query, string $programId): Builder
    {
        return $query->where('program_id', $programId);
    }
}
