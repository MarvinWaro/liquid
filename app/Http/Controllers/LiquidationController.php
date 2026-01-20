<?php

namespace App\Http\Controllers;

use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\LiquidationDocument;
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
                    'id' => $liquidation->hei->id,
                    'name' => $liquidation->hei->name,
                    'code' => $liquidation->hei->code,
                ],
                'disbursed_amount' => number_format($liquidation->disbursed_amount, 2),
                'liquidated_amount' => number_format($liquidation->liquidated_amount, 2),
                'status' => $liquidation->status,
                'status_label' => $liquidation->getStatusLabel(),
                'status_badge' => $liquidation->getStatusBadgeClass(),
                'created_at' => $liquidation->created_at->format('M d, Y'),
                'created_by' => $liquidation->creator->name,
                'reviewed_by' => $liquidation->reviewer?->name,
                'accountant_reviewed_by' => $liquidation->accountantReviewer?->name,
            ];
        });

        $heis = HEI::where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return Inertia::render('liquidation/index', [
            'liquidations' => $liquidations,
            'heis' => $heis,
            'filters' => $request->only(['search']),
            'can' => [
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
            'disbursed_amount' => 'required|numeric|min:0',
            'disbursement_date' => 'nullable|date',
            'fund_source' => 'nullable|string|max:255',
            'liquidated_amount' => 'nullable|numeric|min:0',
            'purpose' => 'nullable|string',
            'remarks' => 'nullable|string',
        ]);

        // Generate control number (using existing field)
        $lastLiquidation = Liquidation::latest('id')->first();
        $nextNumber = $lastLiquidation ? ($lastLiquidation->id + 1) : 1;
        $controlNo = 'LIQ-' . date('Y') . '-' . str_pad($nextNumber, 5, '0', STR_PAD_LEFT);

        $liquidation = Liquidation::create([
            ...$validated,
            'control_no' => $controlNo,
            'created_by' => $request->user()->id,
            'status' => 'draft',
            'liquidated_amount' => $validated['liquidated_amount'] ?? 0,
            // Set default values for existing required fields
            'program_id' => 1, // You may need to adjust this
            'academic_year' => date('Y') . '-' . (date('Y') + 1),
            'semester' => '1st',
            'amount_received' => $validated['disbursed_amount'],
        ]);

        return redirect()->route('liquidation.edit', $liquidation->id)
            ->with('success', 'Liquidation created successfully. You can now upload documents.');
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
            'can' => [
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

        $liquidation->update([
            'status' => 'for_initial_review',
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
        ]);

        $liquidation->update([
            'status' => 'endorsed_to_accounting',
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
            'review_remarks' => $validated['review_remarks'] ?? null,
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
        ]);

        $liquidation->update([
            'status' => 'returned_to_hei',
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
            'review_remarks' => $validated['review_remarks'],
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

        $liquidation->update([
            'status' => 'returned_to_rc',
            'accountant_reviewed_by' => $user->id,
            'accountant_reviewed_at' => now(),
            'accountant_remarks' => $validated['accountant_remarks'],
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
}
