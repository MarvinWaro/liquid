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
            ->orderBy('control_no', 'asc');

        // Filter based on user role
        $user = $request->user();

        // Regional Coordinator sees:
        // - Draft liquidations they created (from bulk import)
        // - All liquidations pending review (for_initial_review, returned_to_rc)
        // - Their own endorsed liquidations (endorsed_to_accounting where they are the reviewer)
        if ($user->role->name === 'Regional Coordinator') {
            $query->where(function ($q) use ($user) {
                // Drafts they created
                $q->where(function ($q2) use ($user) {
                    $q2->where('status', 'draft')
                       ->where('created_by', $user->id);
                })
                // Pending review
                ->orWhereIn('status', ['for_initial_review', 'returned_to_rc'])
                // Their endorsed liquidations
                ->orWhere(function ($q2) use ($user) {
                    $q2->whereIn('status', ['endorsed_to_accounting', 'endorsed_to_coa'])
                       ->where('reviewed_by', $user->id);
                });
            });
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

        // Program filter
        if ($request->program && $request->program !== 'all') {
            $query->where('program_id', $request->program);
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

        $liquidations = $query->with('program')->paginate(15)->through(function ($liquidation, $key) {
            return [
                'id' => $liquidation->id,
                'program' => $liquidation->program ? [
                    'id' => $liquidation->program->id,
                    'name' => $liquidation->program->name,
                    'code' => $liquidation->program->code,
                ] : null,
                'uii' => $liquidation->hei?->uii ?? 'N/A',
                'hei_name' => $liquidation->hei?->name ?? 'N/A',
                'date_fund_released' => $liquidation->date_fund_released?->format('M d, Y'),
                'due_date' => $liquidation->date_fund_released?->copy()->addDays(90)->format('M d, Y'),
                'academic_year' => $liquidation->academic_year,
                'semester' => $liquidation->semester,
                'batch_no' => $liquidation->batch_no,
                'dv_control_no' => $liquidation->control_no ?? $liquidation->reference_number,
                'number_of_grantees' => $liquidation->number_of_grantees,
                'total_disbursements' => number_format($liquidation->disbursed_amount ?? 0, 2),
                'status' => $liquidation->status,
                'status_label' => $liquidation->getStatusLabel(),
                'status_badge' => $liquidation->getStatusBadgeClass(),
            ];
        });

        // Get user's HEI if they belong to one
        $userHei = $request->user()->hei;

        // Get users by role for dropdowns
        $regionalCoordinators = User::whereHas('role', function ($q) {
            $q->where('name', 'Regional Coordinator');
        })->where('status', 'active')->orderBy('name')->get(['id', 'name']);

        $accountants = User::whereHas('role', function ($q) {
            $q->where('name', 'Accountant');
        })->where('status', 'active')->orderBy('name')->get(['id', 'name']);

        // Get all active programs for filter
        $programs = Program::where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return Inertia::render('liquidation/index', [
            'liquidations' => $liquidations,
            'userHei' => $userHei ? [
                'id' => $userHei->id,
                'name' => $userHei->name,
                'code' => $userHei->code,
                'uii' => $userHei->uii,
            ] : null,
            'regionalCoordinators' => $regionalCoordinators,
            'accountants' => $accountants,
            'programs' => $programs,
            'filters' => $request->only(['search', 'status', 'program']),
            'permissions' => [
                'review' => $request->user()->hasPermission('review_liquidation'),
                'create' => $request->user()->hasPermission('create_liquidation'),
            ],
            'userRole' => $request->user()->role->name,
        ]);
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
            'hei_id' => 'sometimes|exists:heis,id',
            'amount_received' => 'sometimes|numeric|min:0',
            'disbursed_amount' => 'sometimes|numeric|min:0',
            'disbursement_date' => 'nullable|date',
            'fund_source' => 'nullable|string|max:255',
            'liquidated_amount' => 'nullable|numeric|min:0',
            'purpose' => 'nullable|string',
            'remarks' => 'nullable|string',
        ]);

        // If amount_received is being updated, also update disbursed_amount and amount_disbursed
        // These fields represent the total CHED disbursement
        if (isset($validated['amount_received'])) {
            $validated['disbursed_amount'] = $validated['amount_received'];
            $validated['amount_disbursed'] = $validated['amount_received'];
        }

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

        // Validate HEI remarks
        $validated = $request->validate([
            'remarks' => 'nullable|string',
        ]);

        // Check if this is a resubmission (after being returned to HEI)
        $isResubmission = $liquidation->status === 'returned_to_hei';

        // If resubmitting and remarks provided, add to review history
        if ($isResubmission && !empty($validated['remarks'])) {
            $reviewHistory = $liquidation->review_history ?? [];
            $reviewHistory[] = [
                'resubmitted_at' => now()->toIso8601String(),
                'resubmitted_by' => $user->name,
                'resubmitted_by_id' => $user->id,
                'hei_remarks' => $validated['remarks'],
                'type' => 'hei_resubmission',
            ];
            $liquidation->review_history = $reviewHistory;
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

        $updateData = [
            'status' => 'for_initial_review',
            'date_submitted' => now(),
            'document_status' => $documentStatus,
        ];

        // Only update remarks field for initial submission, not resubmission
        if (!$isResubmission) {
            $updateData['remarks'] = $validated['remarks'] ?? $liquidation->remarks;
        }

        // Add review_history if it was updated
        if (isset($liquidation->review_history)) {
            $updateData['review_history'] = $liquidation->review_history;
        }

        $liquidation->update($updateData);

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
        // Check file limit (max 3 documents)
        $currentDocCount = $liquidation->documents()->where('is_gdrive', false)->count();
        if ($currentDocCount >= 3) {
            return response()->json([
                'message' => 'Maximum of 3 PDF files allowed. Please delete an existing file first.',
            ], 422);
        }

        $validated = $request->validate([
            'document_type' => 'required|string|max:255',
            'file' => 'required|file|mimes:pdf|max:20480', // PDF only, 20MB max
            'description' => 'nullable|string',
        ], [
            'file.mimes' => 'Only PDF files are allowed.',
            'file.max' => 'The file size must not exceed 20MB.',
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
            'is_gdrive' => false,
            'description' => $validated['description'] ?? null,
            'uploaded_by' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Document uploaded successfully.',
            'success' => true,
        ]);
    }

    /**
     * Store Google Drive link for liquidation.
     */
    public function storeGdriveLink(Request $request, Liquidation $liquidation)
    {
        $validated = $request->validate([
            'gdrive_link' => ['required', 'url', 'regex:/^https:\/\/(drive\.google\.com|docs\.google\.com)/i'],
            'document_type' => 'required|string|max:255',
            'description' => 'nullable|string',
        ], [
            'gdrive_link.regex' => 'Please enter a valid Google Drive link.',
        ]);

        LiquidationDocument::create([
            'liquidation_id' => $liquidation->id,
            'document_type' => $validated['document_type'],
            'file_name' => 'Google Drive Link',
            'file_path' => '',
            'file_type' => 'gdrive',
            'file_size' => 0,
            'gdrive_link' => $validated['gdrive_link'],
            'is_gdrive' => true,
            'description' => $validated['description'] ?? null,
            'uploaded_by' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Google Drive link added successfully.',
            'success' => true,
        ]);
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

        // Delete file from storage if it's not a Google Drive link
        if (!$document->is_gdrive && $document->file_path) {
            Storage::disk('public')->delete($document->file_path);
        }

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
     * Download Excel template for beneficiaries.
     */
    public function downloadBeneficiaryTemplate(Request $request, Liquidation $liquidation)
    {
        if (!$request->user()->hasPermission('view_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        $templatePath = base_path('materials/template-for-hei.xlsx');

        if (!file_exists($templatePath)) {
            abort(404, 'Template file not found.');
        }

        return response()->download($templatePath, 'BENEFICIARIES TEMPLATE.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    /**
     * Import beneficiaries from Excel file.
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
            'beneficiary_file' => 'required|file|mimes:xlsx,xls|max:5120',
        ], [
            'beneficiary_file.mimes' => 'Please upload an Excel file (.xlsx or .xls).',
            'beneficiary_file.max' => 'The file size must not exceed 5MB.',
        ]);

        $file = $request->file('beneficiary_file');
        $path = $file->getRealPath();

        $imported = 0;
        $errors = [];

        try {
            $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($path);
            $worksheet = $spreadsheet->getActiveSheet();
            $rows = $worksheet->toArray();

            // Remove header row (first row)
            array_shift($rows);

            foreach ($rows as $index => $row) {
                // Skip empty rows (check if all cells are empty)
                if (empty(array_filter($row, function($cell) {
                    return $cell !== null && $cell !== '';
                }))) {
                    continue;
                }

                try {
                    // Map columns based on template structure:
                    // A: Student No, B: Last Name, C: First Name, D: Middle Name,
                    // E: Extension Name, F: Award No, G: Date Disbursed, H: Amount, I: Remarks
                    \App\Models\LiquidationBeneficiary::create([
                        'liquidation_id' => $liquidation->id,
                        'student_no' => trim($row[0] ?? ''),
                        'last_name' => trim($row[1] ?? ''),
                        'first_name' => trim($row[2] ?? ''),
                        'middle_name' => !empty(trim($row[3] ?? '')) ? trim($row[3]) : null,
                        'extension_name' => !empty(trim($row[4] ?? '')) ? trim($row[4]) : null,
                        'award_no' => trim($row[5] ?? ''),
                        'date_disbursed' => $this->parseExcelDate($row[6] ?? null),
                        'amount' => $this->parseAmount($row[7] ?? 0),
                        'remarks' => !empty(trim($row[8] ?? '')) ? trim($row[8]) : null,
                    ]);
                    $imported++;
                } catch (\Exception $e) {
                    $errors[] = "Row " . ($index + 2) . ": " . $e->getMessage();
                }
            }
        } catch (\Exception $e) {
            return redirect()->back()->with('error', 'Failed to read Excel file: ' . $e->getMessage());
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
     * Parse Excel date value (handles both Excel serial date and string dates).
     */
    private function parseExcelDate($value)
    {
        if (empty($value)) {
            return now();
        }

        // If it's a numeric value (Excel serial date)
        if (is_numeric($value)) {
            try {
                return \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($value);
            } catch (\Exception $e) {
                return now();
            }
        }

        // Try to parse as string date
        try {
            return \Carbon\Carbon::parse($value);
        } catch (\Exception $e) {
            return now();
        }
    }

    /**
     * Parse amount value (handles formatted numbers).
     */
    private function parseAmount($value)
    {
        if (empty($value)) {
            return 0;
        }

        // Remove any currency symbols and commas
        $cleaned = preg_replace('/[^0-9.\-]/', '', (string) $value);

        return (float) ($cleaned ?: 0);
    }

    /**
     * Download RC bulk liquidation template.
     */
    public function downloadRCTemplate(Request $request)
    {
        $user = $request->user();

        // Only RC can download this template
        if ($user->role->name !== 'Regional Coordinator' && !$user->isSuperAdmin() && $user->role->name !== 'Admin') {
            abort(403, 'Only Regional Coordinators can download this template.');
        }

        $templatePath = base_path('materials/template-for-rc.xlsx');

        if (!file_exists($templatePath)) {
            abort(404, 'Template file not found.');
        }

        return response()->download($templatePath, 'RC_LIQUIDATION_TEMPLATE.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    /**
     * Bulk import liquidations from Excel file (for RC).
     */
    public function bulkImportLiquidations(Request $request)
    {
        $user = $request->user();

        // Only RC can bulk import
        if ($user->role->name !== 'Regional Coordinator' && !$user->isSuperAdmin() && $user->role->name !== 'Admin') {
            abort(403, 'Only Regional Coordinators can bulk import liquidations.');
        }

        $validated = $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
        ], [
            'file.mimes' => 'Please upload an Excel file (.xlsx or .xls).',
            'file.max' => 'The file size must not exceed 10MB.',
        ]);

        $file = $request->file('file');
        $path = $file->getRealPath();

        $imported = 0;
        $errors = [];

        try {
            $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($path);
            $worksheet = $spreadsheet->getActiveSheet();
            $rows = $worksheet->toArray();

            // Remove header rows (instruction row and column header row)
            // Skip rows until we find one with a numeric SEQ value
            foreach ($rows as $index => $row) {
                // Skip empty rows
                if (empty(array_filter($row, fn($cell) => $cell !== null && $cell !== ''))) {
                    continue;
                }

                // Skip header rows (SEQ column should be numeric for data rows)
                $seq = trim($row[0] ?? '');
                if (!is_numeric($seq)) {
                    continue;
                }

                try {
                    // Template columns (matching Excel format):
                    // A (0): SEQ
                    // B (1): Program
                    // C (2): UII
                    // D (3): HEI Name (auto-filled, skipped in import)
                    // E (4): Date of Fund Release
                    // F (5): Due Date
                    // G (6): Academic Year
                    // H (7): Semester
                    // I (8): Batch no.
                    // J (9): DV Control no.
                    // K (10): Number of Grantees
                    // L (11): Total Disbursements

                    $programCode = trim($row[1] ?? '');
                    $uii = trim($row[2] ?? '');
                    $dvControlNo = trim($row[9] ?? '');

                    // Find HEI by UII
                    $hei = $this->findHEI($uii);
                    if (!$hei) {
                        $errors[] = "Row " . ($index + 2) . ": UII '{$uii}' not found. Please use a valid UII from the system.";
                        continue;
                    }

                    // Find program by code or name
                    $program = $this->findProgram($programCode);

                    // Use DV Control no. from template, or generate if empty
                    $controlNo = !empty($dvControlNo) ? $dvControlNo : $this->generateControlNumber();

                    // Check if control_no already exists
                    if (Liquidation::where('control_no', $controlNo)->exists()) {
                        $errors[] = "Row " . ($index + 2) . ": DV Control No '{$controlNo}' already exists.";
                        continue;
                    }

                    Liquidation::create([
                        'control_no' => $controlNo,
                        'hei_id' => $hei->id,
                        'program_id' => $program?->id,
                        'date_fund_released' => $this->parseExcelDate($row[4] ?? null),
                        'academic_year' => trim($row[6] ?? ''),
                        'semester' => $this->parseSemester($row[7] ?? ''),
                        'batch_no' => trim($row[8] ?? ''),
                        'number_of_grantees' => $this->parseInteger($row[10] ?? null),
                        'amount_received' => $this->parseAmount($row[11] ?? 0),
                        'disbursed_amount' => $this->parseAmount($row[11] ?? 0),
                        'status' => 'draft',
                        'created_by' => $user->id,
                    ]);
                    $imported++;
                } catch (\Exception $e) {
                    $errors[] = "Row " . ($index + 2) . ": " . $e->getMessage();
                }
            }
        } catch (\Exception $e) {
            return redirect()->back()->with('error', 'Failed to read Excel file: ' . $e->getMessage());
        }

        if (count($errors) > 0 && $imported === 0) {
            return response()->json([
                'success' => false,
                'message' => 'Import failed: ' . implode('; ', array_slice($errors, 0, 5)),
                'errors' => $errors,
            ], 422);
        }

        if (count($errors) > 0) {
            return response()->json([
                'success' => true,
                'message' => "Imported {$imported} liquidations with " . count($errors) . " errors.",
                'imported' => $imported,
                'errors' => $errors,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => "Successfully imported {$imported} liquidations.",
            'imported' => $imported,
        ]);
    }

    /**
     * Generate a unique control number for liquidation.
     */
    private function generateControlNumber(): string
    {
        $year = date('Y');
        $prefix = "LIQ-{$year}-";

        // Get the latest control number for this year
        $latest = Liquidation::where('control_no', 'like', $prefix . '%')
            ->orderBy('control_no', 'desc')
            ->first();

        if ($latest) {
            $lastNumber = (int) str_replace($prefix, '', $latest->control_no);
            $newNumber = $lastNumber + 1;
        } else {
            $newNumber = 1;
        }

        return $prefix . str_pad($newNumber, 5, '0', STR_PAD_LEFT);
    }

    /**
     * Parse semester value from Excel (1, 2, or text).
     */
    private function parseSemester($value): string
    {
        $value = trim((string) $value);

        // If already in text format, return as is
        if (stripos($value, 'semester') !== false || stripos($value, 'summer') !== false) {
            return $value;
        }

        // Convert numeric to text
        return match ($value) {
            '1', '1st' => '1st Semester',
            '2', '2nd' => '2nd Semester',
            '3', 'summer', 'Summer' => 'Summer',
            default => $value ?: '1st Semester',
        };
    }

    /**
     * Parse integer value from Excel.
     */
    private function parseInteger($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        // Remove any non-numeric characters except minus
        $cleaned = preg_replace('/[^0-9\-]/', '', (string) $value);

        return $cleaned !== '' ? (int) $cleaned : null;
    }

    /**
     * Find HEI by UII (primary) or name (fallback).
     */
    private function findHEI(string $identifier): ?HEI
    {
        if (empty($identifier)) {
            return null;
        }

        $identifier = trim($identifier);

        // 1. Try exact match by UII (primary method)
        $hei = HEI::where('uii', $identifier)->first();
        if ($hei) return $hei;

        // 2. Try case-insensitive UII match
        $hei = HEI::whereRaw('LOWER(uii) = ?', [strtolower($identifier)])->first();
        if ($hei) return $hei;

        // 3. Fallback: Try exact match by name (case-insensitive)
        $hei = HEI::whereRaw('LOWER(name) = ?', [strtolower($identifier)])->first();
        if ($hei) return $hei;

        // 4. Fallback: Try partial match by name
        $hei = HEI::whereRaw('LOWER(name) LIKE ?', ['%' . strtolower($identifier) . '%'])->first();

        return $hei;
    }

    /**
     * Find Program by name or code.
     */
    private function findProgram(string $programName): ?Program
    {
        if (empty($programName)) {
            return null;
        }

        // 1. Try exact match by code (case-insensitive) - most common case
        $program = Program::whereRaw('LOWER(code) = ?', [strtolower($programName)])->first();
        if ($program) return $program;

        // 2. Try exact match by name
        $program = Program::whereRaw('LOWER(name) = ?', [strtolower($programName)])->first();
        if ($program) return $program;

        // 3. Try partial match
        $program = Program::whereRaw('LOWER(name) LIKE ?', ['%' . strtolower($programName) . '%'])
            ->orWhereRaw('LOWER(code) LIKE ?', ['%' . strtolower($programName) . '%'])
            ->first();

        return $program;
    }

    /**
     * Lookup HEI by UII for auto-fill.
     */
    public function lookupHEI(Request $request)
    {
        $uii = trim($request->input('uii', ''));

        if (empty($uii)) {
            return response()->json(['found' => false, 'message' => 'UII is required']);
        }

        $hei = HEI::where('uii', $uii)->first();

        if (!$hei) {
            return response()->json(['found' => false, 'message' => 'HEI not found with this UII']);
        }

        return response()->json([
            'found' => true,
            'hei' => [
                'id' => $hei->id,
                'uii' => $hei->uii,
                'name' => $hei->name,
                'code' => $hei->code,
                'type' => $hei->type,
            ]
        ]);
    }

    /**
     * Store a single liquidation (for RC).
     */
    public function store(Request $request)
    {
        $user = $request->user();

        // Only RC, Admin, Super Admin can create liquidations
        if (!in_array($user->role->name, ['Regional Coordinator', 'Admin']) && !$user->isSuperAdmin()) {
            abort(403, 'Only Regional Coordinators can create liquidations.');
        }

        $validated = $request->validate([
            'program_id' => 'required|exists:programs,id',
            'uii' => 'required|string',
            'date_fund_released' => 'required|date',
            'due_date' => 'nullable|date',
            'academic_year' => 'required|string|max:20',
            'semester' => 'required|string|max:50',
            'batch_no' => 'nullable|string|max:50',
            'dv_control_no' => 'required|string|max:100|unique:liquidations,control_no',
            'number_of_grantees' => 'nullable|integer|min:0',
            'total_disbursements' => 'required|numeric|min:0',
        ], [
            'dv_control_no.unique' => 'This DV Control No. already exists.',
        ]);

        // Find HEI by UII
        $hei = HEI::where('uii', $validated['uii'])->first();
        if (!$hei) {
            return response()->json(['message' => 'HEI not found with the provided UII.'], 422);
        }

        $liquidation = Liquidation::create([
            'control_no' => $validated['dv_control_no'],
            'hei_id' => $hei->id,
            'program_id' => $validated['program_id'],
            'date_fund_released' => $validated['date_fund_released'],
            'academic_year' => $validated['academic_year'],
            'semester' => $validated['semester'],
            'batch_no' => $validated['batch_no'] ?? null,
            'number_of_grantees' => $validated['number_of_grantees'] ?? null,
            'amount_received' => $validated['total_disbursements'],
            'disbursed_amount' => $validated['total_disbursements'],
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Liquidation created successfully.',
            'liquidation' => [
                'id' => $liquidation->id,
                'control_no' => $liquidation->control_no,
            ]
        ]);
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

        $liquidation->load(['hei', 'program', 'beneficiaries', 'documents', 'reviewer']);

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
            'remarks' => $liquidation->remarks,
            'review_remarks' => $liquidation->review_remarks,
            'documents_for_compliance' => $liquidation->documents_for_compliance,
            'compliance_status' => $liquidation->compliance_status,
            'review_history' => $liquidation->review_history ?? [],
            'accountant_review_history' => $liquidation->accountant_review_history ?? [],
            'accountant_remarks' => $liquidation->accountant_remarks,
            // Endorsement details (from RC to Accounting)
            'receiver_name' => $liquidation->receiver_name,
            'document_location' => $liquidation->document_location,
            'transmittal_reference_no' => $liquidation->transmittal_reference_no,
            'number_of_folders' => $liquidation->number_of_folders,
            'folder_location_number' => $liquidation->folder_location_number,
            'group_transmittal' => $liquidation->group_transmittal,
            'reviewed_by_name' => $liquidation->reviewer?->name,
            'reviewed_at' => $liquidation->reviewed_at?->format('Y-m-d H:i:s'),
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
                    'is_gdrive' => $doc->is_gdrive ?? false,
                    'gdrive_link' => $doc->gdrive_link,
                ];
            }),
        ]);
    }
}
