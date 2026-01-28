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
            $summaryPerAY = Liquidation::select('academic_year')
                ->where('status', '!=', 'draft')
                ->selectRaw('SUM(amount_received) as total_disbursements')
                ->selectRaw('SUM(amount_disbursed) as liquidated_amount')
                ->selectRaw('SUM(amount_received - amount_disbursed) as unliquidated_amount')
                ->selectRaw('SUM(CASE WHEN status IN ("endorsed_to_accounting", "endorsed_to_coa") THEN amount_received ELSE 0 END) as for_endorsement')
                ->selectRaw('SUM(CASE WHEN status IN ("returned_to_hei", "returned_to_rc") THEN amount_received ELSE 0 END) as for_compliance')
                ->selectRaw('ROUND((SUM(amount_disbursed) / NULLIF(SUM(amount_received), 0)) * 100, 2) as percentage_liquidation')
                ->selectRaw('ROUND((SUM(CASE WHEN status IN ("returned_to_hei", "returned_to_rc") THEN amount_received ELSE 0 END) / NULLIF(SUM(amount_received), 0)) * 100, 2) as percentage_compliance')
                ->selectRaw('ROUND((COUNT(*) / NULLIF(COUNT(*), 0)) * 100, 2) as percentage_submission')
                ->groupBy('academic_year')
                ->orderBy('academic_year', 'desc')
                ->get();

            // Summary per HEI (exclude drafts)
            $summaryPerHEI = Liquidation::with('hei:id,name')
                ->where('status', '!=', 'draft')
                ->select('hei_id')
                ->selectRaw('SUM(amount_received) as total_disbursements')
                ->selectRaw('SUM(amount_disbursed) as total_amount_liquidated')
                ->selectRaw('SUM(CASE WHEN status IN ("endorsed_to_accounting", "endorsed_to_coa") THEN amount_received ELSE 0 END) as for_endorsement')
                ->selectRaw('SUM(amount_received - amount_disbursed) as unliquidated_amount')
                ->selectRaw('SUM(CASE WHEN status IN ("returned_to_hei", "returned_to_rc") THEN amount_received ELSE 0 END) as for_compliance')
                ->selectRaw('ROUND((SUM(amount_disbursed) / NULLIF(SUM(amount_received), 0)) * 100, 2) as percentage_liquidation')
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
                'total_liquidated' => Liquidation::where('status', '!=', 'draft')->sum('amount_disbursed'),
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
            // RC can see all submitted liquidations (exclude drafts)
            $userStats['my_liquidations'] = Liquidation::whereIn('status', ['for_initial_review', 'returned_to_hei'])->count();
            $userStats['pending_action'] = Liquidation::where('status', 'for_initial_review')->count();
            $userStats['completed'] = Liquidation::where('status', 'endorsed_to_accounting')->count();
            $userStats['total_amount'] = Liquidation::whereIn('status', ['for_initial_review', 'endorsed_to_accounting', 'returned_to_hei'])->sum('amount_received');
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
            // HEI users see their own liquidations including drafts
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
