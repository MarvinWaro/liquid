<?php

namespace App\Http\Controllers;

use App\Models\Liquidation;
use App\Models\HEI;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index()
    {
        $user = auth()->user();
        $isAdmin = $user->role && in_array($user->role->name, ['Admin', 'Super Admin']);

        // Only show consolidated data for Admin roles
        if ($isAdmin) {
            return $this->adminDashboard();
        }

        // For non-admin users (RC, Accountant, HEI)
        return $this->userDashboard($user);
    }

    /**
     * Admin dashboard with consolidated data.
     */
    private function adminDashboard()
    {
        // Summary per Academic Year (exclude drafts)
        $summaryPerAY = $this->getSummaryPerAY();

        // Summary per HEI (exclude drafts)
        $summaryPerHEI = $this->getSummaryPerHEI();

        // Status distribution for chart (exclude drafts)
        $statusDistribution = Liquidation::select('status')
            ->where('status', '!=', 'draft')
            ->selectRaw('COUNT(*) as count')
            ->groupBy('status')
            ->get();

        // Total statistics for cards (exclude drafts)
        $totalStats = $this->getTotalStats();

        return Inertia::render('dashboard', [
            'isAdmin' => true,
            'summaryPerAY' => $summaryPerAY,
            'summaryPerHEI' => $summaryPerHEI,
            'statusDistribution' => $statusDistribution,
            'totalStats' => $totalStats,
        ]);
    }

    /**
     * User-specific dashboard (RC, Accountant, HEI).
     */
    private function userDashboard($user)
    {
        $userRole = $user->role ? $user->role->name : null;

        // Basic stats for non-admin users
        $userStats = [
            'my_liquidations' => 0,
            'pending_action' => 0,
            'completed' => 0,
            'total_amount' => 0,
        ];

        // RC-specific data
        $rcSummaryPerAY = [];
        $rcSummaryPerHEI = [];
        $rcStatusDistribution = [];
        $rcTotalStats = [];

        // Role-specific queries
        if ($userRole === 'Regional Coordinator') {
            $userStats = $this->getRCUserStats();
            $rcTotalStats = $this->getTotalStats();
            $rcStatusDistribution = $this->getStatusDistribution();
            $rcSummaryPerAY = $this->getSummaryPerAY();
            $rcSummaryPerHEI = $this->getSummaryPerHEI();

        } elseif ($userRole === 'Accountant') {
            $userStats = $this->getAccountantUserStats();
            $rcTotalStats = $this->getTotalStats();
            $rcStatusDistribution = $this->getStatusDistribution();
            $rcSummaryPerAY = $this->getSummaryPerAY();
            $rcSummaryPerHEI = $this->getSummaryPerHEI();

        } elseif ($userRole === 'HEI' && $user->hei_id) {
            $userStats = $this->getHEIUserStats($user->hei_id);
            $rcTotalStats = $this->getHEITotalStats($user->hei_id);
            $rcStatusDistribution = $this->getStatusDistribution($user->hei_id);
            $rcSummaryPerAY = $this->getSummaryPerAY($user->hei_id);
        }

        // Recent liquidations for non-admin users
        $recentLiquidations = $this->getRecentLiquidations($user, $userRole);

        return Inertia::render('dashboard', [
            'isAdmin' => false,
            'summaryPerAY' => $rcSummaryPerAY,
            'summaryPerHEI' => $rcSummaryPerHEI,
            'statusDistribution' => $rcStatusDistribution,
            'totalStats' => $rcTotalStats,
            'userStats' => $userStats,
            'recentLiquidations' => $recentLiquidations,
            'userRole' => $userRole,
        ]);
    }

    /**
     * Get summary per academic year with joins to liquidation_financials.
     */
    private function getSummaryPerAY(?string $heiId = null)
    {
        $query = DB::table('liquidations')
            ->leftJoin('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->leftJoin('liquidation_compliance', 'liquidations.id', '=', 'liquidation_compliance.liquidation_id')
            ->where('liquidations.status', '!=', 'draft')
            ->whereNull('liquidations.deleted_at');

        if ($heiId) {
            $query->where('liquidations.hei_id', $heiId);
        }

        return $query->select('liquidations.academic_year')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_disbursements')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_liquidated), 0) as liquidated_amount')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) - COALESCE(SUM(liquidation_financials.amount_liquidated), 0) as unliquidated_amount')
            ->selectRaw('COALESCE(SUM(CASE WHEN liquidations.status = "endorsed_to_accounting" THEN (COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0)) ELSE 0 END), 0) as for_endorsement')
            ->selectRaw('COALESCE(SUM(CASE WHEN liquidation_compliance.id IS NOT NULL THEN (COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0)) ELSE 0 END), 0) as for_compliance')
            ->selectRaw('ROUND((COALESCE(SUM(CASE WHEN liquidations.status = "endorsed_to_accounting" THEN (COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0)) ELSE 0 END), 0) + COALESCE(SUM(liquidation_financials.amount_liquidated), 0)) / NULLIF(COALESCE(SUM(liquidation_financials.amount_received), 0), 0) * 100, 2) as percentage_liquidation')
            ->selectRaw('ROUND(COALESCE(SUM(CASE WHEN liquidation_compliance.id IS NOT NULL THEN (COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0)) ELSE 0 END), 0) / NULLIF(COALESCE(SUM(liquidation_financials.amount_received), 0), 0) * 100, 2) as percentage_compliance')
            ->selectRaw('ROUND((COUNT(*) / NULLIF(COUNT(*), 0)) * 100, 2) as percentage_submission')
            ->groupBy('liquidations.academic_year')
            ->orderBy('liquidations.academic_year', 'desc')
            ->get();
    }

    /**
     * Get summary per HEI with joins to liquidation_financials.
     */
    private function getSummaryPerHEI()
    {
        return DB::table('liquidations')
            ->leftJoin('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->leftJoin('liquidation_compliance', 'liquidations.id', '=', 'liquidation_compliance.liquidation_id')
            ->leftJoin('heis', 'liquidations.hei_id', '=', 'heis.id')
            ->where('liquidations.status', '!=', 'draft')
            ->whereNull('liquidations.deleted_at')
            ->select('liquidations.hei_id', 'heis.name as hei_name')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_disbursements')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_liquidated), 0) as total_amount_liquidated')
            ->selectRaw('COALESCE(SUM(CASE WHEN liquidations.status = "endorsed_to_accounting" THEN (COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0)) ELSE 0 END), 0) as for_endorsement')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) - COALESCE(SUM(liquidation_financials.amount_liquidated), 0) - COALESCE(SUM(CASE WHEN liquidations.status = "endorsed_to_accounting" THEN (COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0)) ELSE 0 END), 0) as unliquidated_amount')
            ->selectRaw('COALESCE(SUM(CASE WHEN liquidation_compliance.id IS NOT NULL THEN (COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0)) ELSE 0 END), 0) as for_compliance')
            ->selectRaw('ROUND((COALESCE(SUM(CASE WHEN liquidations.status = "endorsed_to_accounting" THEN (COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0)) ELSE 0 END), 0) + COALESCE(SUM(liquidation_financials.amount_liquidated), 0)) / NULLIF(COALESCE(SUM(liquidation_financials.amount_received), 0), 0) * 100, 2) as percentage_liquidation')
            ->selectRaw('ROUND((COUNT(*) / NULLIF(COUNT(*), 0)) * 100, 2) as percentage_submission')
            ->groupBy('liquidations.hei_id', 'heis.name')
            ->get()
            ->map(function ($item) {
                return [
                    'hei_id' => $item->hei_id,
                    'hei' => ['id' => $item->hei_id, 'name' => $item->hei_name],
                    'total_disbursements' => $item->total_disbursements,
                    'total_amount_liquidated' => $item->total_amount_liquidated,
                    'for_endorsement' => $item->for_endorsement,
                    'unliquidated_amount' => $item->unliquidated_amount,
                    'for_compliance' => $item->for_compliance,
                    'percentage_liquidation' => $item->percentage_liquidation,
                    'percentage_submission' => $item->percentage_submission,
                ];
            });
    }

    /**
     * Get total stats with joins to liquidation_financials.
     */
    private function getTotalStats(): array
    {
        $stats = DB::table('liquidations')
            ->leftJoin('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->where('liquidations.status', '!=', 'draft')
            ->whereNull('liquidations.deleted_at')
            ->selectRaw('COUNT(*) as total_liquidations')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_disbursed')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_liquidated), 0) as total_liquidated')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) - COALESCE(SUM(liquidation_financials.amount_liquidated), 0) as total_unliquidated')
            ->first();

        $pendingReview = Liquidation::whereIn('status', ['for_initial_review', 'endorsed_to_accounting'])->count();

        return [
            'total_liquidations' => $stats->total_liquidations ?? 0,
            'total_disbursed' => $stats->total_disbursed ?? 0,
            'total_liquidated' => $stats->total_liquidated ?? 0,
            'total_unliquidated' => $stats->total_unliquidated ?? 0,
            'pending_review' => $pendingReview,
        ];
    }

    /**
     * Get status distribution.
     */
    private function getStatusDistribution(?string $heiId = null)
    {
        $query = Liquidation::select('status')
            ->where('status', '!=', 'draft')
            ->selectRaw('COUNT(*) as count');

        if ($heiId) {
            $query->where('hei_id', $heiId);
        }

        return $query->groupBy('status')->get();
    }

    /**
     * Get RC user stats.
     */
    private function getRCUserStats(): array
    {
        $stats = DB::table('liquidations')
            ->leftJoin('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->where('liquidations.status', '!=', 'draft')
            ->whereNull('liquidations.deleted_at')
            ->selectRaw('COUNT(*) as my_liquidations')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_amount')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_liquidated), 0) as total_liquidated')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) - COALESCE(SUM(liquidation_financials.amount_liquidated), 0) as total_unliquidated')
            ->first();

        return [
            'my_liquidations' => $stats->my_liquidations ?? 0,
            'pending_action' => Liquidation::where('status', 'for_initial_review')->count(),
            'completed' => Liquidation::where('status', 'endorsed_to_accounting')->count(),
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
        $stats = DB::table('liquidations')
            ->leftJoin('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->whereIn('liquidations.status', ['endorsed_to_accounting', 'endorsed_to_coa', 'returned_to_rc'])
            ->whereNull('liquidations.deleted_at')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_amount')
            ->first();

        return [
            'my_liquidations' => Liquidation::whereIn('status', ['endorsed_to_accounting', 'returned_to_rc'])->count(),
            'pending_action' => Liquidation::where('status', 'endorsed_to_accounting')->count(),
            'completed' => Liquidation::where('status', 'endorsed_to_coa')->count(),
            'total_amount' => $stats->total_amount ?? 0,
        ];
    }

    /**
     * Get HEI user stats.
     * Note: HEI users see ALL their liquidations including drafts.
     */
    private function getHEIUserStats(string $heiId): array
    {
        // Include all liquidations (including drafts) for HEI users
        $stats = DB::table('liquidations')
            ->leftJoin('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->where('liquidations.hei_id', $heiId)
            ->whereNull('liquidations.deleted_at')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_amount')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_liquidated), 0) as total_liquidated')
            ->first();

        $totalAmount = $stats->total_amount ?? 0;
        $totalLiquidated = $stats->total_liquidated ?? 0;

        return [
            'my_liquidations' => Liquidation::where('hei_id', $heiId)->count(),
            'pending_action' => Liquidation::where('hei_id', $heiId)
                ->whereIn('status', ['draft', 'returned_to_hei'])->count(),
            'completed' => Liquidation::where('hei_id', $heiId)
                ->where('status', 'endorsed_to_coa')->count(),
            'total_amount' => $totalAmount,
            'total_liquidated' => $totalLiquidated,
            'total_unliquidated' => $totalAmount - $totalLiquidated,
        ];
    }

    /**
     * Get HEI total stats (for totalStats card display).
     * Note: HEI users see ALL their liquidations including drafts.
     */
    private function getHEITotalStats(string $heiId): array
    {
        // Include all liquidations (including drafts) for HEI users
        $stats = DB::table('liquidations')
            ->leftJoin('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->where('liquidations.hei_id', $heiId)
            ->whereNull('liquidations.deleted_at')
            ->selectRaw('COUNT(*) as total_liquidations')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_disbursed')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_liquidated), 0) as total_liquidated')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) - COALESCE(SUM(liquidation_financials.amount_liquidated), 0) as total_unliquidated')
            ->first();

        $pendingReview = Liquidation::where('hei_id', $heiId)
            ->whereIn('status', ['for_initial_review', 'endorsed_to_accounting'])
            ->count();

        return [
            'total_liquidations' => $stats->total_liquidations ?? 0,
            'total_disbursed' => $stats->total_disbursed ?? 0,
            'total_liquidated' => $stats->total_liquidated ?? 0,
            'total_unliquidated' => $stats->total_unliquidated ?? 0,
            'pending_review' => $pendingReview,
        ];
    }

    /**
     * Get recent liquidations based on user role.
     */
    private function getRecentLiquidations($user, ?string $userRole)
    {
        if ($userRole === 'Regional Coordinator') {
            return Liquidation::with(['hei:id,name', 'financial', 'semester'])
                ->where(function ($q) use ($user) {
                    $q->whereIn('status', ['for_initial_review', 'returned_to_rc'])
                      ->orWhere(function ($q2) use ($user) {
                          $q2->whereIn('status', ['endorsed_to_accounting', 'endorsed_to_coa'])
                             ->where('reviewed_by', $user->id);
                      });
                })
                ->orderBy('created_at', 'desc')
                ->limit(10)
                ->get()
                ->map(fn ($liq) => $this->formatRecentLiquidation($liq));
        }

        if ($userRole === 'Accountant') {
            return Liquidation::with(['hei:id,name', 'financial', 'semester'])
                ->whereIn('status', ['endorsed_to_accounting', 'endorsed_to_coa', 'returned_to_rc'])
                ->orderBy('created_at', 'desc')
                ->limit(10)
                ->get()
                ->map(fn ($liq) => $this->formatRecentLiquidation($liq));
        }

        if ($userRole === 'HEI' && $user->hei_id) {
            return Liquidation::with(['hei:id,name', 'financial', 'semester'])
                ->where('hei_id', $user->hei_id)
                ->orderBy('created_at', 'desc')
                ->limit(10)
                ->get()
                ->map(fn ($liq) => $this->formatRecentLiquidation($liq));
        }

        return [];
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
            'academic_year' => $liq->academic_year,
            'semester' => $liq->semester?->name ?? 'N/A',
            'amount_received' => (float) ($liq->financial?->amount_received ?? 0),
            'status' => $liq->status,
            'created_at' => $liq->created_at,
        ];
    }
}
