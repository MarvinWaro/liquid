<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AcademicYear;
use App\Models\DocumentStatus;
use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\LiquidationStatus;
use App\Models\Program;
use App\Models\RcNoteStatus;
use App\Models\Region;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Executes the bounded, read-only aggregate queries available to the report assistant.
 */
class ReportAssistantQueryService
{
    private const GROUP_BY = [
        'program',
        'academic_year',
        'region',
        'hei',
        'document_status',
        'liquidation_status',
        'rc_note_status',
    ];

    private const ORDER_BY = [
        'disbursed_desc',
        'liquidation_percentage_desc',
        'liquidation_percentage_asc',
        'records_desc',
        'grantees_desc',
        'unliquidated_desc',
    ];

    private const LIST_ORDER_BY = [
        'control_no_asc',
        'unliquidated_desc',
        'disbursed_desc',
        'liquidated_desc',
        'date_submitted_desc',
        'date_submitted_asc',
    ];

    public function __construct(private readonly LiquidationService $liquidationService) {}

    public function getLiquidationSummary(User $user, array $arguments): array
    {
        $groupBy = in_array($arguments['group_by'] ?? null, self::GROUP_BY, true)
            ? $arguments['group_by']
            : 'program';

        $orderBy = in_array($arguments['order_by'] ?? null, self::ORDER_BY, true)
            ? $arguments['order_by']
            : 'disbursed_desc';

        [$filters, $appliedFilters, $unmatchedFilters] = $this->normalizeFilters($arguments);

        $scoped = Liquidation::query();
        $this->liquidationService->applyRoleAndFilters($scoped, $user, $filters);

        // Do not silently widen a query if the model supplied an unknown named filter.
        if ($unmatchedFilters !== []) {
            $scoped->whereRaw('1 = 0');
        }

        $totals = $this->formatMetrics($this->totalsQuery($scoped)->first());
        $breakdown = $this->breakdownQuery($scoped, $groupBy, $orderBy)
            ->get()
            ->map(fn (object $row): array => [
                'label' => (string) $row->label,
                ...$this->formatMetrics($row),
            ])
            ->values()
            ->all();

        return [
            'generated_at' => now()->timezone('Asia/Manila')->toIso8601String(),
            'scope' => [
                'role' => $user->role?->name,
                'access' => 'Administrative liquidation reports only',
            ],
            'filters' => $appliedFilters,
            'unmatched_filters' => $unmatchedFilters,
            'voided_records' => in_array('VOIDED', $appliedFilters['liquidation_statuses'] ?? [], true)
                ? 'Included because explicitly requested'
                : 'Excluded by default',
            'totals' => $totals,
            'grouped_by' => $groupBy,
            'ordered_by' => $orderBy,
            'breakdown' => $breakdown,
            'breakdown_limit' => 50,
        ];
    }

    /**
     * Return individual liquidation records matching the supplied filters.
     * Bounded (max 25 per page) so the model cannot exhaust the context.
     *
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    public function listLiquidations(User $user, array $arguments): array
    {
        $perPage = max(1, min(25, (int) ($arguments['per_page'] ?? 10)));
        $page = max(1, (int) ($arguments['page'] ?? 1));

        $orderBy = in_array($arguments['order_by'] ?? null, self::LIST_ORDER_BY, true)
            ? $arguments['order_by']
            : 'control_no_asc';

        [$filters, $appliedFilters, $unmatchedFilters] = $this->normalizeFilters($arguments);

        $controlNoSearch = trim((string) ($arguments['control_no_search'] ?? ''));
        if ($controlNoSearch !== '') {
            $filters['search'] = $controlNoSearch;
            $appliedFilters['control_no_search'] = [$controlNoSearch];
        }

        $scoped = Liquidation::query()
            ->with([
                'hei:id,uii,name,region_id',
                'program:id,code,name',
                'academicYear:id,name',
                'semester:id,code,name',
                'documentStatus:id,code,name',
                'liquidationStatus:id,code,name',
                'rcNoteStatus:id,code,name',
                'financial',
            ]);

        $this->applyListOrderBy($scoped, $orderBy);

        $this->liquidationService->applyRoleAndFilters($scoped, $user, $filters);

        if ($unmatchedFilters !== []) {
            return [
                'generated_at' => now()->timezone('Asia/Manila')->toIso8601String(),
                'scope' => [
                    'role' => $user->role?->name,
                    'access' => 'Administrative liquidation reports only',
                ],
                'filters' => $appliedFilters,
                'unmatched_filters' => $unmatchedFilters,
                'voided_records' => 'Excluded by default',
                'page' => $page,
                'per_page' => $perPage,
                'total_matching' => 0,
                'has_more' => false,
                'records' => [],
            ];
        }

        $total = (clone $scoped)->count();
        $records = $scoped->forPage($page, $perPage)
            ->get()
            ->map(fn (Liquidation $row): array => $this->serializeLiquidation($row))
            ->all();

        return [
            'generated_at' => now()->timezone('Asia/Manila')->toIso8601String(),
            'scope' => [
                'role' => $user->role?->name,
                'access' => 'Administrative liquidation reports only',
            ],
            'filters' => $appliedFilters,
            'unmatched_filters' => $unmatchedFilters,
            'voided_records' => in_array('VOIDED', $appliedFilters['liquidation_statuses'] ?? [], true)
                ? 'Included because explicitly requested'
                : 'Excluded by default',
            'page' => $page,
            'per_page' => $perPage,
            'ordered_by' => $orderBy,
            'total_matching' => $total,
            'has_more' => ($page * $perPage) < $total,
            'records' => $records,
        ];
    }

    /**
     * Apply per-record ordering for list_liquidations. Financial columns live
     * on liquidation_financials and are sorted via a correlated subquery so
     * we do not have to add a join (which would conflict with the existing
     * role/filter helper using unqualified column names).
     */
    private function applyListOrderBy(EloquentBuilder $query, string $orderBy): void
    {
        match ($orderBy) {
            'unliquidated_desc' => $query->orderByRaw('(SELECT amount_received - amount_liquidated FROM liquidation_financials WHERE liquidation_id = liquidations.id LIMIT 1) DESC'),
            'disbursed_desc' => $query->orderByRaw('(SELECT amount_received FROM liquidation_financials WHERE liquidation_id = liquidations.id LIMIT 1) DESC'),
            'liquidated_desc' => $query->orderByRaw('(SELECT amount_liquidated FROM liquidation_financials WHERE liquidation_id = liquidations.id LIMIT 1) DESC'),
            'date_submitted_desc' => $query->orderByDesc('date_submitted')->orderBy('control_no'),
            'date_submitted_asc' => $query->orderBy('date_submitted')->orderBy('control_no'),
            default => $query->orderBy('control_no'),
        };
    }

    /**
     * Look up a single liquidation by control number, respecting role scope.
     *
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    public function findLiquidation(User $user, array $arguments): array
    {
        $controlNo = trim((string) ($arguments['control_no'] ?? ''));

        if ($controlNo === '') {
            return [
                'found' => false,
                'error' => 'control_no is required.',
            ];
        }

        $scoped = Liquidation::query()
            ->with([
                'hei:id,uii,name,region_id',
                'program:id,code,name',
                'academicYear:id,name',
                'semester:id,code,name',
                'documentStatus:id,code,name',
                'liquidationStatus:id,code,name',
                'rcNoteStatus:id,code,name',
                'financial',
            ])
            ->where('control_no', $controlNo);

        // Exact-control-no lookup: apply role scope only. Do not exclude voided
        // records and do not add any status filter — the caller asked for a
        // specific record and should see it regardless of status.
        $this->liquidationService->applyRoleScope($scoped, $user);

        $record = $scoped->first();

        if (! $record) {
            return [
                'generated_at' => now()->timezone('Asia/Manila')->toIso8601String(),
                'control_no' => $controlNo,
                'found' => false,
                'message' => 'No liquidation matched this control number within the requester\'s access scope.',
            ];
        }

        return [
            'generated_at' => now()->timezone('Asia/Manila')->toIso8601String(),
            'control_no' => $controlNo,
            'found' => true,
            'record' => $this->serializeLiquidation($record),
        ];
    }

    /**
     * Browse the HEI catalog with optional region filter and name search so
     * the model can map between names, UIIs, and IDs accurately.
     *
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    public function listHeis(User $user, array $arguments): array
    {
        $perPage = max(1, min(50, (int) ($arguments['per_page'] ?? 25)));
        $page = max(1, (int) ($arguments['page'] ?? 1));
        $search = trim((string) ($arguments['search'] ?? ''));
        $regionInput = $this->strings($arguments['regions'] ?? []);

        $query = HEI::query()->orderBy('name');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('uii', 'like', "%{$search}%");
            });
        }

        $appliedRegions = [];
        $unmatchedRegions = [];
        $regionIds = [];

        foreach ($regionInput as $value) {
            $region = Region::query()
                ->where('id', $value)
                ->orWhereRaw('UPPER(code) = ?', [strtoupper($value)])
                ->orWhereRaw('UPPER(name) = ?', [strtoupper($value)])
                ->first(['id', 'name']);

            if (! $region) {
                $unmatchedRegions[] = $value;

                continue;
            }

            $regionIds[] = $region->id;
            $appliedRegions[] = $region->name;
        }

        if ($regionIds !== []) {
            $query->whereIn('region_id', $regionIds);
        }

        // Role scope: HEI users can only see their own institution, RCs only their region.
        $roleName = $user->role?->name;
        if ($roleName === 'HEI' && $user->hei_id) {
            $query->where('id', $user->hei_id);
        } elseif ($roleName === 'Regional Coordinator' && $user->region_id) {
            $query->where('region_id', $user->region_id);
        }

        $total = (clone $query)->count();
        $heis = $query->forPage($page, $perPage)
            ->get(['id', 'uii', 'name', 'type', 'region_id', 'status'])
            ->map(fn (HEI $hei): array => [
                'uii' => $hei->uii,
                'name' => $hei->name,
                'type' => $hei->type,
                'status' => $hei->status,
                'region' => $hei->region?->name,
            ])
            ->all();

        return [
            'generated_at' => now()->timezone('Asia/Manila')->toIso8601String(),
            'filters' => [
                'search' => $search !== '' ? $search : null,
                'regions' => $appliedRegions,
            ],
            'unmatched_filters' => $unmatchedRegions !== [] ? ['regions' => $unmatchedRegions] : [],
            'page' => $page,
            'per_page' => $perPage,
            'total_matching' => $total,
            'has_more' => ($page * $perPage) < $total,
            'heis' => $heis,
        ];
    }

    /**
     * Return code/name pairs for the supported enum and reference tables. The
     * model uses these to construct accurate filter values for the other
     * tools instead of guessing.
     *
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    public function getReferenceData(User $user, array $arguments): array
    {
        $categories = array_map(
            'strtolower',
            $this->strings($arguments['categories'] ?? []),
        );

        $wantAll = $categories === [] || in_array('all', $categories, true);
        $want = fn (string $key): bool => $wantAll || in_array($key, $categories, true);

        $result = [
            'generated_at' => now()->timezone('Asia/Manila')->toIso8601String(),
        ];

        if ($want('programs')) {
            $result['programs'] = Program::query()
                ->orderBy('code')
                ->get(['code', 'name'])
                ->map(fn (Program $p): array => ['code' => $p->code, 'name' => $p->name])
                ->all();
        }

        if ($want('regions')) {
            $result['regions'] = Region::query()
                ->orderBy('name')
                ->get(['code', 'name'])
                ->map(fn (Region $r): array => ['code' => $r->code, 'name' => $r->name])
                ->all();
        }

        if ($want('academic_years')) {
            $result['academic_years'] = AcademicYear::query()
                ->orderBy('name')
                ->pluck('name')
                ->all();
        }

        if ($want('document_statuses')) {
            $result['document_statuses'] = DocumentStatus::query()
                ->orderBy('sort_order')
                ->get(['code', 'name'])
                ->map(fn (DocumentStatus $s): array => ['code' => $s->code, 'name' => $s->name])
                ->all();
        }

        if ($want('liquidation_statuses')) {
            $result['liquidation_statuses'] = LiquidationStatus::query()
                ->orderBy('sort_order')
                ->get(['code', 'name'])
                ->map(fn (LiquidationStatus $s): array => ['code' => $s->code, 'name' => $s->name])
                ->all();
        }

        if ($want('rc_note_statuses')) {
            $result['rc_note_statuses'] = RcNoteStatus::query()
                ->orderBy('name')
                ->get(['code', 'name'])
                ->map(fn (RcNoteStatus $s): array => ['code' => $s->code, 'name' => $s->name])
                ->all();
        }

        return $result;
    }

    /**
     * Compact wire format used by list and find tools.
     *
     * @return array<string, mixed>
     */
    private function serializeLiquidation(Liquidation $row): array
    {
        $financial = $row->financial;
        $amountReceived = $financial ? (float) $financial->amount_received : null;
        $amountLiquidated = $financial ? (float) $financial->amount_liquidated : null;
        $unliquidated = ($amountReceived !== null && $amountLiquidated !== null)
            ? round($amountReceived - $amountLiquidated, 2)
            : null;

        return [
            'control_no' => $row->control_no,
            'hei' => $row->hei ? [
                'uii' => $row->hei->uii,
                'name' => $row->hei->name,
            ] : null,
            'program' => $row->program?->code,
            'academic_year' => $row->academicYear?->name,
            'semester' => $row->semester?->code,
            'batch_no' => $row->batch_no,
            'document_status' => $row->documentStatus?->name,
            'liquidation_status' => $row->liquidationStatus?->name,
            'rc_note_status' => $row->rcNoteStatus?->name,
            'date_submitted' => $row->date_submitted?->toDateString(),
            'number_of_grantees' => $financial?->number_of_grantees,
            'amount_received' => $amountReceived !== null ? round($amountReceived, 2) : null,
            'amount_liquidated' => $amountLiquidated !== null ? round($amountLiquidated, 2) : null,
            'unliquidated' => $unliquidated,
        ];
    }

    private function totalsQuery(EloquentBuilder $scoped): Builder
    {
        return $this->baseQuery($scoped)
            ->selectRaw('COUNT(*) as record_count')
            ->selectRaw('COALESCE(SUM(financials.number_of_grantees), 0) as grantees')
            ->selectRaw('COALESCE(SUM(financials.amount_received), 0) as disbursed')
            ->selectRaw('COALESCE(SUM(financials.amount_liquidated), 0) as liquidated')
            ->selectRaw('COALESCE(SUM(financials.amount_received - financials.amount_liquidated), 0) as unliquidated')
            ->selectRaw('COALESCE(SUM(CASE WHEN rc_notes.code = ? THEN financials.amount_received - financials.amount_liquidated ELSE 0 END), 0) as for_endorsement', [
                RcNoteStatus::CODE_FOR_ENDORSEMENT,
            ]);
    }

    private function breakdownQuery(EloquentBuilder $scoped, string $groupBy, string $orderBy = 'disbursed_desc'): Builder
    {
        $query = $this->baseQuery($scoped);

        switch ($groupBy) {
            case 'academic_year':
                $query->leftJoin('academic_years', 'academic_years.id', '=', 'liquidations.academic_year_id');
                $expression = "COALESCE(academic_years.name, 'Unknown')";
                break;
            case 'region':
                $query->leftJoin('heis', 'heis.id', '=', 'liquidations.hei_id')
                    ->leftJoin('regions', 'regions.id', '=', 'heis.region_id');
                $expression = "COALESCE(regions.name, 'Unknown')";
                break;
            case 'hei':
                $query->leftJoin('heis', 'heis.id', '=', 'liquidations.hei_id');
                $expression = "COALESCE(heis.name, 'Unknown')";
                break;
            case 'document_status':
                $query->leftJoin('document_statuses', 'document_statuses.id', '=', 'liquidations.document_status_id');
                $expression = "COALESCE(document_statuses.name, 'No Submission')";
                break;
            case 'liquidation_status':
                $query->leftJoin('liquidation_statuses', 'liquidation_statuses.id', '=', 'liquidations.liquidation_status_id');
                $expression = "COALESCE(liquidation_statuses.name, 'Unliquidated')";
                break;
            case 'rc_note_status':
                $expression = "COALESCE(rc_notes.name, 'No RC Note')";
                break;
            case 'program':
            default:
                $query->leftJoin('programs', 'programs.id', '=', 'liquidations.program_id');
                $expression = "COALESCE(programs.code, 'Unknown')";
                break;
        }

        // Percentage is computed in PHP after the SQL aggregate, so we sort
        // by an equivalent SQL expression rather than the alias.
        $forEndorsementSql = 'COALESCE(SUM(CASE WHEN rc_notes.code = ? THEN financials.amount_received - financials.amount_liquidated ELSE 0 END), 0)';
        $disbursedSql = 'COALESCE(SUM(financials.amount_received), 0)';
        $liquidatedSql = 'COALESCE(SUM(financials.amount_liquidated), 0)';
        $unliquidatedSql = "COALESCE(SUM(financials.amount_received - financials.amount_liquidated), 0)";
        $percentageSql = "CASE WHEN {$disbursedSql} > 0 THEN (({$liquidatedSql} + {$forEndorsementSql}) / {$disbursedSql}) * 100 ELSE 0 END";

        $query
            ->selectRaw("{$expression} as label")
            ->selectRaw('COUNT(*) as record_count')
            ->selectRaw('COALESCE(SUM(financials.number_of_grantees), 0) as grantees')
            ->selectRaw('COALESCE(SUM(financials.amount_received), 0) as disbursed')
            ->selectRaw('COALESCE(SUM(financials.amount_liquidated), 0) as liquidated')
            ->selectRaw('COALESCE(SUM(financials.amount_received - financials.amount_liquidated), 0) as unliquidated')
            ->selectRaw("{$forEndorsementSql} as for_endorsement", [RcNoteStatus::CODE_FOR_ENDORSEMENT])
            ->groupByRaw($expression);

        switch ($orderBy) {
            case 'liquidation_percentage_desc':
                $query->orderByRaw("{$percentageSql} DESC, {$disbursedSql} DESC", [RcNoteStatus::CODE_FOR_ENDORSEMENT]);
                break;
            case 'liquidation_percentage_asc':
                $query->orderByRaw("{$percentageSql} ASC, {$disbursedSql} DESC", [RcNoteStatus::CODE_FOR_ENDORSEMENT]);
                break;
            case 'records_desc':
                $query->orderByRaw('COUNT(*) DESC');
                break;
            case 'grantees_desc':
                $query->orderByRaw('COALESCE(SUM(financials.number_of_grantees), 0) DESC');
                break;
            case 'unliquidated_desc':
                $query->orderByRaw("{$unliquidatedSql} DESC");
                break;
            case 'disbursed_desc':
            default:
                $query->orderByRaw("{$disbursedSql} DESC");
                break;
        }

        return $query->limit(50);
    }

    private function baseQuery(EloquentBuilder $scoped): Builder
    {
        return DB::table('liquidations')
            ->leftJoin('liquidation_financials as financials', 'financials.liquidation_id', '=', 'liquidations.id')
            ->leftJoin('rc_note_statuses as rc_notes', 'rc_notes.id', '=', 'liquidations.rc_note_status_id')
            ->whereIn('liquidations.id', (clone $scoped)->select('liquidations.id'));
    }

    private function formatMetrics(?object $row): array
    {
        $disbursed = (float) ($row->disbursed ?? 0);
        $liquidated = (float) ($row->liquidated ?? 0);
        $forEndorsement = (float) ($row->for_endorsement ?? 0);

        return [
            'records' => (int) ($row->record_count ?? 0),
            'grantees' => (int) ($row->grantees ?? 0),
            'disbursed' => round($disbursed, 2),
            'liquidated' => round($liquidated, 2),
            'unliquidated' => round((float) ($row->unliquidated ?? 0), 2),
            'for_endorsement' => round($forEndorsement, 2),
            'liquidation_percentage' => $disbursed > 0
                ? round((($liquidated + $forEndorsement) / $disbursed) * 100, 2)
                : 0.0,
        ];
    }

    private function normalizeFilters(array $arguments): array
    {
        $filters = [];
        $applied = [];
        $unmatched = [];

        $this->resolveRecords(
            $arguments['programs'] ?? [],
            fn (string $value) => Program::query()
                ->where('id', $value)
                ->orWhereRaw('UPPER(code) = ?', [strtoupper($value)])
                ->orWhereRaw('UPPER(name) = ?', [strtoupper($value)])
                ->first(['id', 'code']),
            'programs',
            'program',
            fn (Program $program): string => $program->code,
            $filters,
            $applied,
            $unmatched,
        );

        $this->resolveRecords(
            $arguments['academic_years'] ?? [],
            fn (string $value) => AcademicYear::query()
                ->where('id', $value)
                ->orWhereRaw('UPPER(code) = ?', [strtoupper($value)])
                ->orWhereRaw('UPPER(name) = ?', [strtoupper($value)])
                ->first(['id', 'name']),
            'academic_years',
            'academic_year',
            fn (AcademicYear $year): string => $year->name,
            $filters,
            $applied,
            $unmatched,
        );

        $this->resolveRecords(
            $arguments['regions'] ?? [],
            fn (string $value) => Region::query()
                ->where('id', $value)
                ->orWhereRaw('UPPER(code) = ?', [strtoupper($value)])
                ->orWhereRaw('UPPER(name) = ?', [strtoupper($value)])
                ->first(['id', 'name']),
            'regions',
            'region',
            fn (Region $region): string => $region->name,
            $filters,
            $applied,
            $unmatched,
        );

        $this->resolveRecords(
            $arguments['heis'] ?? [],
            fn (string $value) => HEI::query()
                ->where('id', $value)
                ->orWhereRaw('UPPER(uii) = ?', [strtoupper($value)])
                ->orWhereRaw('UPPER(name) = ?', [strtoupper($value)])
                ->first(['id', 'name']),
            'heis',
            'hei',
            fn (HEI $hei): string => $hei->name,
            $filters,
            $applied,
            $unmatched,
        );

        $this->resolveRecords(
            $arguments['document_statuses'] ?? [],
            fn (string $value) => DocumentStatus::query()
                ->whereRaw('UPPER(code) = ?', [$this->normalizeCode($value)])
                ->orWhereRaw('UPPER(name) = ?', [strtoupper($value)])
                ->first(['code', 'name']),
            'document_statuses',
            'document_status',
            fn (DocumentStatus $status): string => $status->code,
            $filters,
            $applied,
            $unmatched,
            useId: false,
        );

        $this->resolveRecords(
            $arguments['liquidation_statuses'] ?? [],
            fn (string $value) => LiquidationStatus::query()
                ->whereRaw('UPPER(code) = ?', [$this->normalizeCode($value)])
                ->orWhereRaw('UPPER(name) = ?', [strtoupper($value)])
                ->first(['code', 'name']),
            'liquidation_statuses',
            'liquidation_status',
            fn (LiquidationStatus $status): string => $status->code,
            $filters,
            $applied,
            $unmatched,
            useId: false,
        );

        // LiquidationService recognizes the voided opt-in using lower-case status codes.
        $filters['liquidation_status'] = array_map(
            'strtolower',
            $filters['liquidation_status'] ?? [],
        );

        $this->resolveRecords(
            array_values(array_filter($this->strings($arguments['rc_note_statuses'] ?? []), fn (string $value): bool => strtolower($value) !== 'none')),
            fn (string $value) => RcNoteStatus::query()
                ->whereRaw('UPPER(code) = ?', [$this->normalizeCode($value)])
                ->orWhereRaw('UPPER(name) = ?', [strtoupper($value)])
                ->first(['id', 'name']),
            'rc_note_statuses',
            'rc_note_status',
            fn (RcNoteStatus $status): string => $status->name,
            $filters,
            $applied,
            $unmatched,
        );

        if (in_array('none', array_map('strtolower', $this->strings($arguments['rc_note_statuses'] ?? [])), true)) {
            $filters['rc_note_status'][] = 'none';
            $applied['rc_note_statuses'][] = 'No RC Note';
        }

        return [$filters, $applied, $unmatched];
    }

    private function resolveRecords(
        mixed $requested,
        callable $resolver,
        string $resultKey,
        string $filterKey,
        callable $label,
        array &$filters,
        array &$applied,
        array &$unmatched,
        bool $useId = true,
    ): void {
        foreach ($this->strings($requested) as $value) {
            $record = $resolver($value);
            if (! $record) {
                $unmatched[$resultKey][] = $value;

                continue;
            }

            $filters[$filterKey][] = $useId ? $record->id : $record->code;
            $applied[$resultKey][] = $label($record);
        }
    }

    private function strings(mixed $values): array
    {
        if (! is_array($values)) {
            return [];
        }

        return array_values(array_unique(array_filter(array_map(
            fn (mixed $value): string => is_string($value) ? trim($value) : '',
            $values,
        ))));
    }

    private function normalizeCode(string $value): string
    {
        return strtoupper(str_replace([' ', '-'], '_', trim($value)));
    }
}
