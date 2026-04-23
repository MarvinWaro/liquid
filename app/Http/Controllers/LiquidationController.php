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
use App\Models\HEI;
use App\Models\ImportBatch;
use App\Models\Liquidation;
use App\Models\Notification;
use App\Models\LiquidationDocument;
use App\Models\LiquidationReview;
use App\Models\LiquidationRunningData;
use App\Models\LiquidationStatus;
use App\Models\RcNoteStatus;
use App\Models\LiquidationTrackingEntry;
use App\Models\ProgramDueDateRule;
use App\Models\User;
use App\Services\CacheService;
use App\Services\LiquidationService;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class LiquidationController extends Controller
{
    // ── Excel column indices (0-based) ────────────────────────────────────────
    private const COL_SEQ                = 0;
    private const COL_PROGRAM            = 1;
    private const COL_UII                = 2;
    private const COL_HEI_NAME           = 3;
    private const COL_DATE_FUND_RELEASED = 4;
    private const COL_DUE_DATE           = 5;
    private const COL_ACADEMIC_YEAR      = 6;
    private const COL_SEMESTER           = 7;
    private const COL_BATCH_NO           = 8;
    private const COL_CONTROL_NO         = 9;
    private const COL_GRANTEES           = 10;
    private const COL_DISBURSEMENTS      = 11;
    private const COL_AMOUNT_LIQUIDATED  = 12;
    private const COL_DOC_STATUS         = 13;
    private const COL_RC_NOTES           = 14;

    /** Rows per DB transaction during bulk import. */
    private const IMPORT_CHUNK_SIZE = 100;

    /** Import token TTL in minutes. */
    private const IMPORT_TOKEN_TTL = 30;

    /** Filter keys accepted on the liquidation listing and print report. */
    private const LISTING_FILTER_KEYS = [
        'search',
        'program',
        'document_status',
        'liquidation_status',
        'academic_year',
        'rc_note_status',
        'region',
        'sort',
        'direction',
    ];

    /** Roles allowed to filter by region (others are implicitly scoped). */
    private const REGION_FILTER_ROLES = ['Super Admin', 'Admin'];

    /** Safety ceiling for rows rendered in a single print/export run.
     *  Real-world expected peak is ~18k; 50k gives comfortable headroom
     *  while keeping memory bounded on small instances. */
    private const PRINT_REPORT_ROW_CAP = 50000;

    /** Max liquidations a single user can pin at once. */
    private const PIN_LIMIT = 10;

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
        $filters = $request->only(self::LISTING_FILTER_KEYS);

        // Only Admin/Super Admin can filter by region; strip for other roles to prevent privilege escalation.
        if (!in_array($user->role->name, self::REGION_FILTER_ROLES)) {
            unset($filters['region']);
        }

        // All programs for the filter dropdown (lightweight, cached)
        $allPrograms = $this->cacheService->getSelectablePrograms();

        // IDs the current user has pinned — used to flag rows and render the pinned section.
        $pinnedIds = $user->pinnedLiquidations()->pluck('liquidations.id');

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
            'pinLimit' => self::PIN_LIMIT,

            // Deferred — table data loads after initial paint.
            // All deferreds below share Inertia's default group, so one XHR
            // delivers them together (stats + rows fill in at the same time).
            'liquidations' => Inertia::defer(fn () =>
                $this->liquidationService
                    ->getPaginatedLiquidations($user, $filters)
                    ->through(fn ($liquidation) => $this->formatLiquidationForList($liquidation, $pinnedIds))
            ),

            // Pinned rows shown above the main table (page 1 only in the UI).
            // Always computed so the client can decide; cap enforced at mutation time.
            'pinnedLiquidations' => Inertia::defer(fn () =>
                $this->liquidationService
                    ->getPinnedLiquidationsForUser($user, self::PIN_LIMIT)
                    ->map(fn ($liquidation) => $this->formatLiquidationForList($liquidation, $pinnedIds))
                    ->values()
            ),

            // Summary stats for the table header
            'tableSummary' => Inertia::defer(fn () =>
                $this->liquidationService->getTableSummary($user, $filters)
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
            'academicYears' => \App\Models\AcademicYear::getDropdownOptions(),
            'rcNoteStatuses' => RcNoteStatus::getDropdownOptions(),
            'regions' => in_array($user->role->name, self::REGION_FILTER_ROLES)
                ? \App\Models\Region::where('status', 'active')->orderBy('code')->get(['id', 'code', 'name'])
                : [],
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

        $selectAll = (bool) $request->input('select_all', false);

        $validated = $request->validate([
            'liquidation_ids' => $selectAll ? 'nullable|array' : 'required|array|min:1',
            'liquidation_ids.*' => 'string|exists:liquidations,id',
            'review_remarks' => 'nullable|string',
        ]);

        // When "select all pages" was used, resolve all eligible IDs server-side
        if ($selectAll) {
            $query = Liquidation::excludeVoided()
                ->whereNull('reviewed_at')
                ->whereNotNull('date_submitted');
            if ($roleName === 'Regional Coordinator' && $user->region_id) {
                $query->whereHas('hei', fn ($q) => $q->where('region_id', $user->region_id));
                $query->whereDoesntHave('program', fn ($q) => $q->whereNotNull('parent_id'));
            } elseif ($roleName === 'STUFAPS Focal') {
                $scopedIds = $user->getParentScopedProgramIds();
                if ($scopedIds) $query->whereIn('program_id', $scopedIds);
            }
            $ids = $query->pluck('id')->toArray();
        } else {
            $ids = $validated['liquidation_ids'];
        }

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

        // Normalize control numbers: trim + uppercase (skip empty/null)
        $entries = $request->input('entries', []);
        foreach ($entries as &$entry) {
            if (!empty($entry['dv_control_no'])) {
                $entry['dv_control_no'] = strtoupper(trim($entry['dv_control_no']));
            } else {
                $entry['dv_control_no'] = null;
            }
        }
        unset($entry);
        $request->merge(['entries' => $entries]);

        $request->validate([
            'entries'                          => 'required|array|min:1|max:100',
            'entries.*.program_id'             => 'required|exists:programs,id',
            'entries.*.uii'                    => 'required|string',
            'entries.*.dv_control_no'          => 'nullable|string|max:100|distinct|unique:liquidations,control_no',
            'entries.*.date_fund_released'     => 'nullable|date',
            'entries.*.due_date'               => 'nullable|date',
            'entries.*.academic_year_id'       => 'required|exists:academic_years,id',
            'entries.*.semester'               => 'nullable|string|max:50',
            'entries.*.batch_no'               => 'nullable|string|max:50',
            'entries.*.number_of_grantees'     => 'nullable|integer|min:0',
            'entries.*.total_disbursements'    => 'required|numeric|min:0',
            'entries.*.total_amount_liquidated' => 'nullable|numeric|min:0',
            'entries.*.document_status'        => 'nullable|string|in:NONE,PARTIAL,COMPLETE',
            'entries.*.rc_notes'               => 'nullable|string|max:1000',
        ], [
            'entries.*.dv_control_no.distinct'  => 'Control / Ledger No. in row :position is duplicated.',
            'entries.*.dv_control_no.unique'    => 'Control / Ledger No. in row :position already exists in the system.',
        ]);

        $imported = 0;
        $errors = [];

        DB::transaction(function () use ($request, $user, &$imported, &$errors) {
            foreach ($request->input('entries') as $index => $entry) {
                try {
                    $this->liquidationService->createLiquidation($entry, $user);
                    $imported++;
                } catch (\Exception $e) {
                    $errors[] = ['row' => $index + 1, 'error' => $e->getMessage()];
                }
            }
        });

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
     *
     * Valid rows are cached server-side under a one-time import token so that
     * the actual import step never needs to re-parse the file.
     */
    public function validateImport(BulkImportRequest $request): JsonResponse
    {
        set_time_limit(300); // Large files (3000+ rows) need more than 30s

        $file = $request->file('file');
        $user = $request->user();

        try {
            $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($file->getRealPath());

            // Try the active sheet first; if it yields no data rows, scan all sheets
            $allRows = $spreadsheet->getActiveSheet()->toArray();
            $hasDataRows = collect($allRows)->contains(fn ($row) => is_numeric(trim($row[self::COL_SEQ] ?? '')));

            if (!$hasDataRows && $spreadsheet->getSheetCount() > 1) {
                foreach ($spreadsheet->getAllSheets() as $sheet) {
                    $candidate = $sheet->toArray();
                    if (collect($candidate)->contains(fn ($row) => is_numeric(trim($row[self::COL_SEQ] ?? '')))) {
                        $allRows = $candidate;
                        break;
                    }
                }
            }

            $spreadsheet->disconnectWorksheets();
            unset($spreadsheet);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to read Excel file: ' . $e->getMessage(),
            ], 422);
        }

        // Pre-warm caches to avoid per-row DB queries
        $this->liquidationService->getCachedSemesters();
        $this->liquidationService->getCachedRcNoteStatuses();
        $this->cacheService->getPrograms();

        // Pre-load all existing control numbers for fast duplicate checks
        $existingControlNos = Liquidation::pluck('control_no')->filter()->flip()->all();

        // Pre-load academic years keyed by code for in-memory lookup
        $academicYearsMap = \App\Models\AcademicYear::all()->keyBy(fn ($ay) => trim($ay->code));

        // Pre-load existing liquidation fingerprints for fast duplicate detection
        $existingFingerprints = DB::table('liquidations')
            ->join('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->select('liquidations.hei_id', 'liquidations.program_id', 'liquidations.academic_year_id',
                     'liquidations.semester_id', 'liquidations.batch_no', 'liquidations.control_no',
                     'liquidation_financials.date_fund_released')
            ->whereNull('liquidations.deleted_at')
            ->get()
            ->map(fn ($r) => $r->hei_id . '|' . $r->program_id . '|' . $r->academic_year_id . '|' .
                ($r->date_fund_released ?? '') . '|' . ($r->semester_id ?? '') . '|' . ($r->batch_no ?? ''))
            ->flip()
            ->all();

        // Count data rows for progress tracking
        $dataRows = array_filter($allRows, function ($row) {
            if (empty(array_filter($row, fn($cell) => $cell !== null && $cell !== ''))) return false;
            return is_numeric(trim($row[self::COL_SEQ] ?? ''));
        });
        $totalDataRows = count($dataRows);

        // Publish progress so frontend can poll during validation
        // Accept a client-provided token so polling can begin before the response returns
        $validateToken = $request->input('validate_token') ?: Str::uuid()->toString();
        $progressKey = "validate_progress_{$validateToken}";
        $progressTtl = now()->addMinutes(15);
        $fileCache = Cache::store('file');
        $fileCache->put($progressKey, ['processed' => 0, 'total' => $totalDataRows, 'done' => false], $progressTtl);

        $validatedRows  = [];
        $importableRows = [];
        $seenControlNos = []; // track within-file duplicates
        $processedCount = 0;

        foreach ($allRows as $index => $row) {
            if (empty(array_filter($row, fn($cell) => $cell !== null && $cell !== ''))) {
                continue;
            }

            $seq = trim($row[self::COL_SEQ] ?? '');
            if (!is_numeric($seq)) {
                continue;
            }

            $processedCount++;

            // Update progress every 50 rows to avoid cache overhead
            if ($processedCount % 50 === 0 || $processedCount === $totalDataRows) {
                $fileCache->put($progressKey, ['processed' => $processedCount, 'total' => $totalDataRows, 'done' => false], $progressTtl);
            }

            $parsed = $this->parseImportRow($row, $user, $existingControlNos, $academicYearsMap, $existingFingerprints);
            $parsed['row'] = $index + 1;
            $parsed['seq'] = $seq;

            // Within-file duplicate control_no detection (DB check only catches existing records,
            // not duplicates within the same uploaded file)
            $controlNoInFile = $parsed['control_no'] ?? '';
            if (!empty($controlNoInFile)) {
                if (isset($seenControlNos[$controlNoInFile])) {
                    $parsed['valid'] = false;
                    $parsed['errors'][] = "Control / Ledger No '{$controlNoInFile}' (col J) appears more than once in this file (first seen at row {$seenControlNos[$controlNoInFile]}).";
                } else {
                    $seenControlNos[$controlNoInFile] = $parsed['row'];
                }
            }

            // Separate importable data from display data before sending to frontend
            $importable = $parsed['valid'] ? $parsed['importable'] : null;
            if ($importable !== null) {
                // Attach row context so import-time errors can include useful info
                $importable['row_no']       = $index + 1;
                $importable['seq']          = $seq;
                $importable['program_code'] = $parsed['program'];
                $importable['uii']          = $parsed['uii'];
            }
            unset($parsed['importable']);
            $validatedRows[] = $parsed;

            if ($importable !== null) {
                $importableRows[] = $importable;
            }
        }

        $validCount = collect($validatedRows)->where('valid', true)->count();
        $errorCount = collect($validatedRows)->where('valid', false)->count();

        // Mark validation as complete
        $fileCache->put($progressKey, ['processed' => $totalDataRows, 'total' => $totalDataRows, 'done' => true], $progressTtl);

        // Cache pre-resolved rows server-side — import step uses token, not file
        $token = Str::uuid()->toString();
        $fileCache->put("liquidation_import_{$token}", [
            'user_id'   => $user->id,
            'file_name' => $file->getClientOriginalName(),
            'rows'      => $importableRows,
        ], now()->addMinutes(self::IMPORT_TOKEN_TTL));

        return response()->json([
            'success'        => true,
            'token'          => $token,
            'validate_token' => $validateToken,
            'rows'           => $validatedRows,
            'summary'        => [
                'total'  => count($validatedRows),
                'valid'  => $validCount,
                'errors' => $errorCount,
            ],
        ]);
    }

    /**
     * Validate pre-parsed import rows (sent as JSON from the frontend Web Worker).
     *
     * The frontend parses the Excel file client-side using SheetJS in a Web Worker,
     * then sends the structured rows here for database-level validation (HEI lookup,
     * duplicate check, program resolution, etc.). This avoids PhpSpreadsheet memory
     * usage on the server and keeps the browser UI responsive during parsing.
     */
    /**
     * Validate a chunk of pre-parsed import rows.
     *
     * Designed to be called multiple times for chunked validation:
     * - First chunk: no import_token → creates a new cache entry, returns token.
     * - Subsequent chunks: pass import_token → appends importable rows to cache.
     * - Pass seen_control_nos between chunks for cross-chunk duplicate detection.
     */
    public function validateParsedImport(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!in_array($user->role?->name, ['Regional Coordinator', 'Admin', 'STUFAPS Focal']) && !$user->isSuperAdmin()) {
            abort(403, 'Unauthorized action.');
        }

        $request->validate([
            'rows'              => 'required|array|min:1',
            'rows.*.seq'        => 'required',
            'file_name'         => 'nullable|string|max:255',
            'import_token'      => 'nullable|string',
            'seen_control_nos'  => 'nullable|array',
        ]);

        $inputRows = $request->input('rows');
        $fileName  = $request->input('file_name', 'import.xlsx');

        // Pre-load all lookup data into memory (no per-row I/O)
        $this->liquidationService->getCachedSemesters();
        $this->liquidationService->getCachedRcNoteStatuses();
        $this->cacheService->getPrograms();

        $heiMap             = HEI::all()->keyBy(fn ($h) => strtolower(trim($h->uii)));
        $existingControlNos = Liquidation::pluck('control_no')->filter()->flip()->all();
        $academicYearsMap   = \App\Models\AcademicYear::all()->keyBy(fn ($ay) => trim($ay->code));

        $existingFingerprints = DB::table('liquidations')
            ->join('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->select(
                'liquidations.hei_id', 'liquidations.program_id', 'liquidations.academic_year_id',
                'liquidations.semester_id', 'liquidations.batch_no', 'liquidations.control_no',
                'liquidation_financials.date_fund_released'
            )
            ->whereNull('liquidations.deleted_at')
            ->get()
            ->map(fn ($r) => $r->hei_id . '|' . $r->program_id . '|' . $r->academic_year_id . '|' .
                ($r->date_fund_released ?? '') . '|' . ($r->semester_id ?? '') . '|' . ($r->batch_no ?? ''))
            ->flip()
            ->all();

        // Cross-chunk state: reuse token & seen control numbers from previous chunks
        $fileCache     = Cache::store('file');
        $token         = $request->input('import_token') ?: Str::uuid()->toString();
        $seenControlNos = $request->input('seen_control_nos', []);

        $validatedRows  = [];
        $importableRows = [];

        foreach ($inputRows as $parsedRow) {
            $raw = $this->structuredToRawRow($parsedRow);

            $parsed       = $this->parseImportRow($raw, $user, $existingControlNos, $academicYearsMap, $existingFingerprints, $heiMap);
            $parsed['row'] = (int) ($parsedRow['row'] ?? 0);
            $parsed['seq'] = (string) ($parsedRow['seq'] ?? '');

            // Cross-chunk duplicate control_no detection
            $controlNoInFile = $parsed['control_no'] ?? '';
            if (!empty($controlNoInFile)) {
                if (isset($seenControlNos[$controlNoInFile])) {
                    $parsed['valid']    = false;
                    $parsed['errors'][] = "Control / Ledger No '{$controlNoInFile}' (col J) appears more than once in this file (first seen at row {$seenControlNos[$controlNoInFile]}).";
                } else {
                    $seenControlNos[$controlNoInFile] = $parsed['row'];
                }
            }

            $importable = $parsed['valid'] ? $parsed['importable'] : null;
            if ($importable !== null) {
                $importable['row_no']       = $parsed['row'];
                $importable['seq']          = $parsed['seq'];
                $importable['program_code'] = $parsed['program'];
                $importable['uii']          = $parsed['uii'];
            }
            unset($parsed['importable']);
            $validatedRows[] = $parsed;

            if ($importable !== null) {
                $importableRows[] = $importable;
            }
        }

        $validCount = collect($validatedRows)->where('valid', true)->count();
        $errorCount = collect($validatedRows)->where('valid', false)->count();

        // Append importable rows to cached data (supports multi-chunk accumulation)
        $cacheKey      = "liquidation_import_{$token}";
        $existingCache = $fileCache->get($cacheKey, ['user_id' => $user->id, 'file_name' => $fileName, 'rows' => []]);
        $existingCache['rows'] = array_merge($existingCache['rows'], $importableRows);
        $fileCache->put($cacheKey, $existingCache, now()->addMinutes(self::IMPORT_TOKEN_TTL));

        return response()->json([
            'success'          => true,
            'token'            => $token,
            'rows'             => $validatedRows,
            'seen_control_nos' => $seenControlNos,
            'summary'          => [
                'total'  => count($validatedRows),
                'valid'  => $validCount,
                'errors' => $errorCount,
            ],
        ]);
    }

    /**
     * Convert a structured (named-key) row from the frontend Worker
     * back into a positional array matching the COL_* column indices,
     * so parseImportRow() can be reused unchanged.
     */
    private function structuredToRawRow(array $parsed): array
    {
        $raw = array_fill(0, 15, '');
        $raw[self::COL_SEQ]                = $parsed['seq'] ?? '';
        $raw[self::COL_PROGRAM]            = $parsed['program'] ?? '';
        $raw[self::COL_UII]                = $parsed['uii'] ?? '';
        $raw[self::COL_HEI_NAME]           = $parsed['hei_name'] ?? '';
        $raw[self::COL_DATE_FUND_RELEASED] = $parsed['date_fund_released'] ?? '';
        $raw[self::COL_DUE_DATE]           = $parsed['due_date'] ?? '';
        $raw[self::COL_ACADEMIC_YEAR]      = $parsed['academic_year'] ?? '';
        $raw[self::COL_SEMESTER]           = $parsed['semester'] ?? '';
        $raw[self::COL_BATCH_NO]           = $parsed['batch_no'] ?? '';
        $raw[self::COL_CONTROL_NO]         = $parsed['control_no'] ?? '';
        $raw[self::COL_GRANTEES]           = $parsed['grantees'] ?? '';
        $raw[self::COL_DISBURSEMENTS]      = $parsed['disbursements'] ?? '';
        $raw[self::COL_AMOUNT_LIQUIDATED]  = $parsed['amount_liquidated'] ?? '';
        $raw[self::COL_DOC_STATUS]         = $parsed['doc_status'] ?? '';
        $raw[self::COL_RC_NOTES]           = $parsed['rc_notes'] ?? '';
        return $raw;
    }

    /**
     * Bulk import liquidations using a pre-validated import token.
     *
     * The token is issued by validateImport() and holds import-ready row data
     * in the cache — no file re-upload or re-parse required.
     * Rows are inserted in chunks of IMPORT_CHUNK_SIZE to keep transactions
     * small and resilient (a failure in one chunk does not roll back others).
     */
    /**
     * Import a chunk of validated rows from the cache.
     *
     * Designed for chunked importing — the frontend calls this multiple times:
     * - First call: no batch_id → creates ImportBatch, returns batch_id.
     * - Subsequent calls: pass batch_id → appends to existing batch.
     * - Last call: pass is_last=true → logs activity & sends notification.
     *
     * Each request processes `offset` to `offset + limit` rows from the cache,
     * returns in ~1-2 seconds, and gives the frontend real progress.
     */
    public function bulkImportLiquidations(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!in_array($user->role?->name, ['Regional Coordinator', 'Admin', 'STUFAPS Focal']) && !$user->isSuperAdmin()) {
            abort(403, 'Unauthorized action.');
        }

        $token = $request->input('import_token');
        if (!$token) {
            return response()->json([
                'success' => false,
                'message' => 'Missing import token. Please re-validate your file.',
            ], 422);
        }

        $fileCache = Cache::store('file');
        $cacheKey  = "liquidation_import_{$token}";
        $cached    = $fileCache->get($cacheKey);

        if (!$cached) {
            return response()->json([
                'success' => false,
                'message' => 'Import session expired or not found. Please re-validate your file.',
            ], 422);
        }

        if ($cached['user_id'] !== $user->id) {
            abort(403, 'Import token does not belong to the current user.');
        }

        $allRows   = $cached['rows'];
        $totalRows = count($allRows);
        $offset    = (int) $request->input('offset', 0);
        $limit     = (int) $request->input('limit', 200);
        $isLast    = (bool) $request->input('is_last', false);
        $batchId   = $request->input('batch_id');

        // Slice the chunk to import
        $chunk = array_slice($allRows, $offset, $limit);

        // Create or retrieve the import batch
        if ($batchId) {
            $batch = ImportBatch::find($batchId);
            if (!$batch || $batch->user_id !== $user->id) {
                abort(403, 'Invalid batch.');
            }
        } else {
            $batch = ImportBatch::create([
                'user_id'        => $user->id,
                'file_name'      => $cached['file_name'] ?? 'unknown.xlsx',
                'total_rows'     => $totalRows,
                'imported_count' => 0,
                'status'         => 'active',
            ]);
        }

        $imported = 0;
        $errors   = [];

        DB::transaction(function () use ($chunk, $user, $batch, &$imported, &$errors) {
            foreach ($chunk as $rowData) {
                try {
                    $this->insertImportRow($rowData, $user, $batch->id);
                    $imported++;
                } catch (\Illuminate\Database\QueryException $e) {
                    $isDuplicate = ($e->errorInfo[1] ?? null) === 1062;
                    $errors[] = [
                        'row'      => $rowData['row_no'] ?? null,
                        'seq'      => $rowData['seq'] ?? null,
                        'program'  => $rowData['program_code'] ?? null,
                        'uii'      => $rowData['uii'] ?? null,
                        'hei_name' => $rowData['hei_name'] ?? '',
                        'error'    => $isDuplicate
                            ? 'Already exists — this record was likely imported in a previous batch.'
                            : 'Database error — the record could not be saved.',
                    ];
                } catch (\Exception $e) {
                    $errors[] = [
                        'row'      => $rowData['row_no'] ?? null,
                        'seq'      => $rowData['seq'] ?? null,
                        'program'  => $rowData['program_code'] ?? null,
                        'uii'      => $rowData['uii'] ?? null,
                        'hei_name' => $rowData['hei_name'] ?? '',
                        'error'    => $e->getMessage(),
                    ];
                }
            }
        });

        // Update batch count
        $batch->increment('imported_count', $imported);

        // On last chunk: clean up cache, log activity, send notification
        if ($isLast) {
            $fileCache->forget($cacheKey);

            $totalImported = $batch->fresh()->imported_count;
            if ($totalImported > 0) {
                ActivityLog::log('bulk_imported', "Bulk imported {$totalImported} liquidation(s) (batch: {$batch->id})", null, 'Liquidation');

                NotificationService::dispatch(
                    'bulk_imported',
                    "Bulk imported {$totalImported} liquidation record(s) from {$batch->file_name}",
                    null,
                    'Liquidation'
                );
            }
        }

        $errorCount = count($errors);
        return response()->json([
            'success'    => true,
            'batch_id'   => $batch->id,
            'imported'   => $imported,
            'errors'     => $errors,
            'total_rows' => $totalRows,
            'message'    => $isLast
                ? "Imported {$batch->fresh()->imported_count} liquidation(s)."
                : null,
        ]);
    }

    /**
     * Return the current progress of an in-flight validation.
     */
    public function validateProgress(Request $request): JsonResponse
    {
        $token = $request->input('token');
        if (!$token) {
            return response()->json(['found' => false], 422);
        }

        $progress = Cache::store('file')->get("validate_progress_{$token}");
        if (!$progress) {
            return response()->json(['found' => false]);
        }

        return response()->json(['found' => true, ...$progress]);
    }

    /**
     * Return the current progress of an in-flight bulk import.
     * The frontend polls this every second while the import is running.
     */
    public function importProgress(Request $request): JsonResponse
    {
        $token = $request->input('token');
        if (!$token) {
            return response()->json(['found' => false], 422);
        }

        $progress = Cache::store('file')->get("import_progress_{$token}");
        if (!$progress) {
            return response()->json(['found' => false]);
        }

        return response()->json(['found' => true, ...$progress]);
    }

    /**
     * List recent import batches for the current user.
     */
    public function importBatches(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!in_array($user->role?->name, ['Regional Coordinator', 'Admin', 'STUFAPS Focal']) && !$user->isSuperAdmin()) {
            abort(403, 'Unauthorized action.');
        }

        // Admin/Super Admin see all batches; others see only their own
        $query = ImportBatch::orderByDesc('created_at')->limit(20);
        if (!$user->isSuperAdmin() && $user->role?->name !== 'Admin') {
            $query->where('user_id', $user->id);
        }

        $batches = $query->get()
            ->map(fn (ImportBatch $b) => [
                'id'             => $b->id,
                'file_name'      => $b->file_name,
                'total_rows'     => $b->total_rows,
                'imported_count' => $b->imported_count,
                'status'         => $b->status,
                'created_at'     => $b->created_at->format('M d, Y h:i A'),
                'undone_at'      => $b->undone_at?->format('M d, Y h:i A'),
                'imported_by'    => $b->user?->name ?? 'Unknown',
            ]);

        return response()->json(['batches' => $batches]);
    }

    /**
     * Undo an entire import batch — deletes all liquidations created in that batch.
     */
    public function undoImportBatch(Request $request, string $batchId): JsonResponse
    {
        $user = $request->user();

        $batch = ImportBatch::findOrFail($batchId);

        if ($batch->user_id !== $user->id && !$user->isSuperAdmin()) {
            abort(403, 'You can only undo your own import batches.');
        }

        if ($batch->isUndone()) {
            return response()->json([
                'success' => false,
                'message' => 'This import batch has already been undone.',
            ], 422);
        }

        // Only delete liquidations still in draft-like states (not yet endorsed/reviewed)
        $deletable = Liquidation::where('import_batch_id', $batchId)
            ->whereNull('date_submitted')
            ->get();

        $skipped = Liquidation::where('import_batch_id', $batchId)
            ->whereNotNull('date_submitted')
            ->count();

        $deletedCount = 0;
        $deletedIds = [];

        foreach ($deletable->chunk(self::IMPORT_CHUNK_SIZE) as $chunk) {
            DB::transaction(function () use ($chunk, &$deletedCount, &$deletedIds) {
                foreach ($chunk as $liquidation) {
                    $deletedIds[] = $liquidation->id;
                    // Hard-delete related records and the liquidation itself
                    // (forceDelete so control numbers are freed for reuse)
                    $liquidation->financial()->forceDelete();
                    $liquidation->documents()->each(function ($doc) {
                        if (!$doc->is_gdrive && $doc->file_path) {
                            Storage::disk('s3')->delete($doc->file_path);
                        }
                        $doc->forceDelete();
                    });
                    $liquidation->forceDelete();
                    $deletedCount++;
                }
            });
        }

        // Also clean up any previously soft-deleted records from this batch
        // (left over from old undo code that used soft-delete instead of forceDelete)
        $orphaned = Liquidation::onlyTrashed()
            ->where('import_batch_id', $batchId)
            ->get();
        foreach ($orphaned as $orphan) {
            $deletedIds[] = $orphan->id;
            $orphan->financial()->forceDelete();
            $orphan->documents()->each(fn ($doc) => $doc->forceDelete());
            $orphan->forceDelete();
        }

        // Clean up notifications for deleted liquidations
        if (!empty($deletedIds)) {
            Notification::where('action', 'bulk_imported')
                ->whereIn('subject_id', $deletedIds)
                ->delete();
        }

        $batch->update([
            'status'   => 'undone',
            'undone_at' => now(),
        ]);

        ActivityLog::log(
            'undo_import_batch',
            "Undid import batch — deleted {$deletedCount} liquidation(s)" . ($skipped > 0 ? ", skipped {$skipped} already submitted" : ''),
            null,
            'Liquidation'
        );

        $message = "Undone — {$deletedCount} liquidation(s) deleted.";
        if ($skipped > 0) {
            $message .= " {$skipped} already-submitted record(s) were kept.";
        }

        return response()->json([
            'success' => true,
            'message' => $message,
            'deleted' => $deletedCount,
            'skipped' => $skipped,
        ]);
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
            'file' => 'required|file|mimes:pdf|max:10240',
        ], [
            'file.mimes' => 'Only PDF files are allowed.',
            'file.max' => 'The file size must not exceed 10MB.',
        ]);

        $file = $request->file('file');
        $fileName = time() . '_' . $file->getClientOriginalName();
        $filePath = $file->storeAs('liquidation_documents/' . $liquidation->id, $fileName, 's3');

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
    public function downloadDocument(Request $request, LiquidationDocument $document): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $liquidation = $document->liquidation;
        $user = $request->user();

        $this->authorizeView($user, $liquidation);

        if (!Storage::disk('s3')->exists($document->file_path)) {
            abort(404, 'File not found.');
        }

        return Storage::disk('s3')->download($document->file_path, $document->file_name);
    }

    /**
     * View document inline in browser.
     */
    public function viewDocument(Request $request, LiquidationDocument $document): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $liquidation = $document->liquidation;
        $user = $request->user();

        $this->authorizeView($user, $liquidation);

        if (!Storage::disk('s3')->exists($document->file_path)) {
            abort(404, 'File not found.');
        }

        return Storage::disk('s3')->response($document->file_path, $document->file_name, [
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
            Storage::disk('s3')->delete($document->file_path);
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
                Storage::disk('s3')->delete($document->file_path);
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
     * Toggle a personal pin on a liquidation for the current user.
     * Pins are per-user and have a hard cap to keep the pinned section focused.
     */
    public function togglePin(Request $request, Liquidation $liquidation): RedirectResponse
    {
        $user = $request->user();

        if (!$user->hasPermission('view_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        $this->authorizeView($user, $liquidation);

        $alreadyPinned = $user->pinnedLiquidations()
            ->where('liquidations.id', $liquidation->id)
            ->exists();

        if ($alreadyPinned) {
            $user->pinnedLiquidations()->detach($liquidation->id);

            return redirect()->back()->with('success', 'Liquidation unpinned.');
        }

        if ($user->pinnedLiquidations()->count() >= self::PIN_LIMIT) {
            return redirect()->back()->with(
                'error',
                'You can pin up to ' . self::PIN_LIMIT . ' liquidations. Unpin one before adding another.',
            );
        }

        $user->pinnedLiquidations()->attach($liquidation->id, ['pinned_at' => now()]);

        return redirect()->back()->with('success', 'Liquidation pinned.');
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

        foreach ($validated['entries'] as $sortOrder => $entryData) {
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
                'sort_order'          => $sortOrder,
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
     * Print liquidation report (Blade HTML for browser printing).
     */
    public function printReport(Request $request)
    {
        $data = $this->buildReportData($request);

        return view('reports.liquidation-print', $data);
    }

    /**
     * Build the full report dataset used by print, Excel and CSV exports.
     */
    private function buildReportData(Request $request): array
    {
        $user = $request->user();

        if (!$user->hasPermission('view_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        // Large exports can outrun default limits; raise only for this request.
        @set_time_limit(0);
        @ini_set('memory_limit', '512M');

        $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'program' => ['nullable', 'array'],
            'program.*' => ['string', 'max:64'],
            'document_status' => ['nullable', 'array'],
            'document_status.*' => ['string', 'max:64'],
            'liquidation_status' => ['nullable', 'array'],
            'liquidation_status.*' => ['string', 'max:64'],
            'academic_year' => ['nullable', 'array'],
            'academic_year.*' => ['string', 'max:64'],
            'rc_note_status' => ['nullable', 'array'],
            'rc_note_status.*' => ['string', 'max:64'],
            'region' => ['nullable', 'array'],
            'region.*' => ['string', 'max:64'],
        ]);

        $filters = $request->only(self::LISTING_FILTER_KEYS);

        // Only Admin/Super Admin can filter by region; strip for other roles.
        if (!in_array($user->role->name, self::REGION_FILTER_ROLES)) {
            unset($filters['region']);
        }

        // Get filtered records with a safety cap to prevent OOM on small instances
        $query = Liquidation::with(['hei', 'program', 'financial', 'semester', 'academicYear', 'documentStatus', 'liquidationStatus', 'rcNoteStatus'])
            ->orderBy('control_no', 'asc');

        $this->liquidationService->applyRoleAndFilters($query, $user, $filters);

        $totalMatching = (clone $query)->count();
        $truncated = $totalMatching > self::PRINT_REPORT_ROW_CAP;

        $liquidations = $query->limit(self::PRINT_REPORT_ROW_CAP)->get()->map(function ($liquidation, $index) {
            $financial = $liquidation->financial;
            $disbursements = (float) ($financial?->amount_received ?? 0);
            $liquidated = (float) ($financial?->amount_liquidated ?? 0);
            $unliquidated = $disbursements - $liquidated;

            $forEndorsement = $liquidation->rcNoteStatus?->code === 'FOR_ENDORSEMENT'
                ? $disbursements - $liquidated
                : 0;
            $percentage = $disbursements > 0
                ? round((($liquidated + $forEndorsement) / $disbursements) * 100, 2)
                : 0;

            $documentStatusDisplay = match ($liquidation->documentStatus?->code) {
                'COMPLETE' => 'Complete Submission',
                'PARTIAL' => 'Partial Submission',
                default => 'No Submission',
            };

            return [
                'program_code' => $liquidation->program?->code ?? '',
                'hei_name' => $liquidation->hei?->name ?? 'N/A',
                'control_no' => $liquidation->control_no,
                'academic_year' => $liquidation->academicYear?->name ?? '',
                'semester' => $liquidation->semester?->name ?? '',
                'batch_no' => $liquidation->batch_no ?? '',
                'date_fund_released' => $financial?->date_fund_released?->format('M d, Y') ?? '',
                'due_date' => $financial?->due_date?->format('M d, Y') ?? '',
                'number_of_grantees' => $financial?->number_of_grantees ?? 0,
                'total_disbursements' => number_format($disbursements, 2),
                'amount_liquidated' => number_format($liquidated, 2),
                'total_unliquidated' => number_format($unliquidated, 2),
                'document_status' => $documentStatusDisplay,
                'rc_notes' => $liquidation->rcNoteStatus?->name ?? '',
                'liquidation_status' => $liquidation->liquidationStatus?->name ?? 'Unliquidated',
                'percentage' => $percentage,
                'lapsing' => $financial?->lapsing_period ?? 0,
                '_raw_disbursements' => $disbursements,
                '_raw_liquidated' => $liquidated,
                '_raw_unliquidated' => $unliquidated,
            ];
        });

        // Totals and per-program summary computed on the FULL filtered query
        // (not the capped $liquidations collection) so numbers match the index card.
        $aggregates = $this->liquidationService->getReportAggregates($user, $filters);
        $totals = $aggregates['totals'];
        $programSummary = $aggregates['programSummary'];

        // Build active filter description
        $activeFilters = $this->buildFilterDescription($filters);

        // Region name for header
        $regionName = $user->region?->name ?? 'Central Office';

        return [
            'liquidations' => $liquidations,
            'totals' => $totals,
            'programSummary' => $programSummary,
            'activeFilters' => $activeFilters,
            'regionName' => $regionName,
            'printedBy' => $user->name,
            'truncated' => $truncated,
            'totalMatching' => $totalMatching,
            'rowCap' => self::PRINT_REPORT_ROW_CAP,
        ];
    }

    /**
     * Export the filtered liquidation report as an XLSX file.
     */
    public function exportExcel(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $data = $this->buildReportData($request);
        $filename = 'liquidation-report-' . now()->format('Ymd-His') . '.xlsx';

        return (new \App\Exports\LiquidationReportExporter())->stream($data, 'xlsx', $filename);
    }

    /**
     * Export the filtered liquidation report as a CSV file.
     */
    public function exportCsv(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $data = $this->buildReportData($request);
        $filename = 'liquidation-report-' . now()->format('Ymd-His') . '.csv';

        return (new \App\Exports\LiquidationReportExporter())->stream($data, 'csv', $filename);
    }

    /**
     * Build a human-readable description of active filters.
     */
    private function buildFilterDescription(array $filters): string
    {
        $parts = [];

        // Helper: normalize to array, stripping empties and 'all'
        $toArray = function ($value): array {
            if (empty($value)) return [];
            $arr = is_array($value) ? $value : [$value];
            return array_values(array_filter($arr, fn ($v) => $v !== '' && $v !== 'all'));
        };

        $programs = $toArray($filters['program'] ?? null);
        if (!empty($programs)) {
            $codes = \App\Models\Program::whereIn('id', $programs)->pluck('code', 'id');
            $names = array_map(fn ($id) => $codes[$id] ?? $id, $programs);
            $parts[] = 'Program: ' . implode(', ', $names);
        }

        $academicYears = $toArray($filters['academic_year'] ?? null);
        if (!empty($academicYears)) {
            $labels = \App\Models\AcademicYear::whereIn('id', $academicYears)->pluck('name', 'id');
            $names = array_map(fn ($id) => $labels[$id] ?? $id, $academicYears);
            $parts[] = 'AY: ' . implode(', ', $names);
        }

        $docStatuses = $toArray($filters['document_status'] ?? null);
        if (!empty($docStatuses)) {
            $labels = array_map(fn ($c) => str_replace('_', ' ', ucfirst(strtolower($c))), $docStatuses);
            $parts[] = 'Doc Status: ' . implode(', ', $labels);
        }

        $liqStatuses = $toArray($filters['liquidation_status'] ?? null);
        if (!empty($liqStatuses)) {
            $labels = array_map(fn ($c) => str_replace('_', ' ', ucfirst(strtolower($c))), $liqStatuses);
            $parts[] = 'Liq Status: ' . implode(', ', $labels);
        }

        $rcNotes = $toArray($filters['rc_note_status'] ?? null);
        if (!empty($rcNotes)) {
            $ids = array_filter($rcNotes, fn ($v) => $v !== 'none');
            $names = RcNoteStatus::whereIn('id', $ids)->pluck('name', 'id');
            $labels = array_map(
                fn ($v) => $v === 'none' ? 'None' : ($names[$v] ?? $v),
                $rcNotes
            );
            $parts[] = 'RC Notes: ' . implode(', ', $labels);
        }

        if (!empty($filters['search'])) {
            $parts[] = 'Search: "' . $filters['search'] . '"';
        }

        return implode(' | ', $parts);
    }

    /**
     * Download RC bulk liquidation template.
     */
    public function downloadRCTemplate(Request $request): \Symfony\Component\HttpFoundation\BinaryFileResponse
    {
        $user = $request->user();

        if (!in_array($user->role?->name, ['Regional Coordinator', 'Admin', 'STUFAPS Focal']) && !$user->isSuperAdmin()) {
            abort(403, 'Unauthorized action.');
        }

        $templatePath = base_path('materials/LIQUIDATION_TEMPLATE-ENTRY.xlsx');

        if (!file_exists($templatePath)) {
            abort(404, 'Template file not found.');
        }

        return response()->download(
            $templatePath,
            'LIQUIDATION_TEMPLATE-ENTRY.xlsx',
            ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
        );
    }

    /**
     * Return the next auto-generated DV control number for preview.
     */
    public function nextControlNo(Request $request): JsonResponse
    {
        $programId = $request->query('program_id');
        $year = $request->query('year') ? (int) $request->query('year') : null;

        if (!$programId) {
            return response()->json(['control_no' => '']);
        }

        $controlNo = $this->liquidationService->generateControlNo($programId, $year);

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

    private function formatLiquidationForList(Liquidation $liquidation, ?\Illuminate\Support\Collection $pinnedIds = null): array
    {
        $financial = $liquidation->financial;

        // Calculate financial values
        $totalDisbursements = (float) ($financial?->amount_received ?? 0);
        $totalLiquidated = (float) ($financial?->amount_liquidated ?? 0);
        $totalUnliquidated = $totalDisbursements - $totalLiquidated;
        // All programs: (Liquidated + For Endorsement) / Disbursed
        $forEndorsement = $liquidation->rcNoteStatus?->code === 'FOR_ENDORSEMENT'
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
            'is_pinned' => $pinnedIds?->contains($liquidation->id) ?? false,
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
     * Parse and validate a single Excel row.
     *
     * Returns display data (for the preview JSON) plus an `importable` key
     * containing pre-resolved IDs ready for DB insert — or null when invalid.
     * This single method replaces the old processImportRow + parseRowForPreview pair.
     */
    private function parseImportRow(array $row, $user, array $existingControlNos = [], $academicYearsMap = null, array $existingFingerprints = [], $heiMap = null): array
    {
        $errors = [];

        // ── Extract all raw values upfront using named column constants ───────
        $programCode      = trim($row[self::COL_PROGRAM] ?? '');
        $uii              = trim($row[self::COL_UII] ?? '');
        $heiName          = trim($row[self::COL_HEI_NAME] ?? '');
        $academicYearCode = trim($row[self::COL_ACADEMIC_YEAR] ?? '');
        $semesterRaw      = trim((string) ($row[self::COL_SEMESTER] ?? ''));
        $batchNo          = trim($row[self::COL_BATCH_NO] ?? '');
        $dvControlNo      = trim($row[self::COL_CONTROL_NO] ?? '');
        $docStatusRaw     = trim((string) ($row[self::COL_DOC_STATUS] ?? ''));
        $rcNotesRaw       = trim($row[self::COL_RC_NOTES] ?? '');
        $grantees         = $this->parseInteger($row[self::COL_GRANTEES] ?? null);
        $totalDisbursements = $this->parseAmount($row[self::COL_DISBURSEMENTS] ?? null);
        $totalLiquidated  = $this->parseAmount($row[self::COL_AMOUNT_LIQUIDATED] ?? 0);
        $dateFundReleasedRaw = trim((string) ($row[self::COL_DATE_FUND_RELEASED] ?? ''));
        $dateFundReleased = $this->parseExcelDate($row[self::COL_DATE_FUND_RELEASED] ?? null);
        $dueDateRaw       = trim((string) ($row[self::COL_DUE_DATE] ?? ''));
        $dueDate          = $this->parseExcelDate($row[self::COL_DUE_DATE] ?? null);

        // ── Required field checks ─────────────────────────────────────────────
        if (empty($programCode))      $errors[] = 'Program (col B) is required.';
        if (empty($uii))              $errors[] = 'UII (col C) is required.';
        if (empty($academicYearCode)) $errors[] = 'Academic Year (col G) is required.';
        // Semester is optional — some rows may leave it blank

        // Date of Fund Released is now optional, but if provided must be valid
        if (!empty($dateFundReleasedRaw) && !$dateFundReleased) {
            $errors[] = 'Date of Fund Released (col E) has an invalid date or year. Please use a valid date with a 4-digit year, or leave it blank.';
        }

        $disbursementsRaw = trim((string) ($row[self::COL_DISBURSEMENTS] ?? ''));
        if (empty($disbursementsRaw)) {
            $errors[] = 'Total Disbursements (col L) is required.';
        } elseif ($totalDisbursements < 0) {
            $errors[] = 'Total Disbursements (col L) cannot be negative.';
        }

        if (!empty($dueDateRaw) && !$dueDate) {
            $errors[] = 'Due Date (col F) has an invalid date or year. Please use a valid date with a 4-digit year.';
        }
        if ($dueDate && $dateFundReleased && \Carbon\Carbon::instance($dueDate)->lt(\Carbon\Carbon::instance($dateFundReleased))) {
            $errors[] = 'Due Date (col F) cannot be earlier than Date of Fund Released (col E).';
        }

        if ($totalLiquidated < 0) {
            $errors[] = 'Total Amount Liquidated (col M) cannot be negative.';
        }

        // Short-circuit when critical fields are missing — lookups would add noise
        if (!empty($errors)) {
            return $this->buildRowResult($errors, $programCode, $uii, $heiName, $dvControlNo, $dateFundReleased, $dueDate, $academicYearCode, $semesterRaw, $batchNo, $grantees, $totalDisbursements, $totalLiquidated, $docStatusRaw, $rcNotesRaw, null, null);
        }

        // ── Lookup validations ────────────────────────────────────────────────
        // Use pre-loaded HEI map when available (chunked validation), otherwise fall back
        $hei = $heiMap ? $heiMap->get(strtolower($uii)) : $this->liquidationService->findHEIByUII($uii);
        $program = !empty($programCode) ? $this->findProgram($programCode) : null;

        if (!$hei) {
            $errors[] = "UII '{$uii}' (col C) not found in the system.";
        } else {
            $heiName = $hei->name;
            $roleName = $user->role?->name;
            if ($roleName === 'Regional Coordinator' && $user->region_id && $hei->region_id !== $user->region_id) {
                $errors[] = "HEI '{$uii}' does not belong to your assigned region.";
            }
        }

        if (!$program) {
            $errors[] = "Program '{$programCode}' (col B) not found. Use a valid program code.";
        }

        $semesterId = null;
        if (!empty($semesterRaw)) {
            $semesterId = $this->liquidationService->findSemesterId($semesterRaw);
            if (!$semesterId) {
                $errors[] = "Semester '{$semesterRaw}' (col H) is invalid. Use: 1ST, 2ND, SUM, TES3A, TES3B, 1ST AND 2ND, First Semester, Second Semester, or Summer.";
            }
        }

        $academicYear = $academicYearsMap
            ? $academicYearsMap->get($academicYearCode)
            : \App\Models\AcademicYear::findByCode($academicYearCode);
        if (!$academicYear) {
            $errors[] = "Academic Year '{$academicYearCode}' (col G) not found.";
        }

        // ── Control number ────────────────────────────────────────────────────
        if (!empty($dvControlNo)) {
            // Normalise: if the value doesn't already start with the program
            // code, auto-prepend it. This handles both UniFAST-style partial
            // numbers ("2026-0001" → "TES-2026-0001") and STUFAPS-style plain
            // ledger numbers ("24094765" → "CMSP-24094765").
            if ($program) {
                $prefix = strtoupper($program->code) . '-';
                if (!str_starts_with(strtoupper($dvControlNo), $prefix)) {
                    $dvControlNo = $prefix . $dvControlNo;
                }
            }

            // Validate: only check uniqueness — format is flexible since
            // different offices use different numbering conventions.
            if (isset($existingControlNos[$dvControlNo])) {
                $errors[] = "Control / Ledger No '{$dvControlNo}' (col J) already exists.";
            }
        }

        // ── Potential duplicate check (auto control numbers only) ─────────────
        // When the control number is not provided, we cannot check for an exact
        // control_no match. Instead, detect records that share the same key
        // business identifiers — these almost certainly represent a re-import.
        if (empty($dvControlNo) && $hei && $program && $academicYear && $dateFundReleased) {
            $fundReleasedStr = \Carbon\Carbon::instance($dateFundReleased)->format('Y-m-d');
            $fingerprint = $hei->id . '|' . $program->id . '|' . $academicYear->id . '|' .
                $fundReleasedStr . '|' . ($semesterId ?? '') . '|' . ($batchNo ?? '');

            if (isset($existingFingerprints[$fingerprint])) {
                $errors[] = "A record already exists for this disbursement. This row would create a duplicate — remove it from the file.";
            }
        }

        // ── Document status ───────────────────────────────────────────────────
        $documentStatusId = null;
        if (!empty($docStatusRaw)) {
            $documentStatusId = $this->parseDocumentStatus($docStatusRaw);
            if (!$documentStatusId) {
                $errors[] = "Status of Documents '{$docStatusRaw}' (col N) is invalid. Use: COMPLETE, PARTIAL, or NONE.";
            }
        } else {
            $documentStatusId = DocumentStatus::findByCode(DocumentStatus::CODE_NONE)?->id;
        }

        // ── RC Notes ──────────────────────────────────────────────────────────
        $rcNoteStatusId = null;
        if (!empty($rcNotesRaw)) {
            $rcNoteStatusId = $this->parseRcNoteStatus($rcNotesRaw);
            if (!$rcNoteStatusId) {
                $errors[] = "RC Notes '{$rcNotesRaw}' (col O) is invalid. Use: No Submission, For Review, For Compliance, For Endorsement, Fully Endorsed, or Partially Endorsed.";
            }
        }

        // ── Auto-calculate due date when omitted ──────────────────────────────
        if (!$dueDate && $dateFundReleased && $program) {
            $fallback = $program->parent_id ? 30 : 90;
            $days     = ProgramDueDateRule::getDueDateDays(
                $program->id,
                $academicYear?->id,
                $fallback,
            );
            $dueDate = \Carbon\Carbon::instance($dateFundReleased)->copy()->addDays($days);
        }

        $valid = empty($errors);

        $importable = null;
        $liquidationStatusLabel = null;
        if ($valid) {
            // Auto-calculate liquidation status from financial amounts
            $liquidationStatus = $this->resolveImportLiquidationStatus($totalDisbursements, $totalLiquidated);
            $liquidationStatusLabel = $liquidationStatus?->name ?? 'Unliquidated';

            $importable = [
                'hei_id'                => $hei->id,
                'hei_name'              => $heiName,
                'program_id'            => $program->id,
                'academic_year_id'      => $academicYear->id,
                'semester_id'           => $semesterId,
                'batch_no'              => !empty($batchNo) ? $batchNo : null,
                'document_status_id'    => $documentStatusId,
                'rc_note_status_id'     => $rcNoteStatusId,
                'liquidation_status_id' => $liquidationStatus?->id ?? LiquidationStatus::unliquidated()?->id,
                'explicit_control_no'   => !empty($dvControlNo) ? $dvControlNo : null,
                'date_fund_released'    => $dateFundReleased
                    ? \Carbon\Carbon::instance($dateFundReleased)->format('Y-m-d')
                    : null,
                'due_date'              => $dueDate ? \Carbon\Carbon::instance($dueDate)->format('Y-m-d') : null,
                'number_of_grantees'    => $grantees,
                'amount_received'       => $totalDisbursements,
                'amount_disbursed'      => $totalDisbursements,
                'amount_liquidated'     => $totalLiquidated,
            ];
        }

        return $this->buildRowResult($errors, $programCode, $uii, $heiName, $dvControlNo, $dateFundReleased, $dueDate, $academicYearCode, $semesterRaw, $batchNo, $grantees, $totalDisbursements, $totalLiquidated, $docStatusRaw, $rcNotesRaw, $liquidationStatusLabel, $importable);
    }

    /**
     * Assemble the display+importable result array returned by parseImportRow().
     * Centralises the return shape so it can never drift between the early-return
     * path and the happy path.
     */
    private function buildRowResult(
        array $errors,
        string $programCode,
        string $uii,
        string $heiName,
        string $dvControlNo,
        ?\DateTime $dateFundReleased,
        $dueDate,
        string $academicYearCode,
        string $semesterRaw,
        string $batchNo,
        ?int $grantees,
        float $totalDisbursements,
        float $totalLiquidated,
        string $docStatusRaw,
        string $rcNotesRaw,
        ?string $liquidationStatus,
        ?array $importable
    ): array {
        return [
            'valid'               => empty($errors),
            'errors'              => $errors,
            'program'             => $programCode,
            'uii'                 => $uii,
            'hei_name'            => $heiName,
            'date_fund_released'  => $dateFundReleased
                ? \Carbon\Carbon::instance($dateFundReleased)->format('M d, Y')
                : null,
            'due_date'            => $dueDate
                ? \Carbon\Carbon::instance($dueDate)->format('M d, Y')
                : null,
            'academic_year'       => $academicYearCode,
            'semester'            => $semesterRaw,
            'batch_no'            => $batchNo,
            'control_no'          => $dvControlNo,
            'grantees'            => $grantees,
            'disbursements'       => $totalDisbursements,
            'amount_liquidated'   => $totalLiquidated,
            'doc_status'          => $docStatusRaw,
            'rc_notes'            => $rcNotesRaw,
            'liquidation_status'  => $liquidationStatus,
            'importable'          => $importable,
        ];
    }

    /**
     * Insert a single pre-validated import row into the database.
     * Must be called within a DB::transaction().
     *
     * @throws \RuntimeException if an explicit control number was taken between validate and import.
     */
    private function insertImportRow(array $data, $user, ?string $batchId = null): void
    {
        $controlNo = $data['explicit_control_no'];

        if (!$controlNo) {
            $fundYear  = !empty($data['date_fund_released'])
                ? (int) substr($data['date_fund_released'], 0, 4)
                : null;
            $controlNo = $this->liquidationService->generateControlNo($data['program_id'], $fundYear);
        } else {
            // Re-check: another import may have taken this number since validate step
            // Include soft-deleted records — MySQL unique constraint covers all rows
            if (Liquidation::withTrashed()->where('control_no', $controlNo)->lockForUpdate()->exists()) {
                throw new \RuntimeException("Control / Ledger No '{$controlNo}' was already taken. Please re-validate.");
            }
        }

        $liquidation = Liquidation::create([
            'control_no'            => $controlNo,
            'hei_id'                => $data['hei_id'],
            'program_id'            => $data['program_id'],
            'academic_year_id'      => $data['academic_year_id'],
            'semester_id'           => $data['semester_id'],
            'batch_no'              => $data['batch_no'],
            'document_status_id'    => $data['document_status_id'],
            'rc_note_status_id'     => $data['rc_note_status_id'],
            'liquidation_status_id' => $data['liquidation_status_id'],
            'created_by'            => $user->id,
            'import_batch_id'       => $batchId,
        ]);

        $liquidation->createOrUpdateFinancial([
            'date_fund_released' => $data['date_fund_released'],
            'due_date'           => $data['due_date'],
            'number_of_grantees' => $data['number_of_grantees'],
            'amount_received'    => $data['amount_received'],
            'amount_disbursed'   => $data['amount_disbursed'],
            'amount_liquidated'  => $data['amount_liquidated'],
        ]);

        // Notification is sent once per batch (not per row) to avoid 1,200+ queries during bulk import
    }

    /**
     * Determine liquidation status from financial amounts.
     */
    private function resolveImportLiquidationStatus(float $totalDisbursements, float $totalLiquidated): ?LiquidationStatus
    {
        if ($totalDisbursements > 0 && $totalLiquidated >= $totalDisbursements) {
            return LiquidationStatus::fullyLiquidated();
        }

        if ($totalLiquidated > 0) {
            return LiquidationStatus::partiallyLiquidated();
        }

        return LiquidationStatus::unliquidated();
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
                $date = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float) $value);
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
            'NO SUBMISSION'       => RcNoteStatus::CODE_NO_SUBMISSION,
            'NO_SUBMISSION'       => RcNoteStatus::CODE_NO_SUBMISSION,
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
