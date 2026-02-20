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
 * Compliance Status lookup model.
 *
 * Represents the compliance status of a liquidation compliance record.
 * Used as a foreign key reference in liquidation_compliance.
 *
 * @property string $id
 * @property string $code
 * @property string $name
 * @property string|null $description
 * @property string $badge_color
 * @property int $sort_order
 * @property bool $is_active
 */
class ComplianceStatus extends Model
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
            'is_active'  => 'boolean',
        ];
    }

    /**
     * Compliance status code constants.
     */
    public const CODE_PENDING_HEI_REVIEW  = 'pending_hei_review';
    public const CODE_DOCUMENTS_SUBMITTED = 'documents_submitted';
    public const CODE_UNDER_REVIEW        = 'under_review';
    public const CODE_COMPLIANT           = 'compliant';
    public const CODE_NON_COMPLIANT       = 'non_compliant';

    /**
     * Get compliance records with this status.
     */
    public function complianceRecords(): HasMany
    {
        return $this->hasMany(LiquidationCompliance::class, 'compliance_status_id');
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
     * Find a compliance status by its code (cached for 24 hours — this data never changes).
     */
    public static function findByCode(string $code): ?self
    {
        return Cache::remember("compliance_status:code:{$code}", 86400, function () use ($code) {
            return static::where('code', $code)->first();
        });
    }
}
