<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Liquidation Financial model.
 *
 * Stores all financial data related to a liquidation.
 * One-to-one relationship with Liquidation.
 *
 * @property string $id
 * @property string $liquidation_id
 * @property \Carbon\Carbon|null $date_fund_released
 * @property string|null $fund_source
 * @property float $amount_received
 * @property float $amount_disbursed
 * @property float $amount_liquidated
 * @property float $amount_refunded
 * @property \Carbon\Carbon|null $disbursement_date
 * @property int|null $number_of_grantees
 * @property string|null $or_number
 * @property string|null $purpose
 */
class LiquidationFinancial extends Model
{
    use HasFactory, HasUuid;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'liquidation_id',
        'date_fund_released',
        'fund_source',
        'amount_received',
        'amount_disbursed',
        'amount_liquidated',
        'amount_refunded',
        'disbursement_date',
        'number_of_grantees',
        'or_number',
        'purpose',
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date_fund_released' => 'date',
            'disbursement_date' => 'date',
            'amount_received' => 'decimal:2',
            'amount_disbursed' => 'decimal:2',
            'amount_liquidated' => 'decimal:2',
            'amount_refunded' => 'decimal:2',
            'number_of_grantees' => 'integer',
        ];
    }

    /**
     * Get the liquidation this financial record belongs to.
     */
    public function liquidation(): BelongsTo
    {
        return $this->belongsTo(Liquidation::class);
    }

    /**
     * Calculate the unliquidated/remaining amount.
     */
    public function getRemainingAmountAttribute(): float
    {
        return $this->amount_received - $this->amount_disbursed;
    }

    /**
     * Calculate the liquidation percentage.
     */
    public function getLiquidationPercentageAttribute(): float
    {
        if ($this->amount_received <= 0) {
            return 0.0;
        }

        return ($this->amount_disbursed / $this->amount_received) * 100;
    }

    /**
     * Calculate due date (fund release + 90 days).
     */
    public function getDueDateAttribute(): ?\Carbon\Carbon
    {
        if (!$this->date_fund_released) {
            return null;
        }

        return $this->date_fund_released->copy()->addDays(90);
    }

    /**
     * Check if the liquidation is overdue.
     */
    public function isOverdue(): bool
    {
        $dueDate = $this->due_date;

        if (!$dueDate) {
            return false;
        }

        return now()->greaterThan($dueDate);
    }

    /**
     * Get days until due (negative if overdue).
     */
    public function getDaysUntilDueAttribute(): ?int
    {
        $dueDate = $this->due_date;

        if (!$dueDate) {
            return null;
        }

        return now()->diffInDays($dueDate, false);
    }
}
