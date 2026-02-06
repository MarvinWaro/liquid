<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;

/**
 * Document Status lookup model.
 *
 * Represents the submission status of liquidation documents.
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
class DocumentStatus extends Model
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
        'description',
        'badge_color',
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
     * Status code constants.
     */
    public const CODE_COMPLETE = 'COMPLETE';
    public const CODE_PARTIAL = 'PARTIAL';
    public const CODE_NONE = 'NONE';

    /**
     * Get liquidations with this document status.
     */
    public function liquidations(): HasMany
    {
        return $this->hasMany(Liquidation::class, 'document_status_id');
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
     * Get dropdown options for document statuses.
     *
     * @return \Illuminate\Support\Collection
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
     * Get the complete submission status.
     */
    public static function complete(): ?self
    {
        return static::findByCode(self::CODE_COMPLETE);
    }

    /**
     * Get the partial submission status.
     */
    public static function partial(): ?self
    {
        return static::findByCode(self::CODE_PARTIAL);
    }

    /**
     * Get the no submission status.
     */
    public static function none(): ?self
    {
        return static::findByCode(self::CODE_NONE);
    }
}
