<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\DocumentStatus;
use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\LiquidationReview;
use App\Models\LiquidationStatus;
use App\Models\Program;
use App\Models\ReviewType;
use App\Models\Semester;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

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
        $query = Liquidation::with(['hei', 'creator', 'reviewer', 'accountantReviewer', 'financial', 'semester', 'program', 'documentStatus', 'liquidationStatus'])
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

        // HEI users see only their institution's liquidations
        if ($roleName === 'HEI' && $user->hei_id) {
            $query->where('hei_id', $user->hei_id);
        } elseif ($roleName === 'Regional Coordinator' && $user->region_id) {
            // RCs see only liquidations from HEIs in their assigned region
            $query->whereHas('hei', function (Builder $q) use ($user) {
                $q->where('region_id', $user->region_id);
            });
        } elseif (!$user->isSuperAdmin() && !in_array($roleName, ['Accountant', 'Admin', 'HEI'])) {
            // Fallback for other non-admin roles: show only their own created liquidations
            $query->where('created_by', $user->id);
        }
        // Accountants, Admins, Super Admins: see all liquidations (no additional filter)
    }

    /**
     * Apply search and filters.
     */
    private function applyFilters(Builder $query, array $filters): void
    {
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

        // Filter by document status
        if (!empty($filters['document_status']) && $filters['document_status'] !== 'all') {
            $documentStatus = DocumentStatus::findByCode($filters['document_status']);
            if ($documentStatus) {
                $query->where('document_status_id', $documentStatus->id);
            } elseif ($filters['document_status'] === 'NONE') {
                // Also include null document_status_id for "No Submission"
                $query->where(function ($q) {
                    $noneStatus = DocumentStatus::findByCode(DocumentStatus::CODE_NONE);
                    $q->whereNull('document_status_id');
                    if ($noneStatus) {
                        $q->orWhere('document_status_id', $noneStatus->id);
                    }
                });
            }
        }

        // Filter by liquidation status
        if (!empty($filters['liquidation_status']) && $filters['liquidation_status'] !== 'all') {
            $liquidationStatus = LiquidationStatus::findByCode(strtoupper($filters['liquidation_status']));
            if ($liquidationStatus) {
                $query->where('liquidation_status_id', $liquidationStatus->id);
            }
        }
    }

    /**
     * Create a new liquidation with financial record.
     * Wrapped in a transaction so liquidation + financial are always consistent.
     */
    public function createLiquidation(array $data, User $creator): Liquidation
    {
        return DB::transaction(function () use ($data, $creator) {
            $hei = $this->findHEIByUII($data['uii']);

            if (!$hei) {
                throw new \InvalidArgumentException('HEI not found with the provided UII.');
            }

            // Regional Coordinators can only create liquidations for HEIs in their assigned region
            if ($creator->role->name === 'Regional Coordinator' && $creator->region_id) {
                if ($hei->region_id !== $creator->region_id) {
                    throw new \InvalidArgumentException('You can only create liquidations for HEIs in your assigned region.');
                }
            }

            $semesterId = $this->findSemesterId($data['semester']);

            // Determine document status ID - default to NONE if not provided
            $documentStatusCode = !empty($data['document_status']) ? $data['document_status'] : 'NONE';
            $documentStatusId = DocumentStatus::findByCode($documentStatusCode)?->id;

            $liquidation = Liquidation::create([
                'control_no'            => $data['dv_control_no'],
                'hei_id'                => $hei->id,
                'program_id'            => $data['program_id'],
                'academic_year'         => $data['academic_year'],
                'semester_id'           => $semesterId,
                'batch_no'              => $data['batch_no'] ?? null,
                'document_status_id'    => $documentStatusId,
                'remarks'               => $data['rc_notes'] ?? null,
                'liquidation_status_id' => LiquidationStatus::unliquidated()?->id,
                'created_by'            => $creator->id,
            ]);

            $liquidation->createOrUpdateFinancial([
                'date_fund_released' => $data['date_fund_released'],
                'due_date'           => $data['due_date'] ?? null,
                'number_of_grantees' => $data['number_of_grantees'] ?? null,
                'amount_received'    => $data['total_disbursements'],
                'amount_disbursed'   => $data['total_disbursements'],
                'amount_liquidated'  => $data['total_amount_liquidated'] ?? 0,
            ]);

            return $liquidation;
        });
    }

    /**
     * Update liquidation and its financial record.
     * Wrapped in a transaction so both writes succeed or both roll back.
     */
    public function updateLiquidation(Liquidation $liquidation, array $data): Liquidation
    {
        return DB::transaction(function () use ($liquidation, $data) {
            $liquidationFields = array_intersect_key($data, array_flip(['hei_id', 'remarks']));

            // Handle liquidation_status → liquidation_status_id lookup
            if (isset($data['liquidation_status'])) {
                $liquidationStatus = LiquidationStatus::where('name', $data['liquidation_status'])->first();
                if ($liquidationStatus) {
                    $liquidationFields['liquidation_status_id'] = $liquidationStatus->id;
                }
            }

            // Handle review_remarks → remarks mapping
            if (array_key_exists('review_remarks', $data)) {
                $liquidationFields['remarks'] = $data['review_remarks'];
            }

            // Handle document_status → document_status_id lookup
            if (isset($data['document_status'])) {
                $documentStatus = DocumentStatus::where('name', $data['document_status'])->first();
                if ($documentStatus) {
                    $liquidationFields['document_status_id'] = $documentStatus->id;
                }
            }

            $financialFieldsMap = [
                'amount_received'    => 'amount_received',
                'disbursed_amount'   => 'amount_disbursed',
                'disbursement_date'  => 'disbursement_date',
                'fund_source'        => 'fund_source',
                'liquidated_amount'  => 'amount_liquidated',
                'purpose'            => 'purpose',
                'date_fund_released' => 'date_fund_released',
                'due_date'           => 'due_date',
                'number_of_grantees' => 'number_of_grantees',
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
        });
    }

    /**
     * Submit liquidation for review.
     */
    public function submitForReview(Liquidation $liquidation, User $user, ?string $remarks = null): Liquidation
    {
        return DB::transaction(function () use ($liquidation, $user, $remarks) {
            // Acquire exclusive row lock — prevents concurrent submissions
            $liquidation = Liquidation::lockForUpdate()->findOrFail($liquidation->id);

            // State guard: cannot resubmit a finalized liquidation
            if ($liquidation->coa_endorsed_at) {
                throw new \InvalidArgumentException('This liquidation has already been endorsed to COA.');
            }

            // Check if this is a resubmission based on review history
            $hasBeenReturned = $liquidation->reviews()
                ->whereHas('reviewType', fn($q) => $q->where('code', LiquidationReview::TYPE_RC_RETURN))
                ->exists();

            if ($hasBeenReturned && !empty($remarks)) {
                $liquidation->addHEIResubmission($user, $remarks);
            }

            $documentStatusId = $this->determineDocumentStatus($liquidation);

            $updateData = [
                'liquidation_status_id' => LiquidationStatus::unliquidated()?->id,
                'date_submitted'        => now(),
                'document_status_id'    => $documentStatusId,
            ];

            if (!$hasBeenReturned) {
                $updateData['remarks'] = $remarks ?? $liquidation->remarks;
            }

            $liquidation->update($updateData);

            ActivityLog::log('submitted', 'Submitted liquidation '.$liquidation->control_no.' for review', $liquidation, 'Liquidation');

            return $liquidation->fresh();
        });
    }

    /**
     * Endorse liquidation to accounting (RC action).
     */
    public function endorseToAccounting(Liquidation $liquidation, User $user, array $data): Liquidation
    {
        return DB::transaction(function () use ($liquidation, $user, $data) {
            // Acquire exclusive row lock — prevents two RCs endorsing simultaneously
            $liquidation = Liquidation::lockForUpdate()->findOrFail($liquidation->id);

            // State guards
            if (!$liquidation->date_submitted) {
                throw new \InvalidArgumentException('Liquidation has not been submitted for review yet.');
            }
            if ($liquidation->coa_endorsed_at) {
                throw new \InvalidArgumentException('This liquidation has already been endorsed to COA.');
            }

            $liquidation->createTransmittal($data, $user);

            if (!empty($data['review_remarks'])) {
                $liquidation->reviews()->create([
                    'review_type_id'    => ReviewType::findByCode(LiquidationReview::TYPE_RC_ENDORSEMENT)?->id,
                    'performed_by'      => $user->id,
                    'performed_by_name' => $user->name,
                    'remarks'           => $data['review_remarks'],
                    'performed_at'      => now(),
                ]);
            }

            $liquidationStatusId = $this->calculateLiquidationStatusId($liquidation);

            $liquidation->update([
                'liquidation_status_id' => $liquidationStatusId,
                'reviewed_by'           => $user->id,
                'reviewed_at'           => now(),
            ]);

            ActivityLog::log('endorsed_to_accounting', 'Endorsed liquidation '.$liquidation->control_no.' to Accounting', $liquidation, 'Liquidation');

            return $liquidation->fresh();
        });
    }

    /**
     * Return liquidation to HEI (RC action).
     */
    public function returnToHEI(Liquidation $liquidation, User $user, array $data): Liquidation
    {
        return DB::transaction(function () use ($liquidation, $user, $data) {
            // Acquire exclusive row lock
            $liquidation = Liquidation::lockForUpdate()->findOrFail($liquidation->id);

            // State guards
            if (!$liquidation->date_submitted) {
                throw new \InvalidArgumentException('Liquidation has not been submitted for review yet.');
            }
            if ($liquidation->coa_endorsed_at) {
                throw new \InvalidArgumentException('This liquidation has already been endorsed to COA.');
            }

            $liquidation->addRCReturn(
                $user,
                $data['review_remarks'],
                $data['documents_for_compliance'] ?? null
            );

            if (!empty($data['documents_for_compliance'])) {
                $liquidation->createCompliance($data['documents_for_compliance']);
            }

            $liquidation->update([
                'liquidation_status_id' => LiquidationStatus::unliquidated()?->id,
                'reviewed_by'           => $user->id,
                'reviewed_at'           => now(),
            ]);

            ActivityLog::log('returned_to_hei', 'Returned liquidation '.$liquidation->control_no.' to HEI', $liquidation, 'Liquidation');

            return $liquidation->fresh();
        });
    }

    /**
     * Endorse liquidation to COA (Accountant action).
     */
    public function endorseToCOA(Liquidation $liquidation, User $user, ?string $remarks = null): Liquidation
    {
        return DB::transaction(function () use ($liquidation, $user, $remarks) {
            // Acquire exclusive row lock
            $liquidation = Liquidation::lockForUpdate()->findOrFail($liquidation->id);

            // State guards
            if (!$liquidation->reviewed_at) {
                throw new \InvalidArgumentException('Liquidation has not been endorsed to Accounting yet.');
            }
            if ($liquidation->coa_endorsed_at) {
                throw new \InvalidArgumentException('This liquidation has already been endorsed to COA.');
            }

            if (!empty($remarks)) {
                $liquidation->reviews()->create([
                    'review_type_id'    => ReviewType::findByCode(LiquidationReview::TYPE_ACCOUNTANT_ENDORSEMENT)?->id,
                    'performed_by'      => $user->id,
                    'performed_by_name' => $user->name,
                    'remarks'           => $remarks,
                    'performed_at'      => now(),
                ]);
            }

            $liquidationStatusId = $this->calculateLiquidationStatusId($liquidation);

            $liquidation->update([
                'liquidation_status_id'  => $liquidationStatusId,
                'accountant_reviewed_by' => $user->id,
                'accountant_reviewed_at' => now(),
                'coa_endorsed_by'        => $user->id,
                'coa_endorsed_at'        => now(),
            ]);

            ActivityLog::log('endorsed_to_coa', 'Endorsed liquidation '.$liquidation->control_no.' to COA', $liquidation, 'Liquidation');

            return $liquidation->fresh();
        });
    }

    /**
     * Return liquidation to RC (Accountant action).
     */
    public function returnToRC(Liquidation $liquidation, User $user, string $remarks): Liquidation
    {
        return DB::transaction(function () use ($liquidation, $user, $remarks) {
            // Acquire exclusive row lock
            $liquidation = Liquidation::lockForUpdate()->findOrFail($liquidation->id);

            // State guards
            if (!$liquidation->reviewed_at) {
                throw new \InvalidArgumentException('Liquidation has not been endorsed to Accounting yet.');
            }
            if ($liquidation->coa_endorsed_at) {
                throw new \InvalidArgumentException('This liquidation has already been endorsed to COA.');
            }

            $liquidation->addAccountantReturn($user, $remarks);

            $liquidation->update([
                'liquidation_status_id'  => LiquidationStatus::unliquidated()?->id,
                'accountant_reviewed_by' => $user->id,
                'accountant_reviewed_at' => now(),
            ]);

            ActivityLog::log('returned_to_rc', 'Returned liquidation '.$liquidation->control_no.' to RC', $liquidation, 'Liquidation');

            return $liquidation->fresh();
        });
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
     *
     * Uses SELECT ... FOR UPDATE inside a transaction to serialize concurrent
     * calls. Must be invoked within the same DB::transaction() that performs
     * the INSERT so the lock is held until the row is committed.
     */
    public function generateControlNumber(): string
    {
        return DB::transaction(function () {
            $year   = date('Y');
            $prefix = "LIQ-{$year}-";

            $latestControlNo = Liquidation::where('control_no', 'like', $prefix . '%')
                ->lockForUpdate()
                ->orderBy('control_no', 'desc')
                ->value('control_no');

            $newNumber = $latestControlNo
                ? (int) substr($latestControlNo, strlen($prefix)) + 1
                : 1;

            return $prefix . str_pad((string) $newNumber, 5, '0', STR_PAD_LEFT);
        });
    }

    /**
     * Clear all liquidation-related caches.
     */
    public function clearCache(): void
    {
        Cache::forget('semesters_all');
        Cache::forget('document_statuses_all');
        Cache::forget('liquidation_statuses_all');
        Cache::forget('programs_active');
        Cache::forget('heis_active');
    }

    /**
     * Calculate liquidation status ID based on financial data.
     */
    public function calculateLiquidationStatusId(Liquidation $liquidation): ?string
    {
        $financial = $liquidation->financial;

        if (!$financial) {
            return LiquidationStatus::partiallyLiquidated()?->id;
        }

        $amountDisbursed = (float) ($financial->amount_disbursed ?? 0);
        $amountLiquidated = (float) ($financial->amount_liquidated ?? 0);

        $percentage = $amountDisbursed > 0 ? ($amountLiquidated / $amountDisbursed) * 100 : 0;

        if ($percentage >= 100) {
            return LiquidationStatus::fullyLiquidated()?->id;
        }

        return LiquidationStatus::partiallyLiquidated()?->id;
    }

    /**
     * Get cached liquidation statuses.
     */
    public function getCachedLiquidationStatuses()
    {
        return Cache::remember('liquidation_statuses_all', self::CACHE_TTL, function () {
            return LiquidationStatus::active()->ordered()->get();
        });
    }
}
