<?php

namespace App\Http\Controllers;

use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\LiquidationDocument;
use App\Models\Program;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Storage;

class LiquidationController extends Controller
{
    /**
     * Display a listing of liquidations.
     */
    public function index(Request $request)
    {
        if (!$request->user()->hasPermission('view_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        $query = Liquidation::with(['hei', 'creator', 'reviewer', 'accountantReviewer'])
            ->orderBy('created_at', 'desc');

        // Filter based on user role
        $user = $request->user();

        // Regional Coordinator sees liquidations for initial review
        if ($user->role->name === 'Regional Coordinator') {
            $query->whereIn('status', ['for_initial_review', 'returned_to_rc']);
        }

        // Accountant sees liquidations endorsed to accounting
        if ($user->role->name === 'Accountant') {
            $query->whereIn('status', ['endorsed_to_accounting', 'endorsed_to_coa']);
        }

        // HEI users see only their liquidations
        if (!$user->isSuperAdmin() && !in_array($user->role->name, ['Regional Coordinator', 'Accountant', 'Admin'])) {
            $query->where('created_by', $user->id);
        }

        // Status filter
        if ($request->status && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Search
        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('control_no', 'like', '%' . $request->search . '%')
                    ->orWhereHas('hei', function ($q) use ($request) {
                        $q->where('name', 'like', '%' . $request->search . '%');
                    });
            });
        }

        $liquidations = $query->paginate(15)->through(function ($liquidation) {
            return [
                'id' => $liquidation->id,
                'reference_number' => $liquidation->control_no ?? $liquidation->reference_number,
                'hei' => [
                    'id' => $liquidation->hei?->id ?? 0,
                    'name' => $liquidation->hei?->name ?? 'N/A',
                    'code' => $liquidation->hei?->code ?? 'N/A',
                ],
                'disbursed_amount' => number_format($liquidation->disbursed_amount, 2),
                'liquidated_amount' => number_format($liquidation->liquidated_amount, 2),
                'status' => $liquidation->status,
                'status_label' => $liquidation->getStatusLabel(),
                'status_badge' => $liquidation->getStatusBadgeClass(),
                'created_at' => $liquidation->created_at->format('M d, Y'),
                'created_by' => $liquidation->creator?->name ?? 'N/A',
                'reviewed_by' => $liquidation->reviewer?->name,
                'accountant_reviewed_by' => $liquidation->accountantReviewer?->name,
                'days_lapsed' => $liquidation->days_lapsed,
            ];
        });

        $heis = HEI::where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        $programs = Program::where('status', 'active')
            ->orderBy('code')
            ->get(['id', 'code', 'name']);

        // Get user's HEI if they belong to one
        $userHei = $request->user()->hei;

        // Get users by role for dropdowns
        $regionalCoordinators = User::whereHas('role', function ($q) {
            $q->where('name', 'Regional Coordinator');
        })->where('status', 'active')->orderBy('name')->get(['id', 'name']);

        $accountants = User::whereHas('role', function ($q) {
            $q->where('name', 'Accountant');
        })->where('status', 'active')->orderBy('name')->get(['id', 'name']);

        return Inertia::render('liquidation/index', [
            'liquidations' => $liquidations,
            'heis' => $heis,
            'programs' => $programs,
            'userHei' => $userHei ? [
                'id' => $userHei->id,
                'name' => $userHei->name,
                'code' => $userHei->code,
                'uii' => $userHei->uii,
            ] : null,
            'regionalCoordinators' => $regionalCoordinators,
            'accountants' => $accountants,
            'filters' => $request->only(['search']),
            'permissions' => [
                'create' => $request->user()->hasPermission('create_liquidation'),
                'edit' => $request->user()->hasPermission('edit_liquidation'),
                'delete' => $request->user()->hasPermission('delete_liquidation'),
                'review' => $request->user()->hasPermission('review_liquidation'),
                'endorse' => $request->user()->hasPermission('endorse_liquidation'),
            ],
            'userRole' => $request->user()->role->name,
        ]);
    }

    /**
     * Show the form for creating a new liquidation.
     */
    public function create(Request $request)
    {
        if (!$request->user()->hasPermission('create_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        $heis = HEI::where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return Inertia::render('liquidation/create', [
            'heis' => $heis,
        ]);
    }

    /**
     * Store a newly created liquidation.
     */
    public function store(Request $request)
    {
        if (!$request->user()->hasPermission('create_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'hei_id' => 'required|exists:heis,id',
            'program_id' => 'required|exists:programs,id',
            'academic_year' => 'required|string',
            'semester' => 'required|string',
            'batch_no' => 'nullable|string|max:255',
            'amount_received' => 'required|numeric|min:0',
            'date_fund_released' => 'nullable|date',
        ]);

        // Get program to generate control number
        $program = Program::findOrFail($validated['program_id']);

        // Generate control number based on program: TES-YYYY-XXXXX or TDP-YYYY-XXXXX
        $year = date('Y');
        $lastLiquidation = Liquidation::where('program_id', $program->id)
            ->whereYear('created_at', $year)
            ->latest('id')
            ->first();

        $nextNumber = $lastLiquidation ? ((int) substr($lastLiquidation->control_no, -5) + 1) : 1;
        $controlNo = $program->code . '-' . $year . '-' . str_pad($nextNumber, 5, '0', STR_PAD_LEFT);

        $liquidation = Liquidation::create([
            'hei_id' => $validated['hei_id'],
            'program_id' => $validated['program_id'],
            'academic_year' => $validated['academic_year'],
            'semester' => $validated['semester'],
            'batch_no' => $validated['batch_no'],
            'control_no' => $controlNo,
            'created_by' => $request->user()->id,
            'status' => 'draft',
            'date_fund_released' => $validated['date_fund_released'] ?? null,
            // Initialize other required fields with defaults
            'disbursed_amount' => $validated['amount_received'],
            'amount_disbursed' => $validated['amount_received'],
            'amount_received' => $validated['amount_received'],
            'amount_refunded' => 0,
            'liquidated_amount' => 0,
            'document_status' => 'No Submission',
        ]);

        return redirect()->route('liquidation.index')
            ->with('success', 'Liquidation report created successfully with Control No: ' . $controlNo);
    }

    /**
     * Show the form for editing a liquidation.
     */
    public function edit(Request $request, Liquidation $liquidation)
    {
        // Allow viewing for users with view permission or review permission
        $user = $request->user();
        $canView = $user->hasPermission('view_liquidation') ||
                   $user->hasPermission('review_liquidation') ||
                   $user->hasPermission('edit_liquidation');

        if (!$canView) {
            abort(403, 'Unauthorized action.');
        }

        // Regional Coordinator and Accountant can view all liquidations they need to review
        $isReviewer = in_array($user->role->name, ['Regional Coordinator', 'Accountant', 'Admin', 'Super Admin']);

        // HEI users can only view their own liquidations
        if (!$isReviewer && $liquidation->created_by !== $user->id) {
            abort(403, 'You can only view your own liquidations.');
        }

        $liquidation->load(['hei', 'documents.uploader', 'creator', 'reviewer', 'accountantReviewer']);

        $heis = HEI::where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return Inertia::render('liquidation/edit', [
            'liquidation' => [
                'id' => $liquidation->id,
                'reference_number' => $liquidation->control_no ?? $liquidation->reference_number,
                'hei_id' => $liquidation->hei_id,
                'hei' => [
                    'id' => $liquidation->hei->id,
                    'name' => $liquidation->hei->name,
                    'code' => $liquidation->hei->code,
                ],
                'disbursed_amount' => $liquidation->disbursed_amount,
                'disbursement_date' => $liquidation->disbursement_date?->format('Y-m-d'),
                'fund_source' => $liquidation->fund_source,
                'liquidated_amount' => $liquidation->liquidated_amount,
                'purpose' => $liquidation->purpose,
                'remarks' => $liquidation->remarks,
                'status' => $liquidation->status,
                'status_label' => $liquidation->getStatusLabel(),
                'review_remarks' => $liquidation->review_remarks,
                'accountant_remarks' => $liquidation->accountant_remarks,
                'documents' => $liquidation->documents->map(function ($doc) {
                    return [
                        'id' => $doc->id,
                        'document_type' => $doc->document_type,
                        'file_name' => $doc->file_name,
                        'file_size' => $doc->getFormattedFileSize(),
                        'description' => $doc->description,
                        'uploaded_by' => $doc->uploader->name,
                        'uploaded_at' => $doc->created_at->format('M d, Y H:i'),
                    ];
                }),
                'can_edit' => $liquidation->isEditableByHEI(),
                'can_submit' => $liquidation->canBeSubmitted(),
            ],
            'heis' => $heis,
            'permissions' => [
                'edit' => $request->user()->hasPermission('edit_liquidation'),
                'delete' => $request->user()->hasPermission('delete_liquidation'),
            ],
        ]);
    }

    /**
     * Update the specified liquidation.
     */
    public function update(Request $request, Liquidation $liquidation)
    {
        if (!$request->user()->hasPermission('edit_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        // Check if user can edit
        $user = $request->user();
        if (!$user->isSuperAdmin() && !in_array($user->role->name, ['Admin'])) {
            if ($liquidation->created_by !== $user->id || !$liquidation->isEditableByHEI()) {
                abort(403, 'You cannot edit this liquidation.');
            }
        }

        $validated = $request->validate([
            'hei_id' => 'required|exists:heis,id',
            'disbursed_amount' => 'required|numeric|min:0',
            'disbursement_date' => 'nullable|date',
            'fund_source' => 'nullable|string|max:255',
            'liquidated_amount' => 'nullable|numeric|min:0',
            'purpose' => 'nullable|string',
            'remarks' => 'nullable|string',
        ]);

        $liquidation->update($validated);

        return redirect()->back()->with('success', 'Liquidation updated successfully.');
    }

    /**
     * Submit liquidation for initial review by Regional Coordinator.
     */
    public function submit(Request $request, Liquidation $liquidation)
    {
        $user = $request->user();

        // Only creator can submit
        if ($liquidation->created_by !== $user->id) {
            abort(403, 'Only the creator can submit this liquidation.');
        }

        if (!$liquidation->canBeSubmitted()) {
            abort(403, 'This liquidation cannot be submitted in its current status.');
        }

        // Determine document status based on beneficiaries and documents
        $hasBeneficiaries = $liquidation->beneficiaries()->count() > 0;
        $hasDocuments = $liquidation->documents()->count() > 0;

        $documentStatus = 'No Submission';
        if ($hasBeneficiaries && $hasDocuments) {
            $documentStatus = 'Complete Submission';
        } elseif ($hasBeneficiaries || $hasDocuments) {
            $documentStatus = 'Partial Submission';
        }

        $liquidation->update([
            'status' => 'for_initial_review',
            'date_submitted' => now(),
            'document_status' => $documentStatus,
        ]);

        return redirect()->route('liquidation.index')
            ->with('success', 'Liquidation submitted for initial review by Regional Coordinator.');
    }

    /**
     * Regional Coordinator endorses to accounting.
     */
    public function endorseToAccounting(Request $request, Liquidation $liquidation)
    {
        $user = $request->user();

        // Only Regional Coordinator can endorse
        if ($user->role->name !== 'Regional Coordinator' && !$user->isSuperAdmin()) {
            abort(403, 'Only Regional Coordinator can endorse to accounting.');
        }

        // Check if liquidation is in correct status for RC review
        if (!in_array($liquidation->status, ['for_initial_review', 'returned_to_rc'])) {
            abort(403, 'This liquidation is not available for Regional Coordinator review.');
        }

        $validated = $request->validate([
            'review_remarks' => 'nullable|string',
            'receiver_name' => 'nullable|string|max:255',
            'document_location' => 'nullable|string|max:255',
            'transmittal_reference_no' => 'required|string|max:255',
            'number_of_folders' => 'nullable|integer',
            'folder_location_number' => 'nullable|string|max:255',
            'group_transmittal' => 'nullable|string|max:255',
        ]);

        $liquidation->update([
            'status' => 'endorsed_to_accounting',
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
            'received_at' => now(),
            'review_remarks' => $validated['review_remarks'] ?? null,
            'receiver_name' => $validated['receiver_name'] ?? null,
            'document_location' => $validated['document_location'] ?? null,
            'transmittal_reference_no' => $validated['transmittal_reference_no'],
            'number_of_folders' => $validated['number_of_folders'] ?? null,
            'folder_location_number' => $validated['folder_location_number'] ?? null,
            'group_transmittal' => $validated['group_transmittal'] ?? null,
        ]);

        return redirect()->route('liquidation.index')
            ->with('success', 'Liquidation endorsed to Accounting successfully.');
    }

    /**
     * Regional Coordinator returns to HEI.
     */
    public function returnToHEI(Request $request, Liquidation $liquidation)
    {
        $user = $request->user();

        // Only Regional Coordinator can return
        if ($user->role->name !== 'Regional Coordinator' && !$user->isSuperAdmin()) {
            abort(403, 'Only Regional Coordinator can return liquidation to HEI.');
        }

        // Check if liquidation is in correct status for RC review
        if (!in_array($liquidation->status, ['for_initial_review', 'returned_to_rc'])) {
            abort(403, 'This liquidation is not available for Regional Coordinator review.');
        }

        $validated = $request->validate([
            'review_remarks' => 'required|string',
            'documents_for_compliance' => 'nullable|string',
            'receiver_name' => 'nullable|string|max:255',
            'document_location' => 'nullable|string|max:255',
        ]);

        // Append to review history
        $reviewHistory = $liquidation->review_history ?? [];
        $reviewHistory[] = [
            'returned_at' => now()->toIso8601String(),
            'returned_by' => $user->name,
            'returned_by_id' => $user->id,
            'review_remarks' => $validated['review_remarks'],
            'documents_for_compliance' => $validated['documents_for_compliance'] ?? null,
        ];

        $liquidation->update([
            'status' => 'returned_to_hei',
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
            'received_at' => now(),
            'review_remarks' => $validated['review_remarks'],
            'documents_for_compliance' => $validated['documents_for_compliance'] ?? null,
            'compliance_status' => 'Pending Review by HEI',
            'date_concerns_emailed' => now(),
            'receiver_name' => $validated['receiver_name'] ?? null,
            'document_location' => $validated['document_location'] ?? null,
            'review_history' => $reviewHistory,
        ]);

        return redirect()->route('liquidation.index')
            ->with('success', 'Liquidation returned to HEI for corrections.');
    }

    /**
     * Accountant endorses to COA.
     */
    public function endorseToCOA(Request $request, Liquidation $liquidation)
    {
        $user = $request->user();

        // Only Accountant can endorse to COA
        if ($user->role->name !== 'Accountant' && !$user->isSuperAdmin()) {
            abort(403, 'Only Accountant can endorse to COA.');
        }

        if (!$liquidation->isPendingAccountantReview()) {
            abort(403, 'This liquidation is not pending Accountant review.');
        }

        $validated = $request->validate([
            'accountant_remarks' => 'nullable|string',
        ]);

        $liquidation->update([
            'status' => 'endorsed_to_coa',
            'accountant_reviewed_by' => $user->id,
            'accountant_reviewed_at' => now(),
            'accountant_remarks' => $validated['accountant_remarks'] ?? null,
            'coa_endorsed_by' => $user->id,
            'coa_endorsed_at' => now(),
        ]);

        return redirect()->route('liquidation.index')
            ->with('success', 'Liquidation endorsed to COA successfully.');
    }

    /**
     * Accountant returns to Regional Coordinator.
     */
    public function returnToRC(Request $request, Liquidation $liquidation)
    {
        $user = $request->user();

        // Only Accountant can return to RC
        if ($user->role->name !== 'Accountant' && !$user->isSuperAdmin()) {
            abort(403, 'Only Accountant can return liquidation to Regional Coordinator.');
        }

        if (!$liquidation->isPendingAccountantReview()) {
            abort(403, 'This liquidation is not pending Accountant review.');
        }

        $validated = $request->validate([
            'accountant_remarks' => 'required|string',
        ]);

        // Append to accountant review history
        $accountantHistory = $liquidation->accountant_review_history ?? [];
        $accountantHistory[] = [
            'returned_at' => now()->toIso8601String(),
            'returned_by' => $user->name,
            'returned_by_id' => $user->id,
            'accountant_remarks' => $validated['accountant_remarks'],
        ];

        $liquidation->update([
            'status' => 'returned_to_rc',
            'accountant_reviewed_by' => $user->id,
            'accountant_reviewed_at' => now(),
            'accountant_remarks' => $validated['accountant_remarks'],
            'accountant_review_history' => $accountantHistory,
        ]);

        return redirect()->route('liquidation.index')
            ->with('success', 'Liquidation returned to Regional Coordinator for review.');
    }

    /**
     * Upload document to liquidation.
     */
    public function uploadDocument(Request $request, Liquidation $liquidation)
    {
        $validated = $request->validate([
            'document_type' => 'required|string|max:255',
            'file' => 'required|file|max:10240', // 10MB max
            'description' => 'nullable|string',
        ]);

        $file = $request->file('file');
        $fileName = time() . '_' . $file->getClientOriginalName();
        $filePath = $file->storeAs('liquidation_documents/' . $liquidation->id, $fileName, 'public');

        LiquidationDocument::create([
            'liquidation_id' => $liquidation->id,
            'document_type' => $validated['document_type'],
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $filePath,
            'file_type' => $file->getMimeType(),
            'file_size' => $file->getSize(),
            'description' => $validated['description'] ?? null,
            'uploaded_by' => $request->user()->id,
        ]);

        return redirect()->back()->with('success', 'Document uploaded successfully.');
    }

    /**
     * Download document.
     */
    public function downloadDocument(Request $request, LiquidationDocument $document)
    {
        $liquidation = $document->liquidation;

        // Check if user has permission to view this liquidation
        $user = $request->user();
        $canView = $user->hasPermission('view_liquidation') ||
                   $user->hasPermission('review_liquidation') ||
                   $user->hasPermission('edit_liquidation');

        if (!$canView) {
            abort(403, 'Unauthorized action.');
        }

        // Check if user can view this specific liquidation
        $isReviewer = in_array($user->role->name, ['Regional Coordinator', 'Accountant', 'Admin', 'Super Admin']);
        if (!$isReviewer && $liquidation->created_by !== $user->id) {
            abort(403, 'You can only view documents from your own liquidations.');
        }

        // Check if file exists
        if (!Storage::disk('public')->exists($document->file_path)) {
            abort(404, 'File not found.');
        }

        return Storage::disk('public')->download($document->file_path, $document->file_name);
    }

    /**
     * Delete document.
     */
    public function deleteDocument(Request $request, LiquidationDocument $document)
    {
        $liquidation = $document->liquidation;

        // Check permissions
        $user = $request->user();
        if (!$user->isSuperAdmin() && !in_array($user->role->name, ['Admin'])) {
            if ($liquidation->created_by !== $user->id || !$liquidation->isEditableByHEI()) {
                abort(403, 'You cannot delete this document.');
            }
        }

        // Delete file from storage
        Storage::disk('public')->delete($document->file_path);

        $document->delete();

        return redirect()->back()->with('success', 'Document deleted successfully.');
    }

    /**
     * Remove the specified liquidation.
     */
    public function destroy(Request $request, Liquidation $liquidation)
    {
        if (!$request->user()->hasPermission('delete_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        // Only allow deletion of draft or returned liquidations
        if (!in_array($liquidation->status, ['draft', 'returned_to_hei'])) {
            return redirect()->back()->with('error', 'Cannot delete liquidation in this status.');
        }

        // Delete associated documents
        foreach ($liquidation->documents as $document) {
            Storage::disk('public')->delete($document->file_path);
        }

        $liquidation->delete();

        return redirect()->route('liquidation.index')
            ->with('success', 'Liquidation deleted successfully.');
    }

    /**
     * Download beneficiary template Excel file.
     */
    public function downloadTemplate(Request $request)
    {
        if (!$request->user()->hasPermission('view_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();

        // Set headers
        $headers = [
            'Student No.',
            'Last Name',
            'First Name',
            'Middle Name',
            'Extension Name',
            'Award No.',
            'Amount',
            'Date Disbursed'
        ];

        // Write headers in row 1
        $column = 'A';
        foreach ($headers as $header) {
            $sheet->setCellValue($column . '1', $header);
            $sheet->getStyle($column . '1')->getFont()->setBold(true);
            $sheet->getStyle($column . '1')->getFill()
                ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                ->getStartColor()->setARGB('FFD9EAD3');
            $column++;
        }

        // Auto-size columns
        foreach (range('A', 'H') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        // Add sample data in row 2 as guide
        $sheet->setCellValue('A2', '2024-001');
        $sheet->setCellValue('B2', 'Dela Cruz');
        $sheet->setCellValue('C2', 'Juan');
        $sheet->setCellValue('D2', 'Santos');
        $sheet->setCellValue('E2', 'Jr.');
        $sheet->setCellValue('F2', 'TES-2024-123');
        $sheet->setCellValue('G2', '10000.00');
        $sheet->setCellValue('H2', date('Y-m-d'));

        // Style sample row as lighter
        $sheet->getStyle('A2:H2')->getFont()->setItalic(true);
        $sheet->getStyle('A2:H2')->getFill()
            ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
            ->getStartColor()->setARGB('FFF3F3F3');

        // Create writer
        $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);

        // Set headers for download
        $filename = 'liquidation_beneficiaries_template_' . date('Y-m-d') . '.xlsx';

        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment;filename="' . $filename . '"');
        header('Cache-Control: max-age=0');

        $writer->save('php://output');
        exit;
    }

    /**
     * Download CSV template for beneficiaries.
     */
    public function downloadBeneficiaryTemplate(Request $request, Liquidation $liquidation)
    {
        if (!$request->user()->hasPermission('view_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        $filename = 'beneficiaries_template_' . $liquidation->control_no . '.csv';

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ];

        $callback = function() {
            $file = fopen('php://output', 'w');

            // Add header row
            fputcsv($file, [
                'Student No',
                'Last Name',
                'First Name',
                'Middle Name',
                'Extension Name',
                'Award No',
                'Date Disbursed (YYYY-MM-DD)',
                'Amount',
                'Remarks'
            ]);

            // Add sample row
            fputcsv($file, [
                '2024-001',
                'Dela Cruz',
                'Juan',
                'Santos',
                'Jr.',
                'TES-2024-123',
                date('Y-m-d'),
                '5000.00',
                ''
            ]);

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * Import beneficiaries from CSV.
     */
    public function importBeneficiaries(Request $request, Liquidation $liquidation)
    {
        $user = $request->user();

        // Check permissions
        if (!$user->hasPermission('edit_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        // Check if user can edit this liquidation
        if (!$user->isSuperAdmin() && !in_array($user->role->name, ['Admin'])) {
            if ($liquidation->created_by !== $user->id || !$liquidation->isEditableByHEI()) {
                abort(403, 'You cannot edit this liquidation.');
            }
        }

        $validated = $request->validate([
            'csv_file' => 'required|file|mimes:csv,txt|max:2048',
        ]);

        $file = $request->file('csv_file');
        $path = $file->getRealPath();

        $csv = array_map('str_getcsv', file($path));
        $header = array_shift($csv); // Remove header row

        $imported = 0;
        $errors = [];

        foreach ($csv as $index => $row) {
            // Skip empty rows
            if (empty(array_filter($row))) {
                continue;
            }

            try {
                \App\Models\LiquidationBeneficiary::create([
                    'liquidation_id' => $liquidation->id,
                    'student_no' => $row[0] ?? '',
                    'last_name' => $row[1] ?? '',
                    'first_name' => $row[2] ?? '',
                    'middle_name' => $row[3] ?? null,
                    'extension_name' => $row[4] ?? null,
                    'award_no' => $row[5] ?? '',
                    'date_disbursed' => $row[6] ?? now(),
                    'amount' => $row[7] ?? 0,
                    'remarks' => $row[8] ?? null,
                ]);
                $imported++;
            } catch (\Exception $e) {
                $errors[] = "Row " . ($index + 2) . ": " . $e->getMessage();
            }
        }

        // Update total disbursed amount
        $totalDisbursed = $liquidation->beneficiaries()->sum('amount');
        $liquidation->update([
            'liquidated_amount' => $totalDisbursed,
        ]);

        if (count($errors) > 0) {
            return redirect()->back()->with('error', 'Imported ' . $imported . ' beneficiaries with ' . count($errors) . ' errors.');
        }

        return redirect()->back()->with('success', 'Successfully imported ' . $imported . ' beneficiaries.');
    }

    /**
     * Get liquidation details with beneficiaries.
     */
    public function show(Request $request, Liquidation $liquidation)
    {
        $user = $request->user();

        if (!$user->hasPermission('view_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        // Check if user can view this liquidation
        $isReviewer = in_array($user->role->name, ['Regional Coordinator', 'Accountant', 'Admin', 'Super Admin']);
        if (!$isReviewer && $liquidation->created_by !== $user->id) {
            abort(403, 'You can only view your own liquidations.');
        }

        $liquidation->load(['hei', 'program', 'beneficiaries', 'documents']);

        $totalDisbursed = $liquidation->beneficiaries->sum('amount');
        $remaining = $liquidation->amount_received - $totalDisbursed;

        return response()->json([
            'id' => $liquidation->id,
            'control_no' => $liquidation->control_no,
            'hei_name' => $liquidation->hei?->name ?? 'N/A',
            'program_name' => $liquidation->program?->name ?? 'N/A',
            'academic_year' => $liquidation->academic_year,
            'semester' => $liquidation->semester,
            'batch_no' => $liquidation->batch_no,
            'amount_received' => $liquidation->amount_received,
            'total_disbursed' => $totalDisbursed,
            'remaining_amount' => $remaining,
            'status' => $liquidation->status,
            'status_label' => $liquidation->getStatusLabel(),
            'review_remarks' => $liquidation->review_remarks,
            'documents_for_compliance' => $liquidation->documents_for_compliance,
            'compliance_status' => $liquidation->compliance_status,
            'review_history' => $liquidation->review_history ?? [],
            'accountant_review_history' => $liquidation->accountant_review_history ?? [],
            'accountant_remarks' => $liquidation->accountant_remarks,
            'beneficiaries' => $liquidation->beneficiaries->map(function ($b) {
                return [
                    'id' => $b->id,
                    'student_no' => $b->student_no,
                    'last_name' => $b->last_name,
                    'first_name' => $b->first_name,
                    'middle_name' => $b->middle_name,
                    'extension_name' => $b->extension_name,
                    'award_no' => $b->award_no,
                    'date_disbursed' => $b->date_disbursed->format('Y-m-d'),
                    'amount' => $b->amount,
                    'remarks' => $b->remarks,
                ];
            }),
            'documents' => $liquidation->documents->map(function ($doc) {
                return [
                    'id' => $doc->id,
                    'file_name' => $doc->file_name,
                    'file_path' => $doc->file_path,
                    'uploaded_at' => $doc->created_at->format('Y-m-d H:i:s'),
                ];
            }),
        ]);
    }
}
