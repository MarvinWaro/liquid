<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Liquidation\BulkImportRequest;
use App\Http\Requests\Liquidation\EndorseToAccountingRequest;
use App\Http\Requests\Liquidation\EndorseToCOARequest;
use App\Http\Requests\Liquidation\LiquidationFinancialRules;
use App\Http\Requests\Liquidation\ReturnToHEIRequest;
use App\Http\Requests\Liquidation\ReturnToRCRequest;
use App\Http\Requests\Liquidation\StoreLiquidationRequest;
use App\Http\Requests\Liquidation\SubmitLiquidationRequest;
use App\Http\Requests\Liquidation\UpdateLiquidationRequest;
use App\Jobs\BulkImportLiquidationsJob;
use App\Models\AcademicYear;
use App\Models\ActivityLog;
use App\Models\DocumentLocation;
use App\Models\DocumentRequirement;
use App\Models\DocumentStatus;
use App\Models\HEI;
use App\Models\ImportBatch;
use App\Models\Liquidation;
use App\Models\LiquidationBeneficiary;
use App\Models\LiquidationComment;
use App\Models\LiquidationDocument;
use App\Models\LiquidationFinancial;
use App\Models\LiquidationReview;
use App\Models\LiquidationStatus;
use App\Models\Notification;
use App\Models\Program;
use App\Models\ProgramDueDateRule;
use App\Models\RcNoteStatus;
use App\Models\Region;
use App\Models\ReviewType;
use App\Models\Semester;
use App\Models\User;
use App\Services\CacheService;
use App\Services\DashboardCache;
use App\Services\LiquidationService;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LiquidationController extends Controller
{
    // ── Excel column indices (0-based) ────────────────────────────────────────
    private const COL_SEQ = 0;

    private const COL_PROGRAM = 1;

    private const COL_UII = 2;

    private const COL_HEI_NAME = 3;

    private const COL_DATE_FUND_RELEASED = 4;

    private const COL_DUE_DATE = 5;

    private const COL_ACADEMIC_YEAR = 6;

    private const COL_SEMESTER = 7;

    private const COL_BATCH_NO = 8;

    private const COL_CONTROL_NO = 9;

    private const COL_GRANTEES = 10;

    private const COL_DISBURSEMENTS = 11;

    private const COL_AMOUNT_LIQUIDATED = 12;

    private const COL_DOC_STATUS = 13;

    private const COL_RC_NOTES = 14;

    /** Rows per DB transaction during bulk import. */
    private const IMPORT_CHUNK_SIZE = 100;

    /** Import token TTL in minutes. */
    private const IMPORT_TOKEN_TTL = 30;

    /**
     * How many control numbers the undo entry lists before summarising the rest
     * as a count. Keeps an audit trail without writing a 60 KB blob into one
     * column for a 4,000-row batch; the description carries the true total.
     */
    private const UNDO_LOGGED_CONTROL_NOS = 100;

    /** How many edited control numbers the undo confirmation names before "+N more". */
    private const UNDO_PREVIEW_SAMPLES = 5;

    /** Filter keys accepted on the liquidation listing and print report. */
    private const LISTING_FILTER_KEYS = [
        'search',
        'program',
        'document_status',
        'liquidation_status',
        'academic_year',
        'rc_note_status',
        'region',
        'hei',
        'sort',
        'direction',
    ];

    /** Roles allowed to filter by region (others are implicitly scoped). */
    private const REGION_FILTER_ROLES = ['Super Admin', 'Admin'];

    /** Max liquidations a single user can pin at once. */
    private const PIN_LIMIT = 10;

    /**
     * Memoised per-request program list for import matching. See importPrograms().
     *
     * @var Collection<int, Program>|null
     */
    private ?Collection $importPrograms = null;

    public function __construct(
        private readonly LiquidationService $liquidationService,
        private readonly CacheService $cacheService
    ) {}

    /**
     * Display a listing of liquidations.
     */
    public function index(Request $request): InertiaResponse
    {
        if (! $request->user()->hasPermission('view_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        $user = $request->user();
        $filters = $request->only(self::LISTING_FILTER_KEYS);
        $includeRegionContext = $user->role->name !== 'HEI';

        // Only Admin/Super Admin can filter by region; strip for other roles to prevent privilege escalation.
        if (! in_array($user->role->name, self::REGION_FILTER_ROLES)) {
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
            'liquidations' => Inertia::defer(fn () => $this->liquidationService
                ->getPaginatedLiquidations($user, $filters)
                ->through(fn ($liquidation) => $this->formatLiquidationForList($liquidation, $pinnedIds, $includeRegionContext))
            ),

            // Pinned rows shown above the main table (page 1 only in the UI).
            // Always computed so the client can decide; cap enforced at mutation time.
            'pinnedLiquidations' => Inertia::defer(fn () => $this->liquidationService
                ->getPinnedLiquidationsForUser($user, self::PIN_LIMIT)
                ->map(fn ($liquidation) => $this->formatLiquidationForList($liquidation, $pinnedIds, $includeRegionContext))
                ->values()
            ),

            // Summary stats for the table header
            'tableSummary' => Inertia::defer(fn () => $this->liquidationService->getTableSummary($user, $filters)
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
                                || ($p->children_count > 0 && Program::where('parent_id', $p->id)
                                    ->whereIn('id', $scopedIds)->exists());
                        })->values()
                        : $allPrograms;
                }

                return $allPrograms;
            }),
            'academicYears' => AcademicYear::getDropdownOptions(),
            // The create and bulk-entry semester dropdowns used to map over a
            // hardcoded list, so anything added under Settings > Semesters never
            // appeared in them. Served from the table instead, using the same
            // helper the academic-year dropdown above already uses.
            'semesters' => Semester::getDropdownOptions(),
            'rcNoteStatuses' => RcNoteStatus::getDropdownOptions(),
            'regions' => in_array($user->role->name, self::REGION_FILTER_ROLES)
                ? Region::where('status', 'active')->orderBy('code')->get(['id', 'code', 'name'])
                : [],
            'heis' => Inertia::defer(fn () => HEI::where('status', 'active')
                ->when(
                    $user->role->name === 'Regional Coordinator' && $user->region_id,
                    fn ($q) => $q->where('region_id', $user->region_id)
                )
                ->orderBy('name')
                ->get(['id', 'name', 'uii'])
            ),
            'accountants' => Inertia::defer(fn () => User::whereHas('role', fn ($q) => $q->where('name', 'Accountant'))
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
        if (
            ! in_array($roleName, ['Regional Coordinator', 'STUFAPS Focal', 'Super Admin'])
            || ! $user->hasPermission('review_liquidation')
        ) {
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
            $this->liquidationService->applyOperationalRoleScope($query, $user);
            $ids = $query->pluck('id')->toArray();
        } else {
            $ids = $validated['liquidation_ids'];

            $accessible = Liquidation::query()->whereIn('id', $ids);
            $this->liquidationService->applyOperationalRoleScope($accessible, $user);
            $accessibleIds = $accessible->pluck('id')->all();

            if (count($accessibleIds) !== count(array_unique($ids))) {
                abort(403, 'One or more selected liquidations are outside your access scope.');
            }

            $ids = $accessibleIds;
        }

        if (empty($ids)) {
            return redirect()->route('liquidation.index')
                ->with('success', '0 liquidation(s) endorsed to Accounting successfully.');
        }

        $now = now();
        $reviewRemarks = $validated['review_remarks'] ?? null;

        $succeeded = DB::transaction(function () use ($ids, $user, $now, $reviewRemarks) {
            // Load all with financials in one query, re-verify eligibility inside transaction
            $query = Liquidation::with(['financial', 'hei:id,region_id', 'program:id,parent_id'])
                ->whereIn('id', $ids)
                ->whereNull('reviewed_at');
            $this->liquidationService->applyOperationalRoleScope($query, $user);
            $liquidations = $query->get();

            if ($liquidations->isEmpty()) {
                return 0;
            }

            $allIds = $liquidations->pluck('id')->toArray();

            // Auto-set date_submitted for any that are still null
            DB::table('liquidations')
                ->whereIn('id', $allIds)
                ->whereNull('date_submitted')
                ->update(['date_submitted' => $now]);

            // Group by resulting liquidation status
            $fullyLiquidatedId = LiquidationStatus::fullyLiquidated()?->id;
            $partiallyLiquidatedId = LiquidationStatus::partiallyLiquidated()?->id;

            $fullyIds = [];
            $partialIds = [];

            foreach ($liquidations as $liq) {
                $financial = $liq->financial;
                $disbursed = (float) ($financial?->amount_disbursed ?? 0);
                $liquidated = (float) ($financial?->amount_liquidated ?? 0);
                $pct = $disbursed > 0 ? ($liquidated / $disbursed) * 100 : 0;
                if ($pct >= 100) {
                    $fullyIds[] = $liq->id;
                } else {
                    $partialIds[] = $liq->id;
                }
            }

            // Bulk update reviewed status
            if (! empty($fullyIds)) {
                DB::table('liquidations')->whereIn('id', $fullyIds)->update([
                    'liquidation_status_id' => $fullyLiquidatedId,
                    'reviewed_by' => $user->id,
                    'reviewed_at' => $now,
                ]);
            }
            if (! empty($partialIds)) {
                DB::table('liquidations')->whereIn('id', $partialIds)->update([
                    'liquidation_status_id' => $partiallyLiquidatedId,
                    'reviewed_by' => $user->id,
                    'reviewed_at' => $now,
                ]);
            }

            // Bulk insert review remarks if provided
            if ($reviewRemarks) {
                $reviewTypeId = ReviewType::findByCode(LiquidationReview::TYPE_RC_ENDORSEMENT)?->id;
                DB::table('liquidation_reviews')->insert(
                    $liquidations->map(fn ($liq) => [
                        'id' => Str::uuid()->toString(),
                        'liquidation_id' => $liq->id,
                        'review_type_id' => $reviewTypeId,
                        'performed_by' => $user->id,
                        'performed_by_name' => $user->name,
                        'remarks' => $reviewRemarks,
                        'performed_at' => $now,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ])->toArray()
                );
            }

            // Single summary log for the bulk operation
            ActivityLog::log(
                'endorsed_to_accounting',
                'Bulk endorsed '.$liquidations->count().' liquidation(s) to Accounting',
                null,
                'Liquidation'
            );

            // Notify accountants, admins, and both operational RC regions with
            // one summary notification. Per-record notifications are skipped to avoid spam.
            $description = $user->name.' bulk endorsed '.$liquidations->count().' liquidation(s) to Accounting.';
            $recipients = User::whereHas('role', fn ($q) => $q->whereIn('name', ['Accountant', 'Admin', 'Super Admin']))
                ->where('status', 'active')
                ->where('id', '!=', $user->id)
                ->get();

            $operationalRegionIds = $liquidations
                ->filter(fn (Liquidation $liquidation) => ! $liquidation->program?->parent_id)
                ->flatMap(fn (Liquidation $liquidation) => [
                    $liquidation->hei?->region_id,
                    $liquidation->processing_region_id,
                ])
                ->filter()
                ->unique()
                ->values();

            if ($operationalRegionIds->isNotEmpty()) {
                $regionalCoordinators = User::whereHas('role', fn ($q) => $q->where('name', 'Regional Coordinator'))
                    ->whereIn('region_id', $operationalRegionIds)
                    ->where('status', 'active')
                    ->where('id', '!=', $user->id)
                    ->get();
                $recipients = $recipients->merge($regionalCoordinators)->unique('id')->values();
            }

            if ($recipients->isNotEmpty()) {
                Notification::insert(
                    $recipients->map(fn ($recipient) => [
                        'id' => Str::uuid()->toString(),
                        'user_id' => $recipient->id,
                        'actor_id' => $user->id,
                        'actor_name' => $user->name,
                        'action' => 'endorsed_to_accounting',
                        'description' => $description,
                        'module' => 'Liquidation',
                        'created_at' => $now,
                        'updated_at' => $now,
                    ])->toArray()
                );
            }

            return $liquidations->count();
        });

        return redirect()->route('liquidation.index')
            ->with('success', "{$succeeded} liquidation(s) endorsed to Accounting successfully.");
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

        if (! $user->hasPermission('create_liquidation')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        // Normalize control numbers: trim + uppercase (skip empty/null)
        $entries = $request->input('entries', []);
        foreach ($entries as &$entry) {
            if (! empty($entry['dv_control_no'])) {
                $entry['dv_control_no'] = strtoupper(trim($entry['dv_control_no']));
            } else {
                $entry['dv_control_no'] = null;
            }
        }
        unset($entry);
        $request->merge(['entries' => $entries]);

        $request->validate([
            'entries' => 'required|array|min:1|max:100',
            'entries.*.program_id' => 'required|exists:programs,id',
            'entries.*.uii' => 'required|string',
            'entries.*.dv_control_no' => 'nullable|string|max:100|distinct|unique:liquidations,control_no',
            'entries.*.date_fund_released' => 'nullable|date',
            'entries.*.due_date' => 'nullable|date',
            'entries.*.academic_year_id' => 'required|exists:academic_years,id',
            'entries.*.semester' => 'nullable|string|max:50',
            'entries.*.batch_no' => 'nullable|string|max:50',
            ...LiquidationFinancialRules::rules('entries.*.'),
            'entries.*.document_status' => 'nullable|string|in:NONE,PARTIAL,COMPLETE',
            'entries.*.rc_notes' => 'nullable|string|max:1000',
        ], [
            'entries.*.dv_control_no.distinct' => 'Control / Ledger No. in row :position is duplicated.',
            'entries.*.dv_control_no.unique' => 'Control / Ledger No. in row :position already exists in the system.',
            ...LiquidationFinancialRules::messages('entries.*.'),
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
                'message' => "Created {$imported} liquidation(s) with ".count($errors).' error(s).',
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
            $spreadsheet = IOFactory::load($file->getRealPath());

            // Try the active sheet first; if it yields no data rows, scan all sheets
            $allRows = $spreadsheet->getActiveSheet()->toArray();
            $hasDataRows = collect($allRows)->contains(fn ($row) => is_numeric(trim($row[self::COL_SEQ] ?? '')));

            if (! $hasDataRows && $spreadsheet->getSheetCount() > 1) {
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
                'message' => 'Failed to read Excel file: '.$e->getMessage(),
            ], 422);
        }

        // Pre-warm caches to avoid per-row DB queries
        $this->liquidationService->getCachedSemesters();
        $this->liquidationService->getCachedRcNoteStatuses();
        $this->cacheService->getPrograms();

        // Pre-load all reserved ledger numbers for fast duplicate checks
        $existingControlNos = $this->existingLedgerTokens();

        // Pre-load academic years keyed by code for in-memory lookup
        $academicYearsMap = AcademicYear::all()->keyBy(fn ($ay) => trim($ay->code));

        // Pre-load existing liquidation fingerprints for fast duplicate detection
        $existingFingerprints = DB::table('liquidations')
            ->join('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->select('liquidations.hei_id', 'liquidations.program_id', 'liquidations.academic_year_id',
                'liquidations.semester_id', 'liquidations.batch_no', 'liquidations.control_no',
                'liquidation_financials.date_fund_released')
            ->whereNull('liquidations.deleted_at')
            ->get()
            ->map(fn ($r) => $r->hei_id.'|'.$r->program_id.'|'.$r->academic_year_id.'|'.
                ($r->date_fund_released ?? '').'|'.($r->semester_id ?? '').'|'.($r->batch_no ?? ''))
            ->flip()
            ->all();

        // Count data rows for progress tracking
        $dataRows = array_filter($allRows, function ($row) {
            if (empty(array_filter($row, fn ($cell) => $cell !== null && $cell !== ''))) {
                return false;
            }

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

        $validatedRows = [];
        $importableRows = [];
        $seenControlNos = []; // track within-file duplicates
        $processedCount = 0;

        foreach ($allRows as $index => $row) {
            if (empty(array_filter($row, fn ($cell) => $cell !== null && $cell !== ''))) {
                continue;
            }

            $seq = trim($row[self::COL_SEQ] ?? '');
            if (! is_numeric($seq)) {
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

            $this->flagDuplicateLedgers($parsed, $seenControlNos);

            // Separate importable data from display data before sending to frontend
            $importable = $parsed['valid'] ? $parsed['importable'] : null;
            if ($importable !== null) {
                // Attach row context so import-time errors can include useful info
                $importable['row_no'] = $index + 1;
                $importable['seq'] = $seq;
                $importable['program_code'] = $parsed['program'];
                $importable['uii'] = $parsed['uii'];
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
        $fileCache->put($this->importCacheKey($token, $user->id), [
            'user_id' => $user->id,
            'file_name' => $file->getClientOriginalName(),
            'rows' => $importableRows,
        ], now()->addMinutes(self::IMPORT_TOKEN_TTL));

        return response()->json([
            'success' => true,
            'token' => $token,
            'validate_token' => $validateToken,
            'rows' => $validatedRows,
            'row_count' => count($importableRows),
            'summary' => [
                'total' => count($validatedRows),
                'valid' => $validCount,
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

        if (! in_array($user->role?->name, ['Regional Coordinator', 'Admin', 'STUFAPS Focal']) && ! $user->isSuperAdmin()) {
            abort(403, 'Unauthorized action.');
        }

        $request->validate([
            'rows' => 'required|array|min:1',
            'rows.*.seq' => 'required',
            'file_name' => 'nullable|string|max:255',
            'import_token' => 'nullable|string',
            'seen_control_nos' => 'nullable|array',
        ]);

        $inputRows = $request->input('rows');
        $fileName = $request->input('file_name', 'import.xlsx');

        // ── Resolve the cross-chunk import session ────────────────────────────
        // Chunk 1 sends no token and opens a new session; every later chunk must
        // present the token it was given and append to that same entry.
        $fileCache = Cache::store('file');
        $token = $request->input('import_token');

        if ($token !== null && $token !== '') {
            if (! Str::isUuid($token)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid import session. Please re-validate your file.',
                ], 422);
            }

            // A miss here means the session expired mid-upload. Silently starting a
            // fresh bucket would discard every chunk validated so far and let the
            // import run on a partial file — fail loudly instead.
            if (! $fileCache->has($this->importCacheKey($token, $user->id))) {
                return response()->json([
                    'success' => false,
                    'message' => 'Import session expired. Please re-validate your file.',
                ], 422);
            }
        } else {
            $token = Str::uuid()->toString();
        }

        // Pre-load all lookup data into memory (no per-row I/O)
        $this->liquidationService->getCachedSemesters();
        $this->liquidationService->getCachedRcNoteStatuses();
        $this->cacheService->getPrograms();

        $heiMap = HEI::all()->keyBy(fn ($h) => strtolower(trim($h->uii)));
        $academicYearsMap = AcademicYear::all()->keyBy(fn ($ay) => trim($ay->code));

        // Both of the lookups below used to sweep the whole liquidations table on
        // every chunk — nine full sweeps for a 4,300-row file, growing with the
        // table. They are now loaded once per session / scoped to the chunk.
        $existingControlNos = $this->sessionLedgerTokens($token, $user->id, $inputRows);
        $existingFingerprints = $this->existingFingerprints($heiMap, $inputRows);

        // Cross-chunk state: seen ledger numbers round-trip through the client
        $seenControlNos = $request->input('seen_control_nos', []);

        $validatedRows = [];
        $importableRows = [];

        foreach ($inputRows as $parsedRow) {
            $raw = $this->structuredToRawRow($parsedRow);

            $parsed = $this->parseImportRow($raw, $user, $existingControlNos, $academicYearsMap, $existingFingerprints, $heiMap);
            $parsed['row'] = (int) ($parsedRow['row'] ?? 0);
            $parsed['seq'] = (string) ($parsedRow['seq'] ?? '');

            $this->flagDuplicateLedgers($parsed, $seenControlNos);

            $importable = $parsed['valid'] ? $parsed['importable'] : null;
            if ($importable !== null) {
                $importable['row_no'] = $parsed['row'];
                $importable['seq'] = $parsed['seq'];
                $importable['program_code'] = $parsed['program'];
                $importable['uii'] = $parsed['uii'];
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
        $cacheKey = $this->importCacheKey($token, $user->id);
        $existingCache = $fileCache->get($cacheKey, ['user_id' => $user->id, 'file_name' => $fileName, 'rows' => []]);
        $existingCache['rows'] = array_merge($existingCache['rows'], $importableRows);
        $fileCache->put($cacheKey, $existingCache, now()->addMinutes(self::IMPORT_TOKEN_TTL));

        return response()->json([
            'success' => true,
            'token' => $token,
            'rows' => $validatedRows,
            'seen_control_nos' => $seenControlNos,
            // Running total held server-side. The client reconciles this against
            // the valid rows it has accumulated so a lost chunk surfaces during
            // validation rather than as a short import.
            'row_count' => count($existingCache['rows']),
            'summary' => [
                'total' => count($validatedRows),
                'valid' => $validCount,
                'errors' => $errorCount,
            ],
        ]);
    }

    /**
     * Cache key for a validated-import payload.
     *
     * Namespaced by user so two operators can never address the same entry, even
     * if a token were guessed or replayed. The ownership check at import time is
     * kept as well — this makes the collision structurally impossible rather than
     * merely detected.
     */
    private function importCacheKey(string $token, string $userId): string
    {
        return "liquidation_import_{$userId}_{$token}";
    }

    /**
     * All ledger tokens already reserved in the database, as a lookup map.
     *
     * Includes soft-deleted rows: `control_no` carries a unique index that covers
     * them, so a trashed record still owns its number and insertImportRow() will
     * reject a re-use. Validating against the same set is what keeps the preview
     * honest — anything the import can refuse is refused here first.
     *
     * Multi-ledger strings (e.g. "TDP-200910699 / TDP-200910700") are flattened to
     * individual tokens so they collide with single-ledger re-imports of the same
     * numbers. Splitting on the separators the import parser uses keeps the lookup
     * symmetric.
     *
     * @return array<string, int>
     */
    private function existingLedgerTokens(): array
    {
        return Liquidation::withTrashed()
            ->pluck('control_no')
            ->filter()
            ->flatMap(fn ($s) => preg_split(self::TOKEN_SEPARATORS, (string) $s, -1, PREG_SPLIT_NO_EMPTY) ?: [])
            ->flip()
            ->all();
    }

    /**
     * Reserved ledger tokens for a validation session, loaded at most once.
     *
     * Two savings over calling existingLedgerTokens() per chunk:
     *
     *  - Files with no Control / Ledger No column skip the query entirely. There
     *    is nothing to collide with, and pulling every control number in the
     *    database to check nothing is the common case for auto-numbered imports.
     *  - When it is needed, the flattened token map is cached beside the import
     *    rows so chunks 2..N reuse it. It is a plain string array, so it costs a
     *    fraction of what re-running the query and re-splitting every number does.
     *
     * Staleness is a non-issue: the map only ever needs to be a superset check,
     * and insertImportRow() re-verifies any explicit number under lockForUpdate().
     *
     * @param  array<int, array<string, mixed>>  $inputRows
     * @return array<string, int>
     */
    private function sessionLedgerTokens(string $token, string $userId, array $inputRows): array
    {
        $chunkHasControlNos = collect($inputRows)
            ->contains(fn ($row) => trim((string) ($row['control_no'] ?? '')) !== '');

        if (! $chunkHasControlNos) {
            return [];
        }

        return Cache::store('file')->remember(
            $this->importCacheKey($token, $userId).'_ledgers',
            now()->addMinutes(self::IMPORT_TOKEN_TTL),
            fn () => $this->existingLedgerTokens(),
        );
    }

    /**
     * Fingerprints of existing records, scoped to the HEIs present in this chunk.
     *
     * The fingerprint check only ever compares a row against records for its own
     * HEI, so joining the entire liquidations table was wasted work. A 500-row
     * chunk touches on the order of a hundred HEIs, which keeps this query flat
     * as the table grows.
     *
     * Soft-deleted records are excluded deliberately — unlike control_no there is
     * no unique index here, and a deleted record must not block a re-import.
     *
     * @param  Collection  $heiMap  uii => HEI
     * @param  array<int, array<string, mixed>>  $inputRows
     * @return array<string, int>
     */
    private function existingFingerprints($heiMap, array $inputRows): array
    {
        $heiIds = collect($inputRows)
            ->map(fn ($row) => $heiMap->get(strtolower(trim((string) ($row['uii'] ?? ''))))?->id)
            ->filter()
            ->unique()
            ->values();

        if ($heiIds->isEmpty()) {
            return [];
        }

        return DB::table('liquidations')
            ->join('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->select(
                'liquidations.hei_id', 'liquidations.program_id', 'liquidations.academic_year_id',
                'liquidations.semester_id', 'liquidations.batch_no', 'liquidations.control_no',
                'liquidation_financials.date_fund_released'
            )
            ->whereNull('liquidations.deleted_at')
            ->whereIn('liquidations.hei_id', $heiIds)
            ->get()
            ->map(fn ($r) => $r->hei_id.'|'.$r->program_id.'|'.$r->academic_year_id.'|'.
                ($r->date_fund_released ?? '').'|'.($r->semester_id ?? '').'|'.($r->batch_no ?? ''))
            ->flip()
            ->all();
    }

    /**
     * Flag a parsed row whose ledger tokens already appeared earlier in the same file.
     *
     * Checked per token so a ledger buried in a multi-ledger row still collides with
     * the same ledger appearing on its own (or in another multi-ledger row). The DB
     * check only catches existing records, not duplicates within the upload itself.
     *
     * Mutates $parsed (valid/errors) and records this row's tokens in $seenLedgers.
     * $seenLedgers carries across chunks, so callers must pass it back and forth.
     *
     * Only rows that are otherwise valid claim their tokens: an unimportable row
     * must not reserve a ledger and turn a later, importable row into a false
     * duplicate.
     *
     * @param  array<string, mixed>  $parsed
     * @param  array<string, int>  $seenLedgers  ledger token => row number first seen
     */
    private function flagDuplicateLedgers(array &$parsed, array &$seenLedgers): void
    {
        $controlNo = $parsed['control_no'] ?? '';
        if ($controlNo === '') {
            return;
        }

        $ledgers = preg_split(self::TOKEN_SEPARATORS, $controlNo, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        foreach ($ledgers as $ledger) {
            if (isset($seenLedgers[$ledger])) {
                $parsed['valid'] = false;
                $parsed['errors'][] = "Control / Ledger No '{$ledger}' (col J) appears more than once in this file (first seen at row {$seenLedgers[$ledger]}).";

                return;
            }
        }

        if (! $parsed['valid']) {
            return;
        }

        foreach ($ledgers as $ledger) {
            $seenLedgers[$ledger] = $parsed['row'];
        }
    }

    /**
     * Convert a structured (named-key) row from the frontend Worker
     * back into a positional array matching the COL_* column indices,
     * so parseImportRow() can be reused unchanged.
     */
    private function structuredToRawRow(array $parsed): array
    {
        $raw = array_fill(0, 15, '');
        $raw[self::COL_SEQ] = $parsed['seq'] ?? '';
        $raw[self::COL_PROGRAM] = $parsed['program'] ?? '';
        $raw[self::COL_UII] = $parsed['uii'] ?? '';
        $raw[self::COL_HEI_NAME] = $parsed['hei_name'] ?? '';
        $raw[self::COL_DATE_FUND_RELEASED] = $parsed['date_fund_released'] ?? '';
        $raw[self::COL_DUE_DATE] = $parsed['due_date'] ?? '';
        $raw[self::COL_ACADEMIC_YEAR] = $parsed['academic_year'] ?? '';
        $raw[self::COL_SEMESTER] = $parsed['semester'] ?? '';
        $raw[self::COL_BATCH_NO] = $parsed['batch_no'] ?? '';
        $raw[self::COL_CONTROL_NO] = $parsed['control_no'] ?? '';
        $raw[self::COL_GRANTEES] = $parsed['grantees'] ?? '';
        $raw[self::COL_DISBURSEMENTS] = $parsed['disbursements'] ?? '';
        $raw[self::COL_AMOUNT_LIQUIDATED] = $parsed['amount_liquidated'] ?? '';
        $raw[self::COL_DOC_STATUS] = $parsed['doc_status'] ?? '';
        $raw[self::COL_RC_NOTES] = $parsed['rc_notes'] ?? '';

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
     * Queue a validated import and return immediately.
     *
     * Previously the browser drove the insert with ~22 sequential requests, so a
     * refresh or a closed tab left the batch half written. Now the ImportBatch is
     * created here with status `processing`, the work is handed to
     * {@see BulkImportLiquidationsJob}, and the client polls importProgress().
     * Because progress lives on the batch row, a refresh resumes it.
     */
    public function bulkImportLiquidations(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! in_array($user->role?->name, ['Regional Coordinator', 'Admin', 'STUFAPS Focal']) && ! $user->isSuperAdmin()) {
            abort(403, 'Unauthorized action.');
        }

        $request->validate([
            'import_token' => ['nullable', 'string'],
            'expected_rows' => ['nullable', 'integer', 'min:0'],
        ]);

        $token = $request->input('import_token');
        if (! $token) {
            return response()->json([
                'success' => false,
                'message' => 'Missing import token. Please re-validate your file.',
            ], 422);
        }

        if (! Str::isUuid($token)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid import session. Please re-validate your file.',
            ], 422);
        }

        $fileCache = Cache::store('file');
        $cacheKey = $this->importCacheKey($token, $user->id);
        $cached = $fileCache->get($cacheKey);

        if (! $cached) {
            return response()->json([
                'success' => false,
                'message' => 'Import session expired or not found. Please re-validate your file.',
            ], 422);
        }

        if ($cached['user_id'] !== $user->id) {
            abort(403, 'Import token does not belong to the current user.');
        }

        $totalRows = count($cached['rows']);

        // ── Preflight: the import must match the preview the user approved ────
        // Checked before the batch is created and before any insert, so a mismatch
        // costs nothing. Without this the user approves N rows and silently gets a
        // different set — the failure mode this endpoint shipped with.
        $expectedRows = $request->input('expected_rows');
        if ($expectedRows !== null && (int) $expectedRows !== $totalRows) {
            return response()->json([
                'success' => false,
                'message' => "Import aborted — the validated data no longer matches the preview (previewed {$expectedRows} rows, found {$totalRows}). Please re-validate the file.",
            ], 422);
        }

        // One import at a time per user. Two concurrent batches would race on
        // control-number allocation and make the progress UI ambiguous.
        //
        // Reconcile first: a batch abandoned by a dead worker must not block the
        // user out of importing for good.
        $inFlight = ImportBatch::where('user_id', $user->id)
            ->where('status', ImportBatch::STATUS_PROCESSING)
            ->get()
            ->reject(fn (ImportBatch $b) => $b->reconcileIfStalled());

        if ($inFlight->isNotEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Another import is still running. Please wait for it to finish.',
            ], 422);
        }

        // The client signals that it intends to send the source Excel, so we can
        // tell "no file wanted" apart from "PHP silently dropped it" (post_max_size
        // / upload_max_filesize).
        $expectsSourceFile = $request->boolean('expects_source_file');

        // Rejecting here is safer than uploading a malicious or oversized file to S3.
        if ($request->hasFile('source_file')) {
            $request->validate([
                'source_file' => ['file', 'mimes:xlsx,xls', 'max:51200'], // 50 MB, matches BulkImportRequest
            ]);
        }

        [$sourceFilePath, $sourceFileSize, $sourceFileWarning] = $this->storeImportSourceFile($request, $user, $expectsSourceFile);

        $batch = ImportBatch::create([
            'user_id' => $user->id,
            'file_name' => $cached['file_name'] ?? 'unknown.xlsx',
            'file_path' => $sourceFilePath,
            'file_size' => $sourceFileSize,
            'total_rows' => $totalRows,
            'imported_count' => 0,
            'status' => ImportBatch::STATUS_PROCESSING,
        ]);

        BulkImportLiquidationsJob::dispatch($user->id, $token, $batch->id, $cacheKey);

        return response()->json([
            'success' => true,
            'batch_id' => $batch->id,
            'total_rows' => $totalRows,
            'source_file_warning' => $sourceFileWarning,
            'message' => "Importing {$totalRows} record(s) in the background.",
        ]);
    }

    /**
     * Persist the uploaded source Excel for audit/traceability.
     *
     * Failure degrades gracefully — the import still runs, the batch just has no
     * downloadable source. The returned warning is surfaced to the operator so a
     * misconfigured upload limit doesn't fail silently.
     *
     * @return array{0: ?string, 1: ?int, 2: ?string} [path, size, warning]
     */
    private function storeImportSourceFile(Request $request, $user, bool $expectsSourceFile): array
    {
        if ($request->hasFile('source_file')) {
            try {
                $sourceFile = $request->file('source_file');
                $timestamp = now()->format('Ymd-His');
                $rand = Str::lower(Str::random(8));
                $extension = strtolower($sourceFile->getClientOriginalExtension() ?: 'xlsx');

                // storeAs handles streams + cleanup automatically and returns
                // the stored path or false on failure.
                $stored = $sourceFile->storeAs(
                    "liquidation_imports/{$user->id}",
                    "{$timestamp}-{$rand}.{$extension}",
                    ['disk' => config('filesystems.default'), 'visibility' => 'private']
                );

                if ($stored === false) {
                    throw new \RuntimeException('Storage driver returned false for putFileAs.');
                }

                return [$stored, $sourceFile->getSize() ?: null, null];
            } catch (\Throwable $e) {
                Log::warning('Bulk import source file upload failed; proceeding without persisted source.', [
                    'user_id' => $user->id,
                    'disk' => config('filesystems.default'),
                    'error' => $e->getMessage(),
                ]);

                return [null, null, 'The original Excel file could not be saved to storage. The import will still run, but the source file will not be available for download.'];
            }
        }

        if ($expectsSourceFile) {
            // Client tried to send a file but PHP didn't receive it — usually
            // upload_max_filesize / post_max_size being smaller than the file.
            Log::warning('Bulk import source file expected but missing; check PHP upload limits.', [
                'user_id' => $user->id,
                'upload_max_filesize' => ini_get('upload_max_filesize'),
                'post_max_size' => ini_get('post_max_size'),
            ]);

            return [null, null, 'The original Excel file could not be uploaded (it may exceed the server upload size limit). The import will still run, but the source file will not be available for download.'];
        }

        return [null, null, null];
    }

    /**
     * Return the current progress of an in-flight validation.
     */
    public function validateProgress(Request $request): JsonResponse
    {
        $token = $request->input('token');
        if (! $token) {
            return response()->json(['found' => false], 422);
        }

        $progress = Cache::store('file')->get("validate_progress_{$token}");
        if (! $progress) {
            return response()->json(['found' => false]);
        }

        return response()->json(['found' => true, ...$progress]);
    }

    /**
     * Progress of a background import, read straight off the ImportBatch row.
     *
     * With no `batch_id` this returns the caller's currently-processing batch, if
     * any. That is what lets the dialog re-attach after a page refresh: the state
     * lives in the database, not in the browser.
     */
    public function importProgress(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'batch_id' => ['nullable', 'string'],
        ]);

        $query = ImportBatch::query()->where('user_id', $user->id);

        if ($batchId = $request->input('batch_id')) {
            $batch = $query->where('id', $batchId)->first();
        } else {
            $batch = $query->where('status', ImportBatch::STATUS_PROCESSING)
                ->orderByDesc('created_at')
                ->first();
        }

        if (! $batch) {
            return response()->json(['found' => false]);
        }

        // Close out a batch whose worker died, so `done` can never be permanently
        // false and the client can never poll an end that will not arrive.
        $batch->reconcileIfStalled();

        return response()->json([
            'found' => true,
            'batch_id' => $batch->id,
            'file_name' => $batch->file_name,
            'status' => $batch->status,
            'processed' => $batch->imported_count,
            'imported' => $batch->imported_count,
            'total' => $batch->total_rows,
            'percent' => $batch->progressPercent(),
            'done' => ! $batch->isProcessing(),
            'failed' => $batch->isFailed(),
            'failed_reason' => $batch->failed_reason,
        ]);
    }

    /**
     * List recent import batches for the current user.
     */
    public function importBatches(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! in_array($user->role?->name, ['Regional Coordinator', 'Admin', 'STUFAPS Focal']) && ! $user->isSuperAdmin()) {
            abort(403, 'Unauthorized action.');
        }

        $focusedBatchId = $request->input('batch_id');

        // Admin/Super Admin see all batches; others see only their own
        $scopeToUser = function ($query) use ($user) {
            if (! $user->isSuperAdmin() && $user->role?->name !== 'Admin') {
                $query->where('user_id', $user->id);
            }
        };

        $query = ImportBatch::with('user')->orderByDesc('created_at')->limit(20);
        $scopeToUser($query);

        $batches = $query->get();

        // When opened from an activity log, include the focused batch even if
        // it is older than the recent-history limit.
        if ($focusedBatchId && ! $batches->contains('id', $focusedBatchId)) {
            $focusedQuery = ImportBatch::with('user')->where('id', $focusedBatchId);
            $scopeToUser($focusedQuery);
            $focusedBatch = $focusedQuery->first();

            if ($focusedBatch) {
                $batches->prepend($focusedBatch);
            }
        }

        $batches = $batches
            ->unique('id')
            ->values()
            ->each(fn (ImportBatch $b) => $b->reconcileIfStalled())
            ->map(fn (ImportBatch $b) => [
                'id' => $b->id,
                'file_name' => $b->file_name,
                'file_size' => $b->file_size,
                'total_rows' => $b->total_rows,
                'imported_count' => $b->imported_count,
                'status' => $b->status,
                'failed_reason' => $b->failed_reason,
                // ISO 8601 with the Manila offset, formatted in the browser by
                // formatManilaDateTime. A bare format() here sent the stored UTC
                // digits as a finished string, so an import run at 3:23 PM Manila
                // was displayed as "07:23 AM" with no way to correct it client-side.
                'created_at' => $b->created_at->copy()->setTimezone('Asia/Manila')->toIso8601String(),
                'undone_at' => $b->undone_at?->copy()->setTimezone('Asia/Manila')->toIso8601String(),
                'imported_by' => $b->user?->name ?? 'Unknown',
                // Source file is removed from S3 when a batch is undone, so
                // restrict downloads to active batches with a stored path.
                'can_download' => $b->file_path !== null && $b->isActive(),
                // A batch still being written can't be reversed — the worker
                // would keep inserting rows behind the undo.
                'can_undo' => ! $b->isProcessing() && ! $b->isUndone(),
            ]);

        return response()->json(['batches' => $batches]);
    }

    /**
     * Load an import batch this user is allowed to reverse, or abort.
     *
     * Shared by the undo and its preview so the preview can never describe a batch
     * the caller would not be permitted to undo.
     */
    private function findUndoableBatchOrFail(string $batchId, User $user): ImportBatch
    {
        $batch = ImportBatch::findOrFail($batchId);

        if ($batch->user_id !== $user->id && ! $user->isSuperAdmin() && $user->role?->name !== 'Admin') {
            abort(403, 'You can only undo your own import batches.');
        }

        $this->authorizeImportBatchScope($batch, $user);

        return $batch;
    }

    /**
     * What an undo of this batch would destroy, for the confirmation step.
     *
     * Undo force-deletes permanently and only spares records with a submitted date,
     * so a record somebody has been working on is taken with the rest. The dialog
     * needs to say so before the user commits.
     *
     * Deliberately not folded into importBatches(): that lists up to 20 batches and
     * this costs several EXISTS subqueries each, which is a poor trade on a 1 GB box
     * for a button most people never press. Fetching it at confirm time also means
     * the number cannot go stale while the panel sits open.
     */
    public function undoImportBatchPreview(Request $request, string $batchId): JsonResponse
    {
        $batch = $this->findUndoableBatchOrFail($batchId, $request->user());

        // Rebuilt per use: a builder cannot be counted and then extended.
        $atRisk = fn () => Liquidation::where('import_batch_id', $batch->id)
            ->whereNull('date_submitted')
            ->touchedSinceImport();

        return response()->json([
            'deletable' => Liquidation::where('import_batch_id', $batch->id)
                ->whereNull('date_submitted')
                ->count(),
            'skipped' => Liquidation::where('import_batch_id', $batch->id)
                ->whereNotNull('date_submitted')
                ->count(),
            // Scoped to deletable rows only, so an edited record that was already
            // submitted counts as skipped rather than as something at risk.
            'modified_count' => $atRisk()->count(),
            'modified_samples' => $atRisk()
                ->orderBy('control_no')
                ->limit(self::UNDO_PREVIEW_SAMPLES)
                ->pluck('control_no')
                ->all(),
        ]);
    }

    /**
     * Undo an entire import batch — deletes all liquidations created in that batch.
     */
    public function undoImportBatch(Request $request, string $batchId): JsonResponse
    {
        $user = $request->user();

        $batch = $this->findUndoableBatchOrFail($batchId, $user);

        if ($batch->isUndone()) {
            return response()->json([
                'success' => false,
                'message' => 'This import batch has already been undone.',
            ], 422);
        }

        // Rows are still being inserted — undoing now would race the worker and
        // leave records behind that no longer belong to any reversible batch.
        // Reconcile first so a batch abandoned by a dead worker stays undoable.
        $batch->reconcileIfStalled();

        if ($batch->isProcessing()) {
            return response()->json([
                'success' => false,
                'message' => 'This import is still running. Please wait for it to finish before undoing it.',
            ], 422);
        }

        // Only delete liquidations still in draft-like states (not yet endorsed/reviewed)
        $deletable = Liquidation::where('import_batch_id', $batchId)
            ->whereNull('date_submitted')
            ->get();

        $skipped = Liquidation::where('import_batch_id', $batchId)
            ->whereNotNull('date_submitted')
            ->count();

        // Counted now, not later: the scope compares timestamps on rows that are
        // about to stop existing. Recorded on the summary entry so the audit trail
        // shows an undo took work with it, not just untouched imported rows.
        $modifiedCount = Liquidation::where('import_batch_id', $batchId)
            ->whereNull('date_submitted')
            ->touchedSinceImport()
            ->count();

        $deletedCount = 0;
        $deletedIds = [];
        $deletedControlNos = [];

        // Undo used to write one "deleted" activity entry per record, so undoing a
        // 4,000-row batch buried every other event in the log. Suppress the per-model
        // entries the way an import already does (LiquidationImportService::importChunk)
        // and let the single summary entry below stand for the whole undo.
        $previousLiquidationLogging = Liquidation::$loggingEnabled;
        $previousFinancialLogging = LiquidationFinancial::$loggingEnabled;
        $previousDocumentLogging = LiquidationDocument::$loggingEnabled;

        Liquidation::$loggingEnabled = false;
        LiquidationFinancial::$loggingEnabled = false;
        LiquidationDocument::$loggingEnabled = false;

        try {
            // Each delete also bumps the dashboard cache version through the model
            // events. Bumping it once per record costs thousands of Redis writes and
            // has the same effect as bumping it once, so collapse them into a single
            // trailing flush — which still runs if the deletion throws part-way.
            DashboardCache::withoutFlushing(function () use ($deletable, $batchId, &$deletedCount, &$deletedIds, &$deletedControlNos) {
                foreach ($deletable->chunk(self::IMPORT_CHUNK_SIZE) as $chunk) {
                    DB::transaction(function () use ($chunk, &$deletedCount, &$deletedIds, &$deletedControlNos) {
                        foreach ($chunk as $liquidation) {
                            $deletedIds[] = $liquidation->id;
                            $deletedControlNos[] = $liquidation->control_no;
                            // Hard-delete related records and the liquidation itself
                            // (forceDelete so control numbers are freed for reuse)
                            $liquidation->financial()->forceDelete();
                            $liquidation->documents()->each(function ($doc) {
                                if (! $doc->is_gdrive && $doc->file_path) {
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
                    $deletedControlNos[] = $orphan->control_no;
                    $orphan->financial()->forceDelete();
                    $orphan->documents()->each(fn ($doc) => $doc->forceDelete());
                    $orphan->forceDelete();
                }
            });
        } finally {
            // Restored even when the undo throws. Leaving these off would silence
            // activity logging for every later request this worker process handles.
            Liquidation::$loggingEnabled = $previousLiquidationLogging;
            LiquidationFinancial::$loggingEnabled = $previousFinancialLogging;
            LiquidationDocument::$loggingEnabled = $previousDocumentLogging;
        }

        // Clean up notifications for deleted liquidations
        if (! empty($deletedIds)) {
            Notification::where('action', 'bulk_imported')
                ->whereIn('subject_id', $deletedIds)
                ->delete();
        }

        // Remove the persisted source Excel from S3 — undo wipes the batch entirely
        if ($batch->file_path) {
            Storage::disk(config('filesystems.default'))->delete($batch->file_path);
        }

        $batch->update([
            'status' => 'undone',
            'undone_at' => now(),
            'file_path' => null,
            'file_size' => null,
        ]);

        $logDescription = "Undid import batch \"{$batch->file_name}\" — deleted {$deletedCount} liquidation(s)";

        if ($modifiedCount > 0) {
            $logDescription .= ", {$modifiedCount} of which had been edited since import";
        }

        if ($skipped > 0) {
            $logDescription .= ", skipped {$skipped} already submitted";
        }

        ActivityLog::log(
            'undo_import_batch',
            $logDescription,
            // Naming the batch as the subject makes the entry linkable for free:
            // subjectRouteMap already points ImportBatch at the import history, and
            // the batch row itself survives the undo.
            $batch,
            'Liquidation',
            // The per-record entries no longer exist, so the control numbers ride
            // here instead. Both sides have to be set - the log UI only offers
            // "View changes" when old and new values are both present.
            oldValues: ['Liquidations in batch' => $this->summariseControlNos($deletedControlNos)],
            newValues: ['Liquidations in batch' => "Deleted ({$deletedCount} record(s))"],
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
     * Control numbers for the undo entry, capped at UNDO_LOGGED_CONTROL_NOS.
     *
     * Undoing a large batch would otherwise write tens of thousands of characters
     * into a single column. The count in the log description stays authoritative;
     * this is the sample an auditor needs to recognise what was removed.
     *
     * @param  array<int, string|null>  $controlNos
     */
    private function summariseControlNos(array $controlNos): string
    {
        $controlNos = array_values(array_filter($controlNos));
        $total = count($controlNos);

        if ($total === 0) {
            return 'None';
        }

        $summary = implode(', ', array_slice($controlNos, 0, self::UNDO_LOGGED_CONTROL_NOS));

        if ($total > self::UNDO_LOGGED_CONTROL_NOS) {
            $summary .= ' … (+'.($total - self::UNDO_LOGGED_CONTROL_NOS).' more)';
        }

        return $summary;
    }

    /**
     * Stream the original Excel file for an import batch.
     * Restricted to internal staff (HEI users never bulk-import, so they don't need source files).
     */
    public function downloadImportBatchFile(Request $request, string $batchId)
    {
        $user = $request->user();

        $batch = ImportBatch::findOrFail($batchId);

        if (
            $user->hei_id !== null
            || ($batch->user_id !== $user->id && ! $user->isSuperAdmin() && $user->role?->name !== 'Admin')
        ) {
            abort(403, 'Unauthorized action.');
        }

        $this->authorizeImportBatchScope($batch, $user);

        if (! $batch->file_path) {
            abort(404, 'Source file is not available for this import batch.');
        }

        $disk = Storage::disk(config('filesystems.default'));
        if (! $disk->exists($batch->file_path)) {
            abort(404, 'Source file no longer exists.');
        }

        return $disk->download($batch->file_path, $batch->file_name);
    }

    /**
     * Display liquidation details page.
     */
    public function show(Request $request, Liquidation $liquidation): InertiaResponse
    {
        $user = $request->user();

        if (! $user->hasPermission('view_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        $this->authorizeView($user, $liquidation);

        // Eager-load only what's needed for the initial paint (header, details, workflow)
        $liquidation->load([
            'hei.region', 'processingRegion', 'program', 'semester', 'academicYear', 'financial',
            'reviewer', 'reviews.reviewType',
            'transmittal.endorser', 'transmittal.location',
            'compliance.complianceStatus',
            'documentStatus', 'liquidationStatus', 'creator',
            'importBatch.user',
        ]);

        $operationalRegionIds = collect([
            $liquidation->hei?->region_id,
            $liquidation->processing_region_id,
        ])->filter()->unique()->values()->all();
        $isHEIUser = $user->role->name === 'HEI';
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
                : $this->cacheService->getRegionalCoordinators($operationalRegionIds),
            'accountants' => $this->cacheService->getAccountants(),
            'documentLocations' => $this->documentLocationOptions($liquidation),
            'permissions' => [
                'review' => $user->can('review', $liquidation),
                'submit' => $isHEIUser,
                'edit' => $user->can('edit', $liquidation),
            ],
            'userRole' => $user->role->name,
            'isStufapsProgram' => (bool) $liquidation->program?->parent_id,

            // Deferred props — load after initial page paint for instant navigation
            'documentRequirements' => Inertia::defer(fn () => $requirements),
            'commentCounts' => Inertia::defer(fn () => LiquidationComment::where('liquidation_id', $liquidation->id)
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
        Gate::authorize('uploadDocument', $liquidation);

        $requirementId = $request->input('document_requirement_id');

        if ($requirementId) {
            // HEI requirement upload — enforce 1:1 per requirement
            $requirement = DocumentRequirement::where('id', $requirementId)
                ->where('program_id', $liquidation->program_id)
                ->where('is_active', true)
                ->first();

            if (! $requirement) {
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
        $fileName = time().'_'.$file->getClientOriginalName();
        $filePath = $file->storeAs('liquidation_documents/'.$liquidation->id, $fileName, 's3');

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

        // Names the requirement as well as the file. File names repeat — the same
        // scan uploaded against two requirements produced two identical entries,
        // so a reviewer had to open the record to tell them apart. $documentType
        // is the requirement's own name, already resolved above.
        // An RC letter is the branch with no requirement behind it, and it lives in
        // its own card rather than under Document Requirements. It gets its own
        // action so a notification about it can deep-link to that card — sharing
        // 'uploaded_document' sent the HEI to the requirements list instead.
        ActivityLog::log(
            $requirementId ? 'uploaded_document' : 'uploaded_rc_letter',
            'Uploaded '.$file->getClientOriginalName().' for '.$documentType.' in liquidation '.$liquidation->control_no,
            $liquidation,
            'Liquidation',
        );

        return response()->json(['message' => 'Document uploaded successfully.', 'success' => true]);
    }

    /**
     * Store Google Drive link for liquidation.
     */
    public function storeGdriveLink(Request $request, Liquidation $liquidation): JsonResponse
    {
        Gate::authorize('uploadDocument', $liquidation);

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

        if (! $requirement) {
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

        // Names the requirement so several links added to one liquidation are
        // tellable apart. Without it a reviewer saw the same sentence repeated
        // once per upload and had to open the record to find out what arrived —
        // the PDF path already named its file, this one did not.
        ActivityLog::log(
            'added_gdrive_link',
            'Added Google Drive link for '.$requirement->name.' in liquidation '.$liquidation->control_no,
            $liquidation,
            'Liquidation',
        );

        return response()->json(['message' => 'Google Drive link added successfully.', 'success' => true]);
    }

    /**
     * Download document.
     */
    public function downloadDocument(Request $request, LiquidationDocument $document): StreamedResponse
    {
        $liquidation = $document->liquidation;
        $user = $request->user();

        $this->authorizeView($user, $liquidation);

        if (! Storage::disk('s3')->exists($document->file_path)) {
            abort(404, 'File not found.');
        }

        return Storage::disk('s3')->download($document->file_path, $document->file_name);
    }

    /**
     * View document inline in browser.
     */
    public function viewDocument(Request $request, LiquidationDocument $document): StreamedResponse
    {
        $liquidation = $document->liquidation;
        $user = $request->user();

        $this->authorizeView($user, $liquidation);

        if (! Storage::disk('s3')->exists($document->file_path)) {
            abort(404, 'File not found.');
        }

        return Storage::disk('s3')->response($document->file_path, $document->file_name, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$document->file_name.'"',

            // The preview dialog frames this URL, and the app-wide default is
            // X-Frame-Options: DENY, which would refuse even our own page. Set
            // here so SecurityHeaders leaves it alone (it passes $replace = false).
            // SAMEORIGIN still shuts out every other site, and what is exposed is
            // a PDF byte stream rather than an interactive page — there are no
            // controls here for a clickjacker to trick anyone into pressing.
            'X-Frame-Options' => 'SAMEORIGIN',
        ]);
    }

    /**
     * Delete document.
     */
    public function deleteDocument(Request $request, LiquidationDocument $document): RedirectResponse
    {
        $liquidation = $document->liquidation;
        $user = $request->user();

        Gate::authorize('uploadDocument', $liquidation);

        if ($user->role->name === 'HEI') {
            if ($document->uploaded_by !== $user->id && $liquidation->created_by !== $user->id) {
                abort(403, 'You cannot delete this document.');
            }
        }

        if (! $document->is_gdrive && $document->file_path) {
            Storage::disk('s3')->delete($document->file_path);
        }

        // Captured before the delete. document_type carries the requirement name,
        // which matters most for Drive links: those are stored with the literal
        // file_name "Google Drive Link", so the old message named nothing at all.
        $documentName = $document->file_name;
        $documentType = $document->document_type;
        // Captured before the delete too: it decides which section the resulting
        // notification points at, the same split as the upload above.
        $wasRequirementDocument = (bool) $document->document_requirement_id;
        $document->delete();

        ActivityLog::log(
            $wasRequirementDocument ? 'deleted_document' : 'deleted_rc_letter',
            'Deleted '.$documentName.' for '.$documentType.' from liquidation '.$liquidation->control_no,
            $liquidation,
            'Liquidation',
        );

        return redirect()->back()->with('success', 'Document deleted successfully.');
    }

    /**
     * Remove the specified liquidation.
     */
    public function destroy(Request $request, Liquidation $liquidation): RedirectResponse
    {
        if (! $request->user()->hasPermission('delete_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        Gate::authorize('view', $liquidation);

        foreach ($liquidation->documents as $document) {
            if (! $document->is_gdrive && $document->file_path) {
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
        if (! $request->user()->hasPermission('delete_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        Gate::authorize('view', $liquidation);

        if ($liquidation->isVoided()) {
            return redirect()->back()->with('error', 'This liquidation is already voided.');
        }

        $liquidation->update([
            'liquidation_status_id' => LiquidationStatus::voided()?->id,
        ]);

        ActivityLog::log('voided_liquidation', 'Voided liquidation '.$liquidation->control_no, $liquidation, 'Liquidation');

        return redirect()->back()->with('success', 'Liquidation has been voided.');
    }

    /**
     * Restore a voided liquidation back to Unliquidated status.
     */
    public function restore(Request $request, Liquidation $liquidation): RedirectResponse
    {
        if (! $request->user()->hasPermission('delete_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        Gate::authorize('view', $liquidation);

        if (! $liquidation->isVoided()) {
            return redirect()->back()->with('error', 'This liquidation is not voided.');
        }

        $liquidation->update([
            'liquidation_status_id' => LiquidationStatus::unliquidated()?->id,
        ]);

        ActivityLog::log('restored_liquidation', 'Restored voided liquidation '.$liquidation->control_no, $liquidation, 'Liquidation');

        return redirect()->back()->with('success', 'Liquidation has been restored.');
    }

    /**
     * Toggle a personal pin on a liquidation for the current user.
     * Pins are per-user and have a hard cap to keep the pinned section focused.
     */
    public function togglePin(Request $request, Liquidation $liquidation): RedirectResponse
    {
        $user = $request->user();

        if (! $user->hasPermission('view_liquidation')) {
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
                'You can pin up to '.self::PIN_LIMIT.' liquidations. Unpin one before adding another.',
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

        Gate::authorize('manageInternalData', $liquidation);

        $validated = $request->validate([
            'entries' => 'required|array',
            'entries.*.id' => 'nullable|string',
            'entries.*.document_status' => 'required|string',
            'entries.*.received_by' => 'nullable|string|max:255',
            'entries.*.date_received' => 'nullable|date',
            'entries.*.document_location' => 'nullable|string|max:255',
            'entries.*.reviewed_by' => 'nullable|string|max:255',
            'entries.*.date_reviewed' => 'nullable|date',
            'entries.*.rc_note' => 'nullable|string|max:255',
            'entries.*.date_endorsement' => 'nullable|date',
            'entries.*.liquidation_status' => 'required|string',
            'expected_updated_at' => 'nullable|string',
        ]);

        // Optimistic locking: reject save if another user modified the record
        if (! empty($validated['expected_updated_at'])) {
            $expected = Carbon::parse($validated['expected_updated_at']);
            if ($liquidation->updated_at->ne($expected)) {
                return back()->withErrors([
                    'conflict' => 'This record was modified by another user. Please refresh the page to see the latest data.',
                ]);
            }
        }

        // Pre-load lookup maps (name → id) to avoid N+1 on each iteration
        $docStatusMap = DocumentStatus::pluck('id', 'name')->toArray();
        $liqStatusMap = LiquidationStatus::pluck('id', 'name')->toArray();
        $locationMap = DocumentLocation::pluck('id', 'name')->toArray();

        $noneId = DocumentStatus::where('code', DocumentStatus::CODE_NONE)->value('id');
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
        $toDelete = array_diff($existingIds, $incomingIds);
        if (! empty($toDelete)) {
            $liquidation->trackingEntries()->whereIn('id', $toDelete)->delete();
        }

        // Upsert entries and sync location pivot
        $latestDocStatusId = $noneId;
        $latestLiqStatusId = $unliquidatedId;

        foreach ($validated['entries'] as $sortOrder => $entryData) {
            $docStatusId = $docStatusMap[$entryData['document_status']] ?? $noneId;
            $liqStatusId = $liqStatusMap[$entryData['liquidation_status']] ?? $unliquidatedId;

            $data = [
                'liquidation_id' => $liquidation->id,
                'document_status_id' => $docStatusId,
                'received_by' => $entryData['received_by'] ?? null,
                'date_received' => $entryData['date_received'] ?? null,
                'reviewed_by' => $entryData['reviewed_by'] ?? null,
                'date_reviewed' => $entryData['date_reviewed'] ?? null,
                'rc_note' => $entryData['rc_note'] ?? null,
                'date_endorsement' => $entryData['date_endorsement'] ?? null,
                'liquidation_status_id' => $liqStatusId,
                'sort_order' => $sortOrder,
            ];

            if (! empty($entryData['id'])) {
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
                    if (! isset($locationMap[$name])) {
                        $newLocation = DocumentLocation::create(['name' => $name, 'sort_order' => 999]);
                        $locationMap[$name] = $newLocation->id;
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
        if (! empty($lastEntry['rc_note'])) {
            $latestRcNote = RcNoteStatus::findByCode(
                strtoupper(str_replace(' ', '_', $lastEntry['rc_note']))
            )?->id;
        }

        // Sync the latest entry's statuses up to the liquidation record
        $liquidation->update([
            'document_status_id' => $latestDocStatusId,
            'liquidation_status_id' => $latestLiqStatusId,
            'rc_note_status_id' => $latestRcNote,
        ]);

        // Detect which fields changed by comparing incoming request data against old snapshot
        $trackingFieldMap = [
            'document_status' => ['label' => 'Status of Documents',   'db_field' => 'document_status_id',   'lookup' => $docStatusMap, 'fallback' => $noneId],
            'received_by' => ['label' => 'Received by',           'db_field' => 'received_by'],
            'date_received' => ['label' => 'Date Received',         'db_field' => 'date_received'],
            'document_location' => ['label' => 'Document Location'],
            'reviewed_by' => ['label' => 'Reviewed by',           'db_field' => 'reviewed_by'],
            'date_reviewed' => ['label' => 'Date Reviewed',         'db_field' => 'date_reviewed'],
            'rc_note' => ['label' => 'RC Note',               'db_field' => 'rc_note'],
            'date_endorsement' => ['label' => 'Date of Endorsement',   'db_field' => 'date_endorsement'],
            'liquidation_status' => ['label' => 'Status of Liquidation', 'db_field' => 'liquidation_status_id', 'lookup' => $liqStatusMap, 'fallback' => $unliquidatedId],
        ];

        $changedFields = [];

        foreach ($validated['entries'] as $entryData) {
            $entryId = $entryData['id'] ?? null;

            if (! $entryId || ! isset($oldEntries[$entryId])) {
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

                // For lookup fields (status name → UUID), resolve incoming name to UUID.
                // The fallback has to match what the upsert above actually wrote: an
                // unrecognised name is stored as $noneId / $unliquidatedId, so comparing
                // it against '' would report a change on every save even when the row
                // never moved — and notify the HEI for it.
                if (isset($config['lookup'])) {
                    $incomingValue = (string) ($config['lookup'][$incomingValue] ?? $config['fallback'] ?? '');
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
        if (! empty(array_diff($oldIds, $keptIds))) {
            $changedFields[] = 'Removed entry';
        }

        $changedFields = array_values(array_unique($changedFields));

        // Nothing actually moved, so there is nothing to announce. ActivityLog::log()
        // is what dispatches the HEI notification, so skipping it here stops both the
        // phantom log line ("Updated document tracking" when nothing was) and the
        // notification that used to fire every time someone pressed Save out of habit.
        if (empty($changedFields)) {
            return redirect()->back()->with('info', 'No changes to save.');
        }

        $fieldSummary = ' ('.implode(', ', $changedFields).')';

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

        Gate::authorize('manageInternalData', $liquidation);

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
        if (! empty($validated['expected_updated_at'])) {
            $expected = Carbon::parse($validated['expected_updated_at']);
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
        if (! empty($toDelete)) {
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

            if (! empty($entryData['id'])) {
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
            'grantees_liquidated' => 'No. of Grantees Liquidated',
            'amount_complete_docs' => 'Amt w/ Complete Docs',
            'amount_refunded' => 'Amt Refunded',
            'refund_or_no' => 'Refund OR No.',
            'total_amount_liquidated' => 'Total Amt Liquidated',
            'transmittal_ref_no' => 'Transmittal Ref No.',
            'group_transmittal_ref_no' => 'Group Transmittal Ref No.',
        ];

        $changedRunningFields = [];

        foreach ($validated['entries'] as $entryData) {
            $entryId = $entryData['id'] ?? null;

            if (! $entryId || ! isset($oldRunningEntries[$entryId])) {
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
        if (! empty($deletedRunningIds)) {
            $changedRunningFields[] = 'Removed entry';
        }

        $changedRunningFields = array_values(array_unique($changedRunningFields));

        // Same rule as document tracking above: no change, no log, no notification.
        if (empty($changedRunningFields)) {
            return redirect()->back()->with('info', 'No changes to save.');
        }

        $runningFieldSummary = ' ('.implode(', ', $changedRunningFields).')';

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

        Gate::authorize('edit', $liquidation);

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
        LiquidationBeneficiary::$loggingEnabled = false;

        try {
            $spreadsheet = IOFactory::load($file->getRealPath());
            $rows = $spreadsheet->getActiveSheet()->toArray();
            array_shift($rows);

            foreach ($rows as $index => $row) {
                if (empty(array_filter($row, fn ($cell) => $cell !== null && $cell !== ''))) {
                    continue;
                }

                try {
                    LiquidationBeneficiary::create([
                        'liquidation_id' => $liquidation->id,
                        'student_no' => trim($row[0] ?? ''),
                        'last_name' => trim($row[1] ?? ''),
                        'first_name' => trim($row[2] ?? ''),
                        'middle_name' => ! empty(trim($row[3] ?? '')) ? trim($row[3]) : null,
                        'extension_name' => ! empty(trim($row[4] ?? '')) ? trim($row[4]) : null,
                        'award_no' => trim($row[5] ?? ''),
                        'date_disbursed' => $this->parseExcelDate($row[6] ?? null),
                        'amount' => $this->parseAmount($row[7] ?? 0),
                        'remarks' => ! empty(trim($row[8] ?? '')) ? trim($row[8]) : null,
                    ]);
                    $imported++;
                } catch (\Exception $e) {
                    $errors[] = 'Row '.($index + 2).': '.$e->getMessage();
                }
            }
        } catch (\Exception $e) {
            return redirect()->back()->with('error', 'Failed to read Excel file: '.$e->getMessage());
        }

        // Recalculate the total inside a transaction with a lock so two concurrent
        // imports cannot both read a stale sum and overwrite each other's work.
        DB::transaction(function () use ($liquidation) {
            Liquidation::lockForUpdate()->findOrFail($liquidation->id);
            $totalDisbursed = $liquidation->beneficiaries()->sum('amount');
            $liquidation->createOrUpdateFinancial(['amount_liquidated' => $totalDisbursed]);
        });

        // Re-enable per-record logging
        LiquidationBeneficiary::$loggingEnabled = true;

        if ($imported > 0) {
            ActivityLog::log('imported_beneficiaries', 'Imported '.$imported.' beneficiaries for liquidation '.$liquidation->control_no, $liquidation, 'Liquidation');
        }

        $message = count($errors) > 0
            ? "Imported {$imported} beneficiaries with ".count($errors).' errors.'
            : "Successfully imported {$imported} beneficiaries.";

        return redirect()->back()->with(count($errors) > 0 ? 'error' : 'success', $message);
    }

    /**
     * Download beneficiary template Excel file.
     */
    public function downloadBeneficiaryTemplate(Request $request, Liquidation $liquidation): BinaryFileResponse
    {
        if (! $request->user()->hasPermission('view_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        Gate::authorize('view', $liquidation);

        $templatePath = base_path('materials/template-for-hei.xlsx');

        if (! file_exists($templatePath)) {
            abort(404, 'Template file not found.');
        }

        return response()->download($templatePath, 'BENEFICIARIES TEMPLATE.xlsx');
    }

    /**
     * Download RC bulk liquidation template.
     */
    public function downloadRCTemplate(Request $request): BinaryFileResponse
    {
        $user = $request->user();

        if (! in_array($user->role?->name, ['Regional Coordinator', 'Admin', 'STUFAPS Focal']) && ! $user->isSuperAdmin()) {
            abort(403, 'Unauthorized action.');
        }

        $templatePath = base_path('materials/LIQUIDATION_TEMPLATE-ENTRY.xlsx');

        if (! file_exists($templatePath)) {
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

        if (! $programId) {
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

        if (! $hei) {
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
        Gate::forUser($user)->authorize('view', $liquidation);
    }

    private function authorizeImportBatchScope(ImportBatch $batch, User $user): void
    {
        if ($user->isSuperAdmin() || $user->role?->name === 'Admin') {
            return;
        }

        $allRows = Liquidation::withTrashed()->where('import_batch_id', $batch->id)->count();
        if ($allRows === 0) {
            return;
        }

        $accessibleRows = Liquidation::withTrashed()->where('import_batch_id', $batch->id);
        $this->liquidationService->applyOperationalRoleScope($accessibleRows, $user);

        if ($accessibleRows->count() !== $allRows) {
            abort(403, 'This import batch contains liquidations outside your access scope.');
        }
    }

    private function formatLiquidationForList(
        Liquidation $liquidation,
        ?Collection $pinnedIds = null,
        bool $includeRegionContext = false,
    ): array {
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

        $result = [
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

        $regionContext = $includeRegionContext ? $this->formatRegionContext($liquidation) : null;
        if ($regionContext !== null) {
            $result['region_context'] = $regionContext;
        }

        return $result;
    }

    private function cleanRcNotes(?string $remarks): ?string
    {
        if (! $remarks) {
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

    /**
     * Serialize a timestamp for the frontend as an ISO 8601 string carrying the
     * Asia/Manila offset (e.g. "2026-08-04T13:30:00+08:00").
     *
     * A bare 'Y-m-d H:i:s' has no timezone marker, so the browser reads the digits
     * as its own local time and the value lands hours off. Matching the ISO format
     * already used for announcements keeps every timestamp unambiguous.
     */
    private function toManilaIso(?CarbonInterface $value): ?string
    {
        return $value?->copy()->setTimezone('Asia/Manila')->toIso8601String();
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
            ->filter(fn ($r) => in_array($r->reviewType?->code, [LiquidationReview::TYPE_RC_RETURN, LiquidationReview::TYPE_HEI_RESUBMISSION]))
            ->map(fn ($review) => $this->formatReviewHistoryItem($review))
            ->values()
            ->toArray();

        $accountantReviewHistory = $liquidation->reviews
            ->filter(fn ($r) => $r->reviewType?->code === LiquidationReview::TYPE_ACCOUNTANT_RETURN)
            ->map(fn ($review) => [
                'returned_at' => $review->performed_at->toIso8601String(),
                'returned_by' => $review->performed_by_name,
                'returned_by_id' => $review->performed_by,
                'accountant_remarks' => $review->remarks,
            ])
            ->values()
            ->toArray();

        $details = [
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
            'reviewed_at' => $this->toManilaIso($liquidation->reviewed_at) ?? $this->toManilaIso($transmittal?->endorsed_at),
            'date_fund_released' => $financial?->date_fund_released?->format('Y-m-d'),
            'due_date' => $financial?->due_date?->format('Y-m-d'),
            'fund_source' => $financial?->fund_source,
            'number_of_grantees' => $financial?->number_of_grantees,
            'ledger_breakdown' => $financial?->ledger_breakdown,
            'amount_liquidated' => $financial?->amount_liquidated ?? 0,
            'lapsing_period' => $financial?->lapsing_period ?? 0,
            'document_status' => $liquidation->documentStatus?->name ?? 'N/A',
            'liquidation_status' => $liquidation->liquidationStatus?->name ?? 'Unliquidated',
            'date_submitted' => $this->toManilaIso($liquidation->date_submitted),
            'coa_endorsed_at' => $this->toManilaIso($liquidation->coa_endorsed_at),
            'accountant_reviewed_by_name' => $liquidation->accountantReviewer?->name,
            'accountant_reviewed_at' => $this->toManilaIso($liquidation->accountant_reviewed_at),
            'rc_endorsement_remarks' => $liquidation->getRcEndorsementRemarks(),
            'accountant_endorsement_remarks' => $liquidation->getAccountantEndorsementRemarks(),
            'updated_at' => $liquidation->updated_at?->toIso8601String(),
            'created_by_name' => $liquidation->creator?->name,
            'import_batch' => $liquidation->importBatch ? [
                'id' => $liquidation->importBatch->id,
                'file_name' => $liquidation->importBatch->file_name,
                'file_size' => $liquidation->importBatch->file_size,
                'imported_by' => $liquidation->importBatch->user?->name,
                'imported_at' => $liquidation->importBatch->created_at?->toIso8601String(),
                'is_undone' => $liquidation->importBatch->isUndone(),
                'can_download' => $liquidation->importBatch->file_path !== null && ! $isHEIUser,
            ] : null,
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
                    'uploaded_at' => $this->toManilaIso($doc->created_at),
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
                'id' => $entry->id,
                'document_status' => $entry->documentStatus?->name ?? 'No Submission',
                'received_by' => $entry->received_by,
                'date_received' => $entry->date_received?->format('Y-m-d'),
                'document_location' => $entry->locations->pluck('name')->implode(','),
                'reviewed_by' => $entry->reviewed_by,
                'date_reviewed' => $entry->date_reviewed?->format('Y-m-d'),
                'rc_note' => $entry->rc_note,
                'date_endorsement' => $entry->date_endorsement?->format('Y-m-d'),
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

        if (! $isHEIUser) {
            $regionContext = $this->formatRegionContext($liquidation);
            if ($regionContext !== null) {
                $details['region_context'] = $regionContext;
            }
        }

        return $details;
    }

    private function formatRegionContext(Liquidation $liquidation): ?array
    {
        $currentRegion = $liquidation->hei?->region;
        $processingRegion = $liquidation->processingRegion;

        if (! $currentRegion || ! $processingRegion || $currentRegion->id === $processingRegion->id) {
            return null;
        }

        return [
            'current_region' => [
                'id' => $currentRegion->id,
                'code' => $currentRegion->code,
                'name' => $currentRegion->name,
            ],
            'processing_region' => [
                'id' => $processingRegion->id,
                'code' => $processingRegion->code,
                'name' => $processingRegion->name,
            ],
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
        if (! $hei) {
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
        $programCode = trim($row[self::COL_PROGRAM] ?? '');
        $uii = trim($row[self::COL_UII] ?? '');
        $heiName = trim($row[self::COL_HEI_NAME] ?? '');
        $academicYearCode = trim($row[self::COL_ACADEMIC_YEAR] ?? '');
        $semesterRaw = trim((string) ($row[self::COL_SEMESTER] ?? ''));
        $batchNo = trim($row[self::COL_BATCH_NO] ?? '');
        $dvControlNo = trim($row[self::COL_CONTROL_NO] ?? '');
        $docStatusRaw = trim((string) ($row[self::COL_DOC_STATUS] ?? ''));
        $rcNotesRaw = trim($row[self::COL_RC_NOTES] ?? '');

        // Grantees may be multi-line in legacy STUFAPS rows (one count per ledger).
        // Capture the per-token list AND the sum so we can build a breakdown later.
        $granteesTokens = $this->parseGranteesTokens($row[self::COL_GRANTEES] ?? null);
        $grantees = ! empty($granteesTokens) ? array_sum($granteesTokens) : null;

        $totalDisbursements = $this->parseAmount($row[self::COL_DISBURSEMENTS] ?? null);
        $totalLiquidated = $this->parseAmount($row[self::COL_AMOUNT_LIQUIDATED] ?? 0);
        $dateFundReleasedRaw = trim((string) ($row[self::COL_DATE_FUND_RELEASED] ?? ''));
        $dateFundReleased = $this->parseExcelDate($row[self::COL_DATE_FUND_RELEASED] ?? null);
        $dueDateRaw = trim((string) ($row[self::COL_DUE_DATE] ?? ''));
        $dueDate = $this->parseExcelDate($row[self::COL_DUE_DATE] ?? null);

        // ── Required field checks ─────────────────────────────────────────────
        if (empty($programCode)) {
            $errors[] = 'Program (col B) is required.';
        }
        if (empty($uii)) {
            $errors[] = 'UII (col C) is required.';
        }
        if (empty($academicYearCode)) {
            $errors[] = 'Academic Year (col G) is required.';
        }
        // Semester is optional — some rows may leave it blank

        // Date of Fund Released is now optional, but if provided must be valid
        if (! empty($dateFundReleasedRaw) && ! $dateFundReleased) {
            $errors[] = 'Date of Fund Released (col E) has an invalid date or year. Please use a valid date with a 4-digit year, or leave it blank.';
        }

        $disbursementsRaw = trim((string) ($row[self::COL_DISBURSEMENTS] ?? ''));
        if (empty($disbursementsRaw)) {
            $errors[] = 'Total Disbursements (col L) is required.';
        } elseif ($totalDisbursements < 0) {
            $errors[] = 'Total Disbursements (col L) cannot be negative.';
        }

        if (! empty($dueDateRaw) && ! $dueDate) {
            $errors[] = 'Due Date (col F) has an invalid date or year. Please use a valid date with a 4-digit year.';
        }
        if ($dueDate && $dateFundReleased && Carbon::instance($dueDate)->lt(Carbon::instance($dateFundReleased))) {
            $errors[] = 'Due Date (col F) cannot be earlier than Date of Fund Released (col E).';
        }

        if ($totalLiquidated < 0) {
            $errors[] = 'Total Amount Liquidated (col M) cannot be negative.';
        }

        // Over-liquidating leaves amount_received - amount_liquidated negative, and that
        // difference is summed into the table and dashboard totals.
        if ($totalLiquidated > $totalDisbursements) {
            $errors[] = 'Total Amount Liquidated (col M) cannot be more than Total Disbursements (col L).';
        }

        // Short-circuit when critical fields are missing — lookups would add noise
        if (! empty($errors)) {
            return $this->buildRowResult($errors, $programCode, $uii, $heiName, $dvControlNo, $dateFundReleased, $dueDate, $academicYearCode, $semesterRaw, $batchNo, $grantees, $totalDisbursements, $totalLiquidated, $docStatusRaw, $rcNotesRaw, null, null);
        }

        // ── Lookup validations ────────────────────────────────────────────────
        // Use pre-loaded HEI map when available (chunked validation), otherwise fall back
        $hei = $heiMap ? $heiMap->get(strtolower($uii)) : $this->liquidationService->findHEIByUII($uii);
        $program = ! empty($programCode) ? $this->findProgram($programCode) : null;

        if (! $hei) {
            $errors[] = "UII '{$uii}' (col C) not found in the system.";
        } else {
            $heiName = $hei->name;
            $roleName = $user->role?->name;
            if (! $hei->region_id) {
                $errors[] = "HEI '{$uii}' is not assigned to an official region.";
            } elseif ($roleName === 'Regional Coordinator' && $user->region_id && $hei->region_id !== $user->region_id) {
                $errors[] = "HEI '{$uii}' does not belong to your assigned region.";
            }
        }

        if (! $program) {
            $errors[] = "Program '{$programCode}' (col B) not found. Use a valid program code.";
        }

        $semesterId = null;
        if (! empty($semesterRaw)) {
            $semesterId = $this->liquidationService->findSemesterId($semesterRaw);
            if (! $semesterId) {
                $errors[] = "Semester '{$semesterRaw}' (col H) is invalid. Use: 1ST, 2ND, SUM, TES3A, TES3B, 1ST AND 2ND, First Semester, Second Semester, or Summer.";
            }
        }

        $academicYear = $academicYearsMap
            ? $academicYearsMap->get($academicYearCode)
            : AcademicYear::findByCode($academicYearCode);
        if (! $academicYear) {
            $errors[] = "Academic Year '{$academicYearCode}' (col G) not found.";
        }

        // ── Control / Ledger No. — supports multi-ledger rows ─────────────────
        // Split the cell on newlines/slashes/whitespace, prefix each token with
        // the program code where missing (handles UniFAST-style partials AND
        // STUFAPS-style plain ledger numbers), then re-join with " / " for the
        // canonical persisted form. Single-ledger rows produce a single-token
        // list and behave identically to before.
        $ledgerTokens = $this->splitLedgerTokens($dvControlNo, $program);
        $dvControlNo = implode(' / ', $ledgerTokens);

        // Per-token uniqueness — multi-ledger strings can't be checked as a
        // whole (the joined form rarely repeats). Check each individual ledger
        // against the flat token map and surface the first collision.
        foreach ($ledgerTokens as $ledger) {
            if (isset($existingControlNos[$ledger])) {
                $errors[] = "Control / Ledger No '{$ledger}' (col J) already exists.";
                break;
            }
        }

        // ── Potential duplicate check (auto control numbers only) ─────────────
        // When the control number is not provided, we cannot check for an exact
        // control_no match. Instead, detect records that share the same key
        // business identifiers — these almost certainly represent a re-import.
        if (empty($dvControlNo) && $hei && $program && $academicYear && $dateFundReleased) {
            $fundReleasedStr = Carbon::instance($dateFundReleased)->format('Y-m-d');
            $fingerprint = $hei->id.'|'.$program->id.'|'.$academicYear->id.'|'.
                $fundReleasedStr.'|'.($semesterId ?? '').'|'.($batchNo ?? '');

            if (isset($existingFingerprints[$fingerprint])) {
                $errors[] = 'A record already exists for this disbursement. This row would create a duplicate — remove it from the file.';
            }
        }

        // ── Document status ───────────────────────────────────────────────────
        $documentStatusId = null;
        if (! empty($docStatusRaw)) {
            $documentStatusId = $this->parseDocumentStatus($docStatusRaw);
            if (! $documentStatusId) {
                $errors[] = "Status of Documents '{$docStatusRaw}' (col N) is invalid. Use: COMPLETE, PARTIAL, or NONE.";
            }
        } else {
            $documentStatusId = DocumentStatus::findByCode(DocumentStatus::CODE_NONE)?->id;
        }

        // ── RC Notes ──────────────────────────────────────────────────────────
        $rcNoteStatusId = null;
        if (! empty($rcNotesRaw)) {
            $rcNoteStatusId = $this->parseRcNoteStatus($rcNotesRaw);
            if (! $rcNoteStatusId) {
                $errors[] = "RC Notes '{$rcNotesRaw}' (col O) is invalid. Use: No Submission, For Review, For Compliance, For Endorsement, Fully Endorsed, or Partially Endorsed.";
            }
        }

        // ── Auto-calculate due date when omitted ──────────────────────────────
        if (! $dueDate && $dateFundReleased && $program) {
            $fallback = $program->parent_id ? 30 : 90;
            $days = ProgramDueDateRule::getDueDateDays(
                $program->id,
                $academicYear?->id,
                $fallback,
            );
            $dueDate = Carbon::instance($dateFundReleased)->copy()->addDays($days);
        }

        // ── Per-ledger grantee breakdown ──────────────────────────────────────
        // When the source row had multiple ledgers AND the grantee column has
        // a matching token count, persist the original {ledger -> grantees}
        // pairs so the UI can show the breakdown. Single-ledger rows produce
        // NULL here and behave exactly as before.
        $ledgerBreakdown = null;
        if (count($ledgerTokens) > 1 && count($granteesTokens) === count($ledgerTokens)) {
            $ledgerBreakdown = [];
            foreach ($ledgerTokens as $i => $ledger) {
                $ledgerBreakdown[] = [
                    'ledger' => $ledger,
                    'grantees' => $granteesTokens[$i],
                ];
            }
        }

        $valid = empty($errors);

        $importable = null;
        $liquidationStatusLabel = null;
        if ($valid) {
            // Auto-calculate liquidation status from financial amounts
            $liquidationStatus = $this->resolveImportLiquidationStatus($totalDisbursements, $totalLiquidated);
            $liquidationStatusLabel = $liquidationStatus?->name ?? 'Unliquidated';

            $importable = [
                'hei_id' => $hei->id,
                'hei_name' => $heiName,
                'program_id' => $program->id,
                'academic_year_id' => $academicYear->id,
                'semester_id' => $semesterId,
                'batch_no' => ! empty($batchNo) ? $batchNo : null,
                'document_status_id' => $documentStatusId,
                'rc_note_status_id' => $rcNoteStatusId,
                'liquidation_status_id' => $liquidationStatus?->id ?? LiquidationStatus::unliquidated()?->id,
                'explicit_control_no' => ! empty($dvControlNo) ? $dvControlNo : null,
                'date_fund_released' => $dateFundReleased
                    ? Carbon::instance($dateFundReleased)->format('Y-m-d')
                    : null,
                'due_date' => $dueDate ? Carbon::instance($dueDate)->format('Y-m-d') : null,
                'number_of_grantees' => $grantees,
                'ledger_breakdown' => $ledgerBreakdown,
                'amount_received' => $totalDisbursements,
                'amount_disbursed' => $totalDisbursements,
                'amount_liquidated' => $totalLiquidated,
            ];
        }

        return $this->buildRowResult($errors, $programCode, $uii, $heiName, $dvControlNo, $dateFundReleased, $dueDate, $academicYearCode, $semesterRaw, $batchNo, $grantees, $totalDisbursements, $totalLiquidated, $docStatusRaw, $rcNotesRaw, $liquidationStatusLabel, $importable, $ledgerBreakdown);
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
        ?array $importable,
        ?array $ledgerBreakdown = null
    ): array {
        return [
            'valid' => empty($errors),
            'errors' => $errors,
            'program' => $programCode,
            'uii' => $uii,
            'hei_name' => $heiName,
            'date_fund_released' => $dateFundReleased
                ? Carbon::instance($dateFundReleased)->format('M d, Y')
                : null,
            'due_date' => $dueDate
                ? Carbon::instance($dueDate)->format('M d, Y')
                : null,
            'academic_year' => $academicYearCode,
            'semester' => $semesterRaw,
            'batch_no' => $batchNo,
            'control_no' => $dvControlNo,
            'grantees' => $grantees,
            'ledger_breakdown' => $ledgerBreakdown,
            'disbursements' => $totalDisbursements,
            'amount_liquidated' => $totalLiquidated,
            'doc_status' => $docStatusRaw,
            'rc_notes' => $rcNotesRaw,
            'liquidation_status' => $liquidationStatus,
            'importable' => $importable,
        ];
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

    /**
     * Location names offered by the Document Tracking picker.
     *
     * Active locations, plus any archived one this record is already filed at.
     * The picker matches on the name string, so dropping an archived location
     * outright would blank the display for a liquidation that legitimately sits
     * there — archiving is meant to retire a shelf from future use, not to
     * rewrite where past documents are.
     *
     * @return Collection<int, string>
     */
    private function documentLocationOptions(Liquidation $liquidation): Collection
    {
        $inUse = collect([$liquidation->transmittal?->location?->name])
            ->merge($liquidation->trackingEntries->flatMap(
                fn ($entry) => $entry->locations->pluck('name')
            ))
            ->filter()
            ->unique();

        return DocumentLocation::query()
            ->where(fn ($query) => $query->active()->orWhereIn('name', $inUse))
            ->ordered()
            ->pluck('name');
    }

    private function findProgram(string $name): ?Program
    {
        if (empty($name)) {
            return null;
        }

        return $this->importPrograms()->first(function ($program) use ($name) {
            return strtolower($program->code) === strtolower($name)
                || strtolower($program->name) === strtolower($name);
        });
    }

    /**
     * Active programs for import matching, read fresh once per request.
     *
     * Deliberately NOT CacheService::getPrograms(). That list is cached for an
     * hour, and the id it yields is frozen into the validated row
     * (see $importable['program_id']) then only re-checked at insert time, which
     * can be another 30 minutes later once the row has sat in the import token
     * cache. If the programs table is rebuilt anywhere in that window — a re-seed
     * mints new uuids, because ProgramSeeder matches on `code` — every stored id
     * is already dead and the whole file fails at insert with "Program not
     * found." while the spreadsheet itself is perfectly valid.
     *
     * HEIs and academic years in this same path are read straight from the
     * database for exactly this reason; programs were the odd one out. One small
     * query per import request, memoised so it stays one and not one per row, is
     * the right price for a lookup whose answer gets written into a record.
     *
     * @return Collection<int, Program>
     */
    private function importPrograms(): Collection
    {
        return $this->importPrograms ??= Program::where('status', 'active')
            ->get(['id', 'name', 'code']);
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
                $date = Date::excelToDateTimeObject((float) $value);
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
            $date = Carbon::parse($value);
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

    /**
     * Separator pattern for splitting multi-token cells: whitespace (incl. newlines),
     * slashes, and semicolons. NOT commas — those are valid thousands separators
     * inside a single number ("1,514"). Used by parseAmount/parseInteger and the
     * ledger/grantees helpers so all multi-line cells parse consistently.
     */
    private const TOKEN_SEPARATORS = '/[\s\/;]+/';

    private function parseAmount($value): float
    {
        if (empty($value)) {
            return 0;
        }

        $str = (string) $value;

        // Single-value fast path — preserves current behaviour for the common case
        // (e.g. "₱22,710,000.00" → 22710000.00). Multi-line/slashed input falls
        // through to the token-sum path below.
        if (! preg_match(self::TOKEN_SEPARATORS, trim($str))) {
            $cleaned = preg_replace('/[^0-9.\-]/', '', $str);

            return (float) ($cleaned ?: 0);
        }

        $total = 0.0;
        foreach (preg_split(self::TOKEN_SEPARATORS, $str, -1, PREG_SPLIT_NO_EMPTY) ?: [] as $tok) {
            $cleaned = preg_replace('/[^0-9.\-]/', '', $tok);
            if ($cleaned !== '' && $cleaned !== '-' && $cleaned !== '.') {
                $total += (float) $cleaned;
            }
        }

        return $total;
    }

    private function parseInteger($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        $str = (string) $value;

        // Single-value fast path: "1,514" → 1514. Avoids treating thousands
        // commas as token separators.
        if (! preg_match(self::TOKEN_SEPARATORS, trim($str))) {
            $cleaned = preg_replace('/[^0-9\-]/', '', $str);

            return $cleaned !== '' ? (int) $cleaned : null;
        }

        // Multi-token path: split on newlines/slashes/whitespace, sum the parts.
        // Fixes the legacy STUFAPS multi-ledger bug where "592\n103\n61" used to
        // become the integer 59210361.
        $total = 0;
        $hadAny = false;
        foreach (preg_split(self::TOKEN_SEPARATORS, $str, -1, PREG_SPLIT_NO_EMPTY) ?: [] as $tok) {
            $cleaned = preg_replace('/[^0-9\-]/', '', $tok);
            if ($cleaned !== '' && $cleaned !== '-') {
                $total += (int) $cleaned;
                $hadAny = true;
            }
        }

        return $hadAny ? $total : null;
    }

    /**
     * Split a CONTROL/LEDGER NO. cell into individual normalised ledger tokens.
     * Returns the tokens with the program prefix prepended where missing.
     *
     * Examples (with TDP program):
     *   "201211082/201211083"                  → ["TDP-201211082", "TDP-201211083"]
     *   "201211456 / 201211455 / 201211448"    → ["TDP-201211456", "TDP-201211455", "TDP-201211448"]
     *   "200910699\n200910700\n200910701"      → ["TDP-200910699", "TDP-200910700", "TDP-200910701"]
     *   "TDP-2025-0001"                        → ["TDP-2025-0001"] (already prefixed)
     *
     * @return array<int, string>
     */
    private function splitLedgerTokens(string $raw, ?Program $program): array
    {
        if ($raw === '') {
            return [];
        }

        $prefix = $program ? strtoupper($program->code).'-' : '';
        $tokens = preg_split(self::TOKEN_SEPARATORS, $raw, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        $normalised = [];
        foreach ($tokens as $tok) {
            $tok = trim($tok);
            if ($tok === '') {
                continue;
            }
            if ($prefix !== '' && ! str_starts_with(strtoupper($tok), $prefix)) {
                $tok = $prefix.$tok;
            }
            $normalised[] = $tok;
        }

        return $normalised;
    }

    /**
     * Split a NUMBER OF GRANTEES cell into integer tokens, preserving order.
     * Returns one int per token — used to pair with ledger tokens for the
     * per-ledger breakdown stored in liquidation_financials.ledger_breakdown.
     *
     * @return array<int, int>
     */
    private function parseGranteesTokens($value): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        $tokens = preg_split(self::TOKEN_SEPARATORS, (string) $value, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        $result = [];
        foreach ($tokens as $tok) {
            $cleaned = preg_replace('/[^0-9\-]/', '', $tok);
            if ($cleaned !== '' && $cleaned !== '-') {
                $result[] = (int) $cleaned;
            }
        }

        return $result;
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
            'COMPLETE' => DocumentStatus::CODE_COMPLETE,
            'COMPLETED' => DocumentStatus::CODE_COMPLETE,
            'PARTIAL' => DocumentStatus::CODE_PARTIAL,
            'INCOMPLETE' => DocumentStatus::CODE_PARTIAL,
            'NONE' => DocumentStatus::CODE_NONE,
            'N/A' => DocumentStatus::CODE_NONE,
            'NA' => DocumentStatus::CODE_NONE,
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
            'NO SUBMISSION' => RcNoteStatus::CODE_NO_SUBMISSION,
            'NO_SUBMISSION' => RcNoteStatus::CODE_NO_SUBMISSION,
            'FOR REVIEW' => RcNoteStatus::CODE_FOR_REVIEW,
            'FOR_REVIEW' => RcNoteStatus::CODE_FOR_REVIEW,
            'FOR COMPLIANCE' => RcNoteStatus::CODE_FOR_COMPLIANCE,
            'FOR_COMPLIANCE' => RcNoteStatus::CODE_FOR_COMPLIANCE,
            'FOR ENDORSEMENT' => RcNoteStatus::CODE_FOR_ENDORSEMENT,
            'FOR_ENDORSEMENT' => RcNoteStatus::CODE_FOR_ENDORSEMENT,
            'FULLY ENDORSED' => RcNoteStatus::CODE_FULLY_ENDORSED,
            'FULLY_ENDORSED' => RcNoteStatus::CODE_FULLY_ENDORSED,
            'PARTIALLY ENDORSED' => RcNoteStatus::CODE_PARTIALLY_ENDORSED,
            'PARTIALLY_ENDORSED' => RcNoteStatus::CODE_PARTIALLY_ENDORSED,
        ];

        $code = $statusMap[$normalized] ?? null;

        return $code ? RcNoteStatus::findByCode($code)?->id : null;
    }
}
