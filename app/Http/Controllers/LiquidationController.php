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
use App\Models\RcNoteStatus;
use App\Models\LiquidationTrackingEntry;
use App\Models\User;
use App\Services\CacheService;
use App\Services\LiquidationService;
use App\Services\NotificationService;
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

        // All programs for the filter dropdown (lightweight, cached)
        $allPrograms = $this->cacheService->getSelectablePrograms();

        return Inertia::render('liquidation/index', [
            // Essential — needed for initial page paint (filters, header, permissions)
            'programs' => $allPrograms,
            'filters' => $filters,
            'permissions' => [
                'review' => $user->hasPermission('review_liquidation'),
                'create' => $user->hasPermission('create_liquidation'),
                'void' => $user->hasPermission('delete_liquidation'),
            ],
            'userRole' => $user->role->name,

            // Deferred — table data loads after initial paint
            'liquidations' => Inertia::defer(fn () =>
                $this->liquidationService
                    ->getPaginatedLiquidations($user, $filters)
                    ->through(fn ($liquidation) => $this->formatLiquidationForList($liquidation))
            ),

            // Deferred — only needed when user opens create/bulk modals
            'createPrograms' => Inertia::defer(function () use ($user, $allPrograms) {
                $roleName = $user->role->name;
                if (in_array($roleName, ['Regional Coordinator', 'Encoder'])) {
                    return $allPrograms->filter(fn ($p) => $p->parent_id === null && ($p->children_count ?? 0) === 0)->values();
                } elseif ($roleName === 'STUFAPS Focal') {
                    $scopedIds = $user->getScopedProgramIds();
                    return $scopedIds
                        ? $allPrograms->filter(function ($p) use ($scopedIds) {
                            return in_array($p->id, $scopedIds)
                                || ($p->children_count > 0 && \App\Models\Program::where('parent_id', $p->id)
                                    ->whereIn('id', $scopedIds)->exists());
                        })->values()
                        : $allPrograms;
                }
                return $allPrograms;
            }),
            'academicYears' => Inertia::defer(fn () => \App\Models\AcademicYear::getDropdownOptions()),
            'rcNoteStatuses' => Inertia::defer(fn () => RcNoteStatus::getDropdownOptions()),
            'heis' => Inertia::defer(fn () =>
                \App\Models\HEI::where('status', 'active')
                    ->when(
                        $user->role->name === 'Regional Coordinator' && $user->region_id,
                        fn ($q) => $q->where('region_id', $user->region_id)
                    )
                    ->orderBy('name')
                    ->get(['id', 'name', 'uii'])
            ),
            'accountants' => Inertia::defer(fn () =>
                User::whereHas('role', fn ($q) => $q->where('name', 'Accountant'))
                    ->orderBy('name')
                    ->get(['id', 'name'])
            ),
        ]);
    }

    /**
     * Show the form for editing a liquidation.
     */
    public function edit(Request $request, Liquidation $liquidation): InertiaResponse
    {
        $user = $request->user();

        $this->authorizeView($user, $liquidation);

        $liquidation->load(['hei', 'documents.uploader', 'creator', 'reviewer', 'accountantReviewer', 'financial', 'academicYear', 'reviews']);

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
     * Regional Coordinator bulk endorses multiple liquidations to Accounting.
     */
    public function bulkEndorseToAccounting(Request $request): RedirectResponse
    {
        $user = $request->user();
        $roleName = $user->role?->name;
        if (!in_array($roleName, ['Regional Coordinator', 'STUFAPS Focal', 'Super Admin'])) {
            abort(403, 'Unauthorized.');
        }

        $validated = $request->validate([
            'liquidation_ids' => 'required|array|min:1',
            'liquidation_ids.*' => 'required|string|exists:liquidations,id',
            'review_remarks' => 'nullable|string',
        ]);

        $ids = $validated['liquidation_ids'];
        $data = collect($validated)->except('liquidation_ids')->toArray();
        $succeeded = 0;
        $errors = [];

        foreach ($ids as $id) {
            try {
                $liquidation = Liquidation::findOrFail($id);
                $this->liquidationService->endorseToAccounting($liquidation, $user, $data);
                $succeeded++;
            } catch (\Exception $e) {
                $errors[] = $id;
            }
        }

        $message = "{$succeeded} liquidation(s) endorsed to Accounting successfully.";
        if (!empty($errors)) {
            $message .= ' ' . count($errors) . ' failed.';
        }

        return redirect()->route('liquidation.index')->with('success', $message);
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
     * Bulk store multiple liquidations from in-app form entry.
     * Reuses the same createLiquidation service as single-entry.
     */
    public function bulkStore(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->hasPermission('create_liquidation')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        // Normalize control numbers: trim + uppercase
        $entries = $request->input('entries', []);
        foreach ($entries as &$entry) {
            if (isset($entry['dv_control_no'])) {
                $entry['dv_control_no'] = strtoupper(trim($entry['dv_control_no']));
            }
        }
        unset($entry);
        $request->merge(['entries' => $entries]);

        $request->validate([
            'entries'                          => 'required|array|min:1|max:100',
            'entries.*.program_id'             => 'required|exists:programs,id',
            'entries.*.uii'                    => 'required|string',
            'entries.*.dv_control_no'          => 'required|string|max:100|distinct|unique:liquidations,control_no',
            'entries.*.date_fund_released'     => 'required|date',
            'entries.*.due_date'               => 'nullable|date',
            'entries.*.academic_year_id'       => 'required|exists:academic_years,id',
            'entries.*.semester'               => 'required|string|max:50',
            'entries.*.batch_no'               => 'nullable|string|max:50',
            'entries.*.number_of_grantees'     => 'nullable|integer|min:0',
            'entries.*.total_disbursements'    => 'required|numeric|min:0',
            'entries.*.total_amount_liquidated' => 'nullable|numeric|min:0',
            'entries.*.document_status'        => 'nullable|string|in:NONE,PARTIAL,COMPLETE',
            'entries.*.rc_notes'               => 'nullable|string|max:1000',
        ], [
            'entries.*.dv_control_no.required' => 'Control No. is required for row :position.',
            'entries.*.dv_control_no.distinct'  => 'Control No. in row :position is duplicated.',
            'entries.*.dv_control_no.unique'    => 'Control No. in row :position already exists in the system.',
        ]);

        $imported = 0;
        $errors = [];

        foreach ($request->input('entries') as $index => $entry) {
            try {
                $this->liquidationService->createLiquidation($entry, $user);
                $imported++;
            } catch (\Exception $e) {
                $errors[] = ['row' => $index + 1, 'error' => $e->getMessage()];
            }
        }

        if ($imported > 0) {
            ActivityLog::log('bulk_entry', 'Bulk entered '.$imported.' liquidation(s)', null, 'Liquidation');
        }

        if (count($errors) > 0 && $imported === 0) {
            return response()->json([
                'success' => false,
                'message' => 'All entries failed. Please check the errors.',
                'imported' => 0,
                'errors' => $errors,
            ], 422);
        }

        if (count($errors) > 0) {
            return response()->json([
                'success' => true,
                'message' => "Created {$imported} liquidation(s) with " . count($errors) . ' error(s).',
                'imported' => $imported,
                'errors' => $errors,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => "Successfully created {$imported} liquidation(s).",
            'imported' => $imported,
        ]);
    }

    /**
     * Validate an Excel file before importing (dry-run).
     * Returns parsed rows with validation status — no records are created.
     */
    public function validateImport(BulkImportRequest $request): JsonResponse
    {
        $file = $request->file('file');
        $user = $request->user();
        $validatedRows = [];

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

                $excelRow = $index + 1;
                $parsedRow = $this->parseRowForPreview($row, $user);
                $parsedRow['row'] = $excelRow;
                $parsedRow['seq'] = $seq;
                $validatedRows[] = $parsedRow;
            }
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to read Excel file: ' . $e->getMessage(),
            ], 422);
        }

        $validCount = collect($validatedRows)->where('valid', true)->count();
        $errorCount = collect($validatedRows)->where('valid', false)->count();

        return response()->json([
            'success' => true,
            'rows' => $validatedRows,
            'summary' => [
                'total' => count($validatedRows),
                'valid' => $validCount,
                'errors' => $errorCount,
            ],
        ]);
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

                $excelRow = $index + 1; // 0-based array index → 1-based Excel row

                try {
                    $result = $this->processImportRow($row, $user);
                    if ($result['success']) {
                        $imported++;
                    } else {
                        $errors[] = [
                            'row' => $excelRow,
                            'seq' => $seq,
                            'uii' => trim($row[2] ?? ''),
                            'program' => trim($row[1] ?? ''),
                            'error' => $result['error'],
                        ];
                    }
                } catch (\Exception $e) {
                    $errors[] = [
                        'row' => $excelRow,
                        'seq' => $seq,
                        'uii' => trim($row[2] ?? ''),
                        'program' => trim($row[1] ?? ''),
                        'error' => $e->getMessage(),
                    ];
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

        // Eager-load only what's needed for the initial paint (header, details, workflow)
        $liquidation->load([
            'hei', 'program', 'semester', 'academicYear', 'financial',
            'reviewer', 'reviews.reviewType',
            'transmittal.endorser', 'transmittal.location',
            'compliance.complianceStatus',
            'documentStatus', 'liquidationStatus', 'creator',
        ]);

        $heiRegionId = $liquidation->hei?->region_id;
        $isHEIUser = $user->hei !== null;
        $requirements = $this->cacheService->getDocumentRequirementsForAY($liquidation->program_id, $liquidation->academic_year_id);

        // Load tracking + running data for the initial liquidation prop (needed for details card)
        $liquidation->load([
            'trackingEntries.documentStatus',
            'trackingEntries.liquidationStatus',
            'trackingEntries.locations',
            'runningData',
        ]);

        return Inertia::render('liquidation/show', [
            'liquidation' => $this->formatLiquidationDetails($liquidation, $requirements, $isHEIUser),
            'userHei' => $this->formatUserHei($user->hei),
            'regionalCoordinators' => $liquidation->program?->parent_id
                ? $this->getStufapsFocalsForProgram($liquidation->program_id)
                : $this->cacheService->getRegionalCoordinators($heiRegionId),
            'accountants' => $this->cacheService->getAccountants(),
            'documentLocations' => DocumentLocation::orderBy('sort_order')->pluck('name'),
            'permissions' => [
                'review' => $user->hasPermission('review_liquidation'),
                'submit' => $isHEIUser,
                'edit' => $user->hasPermission('edit_liquidation'),
            ],
            'userRole' => $user->role->name,
            'isStufapsProgram' => (bool) $liquidation->program?->parent_id,

            // Deferred props — load after initial page paint for instant navigation
            'documentRequirements' => Inertia::defer(fn () => $requirements),
            'commentCounts' => Inertia::defer(fn () =>
                \App\Models\LiquidationComment::where('liquidation_id', $liquidation->id)
                    ->whereNotNull('document_requirement_id')
                    ->selectRaw('document_requirement_id, count(*) as count')
                    ->groupBy('document_requirement_id')
                    ->pluck('count', 'document_requirement_id')
            ),
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
     * Void a liquidation (Admin/Super Admin only).
     * Changes status to VOIDED — record stays in DB but is excluded from totals.
     */
    public function void(Request $request, Liquidation $liquidation): RedirectResponse
    {
        if (!$request->user()->hasPermission('delete_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        if ($liquidation->isVoided()) {
            return redirect()->back()->with('error', 'This liquidation is already voided.');
        }

        $liquidation->update([
            'liquidation_status_id' => LiquidationStatus::voided()?->id,
        ]);

        ActivityLog::log('voided_liquidation', 'Voided liquidation ' . $liquidation->control_no, $liquidation, 'Liquidation');

        return redirect()->back()->with('success', 'Liquidation has been voided.');
    }

    /**
     * Restore a voided liquidation back to Unliquidated status.
     */
    public function restore(Request $request, Liquidation $liquidation): RedirectResponse
    {
        if (!$request->user()->hasPermission('delete_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        if (!$liquidation->isVoided()) {
            return redirect()->back()->with('error', 'This liquidation is not voided.');
        }

        $liquidation->update([
            'liquidation_status_id' => LiquidationStatus::unliquidated()?->id,
        ]);

        ActivityLog::log('restored_liquidation', 'Restored voided liquidation ' . $liquidation->control_no, $liquidation, 'Liquidation');

        return redirect()->back()->with('success', 'Liquidation has been restored.');
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
            'expected_updated_at'           => 'nullable|string',
        ]);

        // Optimistic locking: reject save if another user modified the record
        if (!empty($validated['expected_updated_at'])) {
            $expected = \Carbon\Carbon::parse($validated['expected_updated_at']);
            if ($liquidation->updated_at->ne($expected)) {
                return back()->withErrors([
                    'conflict' => 'This record was modified by another user. Please refresh the page to see the latest data.',
                ]);
            }
        }

        // Pre-load lookup maps (name → id) to avoid N+1 on each iteration
        $docStatusMap  = DocumentStatus::pluck('id', 'name')->toArray();
        $liqStatusMap  = LiquidationStatus::pluck('id', 'name')->toArray();
        $locationMap   = DocumentLocation::pluck('id', 'name')->toArray();

        $noneId         = DocumentStatus::where('code', DocumentStatus::CODE_NONE)->value('id');
        $unliquidatedId = LiquidationStatus::where('code', LiquidationStatus::CODE_UNLIQUIDATED)->value('id');

        // Snapshot old entries for change detection
        $oldEntries = $liquidation->trackingEntries()
            ->with('locations')
            ->get()
            ->keyBy('id')
            ->toArray();

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

        // Resolve the latest entry's RC Note text to an rc_note_status_id
        $latestRcNote = null;
        $lastEntry = end($validated['entries']);
        if (!empty($lastEntry['rc_note'])) {
            $latestRcNote = RcNoteStatus::findByCode(
                strtoupper(str_replace(' ', '_', $lastEntry['rc_note']))
            )?->id;
        }

        // Sync the latest entry's statuses up to the liquidation record
        $liquidation->update([
            'document_status_id'    => $latestDocStatusId,
            'liquidation_status_id' => $latestLiqStatusId,
            'rc_note_status_id'     => $latestRcNote,
        ]);

        // Detect which fields changed by comparing incoming request data against old snapshot
        $trackingFieldMap = [
            'document_status'    => ['label' => 'Status of Documents',   'db_field' => 'document_status_id',   'lookup' => $docStatusMap],
            'received_by'        => ['label' => 'Received by',           'db_field' => 'received_by'],
            'date_received'      => ['label' => 'Date Received',         'db_field' => 'date_received'],
            'document_location'  => ['label' => 'Document Location'],
            'reviewed_by'        => ['label' => 'Reviewed by',           'db_field' => 'reviewed_by'],
            'date_reviewed'      => ['label' => 'Date Reviewed',         'db_field' => 'date_reviewed'],
            'rc_note'            => ['label' => 'RC Note',               'db_field' => 'rc_note'],
            'date_endorsement'   => ['label' => 'Date of Endorsement',   'db_field' => 'date_endorsement'],
            'liquidation_status' => ['label' => 'Status of Liquidation', 'db_field' => 'liquidation_status_id', 'lookup' => $liqStatusMap],
        ];

        $changedFields = [];

        foreach ($validated['entries'] as $entryData) {
            $entryId = $entryData['id'] ?? null;

            if (!$entryId || !isset($oldEntries[$entryId])) {
                $changedFields[] = 'New entry added';
                continue;
            }

            $old = $oldEntries[$entryId];

            foreach ($trackingFieldMap as $requestField => $config) {
                $incomingValue = trim((string) ($entryData[$requestField] ?? ''));

                if ($requestField === 'document_location') {
                    $oldLocationNames = collect($old['locations'] ?? [])->pluck('name')->sort()->values()->implode(',');
                    $newLocationNames = collect(array_filter(array_map('trim', explode(',', $incomingValue))))->sort()->values()->implode(',');
                    if ($oldLocationNames !== $newLocationNames) {
                        $changedFields[] = $config['label'];
                    }
                    continue;
                }

                $dbField = $config['db_field'];

                // For lookup fields (status name → UUID), resolve incoming name to UUID
                if (isset($config['lookup'])) {
                    $incomingValue = (string) ($config['lookup'][$incomingValue] ?? '');
                }

                // Normalize: cast old DB value to string, trim dates of time portion for date-only fields
                $oldValue = trim((string) ($old[$dbField] ?? ''));
                if (in_array($requestField, ['date_received', 'date_reviewed', 'date_endorsement'])) {
                    $oldValue = $oldValue ? substr($oldValue, 0, 10) : '';
                    $incomingValue = $incomingValue ? substr($incomingValue, 0, 10) : '';
                }

                if ($oldValue !== $incomingValue) {
                    $changedFields[] = $config['label'];
                }
            }
        }

        // Check for deleted entries
        $oldIds = array_keys($oldEntries);
        $keptIds = array_filter(array_column($validated['entries'], 'id'));
        if (!empty(array_diff($oldIds, $keptIds))) {
            $changedFields[] = 'Removed entry';
        }

        $changedFields = array_values(array_unique($changedFields));
        $fieldSummary = !empty($changedFields) ? ' (' . implode(', ', $changedFields) . ')' : '';

        ActivityLog::log(
            'updated_tracking',
            "Updated document tracking for {$liquidation->control_no}{$fieldSummary}",
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
            'expected_updated_at' => 'nullable|string',
        ]);

        // Optimistic locking: reject save if another user modified the record
        if (!empty($validated['expected_updated_at'])) {
            $expected = \Carbon\Carbon::parse($validated['expected_updated_at']);
            if ($liquidation->updated_at->ne($expected)) {
                return back()->withErrors([
                    'conflict' => 'This record was modified by another user. Please refresh the page to see the latest data.',
                ]);
            }
        }

        // Snapshot old entries for change detection
        $oldRunningEntries = $liquidation->runningData()->get()->keyBy('id')->toArray();

        $existingIds = array_keys($oldRunningEntries);
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

        // Detect which fields changed by comparing incoming request data against old snapshot
        $runningFieldLabels = [
            'grantees_liquidated'      => 'No. of Grantees Liquidated',
            'amount_complete_docs'     => 'Amt w/ Complete Docs',
            'amount_refunded'          => 'Amt Refunded',
            'refund_or_no'             => 'Refund OR No.',
            'total_amount_liquidated'  => 'Total Amt Liquidated',
            'transmittal_ref_no'       => 'Transmittal Ref No.',
            'group_transmittal_ref_no' => 'Group Transmittal Ref No.',
        ];

        $changedRunningFields = [];

        foreach ($validated['entries'] as $entryData) {
            $entryId = $entryData['id'] ?? null;

            if (!$entryId || !isset($oldRunningEntries[$entryId])) {
                $changedRunningFields[] = 'New entry added';
                continue;
            }

            $old = $oldRunningEntries[$entryId];

            foreach ($runningFieldLabels as $field => $label) {
                // Normalize both to numeric strings for comparison (handles "0" vs 0 vs "0.00" vs null)
                $oldVal = $old[$field] ?? null;
                $newVal = $entryData[$field] ?? null;

                // For numeric fields, compare as floats to handle "0.00" vs "0" vs 0
                if (is_numeric($oldVal) || is_numeric($newVal)) {
                    $oldNum = $oldVal !== null && $oldVal !== '' ? (float) $oldVal : null;
                    $newNum = $newVal !== null && $newVal !== '' ? (float) $newVal : null;
                    if ($oldNum !== $newNum) {
                        $changedRunningFields[] = $label;
                    }
                } else {
                    if (trim((string) ($oldVal ?? '')) !== trim((string) ($newVal ?? ''))) {
                        $changedRunningFields[] = $label;
                    }
                }
            }
        }

        // Check for deleted entries
        $deletedRunningIds = array_diff(array_keys($oldRunningEntries), array_filter(array_column($validated['entries'], 'id')));
        if (!empty($deletedRunningIds)) {
            $changedRunningFields[] = 'Removed entry';
        }

        $changedRunningFields = array_values(array_unique($changedRunningFields));
        $runningFieldSummary = !empty($changedRunningFields) ? ' (' . implode(', ', $changedRunningFields) . ')' : '';

        ActivityLog::log(
            'updated_running_data',
            "Updated running data for {$liquidation->control_no}{$runningFieldSummary}",
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

        $templatePath = base_path('materials/RC-LIQUIDATION_TEMPLATE-ENTRY.xlsx');

        if (!file_exists($templatePath)) {
            abort(404, 'Template file not found.');
        }

        return response()->download(
            $templatePath,
            'RC-LIQUIDATION_TEMPLATE-ENTRY.xlsx',
            ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
        );
    }

    /**
     * Return the next auto-generated DV control number for preview.
     */
    public function nextControlNo(Request $request): JsonResponse
    {
        $programId = $request->query('program_id');
        $controlNo = $this->liquidationService->generateControlNo($programId);

        return response()->json(['control_no' => $controlNo]);
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

        // Accountants, COA, and Admins can view all liquidations
        if (in_array($roleName, ['Accountant', 'COA', 'Admin', 'Super Admin'])) {
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
        // TES: (Liquidated + For Endorsement) / Disbursed
        // STuFAPs (sub-programs): Liquidated / Disbursed
        $isStufaps = $liquidation->program?->parent_id !== null;
        $forEndorsement = (!$isStufaps && $liquidation->rcNoteStatus?->code === 'FOR_ENDORSEMENT')
            ? $totalDisbursements - $totalLiquidated
            : 0;
        $percentageLiquidation = $totalDisbursements > 0
            ? round((($totalLiquidated + $forEndorsement) / $totalDisbursements) * 100, 2)
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
            'academic_year' => $liquidation->academicYear?->name ?? 'N/A',
            'semester' => $liquidation->semester?->name ?? 'N/A',
            'batch_no' => $liquidation->batch_no,
            'dv_control_no' => $liquidation->control_no,
            'number_of_grantees' => $financial?->number_of_grantees,
            'total_disbursements' => number_format($totalDisbursements, 2),
            'total_amount_liquidated' => number_format($totalLiquidated, 2),
            'total_unliquidated_amount' => number_format($totalUnliquidated, 2),
            'document_status' => $documentStatusDisplay,
            'document_status_code' => $documentStatusCode ?? 'NONE',
            'rc_notes' => $liquidation->rcNoteStatus?->name,
            'liquidation_status' => $liquidationStatus,
            'liquidation_status_code' => $liquidation->liquidationStatus?->code ?? 'UNLIQUIDATED',
            'is_voided' => $liquidation->isVoided(),
            'is_endorsed' => $liquidation->reviewed_at !== null,
            'percentage_liquidation' => $percentageLiquidation,
            'lapsing_period' => $financial?->lapsing_period ?? 0,
        ];
    }

    private function cleanRcNotes(?string $remarks): ?string
    {
        if (!$remarks) {
            return null;
        }

        // Remove "Voided by ..." segments appended by previous void actions
        $cleaned = preg_replace('/\s*\|\s*Voided by\s+.*?(?=\s*\||$)/', '', $remarks);
        $cleaned = trim($cleaned, " \t\n\r\0\x0B|");

        return $cleaned ?: null;
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
            'rc_notes' => $liquidation->rcNoteStatus?->code,
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

    private function getStufapsFocalsForProgram(string $programId): Collection
    {
        return User::whereHas('role', fn ($q) => $q->where('name', 'STUFAPS Focal'))
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'avatar', 'region_id']);
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
            'academic_year' => $liquidation->academicYear?->name ?? 'N/A',
            'semester' => $liquidation->semester?->name ?? 'N/A',
            'batch_no' => $liquidation->batch_no,
            'dv_control_no' => $liquidation->control_no,
            'amount_received' => $financial?->amount_received ?? 0,
            'total_disbursed' => $totalDisbursed,
            'remaining_amount' => ($financial?->amount_received ?? 0) - ($financial?->amount_liquidated ?? 0),
            'rc_notes' => $liquidation->rcNoteStatus?->name,
            'remarks' => $liquidation->remarks,
            'review_remarks' => $liquidation->getLatestReviewRemarks(),
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
            'coa_endorsed_at' => $liquidation->coa_endorsed_at?->format('Y-m-d H:i:s'),
            'accountant_reviewed_by_name' => $liquidation->accountantReviewer?->name,
            'accountant_reviewed_at' => $liquidation->accountant_reviewed_at?->format('Y-m-d H:i:s'),
            'rc_endorsement_remarks' => $liquidation->getRcEndorsementRemarks(),
            'accountant_endorsement_remarks' => $liquidation->getAccountantEndorsementRemarks(),
            'updated_at' => $liquidation->updated_at?->toIso8601String(),
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
        $errors = [];

        // --- Extract raw values ---
        $programCode     = trim($row[1] ?? '');
        $uii             = trim($row[2] ?? '');
        $academicYearCode = trim($row[6] ?? '');
        $semesterRaw     = trim((string) ($row[7] ?? ''));
        $batchNo         = trim($row[8] ?? '');
        $dvControlNo     = trim($row[9] ?? '');
        $docStatusRaw    = trim((string) ($row[13] ?? ''));
        $rcNotesRaw      = trim($row[14] ?? '');

        // --- Required field checks ---
        if (empty($programCode))     $errors[] = 'Program (col B) is required.';
        if (empty($uii))             $errors[] = 'UII (col C) is required.';
        if (empty($academicYearCode)) $errors[] = 'Academic Year (col G) is required.';
        if (empty($semesterRaw))     $errors[] = 'Semester (col H) is required.';

        $dateFundReleased = $this->parseExcelDate($row[4] ?? null);
        if (!$dateFundReleased) {
            $errors[] = 'Date of Fund Released (col E) is required and must be a valid date with a 4-digit year.';
        }

        $totalDisbursements = $this->parseAmount($row[11] ?? null);
        if (empty(trim((string) ($row[11] ?? ''))))  $errors[] = 'Total Disbursements (col L) is required.';
        elseif ($totalDisbursements < 0)             $errors[] = 'Total Disbursements (col L) cannot be negative.';

        if (!empty($errors)) {
            return ['success' => false, 'error' => implode(' ', $errors)];
        }

        // --- Lookup validations ---
        $hei = $this->liquidationService->findHEIByUII($uii);
        if (!$hei) {
            return ['success' => false, 'error' => "UII '{$uii}' (col C) not found in the system."];
        }

        if ($user->role->name === 'Regional Coordinator' && $user->region_id) {
            if ($hei->region_id !== $user->region_id) {
                return ['success' => false, 'error' => "HEI '{$uii}' does not belong to your assigned region."];
            }
        }

        $program = $this->findProgram($programCode);
        if (!$program) {
            return ['success' => false, 'error' => "Program '{$programCode}' (col B) not found. Use a valid program code."];
        }

        // Semester must match database codes (1ST, 2ND, SUM) — also accepts word forms
        $semesterId = $this->liquidationService->findSemesterId($semesterRaw);
        if (!$semesterId) {
            return ['success' => false, 'error' => "Semester '{$semesterRaw}' (col H) is invalid. Use: 1ST, 2ND, SUM, First Semester, Second Semester, or Summer."];
        }

        // Academic year must match database codes
        $academicYear = \App\Models\AcademicYear::findByCode($academicYearCode);
        if (!$academicYear) {
            return ['success' => false, 'error' => "Academic Year '{$academicYearCode}' (col G) not found in the system."];
        }

        // --- Control No validation (col J) ---
        $controlNo = !empty($dvControlNo) ? $dvControlNo : $this->liquidationService->generateControlNumber($program->id);

        if (!empty($dvControlNo)) {
            // Validate format: PROGRAM-YYYY-XXXX (program code may contain hyphens, e.g. SIDA-SGP-2026-0012)
            if (!preg_match('/^(.+)-(\d{4})-(\d+)$/', $dvControlNo, $matches)) {
                return ['success' => false, 'error' => "Control No '{$dvControlNo}' (col J) must follow format: PROGRAM-YYYY-XXXX (e.g. TES-2026-0001)."];
            }

            // Program prefix in control no must match the program column
            $controlPrefix = strtoupper($matches[1]);
            if (strtoupper($program->code) !== $controlPrefix) {
                return ['success' => false, 'error' => "Control No prefix '{$controlPrefix}' does not match Program '{$program->code}' (col B vs col J)."];
            }
        }

        if (Liquidation::where('control_no', $controlNo)->exists()) {
            return ['success' => false, 'error' => "Control No '{$controlNo}' (col J) already exists."];
        }

        // --- Document status validation (col N) ---
        $documentStatusId = null;
        if (!empty($docStatusRaw)) {
            $documentStatusId = $this->parseDocumentStatus($docStatusRaw);
            if (!$documentStatusId) {
                return ['success' => false, 'error' => "Status of Documents '{$docStatusRaw}' (col N) is invalid. Use: COMPLETE, PARTIAL, or NONE."];
            }
        } else {
            $documentStatusId = DocumentStatus::findByCode(DocumentStatus::CODE_NONE)?->id;
        }

        // --- RC Notes validation (col O) ---
        $rcNoteStatusId = null;
        if (!empty($rcNotesRaw)) {
            $rcNoteStatusId = $this->parseRcNoteStatus($rcNotesRaw);
            if (!$rcNoteStatusId) {
                return ['success' => false, 'error' => "RC Notes '{$rcNotesRaw}' (col O) is invalid. Use: For Review, For Compliance, For Endorsement, Fully Endorsed, or Partially Endorsed."];
            }
        }

        // --- Due date: auto-calculate if not provided ---
        $dueDateRaw = trim((string) ($row[5] ?? ''));
        $dueDate = $this->parseExcelDate($row[5] ?? null);
        if (!empty($dueDateRaw) && !$dueDate) {
            return ['success' => false, 'error' => 'Due Date (col F) has an invalid date or year. Please use a valid date with a 4-digit year.'];
        }
        if ($dueDate && $dateFundReleased && \Carbon\Carbon::instance($dueDate)->lt(\Carbon\Carbon::instance($dateFundReleased))) {
            return ['success' => false, 'error' => 'Due Date (col F) cannot be earlier than Date of Fund Released (col E).'];
        }
        if (!$dueDate && $dateFundReleased) {
            $days = $program->parent_id ? 30 : 90;
            $dueDate = \Carbon\Carbon::instance($dateFundReleased)->copy()->addDays($days);
        }

        // --- Amount liquidated (non-negative) ---
        $totalLiquidated = $this->parseAmount($row[12] ?? 0);
        if ($totalLiquidated < 0) {
            return ['success' => false, 'error' => 'Total Amount Liquidated (col M) cannot be negative.'];
        }

        // --- Create records ---
        $liquidation = Liquidation::create([
            'control_no'          => $controlNo,
            'hei_id'              => $hei->id,
            'program_id'          => $program->id,
            'academic_year_id'    => $academicYear->id,
            'semester_id'         => $semesterId,
            'batch_no'            => !empty($batchNo) ? $batchNo : null,
            'document_status_id'  => $documentStatusId,
            'rc_note_status_id'   => $rcNoteStatusId,
            'liquidation_status_id' => LiquidationStatus::unliquidated()?->id,
            'created_by'          => $user->id,
        ]);

        $liquidation->createOrUpdateFinancial([
            'date_fund_released' => $dateFundReleased,
            'due_date'           => $dueDate,
            'number_of_grantees' => $this->parseInteger($row[10] ?? null),
            'amount_received'    => $totalDisbursements,
            'amount_disbursed'   => $totalDisbursements,
            'amount_liquidated'  => $totalLiquidated,
        ]);

        NotificationService::dispatch('bulk_imported', 'Bulk imported liquidation '.$liquidation->control_no.' for '.$hei->name, $liquidation, 'Liquidation');

        return ['success' => true];
    }

    /**
     * Parse and validate a single row for preview (dry-run, no DB writes).
     */
    private function parseRowForPreview(array $row, $user): array
    {
        $errors = [];

        $programCode      = trim($row[1] ?? '');
        $uii              = trim($row[2] ?? '');
        $heiNameRaw       = trim($row[3] ?? '');
        $academicYearCode = trim($row[6] ?? '');
        $semesterRaw      = trim((string) ($row[7] ?? ''));
        $batchNo          = trim($row[8] ?? '');
        $dvControlNo      = trim($row[9] ?? '');
        $docStatusRaw     = trim((string) ($row[13] ?? ''));
        $rcNotesRaw       = trim($row[14] ?? '');

        // Required field checks
        if (empty($programCode))      $errors[] = 'Program (col B) is required.';
        if (empty($uii))              $errors[] = 'UII (col C) is required.';
        if (empty($academicYearCode)) $errors[] = 'Academic Year (col G) is required.';
        if (empty($semesterRaw))      $errors[] = 'Semester (col H) is required.';

        $dateFundReleased = $this->parseExcelDate($row[4] ?? null);
        if (!$dateFundReleased) {
            $errors[] = 'Date of Fund Released (col E) is required or has an invalid date/year.';
        }

        $dueDateRaw = trim((string) ($row[5] ?? ''));
        $dueDate = $this->parseExcelDate($row[5] ?? null);
        if (!empty($dueDateRaw) && !$dueDate) {
            $errors[] = 'Due Date (col F) has an invalid date or year. Please use a valid date with a 4-digit year.';
        }
        if ($dueDate && $dateFundReleased && \Carbon\Carbon::instance($dueDate)->lt(\Carbon\Carbon::instance($dateFundReleased))) {
            $errors[] = 'Due Date (col F) cannot be earlier than Date of Fund Released (col E).';
        }

        $totalDisbursements = $this->parseAmount($row[11] ?? null);
        if (empty(trim((string) ($row[11] ?? ''))))  $errors[] = 'Total Disbursements (col L) is required.';
        elseif ($totalDisbursements < 0)             $errors[] = 'Total Disbursements (col L) cannot be negative.';

        $totalLiquidated = $this->parseAmount($row[12] ?? 0);
        if ($totalLiquidated < 0) $errors[] = 'Total Amount Liquidated (col M) cannot be negative.';

        // Lookup validations (only if basic fields present)
        $heiName = $heiNameRaw;
        $program = null;

        if (!empty($uii)) {
            $hei = $this->liquidationService->findHEIByUII($uii);
            if (!$hei) {
                $errors[] = "UII '{$uii}' (col C) not found.";
            } else {
                $heiName = $hei->name;
                if ($user->role->name === 'Regional Coordinator' && $user->region_id && $hei->region_id !== $user->region_id) {
                    $errors[] = "HEI '{$uii}' does not belong to your region.";
                }
            }
        }

        if (!empty($programCode)) {
            $program = $this->findProgram($programCode);
            if (!$program) $errors[] = "Program '{$programCode}' (col B) not found.";
        }

        if (!empty($semesterRaw)) {
            $semesterId = $this->liquidationService->findSemesterId($semesterRaw);
            if (!$semesterId) $errors[] = "Semester '{$semesterRaw}' (col H) is invalid. Use: 1ST, 2ND, SUM, First Semester, Second Semester, or Summer.";
        }

        if (!empty($academicYearCode)) {
            $ay = \App\Models\AcademicYear::findByCode($academicYearCode);
            if (!$ay) $errors[] = "Academic Year '{$academicYearCode}' (col G) not found.";
        }

        if (!empty($dvControlNo)) {
            if (!preg_match('/^(.+)-(\d{4})-(\d+)$/', $dvControlNo, $ctrlMatches)) {
                $errors[] = "Control No '{$dvControlNo}' (col J) must follow format: PROGRAM-YYYY-XXXX.";
            } elseif ($program) {
                $controlPrefix = strtoupper($ctrlMatches[1]);
                if (strtoupper($program->code) !== $controlPrefix) {
                    $errors[] = "Control No prefix '{$controlPrefix}' does not match Program '{$program->code}'.";
                }
            }
            if (Liquidation::where('control_no', $dvControlNo)->exists()) {
                $errors[] = "Control No '{$dvControlNo}' already exists.";
            }
        }

        if (!empty($docStatusRaw)) {
            if (!$this->parseDocumentStatus($docStatusRaw)) {
                $errors[] = "Status of Documents '{$docStatusRaw}' (col N) is invalid.";
            }
        }

        if (!empty($rcNotesRaw)) {
            if (!$this->parseRcNoteStatus($rcNotesRaw)) {
                $errors[] = "RC Notes '{$rcNotesRaw}' (col O) is invalid.";
            }
        }

        // Auto-calculate due date for preview
        $dueDateDisplay = null;
        if ($dueDate) {
            $dueDateDisplay = \Carbon\Carbon::instance($dueDate)->format('M d, Y');
        } elseif ($dateFundReleased && $program) {
            $days = $program->parent_id ? 30 : 90;
            $dueDateDisplay = \Carbon\Carbon::instance($dateFundReleased)->copy()->addDays($days)->format('M d, Y');
        }

        return [
            'valid'              => empty($errors),
            'errors'             => $errors,
            'program'            => $programCode,
            'uii'                => $uii,
            'hei_name'           => $heiName,
            'date_fund_released' => $dateFundReleased ? \Carbon\Carbon::instance($dateFundReleased)->format('M d, Y') : null,
            'due_date'           => $dueDateDisplay,
            'academic_year'      => $academicYearCode,
            'semester'           => $semesterRaw,
            'batch_no'           => $batchNo,
            'control_no'         => $dvControlNo,
            'grantees'           => $this->parseInteger($row[10] ?? null),
            'disbursements'      => $totalDisbursements,
            'amount_liquidated'  => $totalLiquidated,
            'doc_status'         => $docStatusRaw,
            'rc_notes'           => $rcNotesRaw,
        ];
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
        $errorCount = count($errors);

        if ($errorCount > 0 && $imported === 0) {
            return response()->json([
                'success' => false,
                'message' => "Import failed — {$errorCount} error(s) found.",
                'imported' => 0,
                'errors' => $errors,
            ], 422);
        }

        if ($errorCount > 0) {
            return response()->json([
                'success' => true,
                'message' => "Imported {$imported} liquidation(s) with {$errorCount} error(s).",
                'imported' => $imported,
                'errors' => $errors,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => "Successfully imported {$imported} liquidation(s).",
            'imported' => $imported,
        ]);
    }

    private function parseExcelDate($value): ?\DateTime
    {
        if ($value === null || trim((string) $value) === '') {
            return null;
        }

        if (is_numeric($value)) {
            try {
                $date = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($value);
                // Validate year is a reasonable 4-digit year
                $year = (int) $date->format('Y');
                if ($year < 1900 || $year > 2100) {
                    return null;
                }
                return $date;
            } catch (\Exception) {
                return null;
            }
        }

        try {
            $date = \Carbon\Carbon::parse($value);
            // Validate year is a reasonable 4-digit year
            $year = (int) $date->format('Y');
            if ($year < 1900 || $year > 2100) {
                return null;
            }
            return $date;
        } catch (\Exception) {
            return null;
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
        if (empty($value)) {
            return null;
        }

        $normalized = strtoupper(trim($value));

        $statusMap = [
            'COMPLETE'   => DocumentStatus::CODE_COMPLETE,
            'COMPLETED'  => DocumentStatus::CODE_COMPLETE,
            'PARTIAL'    => DocumentStatus::CODE_PARTIAL,
            'INCOMPLETE' => DocumentStatus::CODE_PARTIAL,
            'NONE'       => DocumentStatus::CODE_NONE,
            'N/A'        => DocumentStatus::CODE_NONE,
            'NA'         => DocumentStatus::CODE_NONE,
        ];

        $code = $statusMap[$normalized] ?? null;

        return $code ? DocumentStatus::findByCode($code)?->id : null;
    }

    /**
     * Parse RC note status from import value.
     * Returns the UUID or null if not matched.
     */
    private function parseRcNoteStatus($value): ?string
    {
        if (empty($value)) {
            return null;
        }

        $normalized = strtoupper(trim($value));

        $statusMap = [
            'FOR REVIEW'          => RcNoteStatus::CODE_FOR_REVIEW,
            'FOR_REVIEW'          => RcNoteStatus::CODE_FOR_REVIEW,
            'FOR COMPLIANCE'      => RcNoteStatus::CODE_FOR_COMPLIANCE,
            'FOR_COMPLIANCE'      => RcNoteStatus::CODE_FOR_COMPLIANCE,
            'FOR ENDORSEMENT'     => RcNoteStatus::CODE_FOR_ENDORSEMENT,
            'FOR_ENDORSEMENT'     => RcNoteStatus::CODE_FOR_ENDORSEMENT,
            'FULLY ENDORSED'      => RcNoteStatus::CODE_FULLY_ENDORSED,
            'FULLY_ENDORSED'      => RcNoteStatus::CODE_FULLY_ENDORSED,
            'PARTIALLY ENDORSED'  => RcNoteStatus::CODE_PARTIALLY_ENDORSED,
            'PARTIALLY_ENDORSED'  => RcNoteStatus::CODE_PARTIALLY_ENDORSED,
        ];

        $code = $statusMap[$normalized] ?? null;

        return $code ? RcNoteStatus::findByCode($code)?->id : null;
    }
}
