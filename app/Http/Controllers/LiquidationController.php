<?php

namespace App\Http\Controllers;

use App\Models\Liquidation;
use App\Models\LiquidationItem;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Response as FileResponse;
use Illuminate\Support\Facades\DB;

class LiquidationController extends Controller
{
    public function index(): Response
    {
        $liquidations = Liquidation::orderBy('created_at', 'desc')->get();

        // 1. Sequence Logic
        $year = date('Y');
        $lastRecord = Liquidation::whereYear('created_at', $year)->latest()->first();
        $sequence = $lastRecord ? intval(substr($lastRecord->control_no, -5)) + 1 : 1;
        $nextSequence = str_pad($sequence, 5, '0', STR_PAD_LEFT);

        $programs = [
            ['id' => 1, 'name' => 'TES (Tertiary Education Subsidy)', 'code' => 'TES'],
            ['id' => 2, 'name' => 'TDP (Tulong Dunong Program)', 'code' => 'TDP'],
        ];

        $schools = [];
        for ($i = 1; $i <= 10; $i++) {
            $schools[] = ['id' => $i, 'name' => "School {$i} (Sample HEI)"];
        }

        // ✅ PERMISSIONS: Passed to frontend to control button visibility
        $userPermissions = [
            'can_submit'             => true, // Simplified: Anyone who can see Draft can submit
            'can_endorse_accounting' => auth()->user()->hasPermission('endorse_to_accounting'),
            'can_endorse_coa'        => auth()->user()->hasPermission('endorse_to_coa'),
            'can_return'             => auth()->user()->hasPermission('return_application'),
        ];

        return Inertia::render('liquidations/index', [
            'liquidations' => $liquidations,
            'nextSequence' => $nextSequence,
            'currentYear' => $year,
            'programs' => $programs,
            'schools' => $schools,
            'userPermissions' => $userPermissions, // ✅ Passing to React
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'batch_no' => 'nullable|string|max:50',
            'hei_id' => 'required|integer',
            'program_id' => 'required|integer',
            'academic_year' => 'required|string',
            'semester' => 'required|string',
            'amount_received' => 'required|numeric|min:0',
        ]);

        $year = date('Y');
        $prefix = $validated['program_id'] == 1 ? 'TES' : 'TDP';
        $lastRecord = Liquidation::whereYear('created_at', $year)->latest()->first();
        $sequence = $lastRecord ? intval(substr($lastRecord->control_no, -5)) + 1 : 1;
        $finalSequence = str_pad($sequence, 5, '0', STR_PAD_LEFT);
        $controlNo = "{$prefix}-{$year}-{$finalSequence}";

        Liquidation::create([
            'control_no' => $controlNo,
            'batch_no' => $validated['batch_no'],
            'hei_id' => $validated['hei_id'],
            'program_id' => $validated['program_id'],
            'academic_year' => $validated['academic_year'],
            'semester' => $validated['semester'],
            'amount_received' => $validated['amount_received'],
            'status' => 'Draft',
        ]);

        return redirect()->back()->with('success', 'Liquidation Report initialized successfully.');
    }

    public function show(Liquidation $liquidation): Response
    {
        $liquidation->load(['items', 'hei']);
        return Inertia::render('liquidations/show', [
            'liquidation' => $liquidation,
            'items' => $liquidation->items,
        ]);
    }

    public function getItems(Liquidation $liquidation)
    {
        return response()->json(
            $liquidation->items()->orderBy('last_name', 'asc')->get()
        );
    }

    public function downloadTemplate()
    {
        $headers = [
            "Content-type" => "text/csv",
            "Content-Disposition" => "attachment; filename=Liquidation_Template.csv",
            "Pragma" => "no-cache",
            "Cache-Control" => "must-revalidate, post-check=0, pre-check=0",
            "Expires" => "0"
        ];

        $columns = ['Student No', 'Last Name', 'First Name', 'Middle Name', 'Extension Name', 'Award No', 'Date Disbursed (YYYY-MM-DD)', 'Amount', 'Remarks'];

        $callback = function() use ($columns) {
            $file = fopen('php://output', 'w');
            fputcsv($file, $columns);
            fputcsv($file, ['2024-001', 'Dela Cruz', 'Juan', 'Santos', 'Jr.', 'TES-2024-123', '2024-01-15', '20000.00', 'Claimed by mother']);
            fclose($file);
        };

        return FileResponse::stream($callback, 200, $headers);
    }

    public function uploadCsv(Request $request, Liquidation $liquidation)
    {
        $request->validate(['csv_file' => 'required|file|mimes:csv,txt']);
        $file = $request->file('csv_file');

        DB::beginTransaction();
        try {
            $liquidation->items()->delete();
            $handle = fopen($file->getPathname(), 'r');
            fgetcsv($handle);

            $count = 0;
            while (($row = fgetcsv($handle)) !== false) {
                if (count($row) < 8 || empty($row[1]) || empty($row[2])) continue;

                $amountRaw = str_replace(',', '', $row[7] ?? '0');
                $amount = is_numeric($amountRaw) ? floatval($amountRaw) : 0;
                $dateDisbursed = !empty($row[6]) ? date('Y-m-d', strtotime($row[6])) : date('Y-m-d');

                $liquidation->items()->create([
                    'student_no'     => $row[0] ?? null,
                    'last_name'      => $row[1],
                    'first_name'     => $row[2],
                    'middle_name'    => $row[3] ?? null,
                    'extension_name' => $row[4] ?? null,
                    'award_no'       => $row[5] ?? null,
                    'date_disbursed' => $dateDisbursed,
                    'amount'         => $amount,
                    'remarks'        => $row[8] ?? null,
                ]);
                $count++;
            }
            fclose($handle);

            $totalDisbursed = $liquidation->items()->sum('amount');
            $liquidation->update(['amount_disbursed' => $totalDisbursed]);

            DB::commit();
            return response()->json(['message' => "Successfully imported {$count} students."], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => "Error processing CSV: " . $e->getMessage()], 500);
        }
    }

    // 1. Submit (HEI)
    public function submit(Liquidation $liquidation)
    {
        if ($liquidation->items()->count() === 0) {
            return redirect()->back()->with('error', 'Cannot submit an empty report. Please add students first.');
        }
        $liquidation->update(['status' => 'Submitted']);
        return redirect()->back()->with('success', 'Report submitted successfully for Initial Review.');
    }

    // 2. Endorse to Accounting (Regional Coordinator)
    public function endorse(Liquidation $liquidation)
    {
        if (!auth()->user()->hasPermission('endorse_to_accounting')) {
            abort(403, 'Unauthorized. Only Coordinators can endorse to Accounting.');
        }

        if ($liquidation->status !== 'Submitted') {
            return redirect()->back()->with('error', 'Only submitted reports can be endorsed to Accounting.');
        }

        $liquidation->update([
            'status' => 'Verified', // Verified = Endorsed to Accounting
            'date_endorsed' => now(),
            'endorsed_by' => auth()->user()->name,
        ]);

        return redirect()->back()->with('success', 'Report endorsed to Accounting successfully.');
    }

    // 3. Endorse to COA (Accountant)
    public function endorseToCoa(Liquidation $liquidation)
    {
        if (!auth()->user()->hasPermission('endorse_to_coa')) {
            abort(403, 'Unauthorized. Only Accountants can endorse to COA.');
        }

        if ($liquidation->status !== 'Verified') {
            return redirect()->back()->with('error', 'Report must be verified by Accounting first.');
        }

        $liquidation->update([
            'status' => 'Endorsed to COA',
        ]);

        return redirect()->back()->with('success', 'Report successfully Endorsed to COA.');
    }

    // 4. Return Report
    public function returnReport(Liquidation $liquidation)
    {
        if (!auth()->user()->hasPermission('return_application')) {
            abort(403, 'Unauthorized.');
        }

        $liquidation->update(['status' => 'Returned']);
        return redirect()->back()->with('error', 'Report returned to HEI for compliance.');
    }
}
