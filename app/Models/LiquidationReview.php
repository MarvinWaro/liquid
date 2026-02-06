<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiquidationReview extends Model
{
    use HasFactory, HasUuid;

    protected $fillable = [
        'liquidation_id',
        'review_type',
        'performed_by',
        'performed_by_name',
        'remarks',
        'documents_for_compliance',
        'performed_at',
    ];

    protected function casts(): array
    {
        return [
            'performed_at' => 'datetime',
        ];
    }

    /**
     * Review type constants.
     */
    public const TYPE_RC_RETURN = 'rc_return';
    public const TYPE_RC_ENDORSEMENT = 'rc_endorsement';
    public const TYPE_HEI_RESUBMISSION = 'hei_resubmission';
    public const TYPE_ACCOUNTANT_RETURN = 'accountant_return';
    public const TYPE_ACCOUNTANT_ENDORSEMENT = 'accountant_endorsement';

    /**
     * Get the liquidation this review belongs to.
     */
    public function liquidation(): BelongsTo
    {
        return $this->belongsTo(Liquidation::class);
    }

    /**
     * Get the user who performed the action.
     */
    public function performer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'performed_by');
    }

    /**
     * Check if this is an RC return.
     */
    public function isRCReturn(): bool
    {
        return $this->review_type === self::TYPE_RC_RETURN;
    }

    /**
     * Check if this is an HEI resubmission.
     */
    public function isHEIResubmission(): bool
    {
        return $this->review_type === self::TYPE_HEI_RESUBMISSION;
    }

    /**
     * Check if this is an Accountant return.
     */
    public function isAccountantReturn(): bool
    {
        return $this->review_type === self::TYPE_ACCOUNTANT_RETURN;
    }

    /**
     * Get human-readable review type.
     */
    public function getTypeLabel(): string
    {
        return match($this->review_type) {
            self::TYPE_RC_RETURN => 'RC Return',
            self::TYPE_RC_ENDORSEMENT => 'RC Endorsement',
            self::TYPE_HEI_RESUBMISSION => 'HEI Resubmission',
            self::TYPE_ACCOUNTANT_RETURN => 'Accountant Return',
            self::TYPE_ACCOUNTANT_ENDORSEMENT => 'Accountant Endorsement',
            default => ucfirst(str_replace('_', ' ', $this->review_type)),
        };
    }

    /**
     * Scope to filter by review type.
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('review_type', $type);
    }

    /**
     * Scope to get RC reviews only.
     */
    public function scopeRcReviews($query)
    {
        return $query->whereIn('review_type', [self::TYPE_RC_RETURN, self::TYPE_HEI_RESUBMISSION]);
    }

    /**
     * Scope to get Accountant reviews only.
     */
    public function scopeAccountantReviews($query)
    {
        return $query->where('review_type', self::TYPE_ACCOUNTANT_RETURN);
    }
}
