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
use App\Models\RcNoteStatus;
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
     * Get summary stats for the liquidation table (total records, disbursed, liquidated, unliquidated).
     */
    public function getTableSummary(User $user, array $filters = []): array
    {
        $query = Liquidation::join('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->leftJoin('rc_note_statuses', 'liquidations.rc_note_status_id', '=', 'rc_note_statuses.id');

        $this->applyRoleFilter($query, $user);

        if (!$this->isFilteringVoided($filters)) {
            $query->excludeVoided();
        }

        $this->applyFilters($query, $filters);

        $stats = $query->selectRaw('COUNT(*) as total_records')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_disbursed')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_liquidated), 0) as total_liquidated')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received - liquidation_financials.amount_liquidated), 0) as total_unliquidated')
            ->selectRaw('COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_ENDORSEMENT" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) as for_endorsement')
            ->first();

        return [
            'total_records' => (int) ($stats->total_records ?? 0),
            'total_disbursed' => (float) ($stats->total_disbursed ?? 0),
            'total_liquidated' => (float) ($stats->total_liquidated ?? 0),
            'total_unliquidated' => (float) ($stats->total_unliquidated ?? 0),
            'for_endorsement' => (float) ($stats->for_endorsement ?? 0),
        ];
    }

    /**
     * Get paginated liquidations based on user role.
     */
    public function getPaginatedLiquidations(User $user, array $filters = []): LengthAwarePaginator
    {
        $query = Liquidation::with(['hei', 'creator', 'reviewer', 'accountantReviewer', 'financial', 'semester', 'academicYear', 'program', 'documentStatus', 'liquidationStatus', 'trackingEntries'])
            ->orderBy('control_no', 'asc');

        $this->applyRoleFilter($query, $user);

        // Exclude voided records unless explicitly filtering for them
        if (!$this->isFilteringVoided($filters)) {
            $query->excludeVoided();
        }

        $this->applyFilters($query, $filters);

        return $query->paginate(15);
    }

    /**
     * Apply role-based scope, voided exclusion, and filters to a query.
     */
    public function applyRoleAndFilters(Builder $query, User $user, array $filters = []): void
    {
        $this->applyRoleFilter($query, $user);

        if (!$this->isFilteringVoided($filters)) {
            $query->excludeVoided();
        }

        $this->applyFilters($query, $filters);
    }

    /**
     * Check if the liquidation_status filter includes 'voided' (supports both string and array).
     */
    private function isFilteringVoided(array $filters): bool
    {
        $val = $filters['liquidation_status'] ?? [];
        $arr = is_array($val) ? $val : [$val];
        return in_array('voided', $arr);
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
            // RCs see liquidations from HEIs in their region, excluding STUFAPS sub-programs
            $query->whereHas('hei', function (Builder $q) use ($user) {
                $q->where('region_id', $user->region_id);
            });
            $query->whereDoesntHave('program', function (Builder $q) {
                $q->whereNotNull('parent_id');
            });
        } elseif ($roleName === 'STUFAPS Focal') {
            // STUFAPS Focal sees all regions, all sibling sub-programs under the same parent
            $scopedProgramIds = $user->getParentScopedProgramIds();
            if ($scopedProgramIds) {
                $query->whereIn('program_id', $scopedProgramIds);
            } else {
                // No programs assigned — show nothing
                $query->whereRaw('1 = 0');
            }
        } elseif ($roleName === 'Accountant') {
            // Accountants only see liquidations endorsed to accounting by RC/STUFAPS Focal
            $query->whereNotNull('reviewed_at');
        } elseif ($roleName === 'COA') {
            // COA only sees liquidations endorsed to COA by Accountant
            $query->whereNotNull('coa_endorsed_at');
        } elseif (!$user->isSuperAdmin() && !in_array($roleName, ['Admin', 'HEI'])) {
            // Fallback for other non-admin roles: show only their own created liquidations
            $query->where('created_by', $user->id);
        }
        // Admins, Super Admins: see all liquidations (no additional filter)
    }

    /**
     * Apply search and filters.
     * Filter values may be a single string or an array of strings (multi-select).
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        // Helper: normalize a filter value to a flat array, stripping 'all' and empties.
        $toArray = function ($value): array {
            if (empty($value)) return [];
            $arr = is_array($value) ? $value : [$value];
            return array_values(array_filter($arr, fn ($v) => $v !== '' && $v !== 'all'));
        };

        // Program filter — each selected value is a program UUID
        $programs = $toArray($filters['program'] ?? null);
        if (!empty($programs)) {
            $programIds = collect();
            foreach ($programs as $programId) {
                $program = Program::find($programId);
                if ($program && $program->parent_id === null) {
                    // Parent program: include itself + all children
                    $childIds = Program::where('parent_id', $program->id)->pluck('id');
                    $programIds = $programIds->merge($childIds)->push($program->id);
                } else {
                    $programIds->push($programId);
                }
            }
            $query->whereIn('program_id', $programIds->unique());
        }

        // Search filter
        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('control_no', 'like', "%{$search}%")
                    ->orWhereHas('hei', function ($q) use ($search) {
                        $q->where('name', 'like', "%{$search}%");
                    });
            });
        }

        // Document status filter
        $docStatuses = $toArray($filters['document_status'] ?? null);
        if (!empty($docStatuses)) {
            $docStatusIds = [];
            $includeNull = false;
            foreach ($docStatuses as $code) {
                if ($code === 'NONE') {
                    $includeNull = true;
                    $noneStatus = DocumentStatus::findByCode(DocumentStatus::CODE_NONE);
                    if ($noneStatus) $docStatusIds[] = $noneStatus->id;
                } else {
                    $status = DocumentStatus::findByCode($code);
                    if ($status) $docStatusIds[] = $status->id;
                }
            }
            $query->where(function ($q) use ($docStatusIds, $includeNull) {
                if (!empty($docStatusIds)) {
                    $q->whereIn('document_status_id', $docStatusIds);
                }
                if ($includeNull) {
                    $q->orWhereNull('document_status_id');
                }
            });
        }

        // Liquidation status filter
        $liqStatuses = $toArray($filters['liquidation_status'] ?? null);
        if (!empty($liqStatuses)) {
            $liqStatusIds = [];
            foreach ($liqStatuses as $code) {
                $status = LiquidationStatus::findByCode(strtoupper($code));
                if ($status) $liqStatusIds[] = $status->id;
            }
            if (!empty($liqStatusIds)) {
                $query->whereIn('liquidation_status_id', $liqStatusIds);
            }
        }

        // Academic year filter
        $academicYears = $toArray($filters['academic_year'] ?? null);
        if (!empty($academicYears)) {
            $query->whereIn('academic_year_id', $academicYears);
        }

        // RC note status filter
        $rcNotes = $toArray($filters['rc_note_status'] ?? null);
        if (!empty($rcNotes)) {
            $includeNone = in_array('none', $rcNotes);
            $statusIds = array_filter($rcNotes, fn ($v) => $v !== 'none');
            $query->where(function ($q) use ($statusIds, $includeNone) {
                if (!empty($statusIds)) {
                    $q->whereIn('rc_note_status_id', $statusIds);
                }
                if ($includeNone) {
                    $q->orWhereNull('rc_note_status_id');
                }
            });
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

            $semesterId = !empty($data['semester']) ? $this->findSemesterId($data['semester']) : null;

            // Determine document status ID - default to NONE if not provided
            $documentStatusCode = !empty($data['document_status']) ? $data['document_status'] : 'NONE';
            $documentStatusId = DocumentStatus::findByCode($documentStatusCode)?->id;

            $liquidation = Liquidation::create([
                'control_no'            => $data['dv_control_no'] ?? $this->generateControlNo(
                    $data['program_id'],
                    !empty($data['date_fund_released']) ? (int) date('Y', strtotime($data['date_fund_released'])) : null,
                ),
                'hei_id'                => $hei->id,
                'program_id'            => $data['program_id'],
                'academic_year_id'      => $data['academic_year_id'],
                'semester_id'           => $semesterId,
                'batch_no'              => $data['batch_no'] ?? null,
                'document_status_id'    => $documentStatusId,
                'rc_note_status_id'     => $this->resolveRcNoteStatusId($data['rc_notes'] ?? null),
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

            ActivityLog::log('created_liquidation', 'Created liquidation '.$liquidation->control_no.' for '.$hei->name, $liquidation, 'Liquidation');

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
            if ($liquidation->reviewed_at) {
                throw new \InvalidArgumentException('This liquidation has already been endorsed to Accounting.');
            }
            if ($liquidation->coa_endorsed_at) {
                throw new \InvalidArgumentException('This liquidation has already been endorsed to COA.');
            }

            // Auto-set date_submitted for RC-created entries that were never submitted by HEI
            if (!$liquidation->date_submitted) {
                $liquidation->date_submitted = now();
            }

            // Only create transmittal if transmittal data is provided
            if (!empty($data['transmittal_reference_no'])) {
                $liquidation->createTransmittal($data, $user);
            }

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
     * Generate a unique control number in the format CODE-YYYY-NNNN, scoped per program + year.
     * Each program+year combination maintains its own independent sequence.
     * e.g. TES-2026-0001, TDP-2024-0003
     *
     * Uses SELECT ... FOR UPDATE to serialize concurrent calls.
     * Must be invoked within a DB::transaction() so the lock is held until INSERT.
     */
    public function generateControlNo(string $programId, ?int $year = null): string
    {
        $year = $year ?? now()->year;
        $programCode = Program::where('id', $programId)->value('code');

        if (!$programCode) {
            throw new \InvalidArgumentException('Program not found.');
        }

        $prefix = $programCode . '-' . $year . '-';
        $prefixLen = strlen($prefix) + 1; // +1 for 1-based SUBSTRING

        // Get all occupied sequence numbers for this prefix, sorted ascending.
        // Include soft-deleted records — their control numbers are still reserved
        // in the unique index and cannot be reused.
        $occupied = Liquidation::withTrashed()
            ->where('control_no', 'like', $prefix . '%')
            ->lockForUpdate()
            ->selectRaw('CAST(SUBSTRING(control_no, ' . $prefixLen . ') AS UNSIGNED) as seq')
            ->orderBy('seq')
            ->pluck('seq')
            ->toArray();

        // Find the first available gap starting from 1
        $next = 1;
        foreach ($occupied as $seq) {
            if ($seq == $next) {
                $next++;
            } elseif ($seq > $next) {
                break; // Found a gap
            }
        }

        return $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
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
            '1', '1st', '1st semester', 'first', 'first semester' => Semester::CODE_FIRST,
            '2', '2nd', '2nd semester', 'second', 'second semester' => Semester::CODE_SECOND,
            '3', 'summer', 'sum', 'summer semester' => Semester::CODE_SUMMER,
            '1st and 2nd', '1st & 2nd', '1st and 2nd semester', '1st&2nd',
            '1st & 2nd semester', '1st semester & 2nd semester',
            '1st semester and 2nd semester' => '1ST&2ND',
            'tes3a', 'tes 3a' => 'TES3A',
            'tes3b', 'tes 3b' => 'TES3B',
            default => null,
        };

        if ($code) {
            return $this->getCachedSemesters()->firstWhere('code', $code)?->id;
        }

        // Normalize: strip spaces and compare against code and name
        $normalized = strtoupper(str_replace(' ', '', $value));
        $semester = $this->getCachedSemesters()->first(function ($sem) use ($value, $normalized) {
            return strtolower($sem->name) === strtolower($value)
                || strtoupper($sem->code) === $normalized;
        });

        return $semester?->id;
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
     * Get cached RC note statuses.
     */
    public function getCachedRcNoteStatuses()
    {
        return Cache::remember('rc_note_statuses_all', self::CACHE_TTL, function () {
            return RcNoteStatus::active()->ordered()->get();
        });
    }

    /**
     * Resolve RC note status ID from a name string (e.g. "For Review").
     */
    public function resolveRcNoteStatusId(?string $value): ?string
    {
        if (empty($value)) {
            return null;
        }

        return RcNoteStatus::findByCode(
            strtoupper(str_replace(' ', '_', trim($value)))
        )?->id;
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
