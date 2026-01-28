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
            // Summary per Academic Year (exclude drafts)
            // Based on Excel formulas:
            // - liquidated_amount = sum of beneficiary disbursements (actual amount given to students)
            // - for_endorsement = sum of unliquidated amounts where status is endorsed_to_accounting (ready for accounting review)
            // - for_compliance = sum of unliquidated amounts where status is returned_to_hei/returned_to_rc (needs HEI action)
            // - unliquidated_amount = total remaining unliquidated (total_disbursements - liquidated)
            // - % liquidation = (for_endorsement + liquidated) / total_disbursements (includes pending endorsements)
            $summaryPerAY = Liquidation::select('academic_year')
                ->where('status', '!=', 'draft')
                ->selectRaw('SUM(amount_received) as total_disbursements')
                ->selectRaw('SUM(liquidated_amount) as liquidated_amount')
                ->selectRaw('SUM(amount_received - liquidated_amount) as unliquidated_amount')
                ->selectRaw('SUM(CASE WHEN status = "endorsed_to_accounting" THEN (amount_received - liquidated_amount) ELSE 0 END) as for_endorsement')
                ->selectRaw('SUM(CASE WHEN status IN ("returned_to_hei", "returned_to_rc") THEN (amount_received - liquidated_amount) ELSE 0 END) as for_compliance')
                ->selectRaw('ROUND((SUM(CASE WHEN status = "endorsed_to_accounting" THEN (amount_received - liquidated_amount) ELSE 0 END) + SUM(liquidated_amount)) / NULLIF(SUM(amount_received), 0) * 100, 2) as percentage_liquidation')
                ->selectRaw('ROUND(SUM(CASE WHEN status IN ("returned_to_hei", "returned_to_rc") THEN (amount_received - liquidated_amount) ELSE 0 END) / NULLIF(SUM(amount_received), 0) * 100, 2) as percentage_compliance')
                ->selectRaw('ROUND((COUNT(*) / NULLIF(COUNT(*), 0)) * 100, 2) as percentage_submission')
                ->groupBy('academic_year')
                ->orderBy('academic_year', 'desc')
                ->get();

            // Summary per HEI (exclude drafts)
            // Based on Excel: unliquidated_amount = total_disbursements - liquidated - for_endorsement
            $summaryPerHEI = Liquidation::with('hei:id,name')
                ->where('status', '!=', 'draft')
                ->select('hei_id')
                ->selectRaw('SUM(amount_received) as total_disbursements')
                ->selectRaw('SUM(liquidated_amount) as total_amount_liquidated')
                ->selectRaw('SUM(CASE WHEN status = "endorsed_to_accounting" THEN (amount_received - liquidated_amount) ELSE 0 END) as for_endorsement')
                ->selectRaw('SUM(amount_received) - SUM(liquidated_amount) - SUM(CASE WHEN status = "endorsed_to_accounting" THEN (amount_received - liquidated_amount) ELSE 0 END) as unliquidated_amount')
                ->selectRaw('SUM(CASE WHEN status IN ("returned_to_hei", "returned_to_rc") THEN (amount_received - liquidated_amount) ELSE 0 END) as for_compliance')
                ->selectRaw('ROUND((SUM(CASE WHEN status = "endorsed_to_accounting" THEN (amount_received - liquidated_amount) ELSE 0 END) + SUM(liquidated_amount)) / NULLIF(SUM(amount_received), 0) * 100, 2) as percentage_liquidation')
                ->selectRaw('ROUND((COUNT(*) / NULLIF(COUNT(*), 0)) * 100, 2) as percentage_submission')
                ->groupBy('hei_id')
                ->get();

            // Status distribution for chart (exclude drafts)
            $statusDistribution = Liquidation::select('status')
                ->where('status', '!=', 'draft')
                ->selectRaw('COUNT(*) as count')
                ->groupBy('status')
                ->get();

            // Total statistics for cards (exclude drafts)
            $totalStats = [
                'total_liquidations' => Liquidation::where('status', '!=', 'draft')->count(),
                'total_disbursed' => Liquidation::where('status', '!=', 'draft')->sum('amount_received'),
                'total_liquidated' => Liquidation::where('status', '!=', 'draft')->sum('liquidated_amount'),
                'total_unliquidated' => Liquidation::where('status', '!=', 'draft')->selectRaw('SUM(amount_received - liquidated_amount) as total')->value('total') ?? 0,
                'pending_review' => Liquidation::whereIn('status', ['for_initial_review', 'endorsed_to_accounting'])->count(),
            ];

            return Inertia::render('dashboard', [
                'isAdmin' => true,
                'summaryPerAY' => $summaryPerAY,
                'summaryPerHEI' => $summaryPerHEI,
                'statusDistribution' => $statusDistribution,
                'totalStats' => $totalStats,
            ]);
        }

        // For non-admin users (RC, Accountant, etc.)
        // Get user-specific statistics
        $userRole = $user->role ? $user->role->name : null;

        // Basic stats for non-admin users
        $userStats = [
            'my_liquidations' => 0,
            'pending_action' => 0,
            'completed' => 0,
            'total_amount' => 0,
        ];

        // RC-specific data: charts and summary tables (similar to admin but for their region)
        $rcSummaryPerAY = [];
        $rcSummaryPerHEI = [];
        $rcStatusDistribution = [];
        $rcTotalStats = [];

        // Role-specific queries
        if ($userRole === 'Regional Coordinator') {
            // RC can see all submitted liquidations (exclude drafts)
            // TODO: Filter by region when API is available (e.g., where region = 'BARMM-B')
            $userStats['my_liquidations'] = Liquidation::where('status', '!=', 'draft')->count();
            $userStats['pending_action'] = Liquidation::where('status', 'for_initial_review')->count();
            $userStats['completed'] = Liquidation::where('status', 'endorsed_to_accounting')->count();
            $userStats['total_amount'] = Liquidation::where('status', '!=', 'draft')->sum('amount_received');
            $userStats['total_liquidated'] = Liquidation::where('status', '!=', 'draft')->sum('liquidated_amount');
            $userStats['total_unliquidated'] = Liquidation::where('status', '!=', 'draft')
                ->selectRaw('SUM(amount_received - liquidated_amount) as total')->value('total') ?? 0;

            // RC Total Stats (like admin)
            $rcTotalStats = [
                'total_liquidations' => Liquidation::where('status', '!=', 'draft')->count(),
                'total_disbursed' => Liquidation::where('status', '!=', 'draft')->sum('amount_received'),
                'total_liquidated' => Liquidation::where('status', '!=', 'draft')->sum('liquidated_amount'),
                'total_unliquidated' => Liquidation::where('status', '!=', 'draft')
                    ->selectRaw('SUM(amount_received - liquidated_amount) as total')->value('total') ?? 0,
                'pending_review' => Liquidation::whereIn('status', ['for_initial_review', 'endorsed_to_accounting'])->count(),
            ];

            // RC Status Distribution for pie chart
            $rcStatusDistribution = Liquidation::select('status')
                ->where('status', '!=', 'draft')
                ->selectRaw('COUNT(*) as count')
                ->groupBy('status')
                ->get();

            // RC Summary per Academic Year (same formulas as Admin)
            $rcSummaryPerAY = Liquidation::select('academic_year')
                ->where('status', '!=', 'draft')
                ->selectRaw('SUM(amount_received) as total_disbursements')
                ->selectRaw('SUM(liquidated_amount) as liquidated_amount')
                ->selectRaw('SUM(amount_received - liquidated_amount) as unliquidated_amount')
                ->selectRaw('SUM(CASE WHEN status = "endorsed_to_accounting" THEN (amount_received - liquidated_amount) ELSE 0 END) as for_endorsement')
                ->selectRaw('SUM(CASE WHEN status IN ("returned_to_hei", "returned_to_rc") THEN (amount_received - liquidated_amount) ELSE 0 END) as for_compliance')
                ->selectRaw('ROUND((SUM(CASE WHEN status = "endorsed_to_accounting" THEN (amount_received - liquidated_amount) ELSE 0 END) + SUM(liquidated_amount)) / NULLIF(SUM(amount_received), 0) * 100, 2) as percentage_liquidation')
                ->selectRaw('ROUND(SUM(CASE WHEN status IN ("returned_to_hei", "returned_to_rc") THEN (amount_received - liquidated_amount) ELSE 0 END) / NULLIF(SUM(amount_received), 0) * 100, 2) as percentage_compliance')
                ->selectRaw('ROUND((COUNT(*) / NULLIF(COUNT(*), 0)) * 100, 2) as percentage_submission')
                ->groupBy('academic_year')
                ->orderBy('academic_year', 'desc')
                ->get();

            // RC Summary per HEI (same formulas as Admin)
            $rcSummaryPerHEI = Liquidation::with('hei:id,name')
                ->where('status', '!=', 'draft')
                ->select('hei_id')
                ->selectRaw('SUM(amount_received) as total_disbursements')
                ->selectRaw('SUM(liquidated_amount) as total_amount_liquidated')
                ->selectRaw('SUM(CASE WHEN status = "endorsed_to_accounting" THEN (amount_received - liquidated_amount) ELSE 0 END) as for_endorsement')
                ->selectRaw('SUM(amount_received) - SUM(liquidated_amount) - SUM(CASE WHEN status = "endorsed_to_accounting" THEN (amount_received - liquidated_amount) ELSE 0 END) as unliquidated_amount')
                ->selectRaw('SUM(CASE WHEN status IN ("returned_to_hei", "returned_to_rc") THEN (amount_received - liquidated_amount) ELSE 0 END) as for_compliance')
                ->selectRaw('ROUND((SUM(CASE WHEN status = "endorsed_to_accounting" THEN (amount_received - liquidated_amount) ELSE 0 END) + SUM(liquidated_amount)) / NULLIF(SUM(amount_received), 0) * 100, 2) as percentage_liquidation')
                ->selectRaw('ROUND((COUNT(*) / NULLIF(COUNT(*), 0)) * 100, 2) as percentage_submission')
                ->groupBy('hei_id')
                ->get();

        } elseif ($userRole === 'Accountant') {
            $userStats['my_liquidations'] = Liquidation::whereIn('status', ['endorsed_to_accounting', 'returned_to_rc'])->count();
            $userStats['pending_action'] = Liquidation::where('status', 'endorsed_to_accounting')->count();
            $userStats['completed'] = Liquidation::where('status', 'endorsed_to_coa')->count();
            $userStats['total_amount'] = Liquidation::whereIn('status', ['endorsed_to_accounting', 'endorsed_to_coa', 'returned_to_rc'])->sum('amount_received');
        } elseif ($userRole === 'HEI') {
            // HEI users see their own liquidations including drafts
            if ($user->hei_id) {
                $userStats['my_liquidations'] = Liquidation::where('hei_id', $user->hei_id)->count();
                $userStats['pending_action'] = Liquidation::where('hei_id', $user->hei_id)
                    ->whereIn('status', ['draft', 'returned_to_hei'])->count();
                $userStats['completed'] = Liquidation::where('hei_id', $user->hei_id)
                    ->where('status', 'endorsed_to_coa')->count();
                $userStats['total_amount'] = Liquidation::where('hei_id', $user->hei_id)
                    ->where('status', '!=', 'draft')->sum('amount_received');
                // Add unliquidated amount: total received from CHED minus total disbursed to students
                $userStats['total_liquidated'] = Liquidation::where('hei_id', $user->hei_id)
                    ->where('status', '!=', 'draft')->sum('liquidated_amount');
                $userStats['total_unliquidated'] = $userStats['total_amount'] - $userStats['total_liquidated'];
            }
        }

        // Recent liquidations for non-admin users
        $recentLiquidations = [];
        if ($userRole === 'Regional Coordinator') {
            // RC sees all non-draft liquidations (similar to admin view)
            $recentLiquidations = Liquidation::with('hei:id,name')
                ->where('status', '!=', 'draft')
                ->orderBy('created_at', 'desc')
                ->limit(10)
                ->get();
        } elseif ($userRole === 'Accountant') {
            $recentLiquidations = Liquidation::with('hei:id,name')
                ->whereIn('status', ['endorsed_to_accounting', 'endorsed_to_coa', 'returned_to_rc'])
                ->orderBy('created_at', 'desc')
                ->limit(10)
                ->get();
        } elseif ($userRole === 'HEI' && $user->hei_id) {
            // HEI users see their own liquidations including drafts
            $recentLiquidations = Liquidation::with('hei:id,name')
                ->where('hei_id', $user->hei_id)
                ->orderBy('created_at', 'desc')
                ->limit(10)
                ->get();
        }

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
}
