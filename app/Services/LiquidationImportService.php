<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\LiquidationImportValidationException;
use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\LiquidationFinancial;
use App\Models\User;
use App\Traits\HasUuid;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Writes pre-validated import rows into the database.
 *
 * Extracted from LiquidationController so the queued BulkImportLiquidationsJob
 * and the controller share one implementation. Everything here assumes the rows
 * have already passed validateParsedImport() — no business rules are re-checked,
 * only the races that validation cannot rule out (a ledger number claimed
 * between preview and insert).
 */
class LiquidationImportService
{
    public function __construct(
        private readonly LiquidationService $liquidationService,
    ) {}

    /**
     * Import one chunk of pre-validated rows.
     *
     * Takes the fast path first — two bulk INSERTs for the whole chunk — and on
     * any failure re-runs that chunk row-by-row. The slow path is what produces
     * per-row error attribution, so a single bad row costs one wasted round trip
     * instead of forcing every import to pay three queries per row.
     *
     * Model events are suppressed throughout: activity logs would flood the
     * timeline, and the dashboard cache would be bumped twice per row. Bulk
     * INSERTs bypass events entirely, which is why UUIDs and timestamps are set
     * explicitly in buildRowPayloads().
     *
     * The dashboard cache is flushed exactly once when this returns. Wrapping a
     * multi-chunk import in {@see DashboardCache::withoutFlushing()} collapses
     * those into a single flush for the whole run.
     *
     * @param  array<int, array<string, mixed>>  $chunk
     * @return array{imported: int, errors: array<int, array<string, mixed>>}
     */
    public function importChunk(array $chunk, User $user, string $batchId): array
    {
        $previousLiquidationLogging = Liquidation::$loggingEnabled;
        $previousFinancialLogging = LiquidationFinancial::$loggingEnabled;
        $previousDashboardFlushing = DashboardCache::$flushEnabled;

        Liquidation::$loggingEnabled = false;
        LiquidationFinancial::$loggingEnabled = false;
        DashboardCache::$flushEnabled = false;

        try {
            // ── Fast path ─────────────────────────────────────────────────────
            try {
                $imported = DB::transaction(function () use ($chunk, $user, $batchId) {
                    // Match the transfer workflow's lock order (HEIs first) to
                    // avoid a control-number/HEI deadlock under concurrent imports.
                    $processingRegions = $this->processingRegionsForRows($chunk, $user);

                    // One locking prefix scan per program+year for the whole chunk,
                    // inside the transaction so the lock holds through the inserts.
                    $autoControlNos = $this->allocateControlNos($chunk);
                    [$liquidations, $financials] = $this->buildRowPayloads(
                        $chunk,
                        $autoControlNos,
                        $processingRegions,
                        $user,
                        $batchId,
                    );

                    Liquidation::insert($liquidations);
                    LiquidationFinancial::insert($financials);

                    return count($liquidations);
                });

                return ['imported' => $imported, 'errors' => []];
            } catch (\Throwable $e) {
                // Expected when a row is genuinely unimportable (e.g. an explicit
                // ledger number taken since validation). The transaction rolled
                // back, so the slow path starts from a clean slate.
                Log::info('Bulk import chunk fell back to per-row inserts.', [
                    'batch_id' => $batchId,
                    'rows' => count($chunk),
                    'reason' => $e->getMessage(),
                ]);
            }

            // ── Slow path — names the offending rows ──────────────────────────
            $imported = 0;
            $errors = [];

            DB::transaction(function () use ($chunk, $user, $batchId, &$imported, &$errors) {
                $this->processingRegionsForRows($chunk, $user);
                $autoControlNos = $this->allocateControlNos($chunk);

                foreach ($chunk as $index => $rowData) {
                    try {
                        $this->insertRow($rowData, $user, $batchId, $autoControlNos[$index] ?? null);
                        $imported++;
                    } catch (QueryException $e) {
                        $errors[] = $this->rowError($rowData, ($e->errorInfo[1] ?? null) === 1062
                            ? 'Already exists — this record was likely imported in a previous batch.'
                            : 'Database error — the record could not be saved.');
                    } catch (\Exception $e) {
                        $errors[] = $this->rowError($rowData, $e->getMessage());
                    }
                }
            });

            return ['imported' => $imported, 'errors' => $errors];
        } finally {
            Liquidation::$loggingEnabled = $previousLiquidationLogging;
            LiquidationFinancial::$loggingEnabled = $previousFinancialLogging;
            DashboardCache::$flushEnabled = $previousDashboardFlushing;

            // No-op when an outer withoutFlushing() is still in effect, which is
            // how a multi-chunk import ends up flushing only once.
            DashboardCache::flush();
        }
    }

    /**
     * Pre-allocate auto control numbers for a chunk.
     *
     * Rows carrying an explicit ledger number are skipped — they keep theirs. The
     * rest are grouped by program + fund year and allocated in one call per group,
     * because generateControlNos() costs a locking prefix scan and doing that per
     * row degrades quadratically on large imports.
     *
     * A group that cannot be allocated (e.g. the program vanished) is left out;
     * insertRow() then generates one itself so the failure is reported against
     * that row rather than aborting the whole chunk.
     *
     * Must be called within a DB::transaction() so the locks survive to the inserts.
     *
     * @param  array<int, array<string, mixed>>  $chunk
     * @return array<int, string> chunk index => control number
     */
    private function allocateControlNos(array $chunk): array
    {
        $groups = [];
        foreach ($chunk as $index => $row) {
            if (! empty($row['explicit_control_no'])) {
                continue;
            }

            $year = ! empty($row['date_fund_released'])
                ? (int) substr($row['date_fund_released'], 0, 4)
                : (int) now()->year;

            $groups[$row['program_id'].'|'.$year][] = $index;
        }

        $allocated = [];
        foreach ($groups as $key => $indexes) {
            [$programId, $year] = explode('|', $key, 2);

            try {
                $numbers = $this->liquidationService->generateControlNos($programId, (int) $year, count($indexes));
            } catch (\Throwable $e) {
                Log::warning('Bulk import control-number pre-allocation failed; falling back to per-row generation.', [
                    'program_id' => $programId,
                    'year' => $year,
                    'error' => $e->getMessage(),
                ]);

                continue;
            }

            foreach ($indexes as $position => $index) {
                $allocated[$index] = $numbers[$position];
            }
        }

        return $allocated;
    }

    /**
     * Build the raw row arrays for the two bulk INSERTs.
     *
     * Bulk inserts bypass Eloquent, so everything the model events would have
     * supplied is set here: UUID primary keys ({@see HasUuid}),
     * timestamps, and the JSON encoding for `ledger_breakdown`'s array cast.
     *
     * @param  array<int, array<string, mixed>>  $chunk
     * @param  array<int, string>  $autoControlNos
     * @param  array<string, string|null>  $processingRegions
     * @return array{0: array<int, array<string, mixed>>, 1: array<int, array<string, mixed>>}
     *
     * @throws \RuntimeException when a row has no usable control number, which
     *                           routes the chunk to the per-row path.
     */
    private function buildRowPayloads(
        array $chunk,
        array $autoControlNos,
        array $processingRegions,
        User $user,
        string $batchId,
    ): array {
        $now = now();
        $liquidations = [];
        $financials = [];
        foreach ($chunk as $index => $data) {
            $controlNo = $data['explicit_control_no'] ?: ($autoControlNos[$index] ?? null);

            if (! $controlNo) {
                throw new \RuntimeException("No control number available for row {$index}.");
            }

            $liquidationId = (string) Str::uuid();

            $liquidations[] = [
                'id' => $liquidationId,
                'control_no' => $controlNo,
                'hei_id' => $data['hei_id'],
                'processing_region_id' => $processingRegions[$data['hei_id']] ?? null,
                'program_id' => $data['program_id'],
                'academic_year_id' => $data['academic_year_id'],
                'semester_id' => $data['semester_id'],
                'batch_no' => $data['batch_no'],
                'document_status_id' => $data['document_status_id'],
                'rc_note_status_id' => $data['rc_note_status_id'],
                'liquidation_status_id' => $data['liquidation_status_id'],
                'created_by' => $user->id,
                'import_batch_id' => $batchId,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            $financials[] = [
                'id' => (string) Str::uuid(),
                'liquidation_id' => $liquidationId,
                'date_fund_released' => $data['date_fund_released'],
                'due_date' => $data['due_date'],
                'number_of_grantees' => $data['number_of_grantees'],
                'ledger_breakdown' => isset($data['ledger_breakdown'])
                    ? json_encode($data['ledger_breakdown'])
                    : null,
                'amount_received' => $data['amount_received'],
                'amount_disbursed' => $data['amount_disbursed'],
                'amount_liquidated' => $data['amount_liquidated'],
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        return [$liquidations, $financials];
    }

    /**
     * Insert a single pre-validated row. Must run inside a DB::transaction().
     *
     * $autoControlNo is a number reserved by allocateControlNos() for rows without
     * an explicit ledger; null falls back to generating one here.
     *
     * @throws \RuntimeException if an explicit control number was taken between validate and import.
     */
    private function insertRow(array $data, User $user, string $batchId, ?string $autoControlNo = null): void
    {
        $hei = HEI::query()->lockForUpdate()->find($data['hei_id']);

        if (! $hei) {
            throw new LiquidationImportValidationException('The HEI no longer exists. Please re-validate the import.');
        }

        if (! $hei->region_id) {
            throw new LiquidationImportValidationException('The HEI is not assigned to an official region. Please update the HEI and re-validate the import.');
        }

        if ($user->role?->name === 'Regional Coordinator'
            && $user->region_id
            && $hei->region_id !== $user->region_id) {
            throw new LiquidationImportValidationException('The HEI was transferred to another region. Please re-validate the import.');
        }

        $controlNo = $data['explicit_control_no'];

        if (! $controlNo) {
            $fundYear = ! empty($data['date_fund_released'])
                ? (int) substr($data['date_fund_released'], 0, 4)
                : null;
            $controlNo = $autoControlNo
                ?? $this->liquidationService->generateControlNo($data['program_id'], $fundYear);
        } else {
            // Re-check: another import may have taken this number since validate step.
            // Include soft-deleted records — the unique constraint covers all rows.
            if (Liquidation::withTrashed()->where('control_no', $controlNo)->lockForUpdate()->exists()) {
                throw new \RuntimeException("Control / Ledger No '{$controlNo}' was already taken. Please re-validate.");
            }
        }

        $liquidation = Liquidation::create([
            'control_no' => $controlNo,
            'hei_id' => $data['hei_id'],
            'processing_region_id' => $hei->region_id,
            'program_id' => $data['program_id'],
            'academic_year_id' => $data['academic_year_id'],
            'semester_id' => $data['semester_id'],
            'batch_no' => $data['batch_no'],
            'document_status_id' => $data['document_status_id'],
            'rc_note_status_id' => $data['rc_note_status_id'],
            'liquidation_status_id' => $data['liquidation_status_id'],
            'created_by' => $user->id,
            'import_batch_id' => $batchId,
        ]);

        $liquidation->createOrUpdateFinancial([
            'date_fund_released' => $data['date_fund_released'],
            'due_date' => $data['due_date'],
            'number_of_grantees' => $data['number_of_grantees'],
            'ledger_breakdown' => $data['ledger_breakdown'] ?? null,
            'amount_received' => $data['amount_received'],
            'amount_disbursed' => $data['amount_disbursed'],
            'amount_liquidated' => $data['amount_liquidated'],
        ]);

        // Notification is sent once per batch (not per row) to avoid flooding.
    }

    /**
     * Lock every HEI represented in a bulk chunk and resolve the immutable
     * processing-region snapshot from current ownership at insert time.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @return array<string, string|null>
     */
    private function processingRegionsForRows(array $rows, User $user): array
    {
        $heiIds = collect($rows)
            ->pluck('hei_id')
            ->filter()
            ->unique()
            ->sort()
            ->values();

        $heis = HEI::query()
            ->whereIn('id', $heiIds)
            ->orderBy('id')
            ->lockForUpdate()
            ->get(['id', 'region_id'])
            ->keyBy('id');

        foreach ($heiIds as $heiId) {
            $hei = $heis->get($heiId);

            if (! $hei) {
                throw new LiquidationImportValidationException('An HEI in this import no longer exists. Please re-validate the import.');
            }

            if (! $hei->region_id) {
                throw new LiquidationImportValidationException('An HEI in this import is not assigned to an official region. Please update the HEI and re-validate the import.');
            }

            if ($user->role?->name === 'Regional Coordinator'
                && $user->region_id
                && $hei->region_id !== $user->region_id) {
                throw new LiquidationImportValidationException('An HEI in this import was transferred to another region. Please re-validate the import.');
            }
        }

        return $heis->mapWithKeys(
            fn (HEI $hei) => [$hei->id => $hei->region_id]
        )->all();
    }

    /**
     * The per-row failure shape rendered by the import result dialog.
     *
     * @param  array<string, mixed>  $rowData
     * @return array<string, mixed>
     */
    private function rowError(array $rowData, string $message): array
    {
        return [
            'row' => $rowData['row_no'] ?? null,
            'seq' => $rowData['seq'] ?? null,
            'program' => $rowData['program_code'] ?? null,
            'uii' => $rowData['uii'] ?? null,
            'hei_name' => $rowData['hei_name'] ?? '',
            'error' => $message,
        ];
    }
}
