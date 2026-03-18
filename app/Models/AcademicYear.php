<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;

/**
 * Academic Year lookup model.
 *
 * Represents academic year periods (e.g., 2024-2025).
 * Used as a foreign key reference in liquidations.
 *
 * @property string $id
 * @property string $code
 * @property string $name
 * @property \Carbon\Carbon|null $start_date
 * @property \Carbon\Carbon|null $end_date
 * @property int $sort_order
 * @property bool $is_active
 */
class AcademicYear extends Model
{
    use HasFactory, HasUuid, LogsActivity;

    protected static function getActivityModule(): string
    {
        return 'Settings';
    }

    protected static function getActivityModelLabel(): string
    {
        return 'academic year';
    }

    protected static function getActivityFieldLabels(): array
    {
        return [
            'code' => 'Code',
            'name' => 'Name',
            'start_date' => 'Start Date',
            'end_date' => 'End Date',
            'sort_order' => 'Sort Order',
            'is_active' => 'Active',
        ];
    }

    protected $fillable = [
        'code',
        'name',
        'start_date',
        'end_date',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Get liquidations for this academic year.
     */
    public function liquidations(): HasMany
    {
        return $this->hasMany(Liquidation::class, 'academic_year_id');
    }

    /**
     * Get per-AY document requirement overrides.
     */
    public function requirementConfigs(): HasMany
    {
        return $this->hasMany(AcademicYearDocumentRequirement::class);
    }

    /**
     * Whether this academic year has custom document requirement configuration.
     */
    public function hasRequirementConfig(): bool
    {
        return $this->requirementConfigs()->exists();
    }

    /**
     * Scope to get only active academic years.
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
     * Get dropdown options for academic years.
     */
    public static function getDropdownOptions()
    {
        return static::active()
            ->ordered()
            ->get(['id', 'code', 'name']);
    }

    /**
     * Find academic year by code.
     */
    public static function findByCode(string $code): ?self
    {
        return static::where('code', trim($code))->first();
    }
}
