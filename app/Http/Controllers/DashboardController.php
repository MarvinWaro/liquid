<?php

namespace App\Http\Controllers;

use App\Models\Liquidation;
use App\Models\LiquidationStatus;
use App\Models\HEI;
use App\Models\Program;
use App\Models\Region;
use App\Services\DashboardCache;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $user = auth()->user();
        $isAdmin = $user->role && in_array($user->role->name, ['Admin', 'Super Admin']);

        // Only show consolidated data for Admin roles
        if ($isAdmin) {
            return $this->adminDashboard($request);
        }

        // For non-admin users (RC, Accountant, HEI)
        return $this->userDashboard($user);
    }

    /**
     * Admin dashboard with consolidated data.
     */
    private function adminDashboard(Request $request)
    {
        $regionId      = $request->query('region_id') ?: null;
        $programFilter = $request->query('program_id') ?: null;

        $programs = Program::select('id', 'name', 'code', 'parent_id')->orderBy('name')->get();
        $regions  = Region::select('id', 'name', 'code')->orderBy('name')->get();

        // Validate region_id — fall back silently if unknown.
        if ($regionId && !$regions->firstWhere('id', $regionId)) {
            $regionId = null;
        }

        $programIds = $this->resolveProgramIdsFromFilter($programFilter, $programs);
        // If the filter value is invalid, reset it so the UI and cache stay consistent.
        if ($programFilter && $programIds === null && !in_array($programFilter, ['all', 'unifast', 'stufaps'], true)) {
            $programFilter = null;
        }

        $scope = [
            'role'       => 'admin',
            'region_id'  => $regionId,
            'program'    => $programFilter,
        ];

        return Inertia::render('dashboard', [
            'isAdmin' => true,
            'regions' => $regions,
            'programs' => $programs,
            'filters' => [
                'region_id'  => $regionId,
                'program_id' => $programFilter,
            ],
            'totalStats' => DashboardCache::remember('totalStats', $scope, fn () => $this->getTotalStats($regionId, $programIds)),

            // Deferred — queries run only after initial paint is sent to browser
            // Group into 2 batches: core charts (1 request) + supplementary (1 request)
            'summaryPerAY' => Inertia::defer(fn () => DashboardCache::remember('summaryPerAY', $scope, fn () => $this->getSummaryPerAY(null, $regionId, $programIds)), 'charts'),
            'summaryPerHEI' => Inertia::defer(fn () => DashboardCache::remember('summaryPerHEI', $scope, fn () => $this->getSummaryPerHEI($regionId, $programIds)), 'charts'),
            'statusDistribution' => Inertia::defer(fn () => DashboardCache::remember('statusDistribution', $scope, fn () => $this->getLiquidationStatusDistribution(null, $regionId, $programIds)), 'charts'),
            'calendarDueDates' => Inertia::defer(fn () => $this->getCalendarDueDates(null, null, $regionId, $programIds), 'charts'),
            'overviewStats' => Inertia::defer(fn () => DashboardCache::remember('overviewStats', $scope, fn () => $this->getOverviewStats($regionId, $programIds)), 'charts'),
            'fundSourceData' => Inertia::defer(fn () => DashboardCache::remember('fundSourceData', $scope, fn () => $this->computeFundSourceData(null, $regionId)), 'charts-extra'),
        ]);
    }

    /**
     * Resolve a program filter value (one of: 'all', 'unifast', 'stufaps', program UUID)
     * into an array of concrete program IDs. Returns null when no scoping is needed.
     */
    private function resolveProgramIdsFromFilter(?string $value, Collection $programs): ?array
    {
        if (!$value || $value === 'all') {
            return null;
        }

        $unifastCodes = ['TES', 'TDP'];
        $unifastParentIds = $programs
            ->whereNull('parent_id')
            ->filter(fn ($p) => in_array(strtoupper($p->code ?? ''), $unifastCodes, true))
            ->pluck('id');

        if ($value === 'unifast') {
            $childIds = $programs->whereIn('parent_id', $unifastParentIds)->pluck('id');
            return $unifastParentIds->concat($childIds)->unique()->values()->all() ?: null;
        }

        if ($value === 'stufaps') {
            return $programs
                ->reject(fn ($p) => $p->parent_id === null && in_array(strtoupper($p->code ?? ''), $unifastCodes, true))
                ->pluck('id')
                ->values()
                ->all() ?: null;
        }

        // Specific program ID — include children if it's a parent.
        $program = $programs->firstWhere('id', $value);
        if (!$program) {
            return null;
        }

        if ($program->parent_id === null) {
            $childIds = $programs->where('parent_id', $program->id)->pluck('id');
            return collect([$program->id])->concat($childIds)->unique()->values()->all();
        }

        return [$program->id];
    }

    /**
     * User-specific dashboard (RC, Accountant, HEI).
     */
    private function userDashboard($user)
    {
        $userRole = $user->role ? $user->role->name : null;
        $canViewFundSource = $user->hasPermission('view_fund_source_filter');

        // Scope identifies what data this user sees — included in every cache
        // key so role/region/HEI/program boundaries never leak across users.
        $scope = [
            'role'       => $userRole,
            'region_id'  => $user->region_id,
            'hei_id'     => $user->hei_id,
            'scoped'     => $userRole === 'STUFAPS Focal' ? $user->getScopedProgramIds() : null,
            'parent_scoped' => $userRole === 'STUFAPS Focal' ? $user->getParentScopedProgramIds() : null,
        ];

        // Only compute the stat cards eagerly (fast, small queries)
        $userStats = match ($userRole) {
            'Regional Coordinator' => $this->getRCUserStats($user),
            'Accountant' => $this->getAccountantUserStats(),
            'COA' => $this->getCOAUserStats(),
            'HEI' => $user->hei_id ? $this->getHEIUserStats($user->hei_id) : [],
            'STUFAPS Focal' => $this->getSTUFAPSFocalUserStats($user, $user->getScopedProgramIds()),
            default => ['my_liquidations' => 0, 'pending_action' => 0, 'completed' => 0, 'total_amount' => 0],
        };

        $totalStats = DashboardCache::remember('totalStats', $scope, fn () => match ($userRole) {
            'Regional Coordinator' => $this->getTotalStats($user->region_id, null, true),
            'Accountant' => $this->getTotalStats(endorsedOnly: true),
            'COA' => $this->getTotalStats(coaEndorsedOnly: true),
            'HEI' => $user->hei_id ? $this->getHEITotalStats($user->hei_id) : [],
            'STUFAPS Focal' => $this->getTotalStats(null, $user->getParentScopedProgramIds()),
            default => [],
        });

        return Inertia::render('dashboard', [
            'isAdmin' => false,
            'totalStats' => $totalStats,
            'userStats' => $userStats,
            'userRole' => $userRole,

            // Deferred — heavy queries run only after initial paint is sent to browser
            // Group into 2 batches: core charts (1 request) + fund source (1 request)
            'summaryPerAY' => Inertia::defer(fn () => DashboardCache::remember('summaryPerAY', $scope, fn () => match ($userRole) {
                'Regional Coordinator' => $this->getSummaryPerAY(null, $user->region_id, null, true),
                'Accountant' => $this->getSummaryPerAY(endorsedOnly: true),
                'COA' => $this->getSummaryPerAY(coaEndorsedOnly: true),
                'HEI' => $user->hei_id ? $this->getSummaryPerAY($user->hei_id) : [],
                'STUFAPS Focal' => $this->getSummaryPerAY(null, null, $user->getParentScopedProgramIds()),
                default => [],
            }), 'charts'),
            'summaryPerHEI' => Inertia::defer(fn () => DashboardCache::remember('summaryPerHEI', $scope, fn () => match ($userRole) {
                'Regional Coordinator' => $this->getSummaryPerHEI($user->region_id, null, true),
                'Accountant' => $this->getSummaryPerHEI(endorsedOnly: true),
                'COA' => $this->getSummaryPerHEI(coaEndorsedOnly: true),
                'STUFAPS Focal' => $this->getSummaryPerHEI(null, $user->getParentScopedProgramIds()),
                default => [],
            }), 'charts'),
            'statusDistribution' => Inertia::defer(fn () => DashboardCache::remember('statusDistribution', $scope, fn () => match ($userRole) {
                'Regional Coordinator' => $this->getLiquidationStatusDistribution(null, $user->region_id, null, true),
                'Accountant' => $this->getLiquidationStatusDistribution(endorsedOnly: true),
                'COA' => $this->getLiquidationStatusDistribution(coaEndorsedOnly: true),
                'HEI' => $user->hei_id ? $this->getLiquidationStatusDistribution($user->hei_id) : [],
                'STUFAPS Focal' => $this->getLiquidationStatusDistribution(null, null, $user->getParentScopedProgramIds()),
                default => [],
            }), 'charts'),
            'recentLiquidations' => Inertia::defer(fn () => $this->getRecentLiquidations($user, $userRole), 'charts'),
            'calendarDueDates' => Inertia::defer(fn () => $this->getCalendarDueDates($user, $userRole), 'charts'),
            'fundSourceData' => Inertia::defer(fn () => DashboardCache::remember('fundSourceData', $scope + ['fs' => $canViewFundSource], fn () => match ($userRole) {
                'Accountant' => $canViewFundSource ? $this->computeFundSourceData(endorsedOnly: true) : null,
                'COA' => $canViewFundSource ? $this->computeFundSourceData(coaEndorsedOnly: true) : null,
                'HEI' => $user->hei_id ? $this->computeFundSourceData($user->hei_id) : null,
                default => null,
            }), 'charts-extra'),
        ]);
    }

    /**
     * Get summary per academic year with joins to liquidation_financials.
     */
    /**
     * Get the voided status ID (cached) for excluding from raw queries.
     */
    private function getVoidedStatusId(): ?string
    {
        return LiquidationStatus::voided()?->id;
    }

    /**
     * Apply standard exclusions (soft-deleted + voided) to a raw DB query.
     */
    private function applyBaseExclusions($query): void
    {
        $query->whereNull('liquidations.deleted_at');
        $voidedId = $this->getVoidedStatusId();
        if ($voidedId) {
            $query->where(function ($q) use ($voidedId) {
                $q->where('liquidations.liquidation_status_id', '!=', $voidedId)
                  ->orWhereNull('liquidations.liquidation_status_id');
            });
        }
    }

    /**
     * Get program IDs grouped by fund source (UniFAST vs STuFAPs).
     * UniFAST: TES, TDP (top-level programs)
     * STuFAPs: all other programs
     */
    private function getFundSourceProgramIds(): array
    {
        $allPrograms = Program::all(['id', 'code', 'parent_id']);

        $tesIds = $allPrograms->filter(fn($p) =>
            strtoupper($p->code) === 'TES' && $p->parent_id === null
        )->pluck('id')->toArray();

        $tdpIds = $allPrograms->filter(fn($p) =>
            strtoupper($p->code) === 'TDP' && $p->parent_id === null
        )->pluck('id')->toArray();

        $unifastIds = array_merge($tesIds, $tdpIds);

        $stufapsIds = $allPrograms->reject(fn($p) =>
            in_array($p->id, $unifastIds)
        )->pluck('id')->toArray();

        return [
            'unifast'  => $unifastIds,
            'tes'      => $tesIds,
            'tdp'      => $tdpIds,
            'stufaps'  => $stufapsIds,
        ];
    }

    /**
     * Compute fund-source-specific dashboard data (UniFAST vs STuFAPs).
     */
    private function computeFundSourceData(?string $heiId = null, ?string $regionId = null, bool $endorsedOnly = false, bool $coaEndorsedOnly = false): array
    {
        $fs = $this->getFundSourceProgramIds();
        $empty = [
            'total_liquidations' => 0, 'total_disbursed' => 0,
            'total_liquidated' => 0, 'total_unliquidated' => 0,
            'for_endorsement' => 0, 'for_compliance' => 0, 'pending_review' => 0,
        ];

        $result = [];
        foreach (['unifast', 'tes', 'tdp', 'stufaps'] as $source) {
            $ids = $fs[$source];
            $result[$source] = [
                'totalStats' => !empty($ids) ? $this->getTotalStats($regionId, $ids, false, $heiId, $endorsedOnly, $coaEndorsedOnly) : $empty,
                'summaryPerAY' => !empty($ids) ? $this->getSummaryPerAY($heiId, $regionId, $ids, false, $endorsedOnly, $coaEndorsedOnly) : [],
                'statusDistribution' => !empty($ids) ? $this->getLiquidationStatusDistribution($heiId, $regionId, $ids, false, $endorsedOnly, $coaEndorsedOnly) : [],
            ];
        }

        return $result;
    }

    private function getSummaryPerAY(?string $heiId = null, ?string $regionId = null, ?array $programIds = null, bool $excludeSubPrograms = false, bool $endorsedOnly = false, bool $coaEndorsedOnly = false)
    {
        $query = DB::table('liquidations')
            ->leftJoin('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->leftJoin('rc_note_statuses', 'liquidations.rc_note_status_id', '=', 'rc_note_statuses.id');
        $this->applyBaseExclusions($query);

        if ($coaEndorsedOnly) {
            $query->whereNotNull('liquidations.coa_endorsed_at');
        } elseif ($endorsedOnly) {
            $query->whereNotNull('liquidations.reviewed_at');
        }

        if ($heiId) {
            $query->where('liquidations.hei_id', $heiId);
        }

        if ($regionId) {
            $query->leftJoin('heis', 'liquidations.hei_id', '=', 'heis.id')
                ->where('heis.region_id', $regionId);
        }

        if ($programIds) {
            $query->whereIn('liquidations.program_id', $programIds);
        }

        if ($excludeSubPrograms) {
            $subProgramIds = Program::whereNotNull('parent_id')->pluck('id');
            if ($subProgramIds->isNotEmpty()) {
                $query->whereNotIn('liquidations.program_id', $subProgramIds);
            }
        }

        // Amount Liquidated = always from running data (amount_liquidated) regardless of RC note
        // For Compliance = remaining (amount_received - amount_liquidated) when RC note is FOR_COMPLIANCE
        // Unliquidated = always remaining (amount_received - amount_liquidated)
        // For Endorsement / For Compliance = categorize the remaining by RC note
        // % Submission = (Liquidated + For Endorsement + For Compliance) / Disbursed
        return $query->leftJoin('academic_years', 'liquidations.academic_year_id', '=', 'academic_years.id')
            ->leftJoin('document_statuses', 'liquidations.document_status_id', '=', 'document_statuses.id')
            ->select('academic_years.name as academic_year')
            ->selectRaw('COALESCE(SUM(liquidation_financials.number_of_grantees), 0) as total_grantees')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_disbursements')
            ->selectRaw('COALESCE(SUM(COALESCE(liquidation_financials.amount_liquidated, 0)), 0) as liquidated_amount')
            ->selectRaw('COALESCE(SUM(COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0)), 0) as unliquidated_amount')
            ->selectRaw('COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_ENDORSEMENT" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) as for_endorsement')
            ->selectRaw('COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_COMPLIANCE" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) as for_compliance')
            ->selectRaw('COALESCE(SUM(COALESCE(liquidation_financials.amount_liquidated, 0)), 0) + COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_ENDORSEMENT" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) + COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_COMPLIANCE" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) as total_with_submission')
            ->selectRaw('ROUND((COALESCE(SUM(COALESCE(liquidation_financials.amount_liquidated, 0)), 0) + COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_ENDORSEMENT" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0)) / NULLIF(COALESCE(SUM(liquidation_financials.amount_received), 0), 0) * 100, 2) as percentage_liquidation')
            ->selectRaw('ROUND(COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_COMPLIANCE" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) / NULLIF(COALESCE(SUM(liquidation_financials.amount_received), 0), 0) * 100, 2) as percentage_compliance')
            ->selectRaw('ROUND((COALESCE(SUM(COALESCE(liquidation_financials.amount_liquidated, 0)), 0) + COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_ENDORSEMENT" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) + COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_COMPLIANCE" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0)) / NULLIF(COALESCE(SUM(liquidation_financials.amount_received), 0), 0) * 100, 2) as percentage_submission')
            ->groupBy('academic_years.name')
            ->orderBy('academic_years.name', 'desc')
            ->get();
    }

    /**
     * Get summary per HEI with joins to liquidation_financials.
     */
    private function getSummaryPerHEI(?string $regionId = null, ?array $programIds = null, bool $excludeSubPrograms = false, bool $endorsedOnly = false, bool $coaEndorsedOnly = false)
    {
        $query = DB::table('liquidations')
            ->leftJoin('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->leftJoin('rc_note_statuses', 'liquidations.rc_note_status_id', '=', 'rc_note_statuses.id')
            ->leftJoin('heis', 'liquidations.hei_id', '=', 'heis.id');
        $this->applyBaseExclusions($query);

        if ($coaEndorsedOnly) {
            $query->whereNotNull('liquidations.coa_endorsed_at');
        } elseif ($endorsedOnly) {
            $query->whereNotNull('liquidations.reviewed_at');
        }

        if ($regionId) {
            $query->where('heis.region_id', $regionId);
        }

        if ($programIds) {
            $query->whereIn('liquidations.program_id', $programIds);
        }

        if ($excludeSubPrograms) {
            $subProgramIds = Program::whereNotNull('parent_id')->pluck('id');
            if ($subProgramIds->isNotEmpty()) {
                $query->whereNotIn('liquidations.program_id', $subProgramIds);
            }
        }

        // Amount Liquidated = always from running data (amount_liquidated) regardless of RC note
        // Unliquidated = always remaining (amount_received - amount_liquidated)
        // For Compliance / For Endorsement = categorize the remaining by RC note
        return $query
            ->leftJoin('document_statuses', 'liquidations.document_status_id', '=', 'document_statuses.id')
            ->select('liquidations.hei_id', 'heis.name as hei_name', 'heis.uii as hei_uii')
            ->selectRaw('COALESCE(SUM(liquidation_financials.number_of_grantees), 0) as total_grantees')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_disbursements')
            ->selectRaw('COALESCE(SUM(COALESCE(liquidation_financials.amount_liquidated, 0)), 0) as total_amount_liquidated')
            ->selectRaw('COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_ENDORSEMENT" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) as for_endorsement')
            ->selectRaw('COALESCE(SUM(COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0)), 0) as unliquidated_amount')
            ->selectRaw('COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_COMPLIANCE" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) as for_compliance')
            // Total With Submission = Liquidated + For Endorsement + For Compliance
            ->selectRaw('COALESCE(SUM(COALESCE(liquidation_financials.amount_liquidated, 0)), 0) + COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_ENDORSEMENT" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) + COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_COMPLIANCE" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) as total_with_submission')
            ->selectRaw('ROUND((COALESCE(SUM(COALESCE(liquidation_financials.amount_liquidated, 0)), 0) + COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_ENDORSEMENT" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0)) / NULLIF(COALESCE(SUM(liquidation_financials.amount_received), 0), 0) * 100, 2) as percentage_liquidation')
            ->selectRaw('ROUND(COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_COMPLIANCE" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) / NULLIF(COALESCE(SUM(liquidation_financials.amount_received), 0), 0) * 100, 2) as percentage_compliance')
            // % Submission = Total With Submission / Total Disbursements
            ->selectRaw('ROUND((COALESCE(SUM(COALESCE(liquidation_financials.amount_liquidated, 0)), 0) + COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_ENDORSEMENT" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) + COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_COMPLIANCE" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0)) / NULLIF(COALESCE(SUM(liquidation_financials.amount_received), 0), 0) * 100, 2) as percentage_submission')
            ->groupBy('liquidations.hei_id', 'heis.name', 'heis.uii')
            ->get()
            ->map(function ($item) {
                return [
                    'hei_id' => $item->hei_id,
                    'hei' => ['id' => $item->hei_id, 'name' => $item->hei_name, 'uii' => $item->hei_uii],
                    'total_grantees' => $item->total_grantees,
                    'total_disbursements' => $item->total_disbursements,
                    'total_amount_liquidated' => $item->total_amount_liquidated,
                    'for_endorsement' => $item->for_endorsement,
                    'unliquidated_amount' => $item->unliquidated_amount,
                    'for_compliance' => $item->for_compliance,
                    'total_with_submission' => $item->total_with_submission,
                    'percentage_liquidation' => $item->percentage_liquidation,
                    'percentage_compliance' => $item->percentage_compliance,
                    'percentage_submission' => $item->percentage_submission,
                ];
            });
    }

    /**
     * Get total stats with joins to liquidation_financials.
     */
    private function getTotalStats(?string $regionId = null, ?array $programIds = null, bool $excludeSubPrograms = false, ?string $heiId = null, bool $endorsedOnly = false, bool $coaEndorsedOnly = false): array
    {
        $query = DB::table('liquidations')
            ->leftJoin('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->leftJoin('rc_note_statuses', 'liquidations.rc_note_status_id', '=', 'rc_note_statuses.id')
            ->leftJoin('document_statuses', 'liquidations.document_status_id', '=', 'document_statuses.id');
        $this->applyBaseExclusions($query);

        if ($coaEndorsedOnly) {
            $query->whereNotNull('liquidations.coa_endorsed_at');
        } elseif ($endorsedOnly) {
            $query->whereNotNull('liquidations.reviewed_at');
        }

        if ($heiId) {
            $query->where('liquidations.hei_id', $heiId);
        }

        if ($regionId) {
            $query->leftJoin('heis', 'liquidations.hei_id', '=', 'heis.id')
                ->where('heis.region_id', $regionId);
        }

        if ($programIds) {
            $query->whereIn('liquidations.program_id', $programIds);
        }

        if ($excludeSubPrograms) {
            $subProgramIds = Program::whereNotNull('parent_id')->pluck('id');
            if ($subProgramIds->isNotEmpty()) {
                $query->whereNotIn('liquidations.program_id', $subProgramIds);
            }
        }

        // Amount Liquidated = always from running data regardless of RC note
        // Unliquidated = always remaining (amount_received - amount_liquidated)
        $stats = $query->selectRaw('COUNT(*) as total_liquidations')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_disbursed')
            ->selectRaw('COALESCE(SUM(COALESCE(liquidation_financials.amount_liquidated, 0)), 0) as total_liquidated')
            ->selectRaw('COALESCE(SUM(COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0)), 0) as total_unliquidated')
            ->selectRaw('COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_ENDORSEMENT" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) as for_endorsement')
            ->selectRaw('COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_COMPLIANCE" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) as for_compliance')
            // Total With Submission = Liquidated + For Endorsement + For Compliance
            ->selectRaw('COALESCE(SUM(COALESCE(liquidation_financials.amount_liquidated, 0)), 0) + COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_ENDORSEMENT" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) + COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_COMPLIANCE" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) as total_with_submission')
            ->first();

        // Pending review = submitted but not yet endorsed to COA
        $pendingQuery = Liquidation::excludeVoided()
            ->whereNotNull('date_submitted')
            ->whereNull('coa_endorsed_at');

        if ($coaEndorsedOnly) {
            $pendingQuery->whereNotNull('coa_endorsed_at');
        } elseif ($endorsedOnly) {
            $pendingQuery->whereNotNull('reviewed_at');
        }

        if ($heiId) {
            $pendingQuery->where('hei_id', $heiId);
        }

        if ($regionId) {
            $pendingQuery->whereHas('hei', fn($q) => $q->where('region_id', $regionId));
        }

        if ($programIds) {
            $pendingQuery->whereIn('program_id', $programIds);
        }

        if ($excludeSubPrograms) {
            $subProgramIds = Program::whereNotNull('parent_id')->pluck('id');
            if ($subProgramIds->isNotEmpty()) {
                $pendingQuery->whereNotIn('program_id', $subProgramIds);
            }
        }

        $pendingReview = $pendingQuery->count();

        $result = [
            'total_liquidations' => $stats->total_liquidations ?? 0,
            'total_disbursed' => $stats->total_disbursed ?? 0,
            'total_liquidated' => $stats->total_liquidated ?? 0,
            'total_unliquidated' => $stats->total_unliquidated ?? 0,
            'for_endorsement' => $stats->for_endorsement ?? 0,
            'for_compliance' => $stats->for_compliance ?? 0,
            'total_with_submission' => $stats->total_with_submission ?? 0,
            'pending_review' => $pendingReview,
        ];

        // For Accountant: add completed count (endorsed to COA)
        if ($endorsedOnly) {
            $completedQuery = Liquidation::excludeVoided()
                ->whereNotNull('reviewed_at')
                ->whereNotNull('coa_endorsed_at');

            if ($heiId) $completedQuery->where('hei_id', $heiId);
            if ($regionId) $completedQuery->whereHas('hei', fn($q) => $q->where('region_id', $regionId));
            if ($programIds) $completedQuery->whereIn('program_id', $programIds);

            $result['completed'] = $completedQuery->count();
        }

        // For HEI users: also compute pending_action (not submitted OR returned by RC)
        if ($heiId) {
            $pendingActionQuery = Liquidation::excludeVoided()
                ->where('hei_id', $heiId)
                ->where(function ($q) {
                    $q->whereNull('date_submitted')
                      ->orWhereHas('reviews', function ($q2) {
                          $q2->whereHas('reviewType', fn($q3) => $q3->where('code', 'rc_return'));
                      });
                });

            if ($programIds) {
                $pendingActionQuery->whereIn('program_id', $programIds);
            }

            $result['pending_action'] = $pendingActionQuery->count();

            // Completed (endorsed to COA) for HEI
            $completedQuery = Liquidation::excludeVoided()
                ->where('hei_id', $heiId)
                ->whereNotNull('coa_endorsed_at');

            if ($programIds) {
                $completedQuery->whereIn('program_id', $programIds);
            }

            $result['completed'] = $completedQuery->count();
        }

        return $result;
    }

    /**
     * Overview stats for Admin/Super Admin: HEI count, total grantees, per-program breakdown.
     */
    private function getOverviewStats(?string $regionId = null, ?array $programIds = null): array
    {
        $heiQuery = HEI::where('status', 'active');
        if ($regionId) {
            $heiQuery->where('region_id', $regionId);
        }
        $totalHeis = $heiQuery->count();

        // Grantees per program (only leaf programs that have liquidations)
        $programStats = DB::table('liquidations')
            ->join('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->join('programs', 'liquidations.program_id', '=', 'programs.id')
            ->whereNull('liquidations.deleted_at');

        if ($regionId) {
            $programStats->join('heis', 'liquidations.hei_id', '=', 'heis.id')
                ->where('heis.region_id', $regionId);
        }

        if ($programIds) {
            $programStats->whereIn('liquidations.program_id', $programIds);
        }

        $programStats = $programStats
            ->select(
                'programs.id as program_id',
                'programs.code',
                'programs.name',
                'programs.parent_id',
                DB::raw('COALESCE(SUM(liquidation_financials.number_of_grantees), 0) as grantees'),
                DB::raw('COUNT(liquidations.id) as liquidation_count'),
            )
            ->groupBy('programs.id', 'programs.code', 'programs.name', 'programs.parent_id')
            ->get();

        // Classify into UniFAST (TES, TDP) vs STuFAPs (has parent_id)
        $unifastPrograms = [];
        $stufapsPrograms = [];
        $totalGrantees = 0;

        // Get UniFAST parent IDs (TES, TDP)
        $unifastParentCodes = ['TES', 'TDP'];

        foreach ($programStats as $p) {
            $totalGrantees += (int) $p->grantees;

            $item = [
                'code' => $p->code,
                'name' => $p->name,
                'grantees' => (int) $p->grantees,
                'liquidation_count' => (int) $p->liquidation_count,
            ];

            if (in_array($p->code, $unifastParentCodes) && $p->parent_id === null) {
                $unifastPrograms[] = $item;
            } elseif ($p->parent_id !== null) {
                $stufapsPrograms[] = $item;
            }
        }

        $unifastGrantees = array_sum(array_column($unifastPrograms, 'grantees'));
        $stufapsGrantees = array_sum(array_column($stufapsPrograms, 'grantees'));

        return [
            'total_heis' => $totalHeis,
            'total_grantees' => $totalGrantees,
            'unifast' => [
                'grantees' => $unifastGrantees,
                'programs' => $unifastPrograms,
            ],
            'stufaps' => [
                'grantees' => $stufapsGrantees,
                'programs' => $stufapsPrograms,
            ],
        ];
    }

    /**
     * Get liquidation status distribution (using liquidation_statuses lookup table).
     */
    private function getLiquidationStatusDistribution(?string $heiId = null, ?string $regionId = null, ?array $programIds = null, bool $excludeSubPrograms = false, bool $endorsedOnly = false, bool $coaEndorsedOnly = false)
    {
        $query = Liquidation::join('liquidation_statuses', 'liquidations.liquidation_status_id', '=', 'liquidation_statuses.id')
            ->excludeVoided()
            ->select('liquidation_statuses.name as status')
            ->selectRaw('COUNT(*) as count');

        if ($coaEndorsedOnly) {
            $query->whereNotNull('liquidations.coa_endorsed_at');
        } elseif ($endorsedOnly) {
            $query->whereNotNull('liquidations.reviewed_at');
        }

        if ($heiId) {
            $query->where('liquidations.hei_id', $heiId);
        }

        if ($regionId) {
            $query->whereHas('hei', fn($q) => $q->where('region_id', $regionId));
        }

        if ($programIds) {
            $query->whereIn('liquidations.program_id', $programIds);
        }

        if ($excludeSubPrograms) {
            $subProgramIds = Program::whereNotNull('parent_id')->pluck('id');
            if ($subProgramIds->isNotEmpty()) {
                $query->whereNotIn('liquidations.program_id', $subProgramIds);
            }
        }

        return $query->groupBy('liquidation_statuses.name')->get();
    }

    /**
     * Get RC user stats.
     */
    private function getRCUserStats($user): array
    {
        // Get sub-program IDs to exclude from RC stats (STUFAPS sub-programs belong to STUFAPS Focal)
        $subProgramIds = Program::whereNotNull('parent_id')->pluck('id')->all();

        $query = DB::table('liquidations')
            ->leftJoin('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id');
        $this->applyBaseExclusions($query);

        if (!empty($subProgramIds)) {
            $query->whereNotIn('liquidations.program_id', $subProgramIds);
        }

        $query->leftJoin('rc_note_statuses', 'liquidations.rc_note_status_id', '=', 'rc_note_statuses.id');

        if ($user->region_id) {
            $query->leftJoin('heis', 'liquidations.hei_id', '=', 'heis.id')
                ->where('heis.region_id', $user->region_id);
        }

        $stats = $query->where(function ($q) use ($user) {
                $q->where('liquidations.created_by', $user->id)
                  ->orWhere('liquidations.reviewed_by', $user->id);
            })
            ->selectRaw('COUNT(*) as my_liquidations')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_amount')
            ->selectRaw('COALESCE(SUM(CASE WHEN rc_note_statuses.code IN ("FULLY_ENDORSED", "PARTIALLY_ENDORSED") THEN COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) as total_liquidated')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) - COALESCE(SUM(CASE WHEN rc_note_statuses.code IN ("FULLY_ENDORSED", "PARTIALLY_ENDORSED") THEN COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) as total_unliquidated')
            ->first();

        // Pending action = submitted but not reviewed, in RC's region, excluding sub-programs
        $pendingActionQuery = Liquidation::excludeVoided()
            ->whereNotNull('date_submitted')
            ->whereNull('reviewed_at');
        if ($user->region_id) {
            $pendingActionQuery->whereHas('hei', fn($q) => $q->where('region_id', $user->region_id));
        }
        if (!empty($subProgramIds)) {
            $pendingActionQuery->whereNotIn('program_id', $subProgramIds);
        }
        $pendingAction = $pendingActionQuery->count();

        // Completed = endorsed to accounting, in RC's region, excluding sub-programs
        $completedQuery = Liquidation::excludeVoided()->whereNotNull('reviewed_at');
        if ($user->region_id) {
            $completedQuery->whereHas('hei', fn($q) => $q->where('region_id', $user->region_id));
        }
        if (!empty($subProgramIds)) {
            $completedQuery->whereNotIn('program_id', $subProgramIds);
        }
        $completed = $completedQuery->count();

        return [
            'my_liquidations' => $stats->my_liquidations ?? 0,
            'pending_action' => $pendingAction,
            'completed' => $completed,
            'total_amount' => $stats->total_amount ?? 0,
            'total_liquidated' => $stats->total_liquidated ?? 0,
            'total_unliquidated' => $stats->total_unliquidated ?? 0,
        ];
    }

    /**
     * Get Accountant user stats.
     */
    private function getAccountantUserStats(): array
    {
        $query = DB::table('liquidations')
            ->leftJoin('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->whereNotNull('liquidations.reviewed_at');
        $this->applyBaseExclusions($query);
        $stats = $query->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_amount')
            ->first();

        // My liquidations = those endorsed by RC
        $myLiquidations = Liquidation::excludeVoided()->whereNotNull('reviewed_at')->count();

        // Pending action = endorsed by RC but not yet by accountant
        $pendingAction = Liquidation::excludeVoided()->whereNotNull('reviewed_at')
            ->whereNull('accountant_reviewed_at')
            ->count();

        // Completed = endorsed to COA
        $completed = Liquidation::excludeVoided()->whereNotNull('coa_endorsed_at')->count();

        return [
            'my_liquidations' => $myLiquidations,
            'pending_action' => $pendingAction,
            'completed' => $completed,
            'total_amount' => $stats->total_amount ?? 0,
        ];
    }

    /**
     * Get COA user stats.
     */
    private function getCOAUserStats(): array
    {
        $query = DB::table('liquidations')
            ->leftJoin('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->whereNotNull('liquidations.coa_endorsed_at');
        $this->applyBaseExclusions($query);
        $stats = $query->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_amount')
            ->first();

        $myLiquidations = Liquidation::excludeVoided()->whereNotNull('coa_endorsed_at')->count();

        return [
            'my_liquidations' => $myLiquidations,
            'pending_action' => 0,
            'completed' => 0,
            'total_amount' => $stats->total_amount ?? 0,
        ];
    }

    /**
     * Get STUFAPS Focal user stats (program-scoped, all regions).
     */
    private function getSTUFAPSFocalUserStats($user, ?array $programIds): array
    {
        $query = DB::table('liquidations')
            ->leftJoin('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->leftJoin('rc_note_statuses', 'liquidations.rc_note_status_id', '=', 'rc_note_statuses.id');
        $this->applyBaseExclusions($query);

        if ($programIds) {
            $query->whereIn('liquidations.program_id', $programIds);
        }

        $stats = $query->selectRaw('COUNT(*) as my_liquidations')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_amount')
            ->selectRaw('COALESCE(SUM(CASE WHEN rc_note_statuses.code IN ("FULLY_ENDORSED", "PARTIALLY_ENDORSED") THEN COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) as total_liquidated')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) - COALESCE(SUM(CASE WHEN rc_note_statuses.code IN ("FULLY_ENDORSED", "PARTIALLY_ENDORSED") THEN COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) as total_unliquidated')
            ->first();

        $pendingAction = Liquidation::excludeVoided()
            ->whereNotNull('date_submitted')
            ->whereNull('coa_endorsed_at');
        if ($programIds) {
            $pendingAction->whereIn('program_id', $programIds);
        }

        $completed = Liquidation::excludeVoided()
            ->whereNotNull('coa_endorsed_at');
        if ($programIds) {
            $completed->whereIn('program_id', $programIds);
        }

        return [
            'my_liquidations' => $stats->my_liquidations ?? 0,
            'pending_action' => $pendingAction->count(),
            'completed' => $completed->count(),
            'total_amount' => $stats->total_amount ?? 0,
            'total_liquidated' => $stats->total_liquidated ?? 0,
            'total_unliquidated' => $stats->total_unliquidated ?? 0,
        ];
    }

    /**
     * Get HEI user stats.
     */
    private function getHEIUserStats(string $heiId): array
    {
        $query = DB::table('liquidations')
            ->leftJoin('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->leftJoin('rc_note_statuses', 'liquidations.rc_note_status_id', '=', 'rc_note_statuses.id')
            ->where('liquidations.hei_id', $heiId);
        $this->applyBaseExclusions($query);
        $stats = $query->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_amount')
            ->selectRaw('COALESCE(SUM(CASE WHEN rc_note_statuses.code IN ("FULLY_ENDORSED", "PARTIALLY_ENDORSED") THEN COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) as total_liquidated')
            ->first();

        $totalAmount = $stats->total_amount ?? 0;
        $totalLiquidated = $stats->total_liquidated ?? 0;

        // Pending action = not yet submitted or returned
        $pendingAction = Liquidation::excludeVoided()->where('hei_id', $heiId)
            ->where(function ($q) {
                $q->whereNull('date_submitted') // Not yet submitted
                  ->orWhereHas('reviews', function ($q2) {
                      $q2->whereHas('reviewType', fn($q) => $q->where('code', 'rc_return'));
                  });
            })
            ->count();

        // Completed = endorsed to COA
        $completed = Liquidation::excludeVoided()->where('hei_id', $heiId)
            ->whereNotNull('coa_endorsed_at')
            ->count();

        return [
            'my_liquidations' => Liquidation::excludeVoided()->where('hei_id', $heiId)->count(),
            'pending_action' => $pendingAction,
            'completed' => $completed,
            'total_amount' => $totalAmount,
            'total_liquidated' => $totalLiquidated,
            'total_unliquidated' => $totalAmount - $totalLiquidated,
        ];
    }

    /**
     * Get HEI total stats (for totalStats card display).
     */
    private function getHEITotalStats(string $heiId): array
    {
        $query = DB::table('liquidations')
            ->leftJoin('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->leftJoin('rc_note_statuses', 'liquidations.rc_note_status_id', '=', 'rc_note_statuses.id')
            ->where('liquidations.hei_id', $heiId);
        $this->applyBaseExclusions($query);
        $stats = $query->selectRaw('COUNT(*) as total_liquidations')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_disbursed')
            ->selectRaw('COALESCE(SUM(CASE WHEN rc_note_statuses.code IN ("FULLY_ENDORSED", "PARTIALLY_ENDORSED") THEN COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) as total_liquidated')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) - COALESCE(SUM(CASE WHEN rc_note_statuses.code IN ("FULLY_ENDORSED", "PARTIALLY_ENDORSED") THEN COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) as total_unliquidated')
            ->selectRaw('COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_ENDORSEMENT" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) as for_endorsement')
            ->selectRaw('COALESCE(SUM(CASE WHEN rc_note_statuses.code = "FOR_COMPLIANCE" THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) as for_compliance')
            ->first();

        // Pending review = submitted but not endorsed to COA
        $pendingReview = Liquidation::excludeVoided()->where('hei_id', $heiId)
            ->whereNotNull('date_submitted')
            ->whereNull('coa_endorsed_at')
            ->count();

        return [
            'total_liquidations' => $stats->total_liquidations ?? 0,
            'total_disbursed' => $stats->total_disbursed ?? 0,
            'total_liquidated' => $stats->total_liquidated ?? 0,
            'total_unliquidated' => $stats->total_unliquidated ?? 0,
            'for_endorsement' => $stats->for_endorsement ?? 0,
            'for_compliance' => $stats->for_compliance ?? 0,
            'pending_review' => $pendingReview,
        ];
    }

    /**
     * Get recent liquidations based on user role.
     */
    private function getRecentLiquidations($user, ?string $userRole)
    {
        if ($userRole === 'Regional Coordinator') {
            $query = Liquidation::with(['hei:id,name,region_id', 'financial', 'semester', 'academicYear', 'liquidationStatus'])
                ->where(function ($q) use ($user) {
                    // Pending RC review (submitted but not reviewed)
                    $q->where(function ($q2) {
                        $q2->whereNotNull('date_submitted')
                           ->whereNull('reviewed_at');
                    })
                    // Or already reviewed by this RC
                    ->orWhere('reviewed_by', $user->id);
                });

            if ($user->region_id) {
                $query->whereHas('hei', fn($q) => $q->where('region_id', $user->region_id));
            }

            // Exclude STUFAPS sub-program liquidations
            $query->whereDoesntHave('program', fn($q) => $q->whereNotNull('parent_id'));

            return $query->orderBy('created_at', 'desc')
                ->limit(10)
                ->get()
                ->map(fn ($liq) => $this->formatRecentLiquidation($liq));
        }

        if ($userRole === 'Accountant') {
            return Liquidation::with(['hei:id,name', 'financial', 'semester', 'academicYear', 'liquidationStatus'])
                ->whereNotNull('reviewed_at') // Endorsed by RC
                ->orderBy('created_at', 'desc')
                ->limit(10)
                ->get()
                ->map(fn ($liq) => $this->formatRecentLiquidation($liq));
        }

        if ($userRole === 'COA') {
            return Liquidation::with(['hei:id,name', 'financial', 'semester', 'academicYear', 'liquidationStatus'])
                ->whereNotNull('coa_endorsed_at') // Endorsed by Accountant to COA
                ->orderBy('created_at', 'desc')
                ->limit(10)
                ->get()
                ->map(fn ($liq) => $this->formatRecentLiquidation($liq));
        }

        if ($userRole === 'HEI' && $user->hei_id) {
            return Liquidation::with(['hei:id,name', 'financial', 'semester', 'academicYear', 'liquidationStatus'])
                ->where('hei_id', $user->hei_id)
                ->orderBy('created_at', 'desc')
                ->limit(10)
                ->get()
                ->map(fn ($liq) => $this->formatRecentLiquidation($liq));
        }

        if ($userRole === 'STUFAPS Focal') {
            $programIds = $user->getParentScopedProgramIds();
            $query = Liquidation::with(['hei:id,name', 'financial', 'semester', 'academicYear', 'liquidationStatus'])
                ->excludeVoided();
            if ($programIds) {
                $query->whereIn('program_id', $programIds);
            }
            return $query->orderBy('created_at', 'desc')
                ->limit(10)
                ->get()
                ->map(fn ($liq) => $this->formatRecentLiquidation($liq));
        }

        return [];
    }

    /**
     * Summary per Academic Year page.
     */
    public function summaryPerAY(Request $request)
    {
        $user = auth()->user();
        $userRole = $user->role?->name;

        $regionId = ($userRole === 'Regional Coordinator') ? $user->region_id : null;
        $heiId = ($userRole === 'HEI' && $user->hei_id) ? $user->hei_id : null;
        $endorsedOnly = ($userRole === 'Accountant');
        $coaEndorsedOnly = ($userRole === 'COA');
        // Summary pages show all sibling sub-programs (consolidated STUFAPS view)
        $programIds = ($userRole === 'STUFAPS Focal') ? $user->getParentScopedProgramIds() : null;

        // Apply program filter from request
        $filterProgramId = $request->query('program');
        if ($filterProgramId && $filterProgramId !== 'all') {
            // If user is STUFAPS Focal, only allow filtering within their parent-scoped programs
            if ($programIds && !in_array($filterProgramId, $programIds)) {
                $filterProgramId = null;
            }
            if ($filterProgramId) {
                $programIds = [$filterProgramId];
            }
        }

        $excludeSubPrograms = ($userRole === 'Regional Coordinator');
        $data = $this->getSummaryPerAY($heiId, $regionId, $programIds, $excludeSubPrograms, $endorsedOnly, $coaEndorsedOnly);

        // Get programs for filter dropdown (scoped for STUFAPS Focal)
        $programs = $this->getProgramsForFilter($user, $userRole);

        return Inertia::render('summary/academic-year', [
            'summaryPerAY' => $data,
            'programs' => $programs,
            'filters' => ['program' => $request->query('program', 'all')],
            'userRole' => $userRole,
        ]);
    }

    /**
     * Summary per HEI page.
     */
    public function summaryPerHEI(Request $request)
    {
        $user = auth()->user();
        $userRole = $user->role?->name;

        $regionId = ($userRole === 'Regional Coordinator') ? $user->region_id : null;
        $endorsedOnly = ($userRole === 'Accountant');
        $coaEndorsedOnly = ($userRole === 'COA');
        // Summary pages show all sibling sub-programs (consolidated STUFAPS view)
        $programIds = ($userRole === 'STUFAPS Focal') ? $user->getParentScopedProgramIds() : null;

        // Apply program filter from request
        $filterProgramId = $request->query('program');
        if ($filterProgramId && $filterProgramId !== 'all') {
            if ($programIds && !in_array($filterProgramId, $programIds)) {
                $filterProgramId = null;
            }
            if ($filterProgramId) {
                $programIds = [$filterProgramId];
            }
        }

        $excludeSubPrograms = ($userRole === 'Regional Coordinator');
        $data = ($userRole === 'HEI') ? [] : $this->getSummaryPerHEI($regionId, $programIds, $excludeSubPrograms, $endorsedOnly, $coaEndorsedOnly);

        $programs = $this->getProgramsForFilter($user, $userRole);

        return Inertia::render('summary/hei', [
            'summaryPerHEI' => $data,
            'programs' => $programs,
            'filters' => ['program' => $request->query('program', 'all')],
            'userRole' => $userRole,
        ]);
    }

    /**
     * Get programs available for the filter dropdown based on user role.
     */
    private function getProgramsForFilter($user, ?string $userRole): array
    {
        if ($userRole === 'STUFAPS Focal') {
            // Show all sibling sub-programs under the same parent for breakdown filtering
            $scopedIds = $user->getParentScopedProgramIds();
            if ($scopedIds) {
                return Program::whereIn('id', $scopedIds)
                    ->orderBy('name')
                    ->get(['id', 'code', 'name'])
                    ->toArray();
            }
            return [];
        }

        if ($userRole === 'Regional Coordinator') {
            // RC only sees leaf UniFAST programs (TES, TDP) — exclude STUFAPS parent
            return Program::where('status', 'active')
                ->whereNull('parent_id')
                ->doesntHave('children')
                ->orderBy('name')
                ->get(['id', 'code', 'name'])
                ->toArray();
        }

        return Program::where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'code', 'name'])
            ->toArray();
    }

    /**
     * Get calendar due dates for the dashboard, scoped by role.
     */
    private function getCalendarDueDates($user = null, ?string $userRole = null, ?string $adminRegionId = null, ?array $adminProgramIds = null): array
    {
        $query = Liquidation::with([
            'financial:id,liquidation_id,due_date,amount_received',
            'hei:id,name',
            'program:id,code,name,parent_id',
            'academicYear:id,name',
            'liquidationStatus:id,name',
        ])
        ->excludeVoided()
        ->whereHas('financial', fn($q) => $q->whereNotNull('due_date'));

        if ($user && $userRole === 'Regional Coordinator') {
            if ($user->region_id) {
                $query->whereHas('hei', fn($q) => $q->where('region_id', $user->region_id));
            }
            $query->whereDoesntHave('program', fn($q) => $q->whereNotNull('parent_id'));
        } elseif ($user && $userRole === 'HEI' && $user->hei_id) {
            $query->where('hei_id', $user->hei_id);
        } elseif ($user && $userRole === 'Accountant') {
            $query->whereNotNull('reviewed_at');
        } elseif ($user && $userRole === 'COA') {
            $query->whereNotNull('coa_endorsed_at');
        } elseif ($user && $userRole === 'STUFAPS Focal') {
            $programIds = $user->getParentScopedProgramIds();
            if ($programIds) {
                $query->whereIn('program_id', $programIds);
            }
        } else {
            // Admin/Super Admin: honour optional region + program filters.
            if ($adminRegionId) {
                $query->whereHas('hei', fn($q) => $q->where('region_id', $adminRegionId));
            }
            if ($adminProgramIds) {
                $query->whereIn('program_id', $adminProgramIds);
            }
        }

        $unifastCodes = ['TES', 'TDP'];

        return $query->get()->map(function (Liquidation $liq) use ($unifastCodes) {
            $code = strtoupper($liq->program?->code ?? '');
            return [
                'id' => $liq->id,
                'control_no' => $liq->control_no,
                'due_date' => $liq->financial?->due_date?->toDateString(),
                'amount_received' => (float) ($liq->financial?->amount_received ?? 0),
                'hei_name' => $liq->hei?->name,
                'program_code' => $liq->program?->code,
                'academic_year' => $liq->academicYear?->name,
                'status' => $liq->liquidationStatus?->name ?? 'Unliquidated',
                'fund_source' => (in_array($code, $unifastCodes) && !$liq->program?->parent_id) ? 'unifast' : 'stufaps',
            ];
        })->filter(fn($item) => $item['due_date'] !== null)->values()->toArray();
    }

    /**
     * Format a liquidation for the recent liquidations table.
     */
    private function formatRecentLiquidation(Liquidation $liq): array
    {
        return [
            'id' => $liq->id,
            'control_no' => $liq->control_no,
            'hei' => $liq->hei ? ['id' => $liq->hei->id, 'name' => $liq->hei->name] : null,
            'academic_year' => $liq->academicYear?->name ?? 'N/A',
            'semester' => $liq->semester?->name ?? 'N/A',
            'amount_received' => (float) ($liq->financial?->amount_received ?? 0),
            'liquidation_status' => $liq->liquidationStatus?->name ?? 'Unliquidated',
            'created_at' => $liq->created_at,
        ];
    }
}
