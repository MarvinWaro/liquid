<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\LogsActivity;
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
    use HasFactory, HasUuid, LogsActivity;

    protected static function getActivityModule(): string
    {
        return 'Liquidation';
    }

    protected static function getActivityFieldLabels(): array
    {
        return [
            'date_fund_released' => 'Date of Fund Release',
            'due_date' => 'Due Date',
            'fund_source' => 'Fund Source',
            'amount_received' => 'Amount Received',
            'amount_disbursed' => 'Amount Disbursed',
            'amount_liquidated' => 'Amount Liquidated',
            'amount_refunded' => 'Amount Refunded',
            'disbursement_date' => 'Disbursement Date',
            'number_of_grantees' => 'Number of Grantees',
            'or_number' => 'OR Number',
            'purpose' => 'Purpose',
        ];
    }

    /**
     * Financial figures feed every dashboard aggregate, so bust the cache on
     * any write. See \App\Services\DashboardCache.
     */
    protected static function booted(): void
    {
        $flush = fn () => \App\Services\DashboardCache::flush();
        static::saved($flush);
        static::deleted($flush);
    }

    protected static function getActivityHiddenFields(): array
    {
        return ['liquidation_id'];
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'liquidation_id',
        'date_fund_released',
        'due_date',
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
            'due_date' => 'date',
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
     * Calculate the unliquidated amount.
     * Formula: Total Disbursements (amount_received) - Total Amount Liquidated
     */
    public function getUnliquidatedAmountAttribute(): float
    {
        return (float) $this->amount_received - (float) $this->amount_liquidated;
    }

    /**
     * Alias for unliquidated amount (backwards compatibility).
     */
    public function getRemainingAmountAttribute(): float
    {
        return $this->unliquidated_amount;
    }

    /**
     * Calculate the liquidation percentage.
     * Formula: (Total Amount Liquidated / Total Disbursements) × 100
     */
    public function getLiquidationPercentageAttribute(): float
    {
        if ((float) $this->amount_received <= 0) {
            return 0.0;
        }

        return ((float) $this->amount_liquidated / (float) $this->amount_received) * 100;
    }

    /**
     * Calculate the lapsing period (days overdue).
     * - If the last tracking entry is "Complete Submission": freeze at (date_received - due_date).
     * - If still partial/no submission: live counter using today (keeps ticking).
     * - Returns 0 if reference date is on or before the due date.
     */
    public function getLapsingPeriodAttribute(): int
    {
        $dueDate = $this->due_date;
        $liquidation = $this->liquidation;

        if (!$dueDate || !$liquidation) {
            return 0;
        }

        $completeId = DocumentStatus::findByCode(DocumentStatus::CODE_COMPLETE)?->id;

        // Find the last tracking entry (by sort_order) that has a date_received
        $lastEntry = $liquidation->relationLoaded('trackingEntries')
            ? $liquidation->trackingEntries->filter(fn($e) => $e->date_received !== null)->sortByDesc('sort_order')->first()
            : $liquidation->trackingEntries()->whereNotNull('date_received')->reorder('sort_order', 'desc')->first();

        // Only freeze lapsing when the last entry is a Complete Submission.
        // Partial/no submission means documents are still outstanding → use today.
        $isComplete = $lastEntry && $completeId && $lastEntry->document_status_id === $completeId;
        $referenceDate = $isComplete
            ? $lastEntry->date_received
            : now();

        $diff = (int) $referenceDate->diffInDays($dueDate, false);

        // If reference date is before or on due date (diff >= 0), no lapsing
        // If reference date is after due date (diff < 0), return the days overdue
        return $diff < 0 ? abs($diff) : 0;
    }

    /**
     * Get due date - returns explicit value or calculates from fund release date.
     * STUFAPS sub-programs (those with a parent_id) get 30 days; all others get 90 days.
     */
    public function getDueDateAttribute($value): ?\Carbon\Carbon
    {
        // If explicit due_date is set, use it
        if ($value) {
            return \Carbon\Carbon::parse($value);
        }

        // Otherwise calculate from date_fund_released
        if (!$this->date_fund_released) {
            return null;
        }

        $days = 90;
        $liquidation = $this->liquidation;
        if ($liquidation) {
            $program = $liquidation->program;
            if ($program && $program->parent_id) {
                $days = 30;
            }
        }

        return $this->date_fund_released->copy()->addDays($days);
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
