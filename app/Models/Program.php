<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Program extends Model
{
    use HasUuid, LogsActivity;

    protected static function getActivityModule(): string
    {
        return 'Programs';
    }

    protected static function getActivityFieldLabels(): array
    {
        return [
            'parent_id'   => 'Parent Program',
            'code'        => 'Code',
            'name'        => 'Name',
            'description' => 'Description',
            'status'      => 'Status',
        ];
    }

    protected static function getActivityForeignKeys(): array
    {
        return [
            'parent_id' => ['parent', 'name'],
        ];
    }

    protected $fillable = [
        'parent_id',
        'code',
        'name',
        'description',
        'status',
    ];

    /**
     * Get the parent program (e.g., STUFAPs).
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Program::class, 'parent_id');
    }

    /**
     * Get child/sub-programs.
     */
    public function children(): HasMany
    {
        return $this->hasMany(Program::class, 'parent_id');
    }

    /**
     * Whether this program is a parent (umbrella) program.
     */
    public function isParent(): bool
    {
        return $this->children()->exists();
    }

    /**
     * Whether this program is a sub-program.
     */
    public function isChild(): bool
    {
        return $this->parent_id !== null;
    }

    /**
     * Get liquidations for this program.
     */
    public function liquidations(): HasMany
    {
        return $this->hasMany(Liquidation::class);
    }

    /**
     * Get document requirements for this program.
     */
    public function documentRequirements(): HasMany
    {
        return $this->hasMany(DocumentRequirement::class);
    }

    /**
     * Check if program is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Scope to get only active programs.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope to get only top-level programs (no parent).
     */
    public function scopeTopLevel($query)
    {
        return $query->whereNull('parent_id');
    }
}
