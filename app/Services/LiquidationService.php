<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\DocumentStatus;
use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\LiquidationReview;
use App\Models\Program;
use App\Models\Semester;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Cache;

class LiquidationService
{
    /**
     * Cache TTL in seconds (1 hour).
     */
    private const CACHE_TTL = 3600;

    /**
     * Get paginated liquidations based on user role.
     */
    public function getPaginatedLiquidations(User $user, array $filters = []): LengthAwarePaginator
    {
        $query = Liquidation::with(['hei', 'creator', 'reviewer', 'accountantReviewer', 'financial', 'semester', 'program'])
            ->orderBy('control_no', 'asc');

        $this->applyRoleFilter($query, $user);
        $this->applyFilters($query, $filters);

        return $query->paginate(15);
    }

    /**
     * Apply role-based filtering to query.
     */
    private function applyRoleFilter(Builder $query, User $user): void
    {
        $roleName = $user->role->name;

        if ($roleName === 'Regional Coordinator') {
            $query->where(function ($q) use ($user) {
                $q->where(function ($q2) use ($user) {
                    $q2->where('status', 'draft')
                       ->where('created_by', $user->id);
                })
                ->orWhereIn('status', ['for_initial_review', 'returned_to_rc'])
                ->orWhere(function ($q2) use ($user) {
                    $q2->whereIn('status', ['endorsed_to_accounting', 'endorsed_to_coa'])
                       ->where('reviewed_by', $user->id);
                });
            });
        }

        if ($roleName === 'Accountant') {
            $query->whereIn('status', ['endorsed_to_accounting', 'endorsed_to_coa']);
        }

        // HEI users see only their liquidations
        if (!$user->isSuperAdmin() && !in_array($roleName, ['Regional Coordinator', 'Accountant', 'Admin'])) {
            $query->where('created_by', $user->id);
        }
    }

    /**
     * Apply search and status filters.
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        if (!empty($filters['status']) && $filters['status'] !== 'all') {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['program']) && $filters['program'] !== 'all') {
            $query->where('program_id', $filters['program']);
        }

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('control_no', 'like', "%{$search}%")
                    ->orWhereHas('hei', function ($q) use ($search) {
                        $q->where('name', 'like', "%{$search}%");
                    });
            });
        }
    }

    /**
     * Create a new liquidation with financial record.
     */
    public function createLiquidation(array $data, User $creator): Liquidation
    {
        $hei = $this->findHEIByUII($data['uii']);

        if (!$hei) {
            throw new \InvalidArgumentException('HEI not found with the provided UII.');
        }

        $semesterId = $this->findSemesterId($data['semester']);

        $liquidation = Liquidation::create([
            'control_no' => $data['dv_control_no'],
            'hei_id' => $hei->id,
            'program_id' => $data['program_id'],
            'academic_year' => $data['academic_year'],
            'semester_id' => $semesterId,
            'batch_no' => $data['batch_no'] ?? null,
            'status' => Liquidation::STATUS_DRAFT,
            'created_by' => $creator->id,
        ]);

        $liquidation->createOrUpdateFinancial([
            'date_fund_released' => $data['date_fund_released'],
            'number_of_grantees' => $data['number_of_grantees'] ?? null,
            'amount_received' => $data['total_disbursements'],
            'amount_disbursed' => $data['total_disbursements'],
        ]);

        return $liquidation;
    }

    /**
     * Update liquidation and its financial record.
     */
    public function updateLiquidation(Liquidation $liquidation, array $data): Liquidation
    {
        $liquidationFields = array_intersect_key($data, array_flip(['hei_id', 'remarks']));

        $financialFieldsMap = [
            'amount_received' => 'amount_received',
            'disbursed_amount' => 'amount_disbursed',
            'disbursement_date' => 'disbursement_date',
            'fund_source' => 'fund_source',
            'liquidated_amount' => 'amount_liquidated',
            'purpose' => 'purpose',
        ];

        $financialData = [];
        foreach ($financialFieldsMap as $inputKey => $dbKey) {
            if (isset($data[$inputKey])) {
                $financialData[$dbKey] = $data[$inputKey];
            }
        }

        // Sync amount_disbursed with amount_received if only amount_received is set
        if (isset($financialData['amount_received']) && !isset($data['disbursed_amount'])) {
            $financialData['amount_disbursed'] = $financialData['amount_received'];
        }

        if (!empty($liquidationFields)) {
            $liquidation->update($liquidationFields);
        }

        if (!empty($financialData)) {
            $liquidation->createOrUpdateFinancial($financialData);
        }

        return $liquidation->fresh();
    }

    /**
     * Submit liquidation for review.
     */
    public function submitForReview(Liquidation $liquidation, User $user, ?string $remarks = null): Liquidation
    {
        $isResubmission = $liquidation->status === Liquidation::STATUS_RETURNED_TO_HEI;

        if ($isResubmission && !empty($remarks)) {
            $liquidation->addHEIResubmission($user, $remarks);
        }

        $documentStatusId = $this->determineDocumentStatus($liquidation);

        $updateData = [
            'status' => Liquidation::STATUS_FOR_INITIAL_REVIEW,
            'date_submitted' => now(),
            'document_status_id' => $documentStatusId,
        ];

        if (!$isResubmission) {
            $updateData['remarks'] = $remarks ?? $liquidation->remarks;
        }

        $liquidation->update($updateData);

        return $liquidation->fresh();
    }

    /**
     * Endorse liquidation to accounting (RC action).
     */
    public function endorseToAccounting(Liquidation $liquidation, User $user, array $data): Liquidation
    {
        $liquidation->createTransmittal($data, $user);

        if (!empty($data['review_remarks'])) {
            $liquidation->reviews()->create([
                'review_type' => LiquidationReview::TYPE_RC_ENDORSEMENT,
                'performed_by' => $user->id,
                'performed_by_name' => $user->name,
                'remarks' => $data['review_remarks'],
                'performed_at' => now(),
            ]);
        }

        $liquidation->update([
            'status' => Liquidation::STATUS_ENDORSED_TO_ACCOUNTING,
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
        ]);

        return $liquidation->fresh();
    }

    /**
     * Return liquidation to HEI (RC action).
     */
    public function returnToHEI(Liquidation $liquidation, User $user, array $data): Liquidation
    {
        $liquidation->addRCReturn(
            $user,
            $data['review_remarks'],
            $data['documents_for_compliance'] ?? null
        );

        if (!empty($data['documents_for_compliance'])) {
            $liquidation->createCompliance($data['documents_for_compliance']);
        }

        $liquidation->update([
            'status' => Liquidation::STATUS_RETURNED_TO_HEI,
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
        ]);

        return $liquidation->fresh();
    }

    /**
     * Endorse liquidation to COA (Accountant action).
     */
    public function endorseToCOA(Liquidation $liquidation, User $user, ?string $remarks = null): Liquidation
    {
        if (!empty($remarks)) {
            $liquidation->reviews()->create([
                'review_type' => LiquidationReview::TYPE_ACCOUNTANT_ENDORSEMENT,
                'performed_by' => $user->id,
                'performed_by_name' => $user->name,
                'remarks' => $remarks,
                'performed_at' => now(),
            ]);
        }

        $liquidation->update([
            'status' => Liquidation::STATUS_ENDORSED_TO_COA,
            'accountant_reviewed_by' => $user->id,
            'accountant_reviewed_at' => now(),
            'coa_endorsed_by' => $user->id,
            'coa_endorsed_at' => now(),
        ]);

        return $liquidation->fresh();
    }

    /**
     * Return liquidation to RC (Accountant action).
     */
    public function returnToRC(Liquidation $liquidation, User $user, string $remarks): Liquidation
    {
        $liquidation->addAccountantReturn($user, $remarks);

        $liquidation->update([
            'status' => Liquidation::STATUS_RETURNED_TO_RC,
            'accountant_reviewed_by' => $user->id,
            'accountant_reviewed_at' => now(),
        ]);

        return $liquidation->fresh();
    }

    /**
     * Determine document status based on beneficiaries and documents.
     */
    private function determineDocumentStatus(Liquidation $liquidation): ?string
    {
        $hasBeneficiaries = $liquidation->beneficiaries()->count() > 0;
        $hasDocuments = $liquidation->documents()->count() > 0;

        $code = DocumentStatus::CODE_NONE;
        if ($hasBeneficiaries && $hasDocuments) {
            $code = DocumentStatus::CODE_COMPLETE;
        } elseif ($hasBeneficiaries || $hasDocuments) {
            $code = DocumentStatus::CODE_PARTIAL;
        }

        return DocumentStatus::findByCode($code)?->id;
    }

    /**
     * Find HEI by UII with caching.
     */
    public function findHEIByUII(string $uii): ?HEI
    {
        return Cache::remember("hei_uii_{$uii}", self::CACHE_TTL, function () use ($uii) {
            return HEI::where('uii', $uii)->first()
                ?? HEI::whereRaw('LOWER(uii) = ?', [strtolower($uii)])->first();
        });
    }

    /**
     * Find semester ID from various formats.
     */
    public function findSemesterId(string $value): ?string
    {
        $value = trim($value);

        if (empty($value)) {
            return $this->getCachedSemesters()->firstWhere('code', Semester::CODE_FIRST)?->id;
        }

        $code = match (strtolower($value)) {
            '1', '1st', '1st semester' => Semester::CODE_FIRST,
            '2', '2nd', '2nd semester' => Semester::CODE_SECOND,
            '3', 'summer', 'sum' => Semester::CODE_SUMMER,
            default => null,
        };

        if ($code) {
            return $this->getCachedSemesters()->firstWhere('code', $code)?->id;
        }

        $semester = $this->getCachedSemesters()->first(function ($sem) use ($value) {
            return strtolower($sem->name) === strtolower($value);
        });

        return $semester?->id ?? $this->getCachedSemesters()->firstWhere('code', Semester::CODE_FIRST)?->id;
    }

    /**
     * Get cached semesters.
     */
    public function getCachedSemesters()
    {
        return Cache::remember('semesters_all', self::CACHE_TTL, function () {
            return Semester::active()->ordered()->get();
        });
    }

    /**
     * Get cached document statuses.
     */
    public function getCachedDocumentStatuses()
    {
        return Cache::remember('document_statuses_all', self::CACHE_TTL, function () {
            return DocumentStatus::active()->ordered()->get();
        });
    }

    /**
     * Get cached programs.
     */
    public function getCachedPrograms()
    {
        return Cache::remember('programs_active', self::CACHE_TTL, function () {
            return Program::where('status', 'active')->orderBy('name')->get(['id', 'name', 'code']);
        });
    }

    /**
     * Get cached HEIs.
     */
    public function getCachedHEIs()
    {
        return Cache::remember('heis_active', self::CACHE_TTL, function () {
            return HEI::where('status', 'active')->orderBy('name')->get(['id', 'name', 'code', 'uii']);
        });
    }

    /**
     * Generate a unique control number.
     */
    public function generateControlNumber(): string
    {
        $year = date('Y');
        $prefix = "LIQ-{$year}-";

        $latest = Liquidation::where('control_no', 'like', $prefix . '%')
            ->orderBy('control_no', 'desc')
            ->first();

        $newNumber = $latest
            ? (int) str_replace($prefix, '', $latest->control_no) + 1
            : 1;

        return $prefix . str_pad((string) $newNumber, 5, '0', STR_PAD_LEFT);
    }

    /**
     * Clear all liquidation-related caches.
     */
    public function clearCache(): void
    {
        Cache::forget('semesters_all');
        Cache::forget('document_statuses_all');
        Cache::forget('programs_active');
        Cache::forget('heis_active');
    }
}
