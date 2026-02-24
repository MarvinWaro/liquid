<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Liquidation\BulkImportRequest;
use App\Http\Requests\Liquidation\EndorseToAccountingRequest;
use App\Http\Requests\Liquidation\EndorseToCOARequest;
use App\Http\Requests\Liquidation\ReturnToHEIRequest;
use App\Http\Requests\Liquidation\ReturnToRCRequest;
use App\Http\Requests\Liquidation\StoreLiquidationRequest;
use App\Http\Requests\Liquidation\SubmitLiquidationRequest;
use App\Http\Requests\Liquidation\UpdateLiquidationRequest;
use App\Models\ActivityLog;
use App\Models\DocumentLocation;
use App\Models\DocumentRequirement;
use App\Models\DocumentStatus;
use App\Models\Liquidation;
use App\Models\LiquidationDocument;
use App\Models\LiquidationReview;
use App\Models\LiquidationRunningData;
use App\Models\LiquidationStatus;
use App\Models\LiquidationTrackingEntry;
use App\Services\CacheService;
use App\Services\LiquidationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class LiquidationController extends Controller
{
    public function __construct(
        private readonly LiquidationService $liquidationService,
        private readonly CacheService $cacheService
    ) {}

    /**
     * Display a listing of liquidations.
     */
    public function index(Request $request): InertiaResponse
    {
        if (!$request->user()->hasPermission('view_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        $user = $request->user();
        $filters = $request->only(['search', 'program', 'document_status', 'liquidation_status']);

        $liquidations = $this->liquidationService
            ->getPaginatedLiquidations($user, $filters)
            ->through(fn ($liquidation) => $this->formatLiquidationForList($liquidation));

        // For RC create modal: only HEIs in their region; admins get all
        $heis = \App\Models\HEI::where('status', 'active')
            ->when(
                $user->role->name === 'Regional Coordinator' && $user->region_id,
                fn ($q) => $q->where('region_id', $user->region_id)
            )
            ->orderBy('name')
            ->get(['id', 'name', 'uii']);

        return Inertia::render('liquidation/index', [
            'liquidations' => $liquidations,
            'userHei' => $this->formatUserHei($user->hei),
            'regionalCoordinators' => $this->cacheService->getRegionalCoordinators(),
            'accountants' => $this->cacheService->getAccountants(),
            'programs' => $this->cacheService->getPrograms(),
            'heis' => $heis,
            'filters' => $filters,
            'permissions' => [
                'review' => $user->hasPermission('review_liquidation'),
                'create' => $user->hasPermission('create_liquidation'),
            ],
            'userRole' => $user->role->name,
        ]);
    }

    /**
     * Show the form for editing a liquidation.
     */
    public function edit(Request $request, Liquidation $liquidation): InertiaResponse
    {
        $user = $request->user();

        $this->authorizeView($user, $liquidation);

        $liquidation->load(['hei', 'documents.uploader', 'creator', 'reviewer', 'accountantReviewer', 'financial', 'reviews']);

        return Inertia::render('liquidation/edit', [
            'liquidation' => $this->formatLiquidationForEdit($liquidation),
            'heis' => $this->cacheService->getHEIs(),
            'permissions' => [
                'edit' => $user->hasPermission('edit_liquidation'),
                'delete' => $user->hasPermission('delete_liquidation'),
            ],
        ]);
    }

    /**
     * Update the specified liquidation.
     */
    public function update(UpdateLiquidationRequest $request, Liquidation $liquidation): RedirectResponse
    {
        $this->liquidationService->updateLiquidation($liquidation, $request->validated());

        return redirect()->back()->with('success', 'Liquidation updated successfully.');
    }

    /**
     * Submit liquidation for initial review.
     */
    public function submit(SubmitLiquidationRequest $request, Liquidation $liquidation): RedirectResponse
    {
        try {
            $this->liquidationService->submitForReview(
                $liquidation,
                $request->user(),
                $request->validated('remarks')
            );
        } catch (\InvalidArgumentException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        return redirect()->route('liquidation.index')
            ->with('success', 'Liquidation submitted for initial review by Regional Coordinator.');
    }

    /**
     * Regional Coordinator endorses to accounting.
     */
    public function endorseToAccounting(EndorseToAccountingRequest $request, Liquidation $liquidation): RedirectResponse
    {
        try {
            $this->liquidationService->endorseToAccounting(
                $liquidation,
                $request->user(),
                $request->validated()
            );
        } catch (\InvalidArgumentException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        return redirect()->route('liquidation.index')
            ->with('success', 'Liquidation endorsed to Accounting successfully.');
    }

    /**
     * Regional Coordinator returns to HEI.
     */
    public function returnToHEI(ReturnToHEIRequest $request, Liquidation $liquidation): RedirectResponse
    {
        try {
            $this->liquidationService->returnToHEI(
                $liquidation,
                $request->user(),
                $request->validated()
            );
        } catch (\InvalidArgumentException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        return redirect()->route('liquidation.index')
            ->with('success', 'Liquidation returned to HEI for corrections.');
    }

    /**
     * Accountant endorses to COA.
     */
    public function endorseToCOA(EndorseToCOARequest $request, Liquidation $liquidation): RedirectResponse
    {
        try {
            $this->liquidationService->endorseToCOA(
                $liquidation,
                $request->user(),
                $request->validated('accountant_remarks')
            );
        } catch (\InvalidArgumentException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        return redirect()->route('liquidation.index')
            ->with('success', 'Liquidation endorsed to COA successfully.');
    }

    /**
     * Accountant returns to Regional Coordinator.
     */
    public function returnToRC(ReturnToRCRequest $request, Liquidation $liquidation): RedirectResponse
    {
        try {
            $this->liquidationService->returnToRC(
                $liquidation,
                $request->user(),
                $request->validated('accountant_remarks')
            );
        } catch (\InvalidArgumentException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        return redirect()->route('liquidation.index')
            ->with('success', 'Liquidation returned to Regional Coordinator for review.');
    }

    /**
     * Store a single liquidation (for RC).
     */
    public function store(StoreLiquidationRequest $request): JsonResponse
    {
        try {
            $liquidation = $this->liquidationService->createLiquidation(
                $request->validated(),
                $request->user()
            );

            return response()->json([
                'success' => true,
                'message' => 'Liquidation created successfully.',
                'liquidation' => [
                    'id' => $liquidation->id,
                    'control_no' => $liquidation->control_no,
                ],
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Bulk import liquidations from Excel file (for RC).
     */
    public function bulkImportLiquidations(BulkImportRequest $request): JsonResponse
    {
        $file = $request->file('file');
        $user = $request->user();
        $imported = 0;
        $errors = [];

        try {
            $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($file->getRealPath());
            $rows = $spreadsheet->getActiveSheet()->toArray();

            foreach ($rows as $index => $row) {
                if (empty(array_filter($row, fn($cell) => $cell !== null && $cell !== ''))) {
                    continue;
                }

                $seq = trim($row[0] ?? '');
                if (!is_numeric($seq)) {
                    continue;
                }

                try {
                    $result = $this->processImportRow($row, $user);
                    if ($result['success']) {
                        $imported++;
                    } else {
                        $errors[] = "Row " . ($index + 2) . ": " . $result['error'];
                    }
                } catch (\Exception $e) {
                    $errors[] = "Row " . ($index + 2) . ": " . $e->getMessage();
                }
            }
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to read Excel file: ' . $e->getMessage(),
            ], 422);
        }

        if ($imported > 0) {
            ActivityLog::log('bulk_imported', 'Bulk imported '.$imported.' liquidation(s)', null, 'Liquidation');
        }

        return $this->formatImportResponse($imported, $errors);
    }

    /**
     * Display liquidation details page.
     */
    public function show(Request $request, Liquidation $liquidation): InertiaResponse
    {
        $user = $request->user();

        if (!$user->hasPermission('view_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        $this->authorizeView($user, $liquidation);

        $liquidation->load([
            'hei', 'program', 'semester', 'financial',
            'beneficiaries', 'documents', 'reviewer',
            'reviews.reviewType', 'transmittal.endorser', 'transmittal.location',
            'compliance.complianceStatus',
            'documentStatus', 'liquidationStatus', 'creator',
            'trackingEntries.documentStatus',
            'trackingEntries.liquidationStatus',
            'trackingEntries.locations',
            'runningData'
        ]);

        $heiRegionId = $liquidation->hei?->region_id;
        $isHEIUser = $user->hei !== null;
        $requirements = $this->cacheService->getDocumentRequirements($liquidation->program_id);

        return Inertia::render('liquidation/show', [
            'liquidation' => $this->formatLiquidationDetails($liquidation, $requirements, $isHEIUser),
            'userHei' => $this->formatUserHei($user->hei),
            'regionalCoordinators' => $this->cacheService->getRegionalCoordinators($heiRegionId),
            'accountants' => $this->cacheService->getAccountants(),
            'documentLocations' => DocumentLocation::orderBy('sort_order')->pluck('name'),
            'documentRequirements' => $requirements,
            'permissions' => [
                'review' => $user->hasPermission('review_liquidation'),
                'submit' => $isHEIUser,
                'edit' => $user->hasPermission('edit_liquidation'),
            ],
            'userRole' => $user->role->name,
        ]);
    }

    /**
     * Upload document to liquidation.
     */
    public function uploadDocument(Request $request, Liquidation $liquidation): JsonResponse
    {
        $requirementId = $request->input('document_requirement_id');

        if ($requirementId) {
            // HEI requirement upload — enforce 1:1 per requirement
            $requirement = DocumentRequirement::where('id', $requirementId)
                ->where('program_id', $liquidation->program_id)
                ->where('is_active', true)
                ->first();

            if (!$requirement) {
                return response()->json(['message' => 'Invalid document requirement for this program.'], 422);
            }

            $existing = $liquidation->documents()
                ->where('document_requirement_id', $requirementId)
                ->exists();

            if ($existing) {
                return response()->json([
                    'message' => 'A document has already been uploaded for this requirement. Delete the existing one first.',
                ], 422);
            }

            $documentType = $requirement->name;
        } else {
            // RC Letter upload — keep 3-file limit
            $currentDocCount = $liquidation->documents()
                ->whereNull('document_requirement_id')
                ->where('is_gdrive', false)
                ->count();

            if ($currentDocCount >= 3) {
                return response()->json([
                    'message' => 'Maximum of 3 PDF files allowed. Please delete an existing file first.',
                ], 422);
            }

            $documentType = $request->input('document_type', 'RC Letter');
        }

        $request->validate([
            'file' => 'required|file|mimes:pdf|max:20480',
        ], [
            'file.mimes' => 'Only PDF files are allowed.',
            'file.max' => 'The file size must not exceed 20MB.',
        ]);

        $file = $request->file('file');
        $fileName = time() . '_' . $file->getClientOriginalName();
        $filePath = $file->storeAs('liquidation_documents/' . $liquidation->id, $fileName, 'public');

        LiquidationDocument::create([
            'liquidation_id' => $liquidation->id,
            'document_requirement_id' => $requirementId,
            'document_type' => $documentType,
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $filePath,
            'file_type' => $file->getMimeType(),
            'file_size' => $file->getSize(),
            'is_gdrive' => false,
            'description' => $request->input('description'),
            'uploaded_by' => $request->user()->id,
        ]);

        ActivityLog::log('uploaded_document', 'Uploaded document '.$file->getClientOriginalName().' to liquidation '.$liquidation->control_no, $liquidation, 'Liquidation');

        return response()->json(['message' => 'Document uploaded successfully.', 'success' => true]);
    }

    /**
     * Store Google Drive link for liquidation.
     */
    public function storeGdriveLink(Request $request, Liquidation $liquidation): JsonResponse
    {
        $validated = $request->validate([
            'gdrive_link' => ['required', 'url', 'regex:/^https:\/\/(drive\.google\.com|docs\.google\.com)/i'],
            'document_requirement_id' => 'required|string',
            'description' => 'nullable|string',
        ], [
            'gdrive_link.regex' => 'Please enter a valid Google Drive link.',
        ]);

        // Validate requirement belongs to this liquidation's program
        $requirement = DocumentRequirement::where('id', $validated['document_requirement_id'])
            ->where('program_id', $liquidation->program_id)
            ->where('is_active', true)
            ->first();

        if (!$requirement) {
            return response()->json(['message' => 'Invalid document requirement for this program.'], 422);
        }

        // Enforce 1:1 per requirement
        $existing = $liquidation->documents()
            ->where('document_requirement_id', $requirement->id)
            ->exists();

        if ($existing) {
            return response()->json([
                'message' => 'A document has already been submitted for this requirement. Delete the existing one first.',
            ], 422);
        }

        LiquidationDocument::create([
            'liquidation_id' => $liquidation->id,
            'document_requirement_id' => $requirement->id,
            'document_type' => $requirement->name,
            'file_name' => 'Google Drive Link',
            'file_path' => '',
            'file_type' => 'gdrive',
            'file_size' => 0,
            'gdrive_link' => $validated['gdrive_link'],
            'is_gdrive' => true,
            'description' => $validated['description'] ?? null,
            'uploaded_by' => $request->user()->id,
        ]);

        ActivityLog::log('added_gdrive_link', 'Added Google Drive link for liquidation '.$liquidation->control_no, $liquidation, 'Liquidation');

        return response()->json(['message' => 'Google Drive link added successfully.', 'success' => true]);
    }

    /**
     * Download document.
     */
    public function downloadDocument(Request $request, LiquidationDocument $document): BinaryFileResponse
    {
        $liquidation = $document->liquidation;
        $user = $request->user();

        $this->authorizeView($user, $liquidation);

        if (!Storage::disk('public')->exists($document->file_path)) {
            abort(404, 'File not found.');
        }

        return Storage::disk('public')->download($document->file_path, $document->file_name);
    }

    /**
     * View document inline in browser.
     */
    public function viewDocument(Request $request, LiquidationDocument $document): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $liquidation = $document->liquidation;
        $user = $request->user();

        $this->authorizeView($user, $liquidation);

        if (!Storage::disk('public')->exists($document->file_path)) {
            abort(404, 'File not found.');
        }

        return Storage::disk('public')->response($document->file_path, $document->file_name, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $document->file_name . '"',
        ]);
    }

    /**
     * Delete document.
     */
    public function deleteDocument(Request $request, LiquidationDocument $document): RedirectResponse
    {
        $liquidation = $document->liquidation;
        $user = $request->user();

        if (!$user->isSuperAdmin() && $user->role->name !== 'Admin') {
            if ($document->uploaded_by !== $user->id && $liquidation->created_by !== $user->id) {
                abort(403, 'You cannot delete this document.');
            }
        }

        if (!$document->is_gdrive && $document->file_path) {
            Storage::disk('public')->delete($document->file_path);
        }

        $documentName = $document->file_name;
        $document->delete();

        ActivityLog::log('deleted_document', 'Deleted document '.$documentName.' from liquidation '.$liquidation->control_no, $liquidation, 'Liquidation');

        return redirect()->back()->with('success', 'Document deleted successfully.');
    }

    /**
     * Remove the specified liquidation.
     */
    public function destroy(Request $request, Liquidation $liquidation): RedirectResponse
    {
        if (!$request->user()->hasPermission('delete_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        foreach ($liquidation->documents as $document) {
            if (!$document->is_gdrive && $document->file_path) {
                Storage::disk('public')->delete($document->file_path);
            }
        }

        $liquidation->delete();

        return redirect()->route('liquidation.index')
            ->with('success', 'Liquidation deleted successfully.');
    }

    /**
     * Import beneficiaries from Excel file.
     */
    /**
     * Save tracking entries for a liquidation.
     */
    public function saveTrackingEntries(Request $request, Liquidation $liquidation): RedirectResponse
    {
        $user = $request->user();

        if (!$user->hasPermission('view_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'entries'                       => 'required|array',
            'entries.*.id'                  => 'nullable|string',
            'entries.*.document_status'     => 'required|string',
            'entries.*.received_by'         => 'nullable|string|max:255',
            'entries.*.date_received'       => 'nullable|date',
            'entries.*.document_location'   => 'nullable|string|max:255',
            'entries.*.reviewed_by'         => 'nullable|string|max:255',
            'entries.*.date_reviewed'       => 'nullable|date',
            'entries.*.rc_note'             => 'nullable|string|max:255',
            'entries.*.date_endorsement'    => 'nullable|date',
            'entries.*.liquidation_status'  => 'required|string',
        ]);

        // Pre-load lookup maps (name → id) to avoid N+1 on each iteration
        $docStatusMap  = DocumentStatus::pluck('id', 'name')->toArray();
        $liqStatusMap  = LiquidationStatus::pluck('id', 'name')->toArray();
        $locationMap   = DocumentLocation::pluck('id', 'name')->toArray();

        $noneId         = DocumentStatus::where('code', DocumentStatus::CODE_NONE)->value('id');
        $unliquidatedId = LiquidationStatus::where('code', LiquidationStatus::CODE_UNLIQUIDATED)->value('id');

        // Delete removed entries
        $existingIds = $liquidation->trackingEntries()->pluck('id')->toArray();
        $incomingIds = array_filter(array_column($validated['entries'], 'id'));
        $toDelete    = array_diff($existingIds, $incomingIds);
        if (!empty($toDelete)) {
            $liquidation->trackingEntries()->whereIn('id', $toDelete)->delete();
        }

        // Upsert entries and sync location pivot
        $latestDocStatusId  = $noneId;
        $latestLiqStatusId  = $unliquidatedId;

        foreach ($validated['entries'] as $entryData) {
            $docStatusId = $docStatusMap[$entryData['document_status']]    ?? $noneId;
            $liqStatusId = $liqStatusMap[$entryData['liquidation_status']] ?? $unliquidatedId;

            $data = [
                'liquidation_id'      => $liquidation->id,
                'document_status_id'  => $docStatusId,
                'received_by'         => $entryData['received_by'] ?? null,
                'date_received'       => $entryData['date_received'] ?? null,
                'reviewed_by'         => $entryData['reviewed_by'] ?? null,
                'date_reviewed'       => $entryData['date_reviewed'] ?? null,
                'rc_note'             => $entryData['rc_note'] ?? null,
                'date_endorsement'    => $entryData['date_endorsement'] ?? null,
                'liquidation_status_id' => $liqStatusId,
            ];

            if (!empty($entryData['id'])) {
                $liquidation->trackingEntries()->where('id', $entryData['id'])->update($data);
                $entry = $liquidation->trackingEntries()->find($entryData['id']);
            } else {
                $entry = $liquidation->trackingEntries()->create($data);
            }

            // Sync location pivot: split comma-separated names → location IDs
            if ($entry) {
                $locationNames = array_values(array_filter(
                    array_map('trim', explode(',', $entryData['document_location'] ?? ''))
                ));

                $syncData = [];
                foreach ($locationNames as $sortOrder => $name) {
                    if (!isset($locationMap[$name])) {
                        $newLocation         = DocumentLocation::create(['name' => $name, 'sort_order' => 999]);
                        $locationMap[$name]  = $newLocation->id;
                    }
                    $syncData[$locationMap[$name]] = ['sort_order' => $sortOrder];
                }
                $entry->locations()->sync($syncData);
            }

            $latestDocStatusId = $docStatusId;
            $latestLiqStatusId = $liqStatusId;
        }

        // Sync the latest entry's statuses up to the liquidation record
        $liquidation->update([
            'document_status_id'    => $latestDocStatusId,
            'liquidation_status_id' => $latestLiqStatusId,
        ]);

        ActivityLog::log(
            'updated',
            "Updated document tracking for {$liquidation->control_no}",
            $liquidation,
            'Liquidation',
        );

        return redirect()->back()->with('success', 'Tracking entries saved successfully.');
    }

    /**
     * Save running data entries for a liquidation.
     */
    public function saveRunningData(Request $request, Liquidation $liquidation): RedirectResponse
    {
        $user = $request->user();

        if (!$user->hasPermission('view_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'entries' => 'required|array',
            'entries.*.id' => 'nullable|string',
            'entries.*.grantees_liquidated' => 'nullable|integer|min:0',
            'entries.*.amount_complete_docs' => 'nullable|numeric|min:0',
            'entries.*.amount_refunded' => 'nullable|numeric|min:0',
            'entries.*.refund_or_no' => 'nullable|string|max:100',
            'entries.*.total_amount_liquidated' => 'nullable|numeric|min:0',
            'entries.*.transmittal_ref_no' => 'nullable|string|max:255',
            'entries.*.group_transmittal_ref_no' => 'nullable|string|max:255',
        ]);

        $existingIds = $liquidation->runningData()->pluck('id')->toArray();
        $incomingIds = array_filter(array_column($validated['entries'], 'id'));

        // Delete removed entries
        $toDelete = array_diff($existingIds, $incomingIds);
        if (!empty($toDelete)) {
            $liquidation->runningData()->whereIn('id', $toDelete)->delete();
        }

        // Upsert entries
        foreach ($validated['entries'] as $index => $entryData) {
            $data = [
                'liquidation_id' => $liquidation->id,
                'grantees_liquidated' => $entryData['grantees_liquidated'] ?? null,
                'amount_complete_docs' => $entryData['amount_complete_docs'] ?? null,
                'amount_refunded' => $entryData['amount_refunded'] ?? null,
                'refund_or_no' => $entryData['refund_or_no'] ?? null,
                'total_amount_liquidated' => $entryData['total_amount_liquidated'] ?? null,
                'transmittal_ref_no' => $entryData['transmittal_ref_no'] ?? null,
                'group_transmittal_ref_no' => $entryData['group_transmittal_ref_no'] ?? null,
                'sort_order' => $index,
            ];

            if (!empty($entryData['id'])) {
                $liquidation->runningData()->where('id', $entryData['id'])->update($data);
            } else {
                $liquidation->runningData()->create($data);
            }
        }

        // Sync computed totals to liquidation_financials so index/dashboard reflect the latest data
        $totalLiquidated = $liquidation->runningData()->sum('total_amount_liquidated');
        $totalRefunded = $liquidation->runningData()->sum('amount_refunded');

        if ($liquidation->financial) {
            $liquidation->financial->update([
                'amount_liquidated' => $totalLiquidated,
                'amount_refunded' => $totalRefunded,
            ]);
        }

        ActivityLog::log(
            'updated',
            "Updated running data for {$liquidation->control_no}",
            $liquidation,
            'Liquidation',
        );

        return redirect()->back()->with('success', 'Running data saved successfully.');
    }

    public function importBeneficiaries(Request $request, Liquidation $liquidation): RedirectResponse
    {
        $user = $request->user();

        if (!$user->hasPermission('edit_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        if (!$user->isSuperAdmin() && $user->role->name !== 'Admin') {
            if ($liquidation->created_by !== $user->id) {
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
        $imported = 0;
        $errors = [];

        // Disable per-record logging for bulk operations
        \App\Models\LiquidationBeneficiary::$loggingEnabled = false;

        try {
            $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($file->getRealPath());
            $rows = $spreadsheet->getActiveSheet()->toArray();
            array_shift($rows);

            foreach ($rows as $index => $row) {
                if (empty(array_filter($row, fn($cell) => $cell !== null && $cell !== ''))) {
                    continue;
                }

                try {
                    \App\Models\LiquidationBeneficiary::create([
                        'liquidation_id' => $liquidation->id,
                        'student_no'     => trim($row[0] ?? ''),
                        'last_name'      => trim($row[1] ?? ''),
                        'first_name'     => trim($row[2] ?? ''),
                        'middle_name'    => !empty(trim($row[3] ?? '')) ? trim($row[3]) : null,
                        'extension_name' => !empty(trim($row[4] ?? '')) ? trim($row[4]) : null,
                        'award_no'       => trim($row[5] ?? ''),
                        'date_disbursed' => $this->parseExcelDate($row[6] ?? null),
                        'amount'         => $this->parseAmount($row[7] ?? 0),
                        'remarks'        => !empty(trim($row[8] ?? '')) ? trim($row[8]) : null,
                    ]);
                    $imported++;
                } catch (\Exception $e) {
                    $errors[] = "Row " . ($index + 2) . ": " . $e->getMessage();
                }
            }
        } catch (\Exception $e) {
            return redirect()->back()->with('error', 'Failed to read Excel file: ' . $e->getMessage());
        }

        // Recalculate the total inside a transaction with a lock so two concurrent
        // imports cannot both read a stale sum and overwrite each other's work.
        \Illuminate\Support\Facades\DB::transaction(function () use ($liquidation) {
            Liquidation::lockForUpdate()->findOrFail($liquidation->id);
            $totalDisbursed = $liquidation->beneficiaries()->sum('amount');
            $liquidation->createOrUpdateFinancial(['amount_liquidated' => $totalDisbursed]);
        });

        // Re-enable per-record logging
        \App\Models\LiquidationBeneficiary::$loggingEnabled = true;

        if ($imported > 0) {
            ActivityLog::log('imported_beneficiaries', 'Imported '.$imported.' beneficiaries for liquidation '.$liquidation->control_no, $liquidation, 'Liquidation');
        }

        $message = count($errors) > 0
            ? "Imported {$imported} beneficiaries with " . count($errors) . " errors."
            : "Successfully imported {$imported} beneficiaries.";

        return redirect()->back()->with(count($errors) > 0 ? 'error' : 'success', $message);
    }

    /**
     * Download beneficiary template Excel file.
     */
    public function downloadBeneficiaryTemplate(Request $request, Liquidation $liquidation): BinaryFileResponse
    {
        if (!$request->user()->hasPermission('view_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        $templatePath = base_path('materials/template-for-hei.xlsx');

        if (!file_exists($templatePath)) {
            abort(404, 'Template file not found.');
        }

        return response()->download($templatePath, 'BENEFICIARIES TEMPLATE.xlsx');
    }

    /**
     * Download RC bulk liquidation template.
     */
    public function downloadRCTemplate(Request $request): \Symfony\Component\HttpFoundation\BinaryFileResponse
    {
        $user = $request->user();

        if (!in_array($user->role->name, ['Regional Coordinator', 'Admin']) && !$user->isSuperAdmin()) {
            abort(403, 'Only Regional Coordinators can download this template.');
        }

        $templatePath = base_path('materials/RC_LIQUIDATION_TEMPLATE_complete.xlsx');

        if (!file_exists($templatePath)) {
            abort(404, 'Template file not found.');
        }

        return response()->download(
            $templatePath,
            'RC_LIQUIDATION_TEMPLATE.xlsx',
            ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
        );
    }

    /**
     * Lookup HEI by UII for auto-fill.
     */
    public function lookupHEI(Request $request): JsonResponse
    {
        $uii = trim($request->input('uii', ''));

        if (empty($uii)) {
            return response()->json(['found' => false, 'message' => 'UII is required']);
        }

        $hei = $this->cacheService->getHEIByUII($uii);

        if (!$hei) {
            return response()->json(['found' => false, 'message' => 'HEI not found with this UII']);
        }

        // Regional Coordinators can only look up HEIs in their assigned region
        $user = $request->user();
        if ($user->role->name === 'Regional Coordinator' && $user->region_id) {
            if ($hei->region_id !== $user->region_id) {
                return response()->json(['found' => false, 'message' => 'This HEI does not belong to your assigned region.']);
            }
        }

        return response()->json([
            'found' => true,
            'hei' => [
                'id' => $hei->id,
                'uii' => $hei->uii,
                'name' => $hei->name,
                'code' => $hei->code,
                'type' => $hei->type,
            ],
        ]);
    }

    // =========================================================================
    // PRIVATE HELPER METHODS
    // =========================================================================

    private function authorizeView($user, Liquidation $liquidation): void
    {
        $canView = $user->hasPermission('view_liquidation') ||
                   $user->hasPermission('review_liquidation') ||
                   $user->hasPermission('edit_liquidation');

        if (!$canView) {
            abort(403, 'Unauthorized action.');
        }

        $roleName = $user->role->name;

        // Regional Coordinators can only view liquidations from their own region
        if ($roleName === 'Regional Coordinator' && $user->region_id) {
            $liquidation->loadMissing('hei');
            if ($liquidation->hei?->region_id !== $user->region_id) {
                abort(403, 'You can only view liquidations from your region.');
            }
            return;
        }

        // Accountants and Admins can view all liquidations
        if (in_array($roleName, ['Accountant', 'Admin', 'Super Admin'])) {
            return;
        }

        // HEI users can view liquidations belonging to their institution
        $isHEI = $roleName === 'HEI' && $user->hei_id && $liquidation->hei_id === $user->hei_id;

        if (!$isHEI && $liquidation->created_by !== $user->id) {
            abort(403, 'You can only view your own liquidations.');
        }
    }

    private function formatLiquidationForList(Liquidation $liquidation): array
    {
        $financial = $liquidation->financial;

        // Calculate financial values
        $totalDisbursements = (float) ($financial?->amount_received ?? 0);
        $totalLiquidated = (float) ($financial?->amount_liquidated ?? 0);
        $totalUnliquidated = $totalDisbursements - $totalLiquidated;
        $percentageLiquidation = $totalDisbursements > 0
            ? round(($totalLiquidated / $totalDisbursements) * 100, 2)
            : 0;

        // Determine Status of Documents display name
        $documentStatusCode = $liquidation->documentStatus?->code;
        $documentStatusDisplay = match ($documentStatusCode) {
            'COMPLETE' => 'Complete Submission',
            'PARTIAL' => 'Partial Submission',
            default => 'No Submission',
        };

        // Use the stored liquidation_status from lookup table
        $liquidationStatus = $liquidation->liquidationStatus?->name ?? 'Unliquidated';

        return [
            'id' => $liquidation->id,
            'program' => $liquidation->program ? [
                'id' => $liquidation->program->id,
                'name' => $liquidation->program->name,
                'code' => $liquidation->program->code,
            ] : null,
            'uii' => $liquidation->hei?->uii ?? 'N/A',
            'hei_name' => $liquidation->hei?->name ?? 'N/A',
            'date_fund_released' => $financial?->date_fund_released?->format('M d, Y'),
            'due_date' => $financial?->due_date?->format('M d, Y'),
            'academic_year' => $liquidation->academic_year,
            'semester' => $liquidation->semester?->name ?? 'N/A',
            'batch_no' => $liquidation->batch_no,
            'dv_control_no' => $liquidation->control_no,
            'number_of_grantees' => $financial?->number_of_grantees,
            'total_disbursements' => number_format($totalDisbursements, 2),
            'total_amount_liquidated' => number_format($totalLiquidated, 2),
            'total_unliquidated_amount' => number_format($totalUnliquidated, 2),
            'document_status' => $documentStatusDisplay,
            'document_status_code' => $documentStatusCode ?? 'NONE',
            'rc_notes' => $liquidation->remarks,
            'liquidation_status' => $liquidationStatus,
            'percentage_liquidation' => $percentageLiquidation,
            'lapsing_period' => $financial?->lapsing_period ?? 0,
        ];
    }

    private function formatLiquidationForEdit(Liquidation $liquidation): array
    {
        $financial = $liquidation->financial;

        return [
            'id' => $liquidation->id,
            'reference_number' => $liquidation->control_no,
            'hei_id' => $liquidation->hei_id,
            'hei' => [
                'id' => $liquidation->hei->id,
                'name' => $liquidation->hei->name,
                'code' => $liquidation->hei->code,
            ],
            'disbursed_amount' => $financial?->amount_disbursed,
            'disbursement_date' => $financial?->disbursement_date?->format('Y-m-d'),
            'fund_source' => $financial?->fund_source,
            'liquidated_amount' => $financial?->amount_liquidated,
            'purpose' => $financial?->purpose,
            'remarks' => $liquidation->remarks,
            'review_remarks' => $liquidation->getLatestReviewRemarks(),
            'accountant_remarks' => $liquidation->getLatestAccountantRemarks(),
            'documents' => $liquidation->documents->map(fn ($doc) => [
                'id' => $doc->id,
                'document_type' => $doc->document_type,
                'file_name' => $doc->file_name,
                'file_size' => $doc->getFormattedFileSize(),
                'description' => $doc->description,
                'uploaded_by' => $doc->uploader->name,
                'uploaded_at' => $doc->created_at->format('M d, Y H:i'),
            ]),
            'can_edit' => true,
            'can_submit' => true,
        ];
    }

    private function formatLiquidationDetails(Liquidation $liquidation, Collection $requirements, bool $isHEIUser): array
    {
        $financial = $liquidation->financial;
        $totalDisbursed = $liquidation->beneficiaries->sum('amount');
        $transmittal = $liquidation->transmittal;

        // Compute document completeness from already-loaded collections (zero extra queries)
        $totalReqs = $requirements->count();
        $fulfilled = $totalReqs > 0
            ? $liquidation->documents->whereNotNull('document_requirement_id')
                ->pluck('document_requirement_id')
                ->unique()
                ->count()
            : 0;
        $isRequirementsComplete = $totalReqs > 0 && $fulfilled >= $totalReqs;

        $reviewHistory = $liquidation->reviews
            ->filter(fn($r) => in_array($r->reviewType?->code, [LiquidationReview::TYPE_RC_RETURN, LiquidationReview::TYPE_HEI_RESUBMISSION]))
            ->map(fn ($review) => $this->formatReviewHistoryItem($review))
            ->values()
            ->toArray();

        $accountantReviewHistory = $liquidation->reviews
            ->filter(fn($r) => $r->reviewType?->code === LiquidationReview::TYPE_ACCOUNTANT_RETURN)
            ->map(fn ($review) => [
                'returned_at' => $review->performed_at->toIso8601String(),
                'returned_by' => $review->performed_by_name,
                'returned_by_id' => $review->performed_by,
                'accountant_remarks' => $review->remarks,
            ])
            ->values()
            ->toArray();

        return [
            'id' => $liquidation->id,
            'control_no' => $liquidation->control_no,
            'hei_name' => $liquidation->hei?->name ?? 'N/A',
            'program_name' => $liquidation->program?->name ?? 'N/A',
            'academic_year' => $liquidation->academic_year,
            'semester' => $liquidation->semester?->name ?? 'N/A',
            'batch_no' => $liquidation->batch_no,
            'dv_control_no' => $liquidation->control_no,
            'amount_received' => $financial?->amount_received ?? 0,
            'total_disbursed' => $totalDisbursed,
            'remaining_amount' => ($financial?->amount_received ?? 0) - ($financial?->amount_liquidated ?? 0),
            'remarks' => $liquidation->remarks,
            'review_remarks' => $liquidation->remarks ?? $liquidation->getLatestReviewRemarks(),
            'documents_for_compliance' => $liquidation->compliance?->documents_required,
            'compliance_status' => $liquidation->compliance?->getStatusLabel(),
            'review_history' => $reviewHistory,
            'accountant_review_history' => $accountantReviewHistory,
            'accountant_remarks' => $liquidation->getLatestAccountantRemarks(),
            'receiver_name' => $transmittal?->receiver_name,
            'document_location' => $transmittal?->location?->name,
            'transmittal_reference_no' => $transmittal?->transmittal_reference_no,
            'number_of_folders' => $transmittal?->number_of_folders,
            'folder_location_number' => $transmittal?->folder_location_number,
            'group_transmittal' => $transmittal?->group_transmittal,
            'reviewed_by_name' => $liquidation->reviewer?->name ?? $transmittal?->endorser?->name,
            'reviewed_at' => $liquidation->reviewed_at?->format('Y-m-d H:i:s') ?? $transmittal?->endorsed_at?->format('Y-m-d H:i:s'),
            'date_fund_released' => $financial?->date_fund_released?->format('Y-m-d'),
            'due_date' => $financial?->due_date?->format('Y-m-d'),
            'fund_source' => $financial?->fund_source,
            'number_of_grantees' => $financial?->number_of_grantees,
            'amount_liquidated' => $financial?->amount_liquidated ?? 0,
            'lapsing_period' => $financial?->lapsing_period ?? 0,
            'document_status' => $liquidation->documentStatus?->name ?? 'N/A',
            'liquidation_status' => $liquidation->liquidationStatus?->name ?? 'Unliquidated',
            'date_submitted' => $liquidation->date_submitted?->format('Y-m-d H:i:s'),
            'created_by_name' => $liquidation->creator?->name,
            'beneficiaries' => $liquidation->beneficiaries->map(fn ($b) => [
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
            ]),
            'documents' => $liquidation->documents
                // RC can only see requirement documents when all requirements are fulfilled
                ->when(!$isHEIUser && !$isRequirementsComplete, fn ($docs) =>
                    $docs->filter(fn ($doc) => $doc->document_requirement_id === null)
                )
                ->map(fn ($doc) => [
                    'id' => $doc->id,
                    'document_requirement_id' => $doc->document_requirement_id,
                    'document_type' => $doc->document_type,
                    'file_name' => $doc->file_name,
                    'file_path' => $doc->file_path,
                    'file_size' => $doc->file_size,
                    'uploaded_at' => $doc->created_at->format('Y-m-d H:i:s'),
                    'is_gdrive' => $doc->is_gdrive ?? false,
                    'gdrive_link' => $doc->gdrive_link,
                ])
                ->values(),
            'document_completeness' => [
                'total' => $totalReqs,
                'fulfilled' => $fulfilled,
                'percentage' => $totalReqs > 0 ? round(($fulfilled / $totalReqs) * 100) : 0,
            ],
            'tracking_entries' => $liquidation->trackingEntries->map(fn ($entry) => [
                'id'                 => $entry->id,
                'document_status'    => $entry->documentStatus?->name    ?? 'No Submission',
                'received_by'        => $entry->received_by,
                'date_received'      => $entry->date_received?->format('Y-m-d'),
                'document_location'  => $entry->locations->pluck('name')->implode(','),
                'reviewed_by'        => $entry->reviewed_by,
                'date_reviewed'      => $entry->date_reviewed?->format('Y-m-d'),
                'rc_note'            => $entry->rc_note,
                'date_endorsement'   => $entry->date_endorsement?->format('Y-m-d'),
                'liquidation_status' => $entry->liquidationStatus?->name ?? 'Unliquidated',
            ]),
            'running_data' => $liquidation->runningData->map(fn ($rd) => [
                'id' => $rd->id,
                'grantees_liquidated' => $rd->grantees_liquidated,
                'amount_complete_docs' => $rd->amount_complete_docs,
                'amount_refunded' => $rd->amount_refunded,
                'refund_or_no' => $rd->refund_or_no,
                'total_amount_liquidated' => $rd->total_amount_liquidated,
                'transmittal_ref_no' => $rd->transmittal_ref_no,
                'group_transmittal_ref_no' => $rd->group_transmittal_ref_no,
                'sort_order' => $rd->sort_order,
            ]),
        ];
    }

    private function formatReviewHistoryItem(LiquidationReview $review): array
    {
        if ($review->reviewType?->code === LiquidationReview::TYPE_HEI_RESUBMISSION) {
            return [
                'type' => 'hei_resubmission',
                'resubmitted_at' => $review->performed_at->toIso8601String(),
                'resubmitted_by' => $review->performed_by_name,
                'resubmitted_by_id' => $review->performed_by,
                'hei_remarks' => $review->remarks,
            ];
        }

        return [
            'type' => 'rc_return',
            'returned_at' => $review->performed_at->toIso8601String(),
            'returned_by' => $review->performed_by_name,
            'returned_by_id' => $review->performed_by,
            'review_remarks' => $review->remarks,
            'documents_for_compliance' => $review->documents_for_compliance,
        ];
    }

    private function formatUserHei($hei): ?array
    {
        if (!$hei) {
            return null;
        }

        return [
            'id' => $hei->id,
            'name' => $hei->name,
            'code' => $hei->code,
            'uii' => $hei->uii,
        ];
    }

    /**
     * Process a single import row.
     *
     * Column mapping (0-indexed):
     * 0: SEQ, 1: Program, 2: UII, 3: HEI Name, 4: Date of Fund Release,
     * 5: Due Date, 6: Academic Year, 7: Semester, 8: Batch no., 9: DV Control no.,
     * 10: Number of Grantees, 11: Total Disbursements, 12: Total Amount Liquidated,
     * 13: Status of Documents, 14: RC Notes
     */
    private function processImportRow(array $row, $user): array
    {
        $uii = trim($row[2] ?? '');
        $dvControlNo = trim($row[9] ?? '');

        $hei = $this->liquidationService->findHEIByUII($uii);
        if (!$hei) {
            return ['success' => false, 'error' => "UII '{$uii}' not found."];
        }

        // Regional Coordinators can only import liquidations for HEIs in their assigned region
        if ($user->role->name === 'Regional Coordinator' && $user->region_id) {
            if ($hei->region_id !== $user->region_id) {
                return ['success' => false, 'error' => "HEI '{$uii}' does not belong to your assigned region."];
            }
        }

        $controlNo = !empty($dvControlNo) ? $dvControlNo : $this->liquidationService->generateControlNumber();

        if (Liquidation::where('control_no', $controlNo)->exists()) {
            return ['success' => false, 'error' => "DV Control No '{$controlNo}' already exists."];
        }

        $programCode = trim($row[1] ?? '');
        $program = $this->findProgram($programCode);
        $semesterId = $this->liquidationService->findSemesterId($row[7] ?? '');

        // Parse document status (column 13)
        $documentStatusId = $this->parseDocumentStatus($row[13] ?? null);

        // Parse RC notes/remarks (column 14)
        $remarks = trim($row[14] ?? '');

        $liquidation = Liquidation::create([
            'control_no' => $controlNo,
            'hei_id' => $hei->id,
            'program_id' => $program?->id,
            'academic_year' => trim($row[6] ?? ''),
            'semester_id' => $semesterId,
            'batch_no' => trim($row[8] ?? ''),
            'liquidation_status' => Liquidation::LIQUIDATION_STATUS_UNLIQUIDATED,
            'document_status_id' => $documentStatusId,
            'remarks' => !empty($remarks) ? $remarks : null,
            'created_by' => $user->id,
        ]);

        // Parse financial data including new columns
        $totalDisbursements = $this->parseAmount($row[11] ?? 0);
        $totalLiquidated = $this->parseAmount($row[12] ?? 0);

        $liquidation->createOrUpdateFinancial([
            'date_fund_released' => $this->parseExcelDate($row[4] ?? null),
            'due_date' => $this->parseExcelDate($row[5] ?? null),
            'number_of_grantees' => $this->parseInteger($row[10] ?? null),
            'amount_received' => $totalDisbursements,
            'amount_disbursed' => $totalDisbursements,
            'amount_liquidated' => $totalLiquidated,
        ]);

        return ['success' => true];
    }

    private function findProgram(string $name): ?\App\Models\Program
    {
        if (empty($name)) {
            return null;
        }

        return $this->cacheService->getPrograms()->first(function ($program) use ($name) {
            return strtolower($program->code) === strtolower($name)
                || strtolower($program->name) === strtolower($name);
        });
    }

    private function formatImportResponse(int $imported, array $errors): JsonResponse
    {
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

    private function parseExcelDate($value): ?\DateTime
    {
        if (empty($value)) {
            return now();
        }

        if (is_numeric($value)) {
            try {
                return \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($value);
            } catch (\Exception) {
                return now();
            }
        }

        try {
            return \Carbon\Carbon::parse($value);
        } catch (\Exception) {
            return now();
        }
    }

    private function parseAmount($value): float
    {
        if (empty($value)) {
            return 0;
        }

        $cleaned = preg_replace('/[^0-9.\-]/', '', (string) $value);

        return (float) ($cleaned ?: 0);
    }

    private function parseInteger($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        $cleaned = preg_replace('/[^0-9\-]/', '', (string) $value);

        return $cleaned !== '' ? (int) $cleaned : null;
    }

    /**
     * Parse document status from import value.
     * Accepts: COMPLETE, PARTIAL, NONE, or empty (defaults to NONE)
     */
    private function parseDocumentStatus($value): ?string
    {
        // Default to NONE if empty
        if (empty($value)) {
            return DocumentStatus::findByCode(DocumentStatus::CODE_NONE)?->id;
        }

        $normalized = strtoupper(trim($value));

        // Map common variations to standard codes
        $statusMap = [
            'COMPLETE' => DocumentStatus::CODE_COMPLETE,
            'COMPLETED' => DocumentStatus::CODE_COMPLETE,
            'PARTIAL' => DocumentStatus::CODE_PARTIAL,
            'INCOMPLETE' => DocumentStatus::CODE_PARTIAL,
            'NONE' => DocumentStatus::CODE_NONE,
            'N/A' => DocumentStatus::CODE_NONE,
            'NA' => DocumentStatus::CODE_NONE,
        ];

        $code = $statusMap[$normalized] ?? DocumentStatus::CODE_NONE;

        return DocumentStatus::findByCode($code)?->id;
    }
}
