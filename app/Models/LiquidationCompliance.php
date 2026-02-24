<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiquidationCompliance extends Model
{
    use HasFactory, HasUuid, LogsActivity;

    protected static function getActivityModule(): string
    {
        return 'Liquidation';
    }

    protected $table = 'liquidation_compliance';

    protected $fillable = [
        'liquidation_id',
        'documents_required',
        'compliance_status_id',
        'concerns_emailed_at',
        'compliance_submitted_at',
        'amount_with_complete_docs',
    ];

    protected function casts(): array
    {
        return [
            'concerns_emailed_at'      => 'datetime',
            'compliance_submitted_at'  => 'datetime',
            'amount_with_complete_docs' => 'decimal:2',
        ];
    }

    /**
     * Compliance status code constants (matching compliance_statuses.code).
     */
    public const STATUS_PENDING_HEI_REVIEW  = 'pending_hei_review';
    public const STATUS_DOCUMENTS_SUBMITTED = 'documents_submitted';
    public const STATUS_UNDER_REVIEW        = 'under_review';
    public const STATUS_COMPLIANT           = 'compliant';
    public const STATUS_NON_COMPLIANT       = 'non_compliant';

    /**
     * Get the liquidation this compliance record belongs to.
     */
    public function liquidation(): BelongsTo
    {
        return $this->belongsTo(Liquidation::class);
    }

    /**
     * Get the compliance status for this record.
     */
    public function complianceStatus(): BelongsTo
    {
        return $this->belongsTo(ComplianceStatus::class, 'compliance_status_id');
    }

    /**
     * Get human-readable compliance status.
     */
    public function getStatusLabel(): string
    {
        return match($this->complianceStatus?->code) {
            self::STATUS_PENDING_HEI_REVIEW  => 'Pending HEI Review',
            self::STATUS_DOCUMENTS_SUBMITTED => 'Documents Submitted',
            self::STATUS_UNDER_REVIEW        => 'Under Review',
            self::STATUS_COMPLIANT           => 'Compliant',
            self::STATUS_NON_COMPLIANT       => 'Non-Compliant',
            default                          => ucfirst(str_replace('_', ' ', $this->complianceStatus?->code ?? 'unknown')),
        };
    }

    /**
     * Get status badge color class.
     */
    public function getStatusBadgeClass(): string
    {
        return $this->complianceStatus?->badge_color ?? 'secondary';
    }

    /**
     * Check if compliance is pending.
     */
    public function isPending(): bool
    {
        return in_array($this->complianceStatus?->code, [
            self::STATUS_PENDING_HEI_REVIEW,
            self::STATUS_DOCUMENTS_SUBMITTED,
            self::STATUS_UNDER_REVIEW,
        ]);
    }

    /**
     * Check if compliance is resolved.
     */
    public function isResolved(): bool
    {
        return in_array($this->complianceStatus?->code, [
            self::STATUS_COMPLIANT,
            self::STATUS_NON_COMPLIANT,
        ]);
    }

    /**
     * Mark concerns as emailed.
     */
    public function markConcernsEmailed(): void
    {
        $this->update(['concerns_emailed_at' => now()]);
    }

    /**
     * Mark compliance as submitted.
     */
    public function markComplianceSubmitted(): void
    {
        $this->update([
            'compliance_status_id'    => ComplianceStatus::findByCode(self::STATUS_DOCUMENTS_SUBMITTED)?->id,
            'compliance_submitted_at' => now(),
        ]);
    }
}
