<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use App\Models\LiquidationStatus;
use App\Models\Program;
use App\Models\Region;

class AnnouncementController extends Controller
{
    public function welcome(Request $request)
    {
        $regionId       = $request->query('region');
        $programFilter  = $request->query('program');

        $programs   = Program::select('id', 'name', 'code', 'parent_id')
            ->orderBy('name')
            ->get();
        $programIds = $this->resolveProgramFilter($programFilter, $programs);

        [$honorBoard, $shameBoard] = $this->getBoards($regionId, null, $programIds, false);

        $regions = Region::select('id', 'name', 'code')->orderBy('name')->get();

        return Inertia::render('welcome', [
            'honorBoard' => $honorBoard,
            'shameBoard' => $shameBoard,
            'regions'    => $regions,
            'programs'   => $programs,
            'filters'    => array_filter([
                'region'  => $regionId,
                'program' => $programFilter,
            ]),
        ]);
    }

    /**
     * Resolve the landing-page program filter value into a concrete list of
     * program IDs. Mirrors the grouping used by the liquidation index filter:
     *   - null / 'all'          → no filter
     *   - 'unifast'             → top-level TES + TDP (+ their children, if any)
     *   - 'stufaps'             → every non-UniFAST program (parents + children)
     *   - parent program id     → parent + all its children
     *   - child/leaf program id → that program only
     */
    private function resolveProgramFilter(?string $value, $programs): ?array
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

        // Specific program id — include children when it's a parent
        $program = $programs->firstWhere('id', $value);
        if (!$program) {
            return [$value];
        }

        if ($program->parent_id === null) {
            $childIds = $programs->where('parent_id', $program->id)->pluck('id');
            return collect([$program->id])->concat($childIds)->unique()->values()->all();
        }

        return [$program->id];
    }

    public function index()
    {
        $user = auth()->user();
        $userRole = $user->role?->name;

        // Scope by region for RC
        $regionId = ($userRole === 'Regional Coordinator') ? $user->region_id : null;
        // Scope by HEI
        $heiId = ($userRole === 'HEI' && $user->hei_id) ? $user->hei_id : null;
        // Scope by program for STUFAPS Focal
        $programIds = ($userRole === 'STUFAPS Focal') ? $user->getParentScopedProgramIds() : null;
        // Exclude sub-programs for RC
        $excludeSubPrograms = ($userRole === 'Regional Coordinator');

        [$honorBoard, $shameBoard] = $this->getBoards($regionId, $heiId, $programIds, $excludeSubPrograms);

        return Inertia::render('announcement', [
            'honorBoard' => $honorBoard,
            'shameBoard' => $shameBoard,
            'userRole'   => $userRole,
        ]);
    }

    private function getBoards(
        ?string $regionId,
        ?string $heiId,
        ?array $programIds,
        bool $excludeSubPrograms
    ): array {
        $query = DB::table('liquidations')
            ->join('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->leftJoin('rc_note_statuses', 'liquidations.rc_note_status_id', '=', 'rc_note_statuses.id')
            ->leftJoin('heis', 'liquidations.hei_id', '=', 'heis.id')
            ->leftJoin('regions', 'heis.region_id', '=', 'regions.id')
            ->whereNull('liquidations.deleted_at');

        $voidedId = LiquidationStatus::voided()?->id;
        $fullyLiquidatedId = LiquidationStatus::fullyLiquidated()?->id;

        if ($voidedId) {
            $query->where(function ($q) use ($voidedId) {
                $q->where('liquidations.liquidation_status_id', '!=', $voidedId)
                  ->orWhereNull('liquidations.liquidation_status_id');
            });
        }

        if ($regionId) {
            $query->where('heis.region_id', $regionId);
        }
        if ($heiId) {
            $query->where('liquidations.hei_id', $heiId);
        }
        if ($programIds) {
            $query->whereIn('liquidations.program_id', $programIds);
        }
        if ($excludeSubPrograms) {
            $subIds = Program::whereNotNull('parent_id')->pluck('id');
            if ($subIds->isNotEmpty()) {
                $query->whereNotIn('liquidations.program_id', $subIds);
            }
        }

        // When liquidation_status is FULLY_LIQUIDATED, treat amount_received as the
        // effective liquidated amount so the HEI shows as 100% on the board.
        $fullyLiquidatedClause = $fullyLiquidatedId
            ? "CASE WHEN liquidations.liquidation_status_id = '{$fullyLiquidatedId}' THEN COALESCE(liquidation_financials.amount_received, 0) ELSE COALESCE(liquidation_financials.amount_liquidated, 0) END"
            : 'COALESCE(liquidation_financials.amount_liquidated, 0)';

        $rows = $query
            ->select(
                'liquidations.hei_id',
                'heis.name as hei_name',
                'heis.uii as hei_uii',
                'regions.name as region_name'
            )
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_disbursements')
            ->selectRaw("COALESCE(SUM({$fullyLiquidatedClause}), 0) as total_liquidated")
            ->selectRaw("COALESCE(SUM(CASE WHEN rc_note_statuses.code = 'FOR_ENDORSEMENT' AND (liquidations.liquidation_status_id != ? OR liquidations.liquidation_status_id IS NULL) THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) as for_endorsement", $fullyLiquidatedId ? [$fullyLiquidatedId] : ['__none__'])
            ->selectRaw("ROUND((COALESCE(SUM({$fullyLiquidatedClause}), 0) + COALESCE(SUM(CASE WHEN rc_note_statuses.code = 'FOR_ENDORSEMENT' AND (liquidations.liquidation_status_id != ? OR liquidations.liquidation_status_id IS NULL) THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0)) / NULLIF(COALESCE(SUM(liquidation_financials.amount_received), 0), 0) * 100, 2) as pct_liquidation", $fullyLiquidatedId ? [$fullyLiquidatedId] : ['__none__'])
            ->selectRaw('COUNT(DISTINCT liquidations.id) as liquidation_count')
            ->groupBy('liquidations.hei_id', 'heis.name', 'heis.uii', 'regions.name')
            ->get();

        $honor = [];
        $shame  = [];

        foreach ($rows as $row) {
            $pct = (float) $row->pct_liquidation;
            $item = [
                'hei_id'              => $row->hei_id,
                'hei_name'            => $row->hei_name,
                'hei_uii'             => $row->hei_uii,
                'region_name'         => $row->region_name,
                'total_disbursements' => (float) $row->total_disbursements,
                'total_liquidated'    => (float) $row->total_liquidated,
                'pct_liquidation'     => $pct,
                'liquidation_count'   => (int) $row->liquidation_count,
            ];

            if ($pct >= 100) {
                $honor[] = $item;
            } else {
                $shame[] = $item;
            }
        }

        // Honor: highest % first (all 100%, sort by name)
        usort($honor, fn($a, $b) => strcmp($a['hei_name'], $b['hei_name']));
        // Shame: lowest % first (most behind at top)
        usort($shame, fn($a, $b) => $a['pct_liquidation'] <=> $b['pct_liquidation']);

        return [$honor, $shame];
    }
}
