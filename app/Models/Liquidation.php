<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\LogsActivity;
use App\Models\ComplianceStatus;
use App\Models\DocumentLocation;
use App\Models\ReviewType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Builder;

/**
 * Liquidation model.
 *
 * Core entity representing a liquidation report submitted by HEIs.
 * Financial data is stored in a separate LiquidationFinancial record.
 *
 * @property string $id
 * @property string $control_no
 * @property string $hei_id
 * @property string $program_id
 * @property string $academic_year
 * @property string|null $semester_id
 * @property string|null $batch_no
 * @property string|null $document_status_id
 * @property string $liquidation_status
 * @property \Carbon\Carbon|null $date_submitted
 * @property string|null $remarks
 * @property string $created_by
 * @property string|null $reviewed_by
 * @property \Carbon\Carbon|null $reviewed_at
 * @property string|null $accountant_reviewed_by
 * @property \Carbon\Carbon|null $accountant_reviewed_at
 * @property string|null $coa_endorsed_by
 * @property \Carbon\Carbon|null $coa_endorsed_at
 */
class Liquidation extends Model
{
    use HasFactory, HasUuid, LogsActivity, SoftDeletes;

    protected static function getActivityModule(): string
    {
        return 'Liquidation';
    }

    protected static function getActivityForeignKeys(): array
    {
        return [
            'hei_id' => ['hei', 'name'],
            'program_id' => ['program', 'name'],
            'semester_id' => ['semester', 'name'],
            'document_status_id' => ['documentStatus', 'name'],
            'liquidation_status_id' => ['liquidationStatus', 'name'],
        ];
    }

    protected static function getActivityFieldLabels(): array
    {
        return [
            'hei_id' => 'HEI',
            'program_id' => 'Program',
            'semester_id' => 'Semester',
            'document_status_id' => 'Document Status',
            'liquidation_status_id' => 'Liquidation Status',
            'control_no' => 'Control No.',
            'academic_year' => 'Academic Year',
            'batch_no' => 'Batch No.',
            'date_submitted' => 'Date Submitted',
            'remarks' => 'Remarks',
        ];
    }

    protected static function getActivityHiddenFields(): array
    {
        return ['created_by', 'reviewed_by', 'reviewed_at', 'accountant_reviewed_by', 'accountant_reviewed_at', 'coa_endorsed_by', 'coa_endorsed_at'];
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        // Core identification
        'control_no',
        'hei_id',
        'program_id',

        // Period coverage
        'academic_year',
        'semester_id',
        'batch_no',

        // Status tracking
        'document_status_id',
        'liquidation_status_id',
        'date_submitted',
        'remarks',

        // Workflow tracking
        'created_by',

        // RC Review (current state)
        'reviewed_by',
        'reviewed_at',

        // Accountant Review (current state)
        'accountant_reviewed_by',
        'accountant_reviewed_at',

        // COA Endorsement
        'coa_endorsed_by',
        'coa_endorsed_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date_submitted' => 'datetime',
            'reviewed_at' => 'datetime',
            'accountant_reviewed_at' => 'datetime',
            'coa_endorsed_at' => 'datetime',
        ];
    }

    /**
     * The accessors to append to the model's array form.
     *
     * @var array<string>
     */
    protected $appends = ['days_lapsed'];

    /**
     * Liquidation status code constants (matching liquidation_statuses.code).
     */
    public const LIQUIDATION_STATUS_UNLIQUIDATED = 'UNLIQUIDATED';
    public const LIQUIDATION_STATUS_PARTIALLY = 'PARTIALLY_LIQUIDATED';
    public const LIQUIDATION_STATUS_FULLY = 'FULLY_LIQUIDATED';

    // ========================================
    // RELATIONSHIPS - Core Entities
    // ========================================

    /**
     * Get the HEI for this liquidation.
     */
    public function hei(): BelongsTo
    {
        return $this->belongsTo(HEI::class);
    }

    /**
     * Get the program for this liquidation.
     */
    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    /**
     * Get the semester for this liquidation.
     */
    public function semester(): BelongsTo
    {
        return $this->belongsTo(Semester::class);
    }

    /**
     * Get the document status for this liquidation.
     */
    public function documentStatus(): BelongsTo
    {
        return $this->belongsTo(DocumentStatus::class);
    }

    /**
     * Get the liquidation status for this liquidation.
     */
    public function liquidationStatus(): BelongsTo
    {
        return $this->belongsTo(LiquidationStatus::class);
    }

    // ========================================
    // RELATIONSHIPS - Users
    // ========================================

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

    // ========================================
    // RELATIONSHIPS - Child Tables
    // ========================================

    /**
     * Get the financial record for this liquidation.
     */
    public function financial(): HasOne
    {
        return $this->hasOne(LiquidationFinancial::class);
    }

    /**
     * Get documents for this liquidation.
     */
    public function documents(): HasMany
    {
        return $this->hasMany(LiquidationDocument::class);
    }

    /**
     * Get beneficiaries for this liquidation.
     */
    public function beneficiaries(): HasMany
    {
        return $this->hasMany(LiquidationBeneficiary::class);
    }

    /**
     * Get all review history entries.
     */
    public function reviews(): HasMany
    {
        return $this->hasMany(LiquidationReview::class)->orderBy('performed_at', 'asc');
    }

    /**
     * Get RC review history (returns and resubmissions).
     */
    public function rcReviews(): HasMany
    {
        return $this->hasMany(LiquidationReview::class)
            ->whereHas('reviewType', fn($q) => $q->whereIn('code', [
                LiquidationReview::TYPE_RC_RETURN,
                LiquidationReview::TYPE_HEI_RESUBMISSION,
            ]))
            ->orderBy('performed_at', 'asc');
    }

    /**
     * Get Accountant review history.
     */
    public function accountantReviews(): HasMany
    {
        return $this->hasMany(LiquidationReview::class)
            ->whereHas('reviewType', fn($q) => $q->where('code', LiquidationReview::TYPE_ACCOUNTANT_RETURN))
            ->orderBy('performed_at', 'asc');
    }

    /**
     * Get the transmittal record.
     */
    public function transmittal(): HasOne
    {
        return $this->hasOne(LiquidationTransmittal::class);
    }

    /**
     * Get the compliance record.
     */
    public function compliance(): HasOne
    {
        return $this->hasOne(LiquidationCompliance::class);
    }

    /**
     * Get the tracking entries for this liquidation.
     */
    public function trackingEntries(): HasMany
    {
        return $this->hasMany(LiquidationTrackingEntry::class);
    }

    /**
     * Get the running data entries for this liquidation.
     */
    public function runningData(): HasMany
    {
        return $this->hasMany(LiquidationRunningData::class)->orderBy('sort_order');
    }

    // ========================================
    // ACCESSORS
    // ========================================

    /**
     * Calculate days lapsed based on the formula:
     * Date Fund Released + 90 Days - Date of HEI's submission
     */
    public function getDaysLapsedAttribute(): ?int
    {
        $financial = $this->financial;

        if (!$financial || !$financial->date_fund_released || !$this->date_submitted) {
            return null;
        }

        $deadlineDate = $financial->date_fund_released->copy()->addDays(90);
        return $this->date_submitted->diffInDays($deadlineDate, false);
    }

    // ========================================
    // HELPER METHODS - Review History
    // ========================================

    /**
     * Add an RC return to review history.
     */
    public function addRCReturn(User $user, string $remarks, ?string $documentsForCompliance = null): LiquidationReview
    {
        return $this->reviews()->create([
            'review_type_id' => ReviewType::findByCode(LiquidationReview::TYPE_RC_RETURN)?->id,
            'performed_by' => $user->id,
            'performed_by_name' => $user->name,
            'remarks' => $remarks,
            'documents_for_compliance' => $documentsForCompliance,
            'performed_at' => now(),
        ]);
    }

    /**
     * Add an HEI resubmission to review history.
     */
    public function addHEIResubmission(User $user, ?string $remarks = null): LiquidationReview
    {
        return $this->reviews()->create([
            'review_type_id' => ReviewType::findByCode(LiquidationReview::TYPE_HEI_RESUBMISSION)?->id,
            'performed_by' => $user->id,
            'performed_by_name' => $user->name,
            'remarks' => $remarks,
            'performed_at' => now(),
        ]);
    }

    /**
     * Add an Accountant return to review history.
     */
    public function addAccountantReturn(User $user, string $remarks): LiquidationReview
    {
        return $this->reviews()->create([
            'review_type_id' => ReviewType::findByCode(LiquidationReview::TYPE_ACCOUNTANT_RETURN)?->id,
            'performed_by' => $user->id,
            'performed_by_name' => $user->name,
            'remarks' => $remarks,
            'performed_at' => now(),
        ]);
    }

    /**
     * Get the latest HEI resubmission.
     */
    public function getLatestHEIResubmission(): ?LiquidationReview
    {
        return $this->reviews()
            ->whereHas('reviewType', fn($q) => $q->where('code', LiquidationReview::TYPE_HEI_RESUBMISSION))
            ->orderBy('performed_at', 'desc')
            ->first();
    }

    /**
     * Get the latest review remarks (from reviews table).
     */
    public function getLatestReviewRemarks(): ?string
    {
        $latestReview = $this->reviews()
            ->whereHas('reviewType', fn($q) => $q->where('code', LiquidationReview::TYPE_RC_RETURN))
            ->orderBy('performed_at', 'desc')
            ->first();

        return $latestReview?->remarks;
    }

    /**
     * Get the latest accountant remarks (from reviews table).
     */
    public function getLatestAccountantRemarks(): ?string
    {
        $latestReview = $this->reviews()
            ->whereHas('reviewType', fn($q) => $q->where('code', LiquidationReview::TYPE_ACCOUNTANT_RETURN))
            ->orderBy('performed_at', 'desc')
            ->first();

        return $latestReview?->remarks;
    }

    // ========================================
    // HELPER METHODS - Transmittal
    // ========================================

    /**
     * Create or update transmittal record.
     */
    public function createTransmittal(array $data, User $endorser): LiquidationTransmittal
    {
        return $this->transmittal()->updateOrCreate(
            ['liquidation_id' => $this->id],
            [
                'transmittal_reference_no' => $data['transmittal_reference_no'],
                'receiver_name'            => $data['receiver_name'] ?? null,
                'document_location_id'     => DocumentLocation::where('name', $data['document_location'] ?? '')->value('id'),
                'number_of_folders' => $data['number_of_folders'] ?? null,
                'folder_location_number' => $data['folder_location_number'] ?? null,
                'group_transmittal' => $data['group_transmittal'] ?? null,
                'other_file_location' => $data['other_file_location'] ?? null,
                'endorsed_by' => $endorser->id,
                'endorsed_at' => now(),
                'received_at' => now(),
            ]
        );
    }

    // ========================================
    // HELPER METHODS - Compliance
    // ========================================

    /**
     * Create or update compliance record.
     */
    public function createCompliance(string $documentsRequired): LiquidationCompliance
    {
        return $this->compliance()->updateOrCreate(
            ['liquidation_id' => $this->id],
            [
                'documents_required'   => $documentsRequired,
                'compliance_status_id' => ComplianceStatus::findByCode(LiquidationCompliance::STATUS_PENDING_HEI_REVIEW)?->id,
                'concerns_emailed_at'  => now(),
            ]
        );
    }

    // ========================================
    // HELPER METHODS - Financial
    // ========================================

    /**
     * Create or update financial record.
     */
    public function createOrUpdateFinancial(array $data): LiquidationFinancial
    {
        return $this->financial()->updateOrCreate(
            ['liquidation_id' => $this->id],
            $data
        );
    }

    /**
     * Get total amount disbursed to beneficiaries.
     */
    public function getTotalBeneficiaryDisbursements(): float
    {
        return (float) $this->beneficiaries()->sum('amount');
    }

    /**
     * Get remaining/unliquidated amount.
     */
    public function getRemainingAmount(): float
    {
        $amountReceived = $this->financial?->amount_received ?? 0;
        return $amountReceived - $this->getTotalBeneficiaryDisbursements();
    }

    /**
     * Get liquidation percentage.
     */
    public function getLiquidationPercentage(): float
    {
        $amountReceived = $this->financial?->amount_received ?? 0;

        if ($amountReceived <= 0) {
            return 0.0;
        }

        return ($this->getTotalBeneficiaryDisbursements() / $amountReceived) * 100;
    }

    // ========================================
    // HELPER METHODS - Editability
    // ========================================

    /**
     * Check if the liquidation is editable by the HEI user who created it.
     * HEI can edit when it hasn't been endorsed yet (still Unliquidated).
     */
    public function isEditableByHEI(): bool
    {
        return $this->liquidationStatus?->code === self::LIQUIDATION_STATUS_UNLIQUIDATED;
    }

    // ========================================
    // SCOPES
    // ========================================

    /**
     * Scope to filter by HEI.
     */
    public function scopeForHEI(Builder $query, string $heiId): Builder
    {
        return $query->where('hei_id', $heiId);
    }

    /**
     * Scope to filter by academic period.
     */
    public function scopeForPeriod(Builder $query, string $academicYear, ?string $semesterId = null): Builder
    {
        $query->where('academic_year', $academicYear);

        if ($semesterId) {
            $query->where('semester_id', $semesterId);
        }

        return $query;
    }
}
