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
        // Summary per Academic Year
        $summaryPerAY = $this->getSummaryPerAY();

        // Summary per HEI
        $summaryPerHEI = $this->getSummaryPerHEI();

        // Liquidation status distribution for chart
        $statusDistribution = $this->getLiquidationStatusDistribution();

        // Total statistics for cards
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
            $userStats = $this->getRCUserStats($user);
            $rcTotalStats = $this->getTotalStats();
            $rcStatusDistribution = $this->getLiquidationStatusDistribution();
            $rcSummaryPerAY = $this->getSummaryPerAY();
            $rcSummaryPerHEI = $this->getSummaryPerHEI();

        } elseif ($userRole === 'Accountant') {
            $userStats = $this->getAccountantUserStats();
            $rcTotalStats = $this->getTotalStats();
            $rcStatusDistribution = $this->getLiquidationStatusDistribution();
            $rcSummaryPerAY = $this->getSummaryPerAY();
            $rcSummaryPerHEI = $this->getSummaryPerHEI();

        } elseif ($userRole === 'HEI' && $user->hei_id) {
            $userStats = $this->getHEIUserStats($user->hei_id);
            $rcTotalStats = $this->getHEITotalStats($user->hei_id);
            $rcStatusDistribution = $this->getLiquidationStatusDistribution($user->hei_id);
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
            ->whereNull('liquidations.deleted_at');

        if ($heiId) {
            $query->where('liquidations.hei_id', $heiId);
        }

        return $query->select('liquidations.academic_year')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_disbursements')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_liquidated), 0) as liquidated_amount')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) - COALESCE(SUM(liquidation_financials.amount_liquidated), 0) as unliquidated_amount')
            ->selectRaw('COALESCE(SUM(CASE WHEN liquidations.reviewed_at IS NOT NULL AND liquidations.coa_endorsed_at IS NULL THEN (COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0)) ELSE 0 END), 0) as for_endorsement')
            ->selectRaw('COALESCE(SUM(CASE WHEN liquidation_compliance.id IS NOT NULL THEN (COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0)) ELSE 0 END), 0) as for_compliance')
            ->selectRaw('ROUND((COALESCE(SUM(CASE WHEN liquidations.reviewed_at IS NOT NULL THEN (COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0)) ELSE 0 END), 0) + COALESCE(SUM(liquidation_financials.amount_liquidated), 0)) / NULLIF(COALESCE(SUM(liquidation_financials.amount_received), 0), 0) * 100, 2) as percentage_liquidation')
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
            ->whereNull('liquidations.deleted_at')
            ->select('liquidations.hei_id', 'heis.name as hei_name')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_disbursements')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_liquidated), 0) as total_amount_liquidated')
            ->selectRaw('COALESCE(SUM(CASE WHEN liquidations.reviewed_at IS NOT NULL AND liquidations.coa_endorsed_at IS NULL THEN (COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0)) ELSE 0 END), 0) as for_endorsement')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) - COALESCE(SUM(liquidation_financials.amount_liquidated), 0) - COALESCE(SUM(CASE WHEN liquidations.reviewed_at IS NOT NULL AND liquidations.coa_endorsed_at IS NULL THEN (COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0)) ELSE 0 END), 0) as unliquidated_amount')
            ->selectRaw('COALESCE(SUM(CASE WHEN liquidation_compliance.id IS NOT NULL THEN (COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0)) ELSE 0 END), 0) as for_compliance')
            ->selectRaw('ROUND((COALESCE(SUM(CASE WHEN liquidations.reviewed_at IS NOT NULL THEN (COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0)) ELSE 0 END), 0) + COALESCE(SUM(liquidation_financials.amount_liquidated), 0)) / NULLIF(COALESCE(SUM(liquidation_financials.amount_received), 0), 0) * 100, 2) as percentage_liquidation')
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
            ->whereNull('liquidations.deleted_at')
            ->selectRaw('COUNT(*) as total_liquidations')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_disbursed')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_liquidated), 0) as total_liquidated')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) - COALESCE(SUM(liquidation_financials.amount_liquidated), 0) as total_unliquidated')
            ->first();

        // Pending review = submitted but not yet endorsed to COA
        $pendingReview = Liquidation::whereNotNull('date_submitted')
            ->whereNull('coa_endorsed_at')
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
     * Get liquidation status distribution (using liquidation_status column).
     */
    private function getLiquidationStatusDistribution(?string $heiId = null)
    {
        $query = Liquidation::select('liquidation_status as status')
            ->selectRaw('COUNT(*) as count');

        if ($heiId) {
            $query->where('hei_id', $heiId);
        }

        return $query->groupBy('liquidation_status')->get();
    }

    /**
     * Get RC user stats.
     */
    private function getRCUserStats($user): array
    {
        $stats = DB::table('liquidations')
            ->leftJoin('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->whereNull('liquidations.deleted_at')
            ->where(function ($q) use ($user) {
                $q->where('liquidations.created_by', $user->id)
                  ->orWhere('liquidations.reviewed_by', $user->id);
            })
            ->selectRaw('COUNT(*) as my_liquidations')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_amount')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_liquidated), 0) as total_liquidated')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) - COALESCE(SUM(liquidation_financials.amount_liquidated), 0) as total_unliquidated')
            ->first();

        // Pending action = submitted but not reviewed by RC
        $pendingAction = Liquidation::whereNotNull('date_submitted')
            ->whereNull('reviewed_at')
            ->count();

        // Completed = endorsed to accounting (reviewed by RC)
        $completed = Liquidation::whereNotNull('reviewed_at')->count();

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
        $stats = DB::table('liquidations')
            ->leftJoin('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->whereNotNull('liquidations.reviewed_at') // Endorsed by RC
            ->whereNull('liquidations.deleted_at')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_amount')
            ->first();

        // My liquidations = those endorsed by RC
        $myLiquidations = Liquidation::whereNotNull('reviewed_at')->count();

        // Pending action = endorsed by RC but not yet by accountant
        $pendingAction = Liquidation::whereNotNull('reviewed_at')
            ->whereNull('accountant_reviewed_at')
            ->count();

        // Completed = endorsed to COA
        $completed = Liquidation::whereNotNull('coa_endorsed_at')->count();

        return [
            'my_liquidations' => $myLiquidations,
            'pending_action' => $pendingAction,
            'completed' => $completed,
            'total_amount' => $stats->total_amount ?? 0,
        ];
    }

    /**
     * Get HEI user stats.
     */
    private function getHEIUserStats(string $heiId): array
    {
        $stats = DB::table('liquidations')
            ->leftJoin('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->where('liquidations.hei_id', $heiId)
            ->whereNull('liquidations.deleted_at')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_amount')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_liquidated), 0) as total_liquidated')
            ->first();

        $totalAmount = $stats->total_amount ?? 0;
        $totalLiquidated = $stats->total_liquidated ?? 0;

        // Pending action = not yet submitted or returned
        $pendingAction = Liquidation::where('hei_id', $heiId)
            ->where(function ($q) {
                $q->whereNull('date_submitted') // Not yet submitted
                  ->orWhereHas('reviews', function ($q2) {
                      $q2->where('review_type', 'rc_return');
                  });
            })
            ->count();

        // Completed = endorsed to COA
        $completed = Liquidation::where('hei_id', $heiId)
            ->whereNotNull('coa_endorsed_at')
            ->count();

        return [
            'my_liquidations' => Liquidation::where('hei_id', $heiId)->count(),
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
        $stats = DB::table('liquidations')
            ->leftJoin('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->where('liquidations.hei_id', $heiId)
            ->whereNull('liquidations.deleted_at')
            ->selectRaw('COUNT(*) as total_liquidations')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_disbursed')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_liquidated), 0) as total_liquidated')
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) - COALESCE(SUM(liquidation_financials.amount_liquidated), 0) as total_unliquidated')
            ->first();

        // Pending review = submitted but not endorsed to COA
        $pendingReview = Liquidation::where('hei_id', $heiId)
            ->whereNotNull('date_submitted')
            ->whereNull('coa_endorsed_at')
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
                    // Pending RC review (submitted but not reviewed)
                    $q->where(function ($q2) {
                        $q2->whereNotNull('date_submitted')
                           ->whereNull('reviewed_at');
                    })
                    // Or already reviewed by this RC
                    ->orWhere('reviewed_by', $user->id);
                })
                ->orderBy('created_at', 'desc')
                ->limit(10)
                ->get()
                ->map(fn ($liq) => $this->formatRecentLiquidation($liq));
        }

        if ($userRole === 'Accountant') {
            return Liquidation::with(['hei:id,name', 'financial', 'semester'])
                ->whereNotNull('reviewed_at') // Endorsed by RC
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
            'liquidation_status' => $liq->liquidation_status,
            'created_at' => $liq->created_at,
        ];
    }
}
