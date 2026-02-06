<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;

/**
 * Semester lookup model.
 *
 * Represents academic semester periods (1st, 2nd, Summer).
 * Used as a foreign key reference in liquidations.
 *
 * @property string $id
 * @property string $code
 * @property string $name
 * @property int $sort_order
 * @property bool $is_active
 */
class Semester extends Model
{
    use HasFactory, HasUuid;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'code',
        'name',
        'sort_order',
        'is_active',
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Semester code constants.
     */
    public const CODE_FIRST = '1ST';
    public const CODE_SECOND = '2ND';
    public const CODE_SUMMER = 'SUM';

    /**
     * Get liquidations for this semester.
     */
    public function liquidations(): HasMany
    {
        return $this->hasMany(Liquidation::class, 'semester_id');
    }

    /**
     * Scope to get only active semesters.
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
     * Get dropdown options for semesters.
     *
     * @return \Illuminate\Support\Collection
     */
    public static function getDropdownOptions()
    {
        return static::active()
            ->ordered()
            ->get(['id', 'code', 'name']);
    }

    /**
     * Find semester by code.
     */
    public static function findByCode(string $code): ?self
    {
        return static::where('code', strtoupper($code))->first();
    }
}
