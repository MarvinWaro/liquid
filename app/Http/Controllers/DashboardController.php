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
            // Summary per Academic Year
            $summaryPerAY = Liquidation::select('academic_year')
                ->selectRaw('SUM(amount_received) as total_disbursements')
                ->selectRaw('SUM(amount_disbursed) as liquidated_amount')
                ->selectRaw('SUM(amount_received - amount_disbursed) as unliquidated_amount')
                ->selectRaw('SUM(CASE WHEN status IN ("endorsed_to_accounting", "endorsed_to_coa") THEN amount_received ELSE 0 END) as for_endorsement')
                ->selectRaw('SUM(CASE WHEN status IN ("returned_to_hei", "returned_to_rc") THEN amount_received ELSE 0 END) as for_compliance')
                ->selectRaw('ROUND((SUM(amount_disbursed) / SUM(amount_received)) * 100, 2) as percentage_liquidation')
                ->selectRaw('ROUND((SUM(CASE WHEN status IN ("returned_to_hei", "returned_to_rc") THEN amount_received ELSE 0 END) / SUM(amount_received)) * 100, 2) as percentage_compliance')
                ->selectRaw('ROUND((SUM(CASE WHEN status NOT IN ("draft") THEN amount_received ELSE 0 END) / SUM(amount_received)) * 100, 2) as percentage_submission')
                ->groupBy('academic_year')
                ->orderBy('academic_year', 'desc')
                ->get();

            // Summary per HEI
            $summaryPerHEI = Liquidation::with('hei:id,name')
                ->select('hei_id')
                ->selectRaw('SUM(amount_received) as total_disbursements')
                ->selectRaw('SUM(amount_disbursed) as total_amount_liquidated')
                ->selectRaw('SUM(CASE WHEN status IN ("endorsed_to_accounting", "endorsed_to_coa") THEN amount_received ELSE 0 END) as for_endorsement')
                ->selectRaw('SUM(amount_received - amount_disbursed) as unliquidated_amount')
                ->selectRaw('SUM(CASE WHEN status IN ("returned_to_hei", "returned_to_rc") THEN amount_received ELSE 0 END) as for_compliance')
                ->selectRaw('ROUND((SUM(amount_disbursed) / SUM(amount_received)) * 100, 2) as percentage_liquidation')
                ->selectRaw('ROUND((SUM(CASE WHEN status NOT IN ("draft") THEN amount_received ELSE 0 END) / SUM(amount_received)) * 100, 2) as percentage_submission')
                ->groupBy('hei_id')
                ->get();

            // Status distribution for chart
            $statusDistribution = Liquidation::select('status')
                ->selectRaw('COUNT(*) as count')
                ->groupBy('status')
                ->get();

            // Total statistics for cards
            $totalStats = [
                'total_liquidations' => Liquidation::count(),
                'total_disbursed' => Liquidation::sum('amount_received'),
                'total_liquidated' => Liquidation::sum('amount_disbursed'),
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

        // Role-specific queries
        if ($userRole === 'Regional Coordinator') {
            // RC can see all liquidations (or filter by region if needed)
            $userStats['my_liquidations'] = Liquidation::whereIn('status', ['for_initial_review', 'returned_to_hei'])->count();
            $userStats['pending_action'] = Liquidation::where('status', 'for_initial_review')->count();
            $userStats['completed'] = Liquidation::where('status', 'endorsed_to_accounting')->count();
            $userStats['total_amount'] = Liquidation::whereIn('status', ['for_initial_review', 'endorsed_to_accounting'])->sum('amount_received');
        } elseif ($userRole === 'Accountant') {
            $userStats['my_liquidations'] = Liquidation::whereIn('status', ['endorsed_to_accounting', 'returned_to_rc'])->count();
            $userStats['pending_action'] = Liquidation::where('status', 'endorsed_to_accounting')->count();
            $userStats['completed'] = Liquidation::where('status', 'endorsed_to_coa')->count();
            $userStats['total_amount'] = Liquidation::whereIn('status', ['endorsed_to_accounting', 'endorsed_to_coa'])->sum('amount_received');
        } elseif ($userRole === 'HEI') {
            // HEI users see their own liquidations
            if ($user->hei_id) {
                $userStats['my_liquidations'] = Liquidation::where('hei_id', $user->hei_id)->count();
                $userStats['pending_action'] = Liquidation::where('hei_id', $user->hei_id)
                    ->whereIn('status', ['draft', 'returned_to_hei'])->count();
                $userStats['completed'] = Liquidation::where('hei_id', $user->hei_id)
                    ->where('status', 'endorsed_to_coa')->count();
                $userStats['total_amount'] = Liquidation::where('hei_id', $user->hei_id)->sum('amount_received');
            }
        }

        // Recent liquidations for non-admin users
        $recentLiquidations = [];
        if ($userRole === 'Regional Coordinator') {
            $recentLiquidations = Liquidation::with('hei:id,name')
                ->whereIn('status', ['for_initial_review', 'endorsed_to_accounting', 'returned_to_hei'])
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
            $recentLiquidations = Liquidation::with('hei:id,name')
                ->where('hei_id', $user->hei_id)
                ->orderBy('created_at', 'desc')
                ->limit(10)
                ->get();
        }

        return Inertia::render('dashboard', [
            'isAdmin' => false,
            'summaryPerAY' => [],
            'summaryPerHEI' => [],
            'userStats' => $userStats,
            'recentLiquidations' => $recentLiquidations,
            'userRole' => $userRole,
        ]);
    }
}
