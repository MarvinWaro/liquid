<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Liquidation extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        // Existing fields
        'control_no',
        'hei_id',
        'program_id',
        'academic_year',
        'semester',
        'amount_received',
        'amount_disbursed',
        'amount_refunded',
        'or_number',
        'status',
        'remarks',

        // New workflow fields
        'reference_number',
        'created_by',
        'disbursed_amount',
        'disbursement_date',
        'fund_source',
        'liquidated_amount',
        'purpose',
        'reviewed_by',
        'reviewed_at',
        'review_remarks',
        'accountant_reviewed_by',
        'accountant_reviewed_at',
        'accountant_remarks',
        'coa_endorsed_by',
        'coa_endorsed_at',
    ];

    protected function casts(): array
    {
        return [
            'disbursed_amount' => 'decimal:2',
            'liquidated_amount' => 'decimal:2',
            'disbursement_date' => 'date',
            'reviewed_at' => 'datetime',
            'accountant_reviewed_at' => 'datetime',
            'coa_endorsed_at' => 'datetime',
        ];
    }

    /**
     * Get the HEI for this liquidation.
     */
    public function hei(): BelongsTo
    {
        return $this->belongsTo(HEI::class);
    }

    /**
     * Get the user who created this liquidation.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the Regional Coordinator who reviewed.
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * Get the Accountant who reviewed.
     */
    public function accountantReviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accountant_reviewed_by');
    }

    /**
     * Get the user who endorsed to COA.
     */
    public function coaEndorser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'coa_endorsed_by');
    }

    /**
     * Get documents for this liquidation.
     */
    public function documents(): HasMany
    {
        return $this->hasMany(LiquidationDocument::class);
    }

    /**
     * Check if liquidation is editable by HEI.
     */
    public function isEditableByHEI(): bool
    {
        return in_array($this->status, ['draft', 'returned_to_hei']);
    }

    /**
     * Check if liquidation can be submitted for review.
     */
    public function canBeSubmitted(): bool
    {
        return in_array($this->status, ['draft', 'returned_to_hei']);
    }

    /**
     * Check if liquidation is pending Regional Coordinator review.
     */
    public function isPendingRCReview(): bool
    {
        return in_array($this->status, ['for_initial_review', 'returned_to_rc']);
    }

    /**
     * Check if liquidation is pending Accountant review.
     */
    public function isPendingAccountantReview(): bool
    {
        return $this->status === 'endorsed_to_accounting';
    }

    /**
     * Get status badge color.
     */
    public function getStatusBadgeClass(): string
    {
        return match($this->status) {
            'draft' => 'secondary',
            'for_initial_review' => 'warning',
            'returned_to_hei' => 'destructive',
            'endorsed_to_accounting' => 'info',
            'returned_to_rc' => 'destructive',
            'endorsed_to_coa' => 'success',
            'approved' => 'success',
            'rejected' => 'destructive',
            default => 'secondary',
        };
    }

    /**
     * Get human-readable status.
     */
    public function getStatusLabel(): string
    {
        return match($this->status) {
            'draft' => 'Draft',
            'for_initial_review' => 'For Initial Review (RC)',
            'returned_to_hei' => 'Returned to HEI',
            'endorsed_to_accounting' => 'Endorsed to Accounting',
            'returned_to_rc' => 'Returned to RC',
            'endorsed_to_coa' => 'Endorsed to COA',
            'approved' => 'Approved',
            'rejected' => 'Rejected',
            default => ucfirst(str_replace('_', ' ', $this->status)),
        };
    }
}
