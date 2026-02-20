<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Cache;

/**
 * Review Type lookup model.
 *
 * Represents the type of a liquidation review action.
 * Used as a foreign key reference in liquidation_reviews.
 *
 * @property string $id
 * @property string $code
 * @property string $name
 * @property string|null $description
 * @property int $sort_order
 * @property bool $is_active
 */
class ReviewType extends Model
{
    use HasFactory, HasUuid;

    protected $fillable = [
        'code',
        'name',
        'description',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_active'  => 'boolean',
        ];
    }

    /**
     * Review type code constants.
     */
    public const CODE_RC_RETURN              = 'rc_return';
    public const CODE_RC_ENDORSEMENT         = 'rc_endorsement';
    public const CODE_HEI_RESUBMISSION       = 'hei_resubmission';
    public const CODE_ACCOUNTANT_RETURN      = 'accountant_return';
    public const CODE_ACCOUNTANT_ENDORSEMENT = 'accountant_endorsement';

    /**
     * Get reviews of this type.
     */
    public function reviews(): HasMany
    {
        return $this->hasMany(LiquidationReview::class, 'review_type_id');
    }

    /**
     * Scope to get only active types.
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
     * Find a review type by its code (cached for 24 hours — this data never changes).
     */
    public static function findByCode(string $code): ?self
    {
        return Cache::remember("review_type:code:{$code}", 86400, function () use ($code) {
            return static::where('code', $code)->first();
        });
    }
}
