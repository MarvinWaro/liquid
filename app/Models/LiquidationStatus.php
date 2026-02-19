<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;

/**
 * Liquidation Status lookup model.
 *
 * Represents the liquidation status of a liquidation record.
 * Used as a foreign key reference in liquidations.
 *
 * @property string $id
 * @property string $code
 * @property string $name
 * @property string|null $description
 * @property string $badge_color
 * @property int $sort_order
 * @property bool $is_active
 */
class LiquidationStatus extends Model
{
    use HasFactory, HasUuid;

    protected $fillable = [
        'code',
        'name',
        'description',
        'badge_color',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Status code constants.
     */
    public const CODE_UNLIQUIDATED = 'UNLIQUIDATED';
    public const CODE_PARTIALLY_LIQUIDATED = 'PARTIALLY_LIQUIDATED';
    public const CODE_FULLY_LIQUIDATED = 'FULLY_LIQUIDATED';

    /**
     * Get liquidations with this liquidation status.
     */
    public function liquidations(): HasMany
    {
        return $this->hasMany(Liquidation::class, 'liquidation_status_id');
    }

    /**
     * Scope to get only active statuses.
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
     * Get dropdown options for liquidation statuses.
     */
    public static function getDropdownOptions()
    {
        return static::active()
            ->ordered()
            ->get(['id', 'code', 'name', 'badge_color']);
    }

    /**
     * Find status by code.
     */
    public static function findByCode(string $code): ?self
    {
        return static::where('code', strtoupper($code))->first();
    }

    /**
     * Get the unliquidated status.
     */
    public static function unliquidated(): ?self
    {
        return static::findByCode(self::CODE_UNLIQUIDATED);
    }

    /**
     * Get the partially liquidated status.
     */
    public static function partiallyLiquidated(): ?self
    {
        return static::findByCode(self::CODE_PARTIALLY_LIQUIDATED);
    }

    /**
     * Get the fully liquidated status.
     */
    public static function fullyLiquidated(): ?self
    {
        return static::findByCode(self::CODE_FULLY_LIQUIDATED);
    }
}
