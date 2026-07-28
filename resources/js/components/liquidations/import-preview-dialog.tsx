import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from '@/components/ui/tooltip';
import {
    Loader2,
    Upload,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    ChevronRight,
    ChevronLeft,
    ChevronsLeft,
    ChevronsRight,
    FileSpreadsheet,
    ArrowRight,
    Filter,
    Building2,
    Calendar,
    Banknote,
    ClipboardList,
    X,
    History,
    Undo2,
    FileX2,
    Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import axios, { type AxiosResponse } from 'axios';
import { parseExcelBuffer, type ParsedExcelRow } from '@/lib/import-excel-parser';
import { useImportProgress, importPhase, type ImportProgress } from '@/hooks/use-import-progress';
import type { ParseRequest, ParseResponse } from '@/workers/import-parser.worker';

// --- Types ----------------------------------------------------------------

export interface ValidatedRow {
    row: number;
    seq: string;
    valid: boolean;
    errors: string[];
    program: string;
    uii: string;
    hei_name: string;
    date_fund_released: string | null;
    due_date: string | null;
    academic_year: string;
    semester: string;
    batch_no: string;
    control_no: string;
    grantees: number | null;
    /** Populated when the source row had multiple ledgers paired with grantee counts. */
    ledger_breakdown: LedgerBreakdownEntry[] | null;
    disbursements: number;
    amount_liquidated: number;
    doc_status: string;
    rc_notes: string;
    liquidation_status: string | null;
}

export interface LedgerBreakdownEntry {
    ledger: string;
    grantees: number;
}

type ImportBatchStatus = 'processing' | 'active' | 'undone' | 'failed';

interface ImportBatchRecord {
    id: string;
    file_name: string;
    file_size: number | null;
    total_rows: number;
    imported_count: number;
    status: ImportBatchStatus;
    failed_reason: string | null;
    created_at: string;
    undone_at: string | null;
    imported_by?: string;
    can_download: boolean;
    can_undo: boolean;
}

const BATCH_STATUS_LABELS: Record<ImportBatchStatus, string> = {
    processing: 'Importing…',
    active: 'Active',
    undone: 'Undone',
    failed: 'Failed',
};

const BATCH_STATUS_STYLES: Record<ImportBatchStatus, string> = {
    processing: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    active: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800',
    undone: 'bg-muted text-muted-foreground border-border',
    failed: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
};

/** A row the server could not insert, as reported by the bulk-import endpoint. */
export interface ImportRowError {
    row: number | null;
    seq: string | null;
    program: string | null;
    uii: string | null;
    hei_name?: string;
    error: string;
}

interface ImportValidationResponse {
    success: boolean;
    token: string | null;
    seen_control_nos?: Record<string, number>;
    rows: ValidatedRow[];
    /** Rows the server has accumulated for this import token so far. */
    row_count?: number;
    summary: {
        valid: number;
        errors: number;
    };
}

/** Response from queueing an import — the work itself happens on the worker. */
interface BulkImportDispatchResponse {
    success: boolean;
    batch_id: string;
    total_rows: number;
    source_file_warning: string | null;
    message: string | null;
}

interface ImportPreviewDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete: (result: { imported: number; errors: ImportRowError[] }) => void;
    initialFile?: File | null;
    initialShowHistory?: boolean;
    highlightBatchId?: string | null;
}

// --- Error helpers --------------------------------------------------------

/** Best human-readable message from an axios error, a thrown Error, or anything else. */
function errorMessage(error: unknown, fallback: string): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as { message?: string } | undefined;
        if (data?.message) return data.message;
    }
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

// --- Excel parsing --------------------------------------------------------

/**
 * Parse the workbook in a Web Worker, reporting rows as they're found.
 *
 * ExcelJS blocks for several seconds on a 4,000-row file, which froze the whole
 * tab while the dialog claimed to be working. Off-thread the UI stays live and
 * the progress bar actually moves during the parse phase.
 *
 * Falls back to parsing inline if the worker can't start (older browser, blocked
 * blob/module worker) — slower and janky, but never broken.
 */
async function parseExcel(
    file: File,
    onProgress: (rowsFound: number) => void,
): Promise<ParsedExcelRow[]> {
    const buffer = await file.arrayBuffer();

    let worker: Worker;
    try {
        worker = new Worker(new URL('../../workers/import-parser.worker.ts', import.meta.url), {
            type: 'module',
        });
    } catch {
        return parseExcelBuffer(buffer, onProgress);
    }

    try {
        return await new Promise<ParsedExcelRow[]>((resolve, reject) => {
            worker.onmessage = (event: MessageEvent<ParseResponse>) => {
                const message = event.data;

                if (message.type === 'progress') {
                    onProgress(message.rowsFound);
                    return;
                }
                if (message.type === 'done') {
                    resolve(message.rows);
                    return;
                }
                reject(new Error(message.message));
            };

            worker.onerror = () => reject(new Error('Failed to parse the Excel file.'));

            // Hand the buffer over rather than copying it — a 50 MB workbook
            // shouldn't be duplicated across threads.
            worker.postMessage({ buffer } satisfies ParseRequest, [buffer]);
        });
    } finally {
        worker.terminate();
    }
}

/** Rows sent to the backend validator per request. */
const VALIDATION_CHUNK_SIZE = 500;


// --- Component ------------------------------------------------------------

export function ImportPreviewDialog({
    isOpen,
    onClose,
    onImportComplete,
    initialFile,
    initialShowHistory,
    highlightBatchId,
}: ImportPreviewDialogProps) {
    const ROWS_PER_PAGE = 100;

    const [step, setStep] = useState<'idle' | 'validating' | 'preview' | 'importing'>('idle');
    const [rows, setRows] = useState<ValidatedRow[]>([]);
    const [summary, setSummary] = useState({ total: 0, valid: 0, errors: 0 });
    const [uploadPhase, setUploadPhase] = useState<'parsing' | 'processing'>('parsing');
    const [selectedRow, setSelectedRow] = useState<ValidatedRow | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [importToken, setImportToken] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowFilter, setRowFilter] = useState<'all' | 'valid' | 'errors'>('all');
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const processedFileRef = React.useRef<File | null>(null);

    // Which background import to watch. Set on dispatch; also discovered on open,
    // which is how a refreshed page re-attaches to an import already in flight.
    const [watchImport, setWatchImport] = useState(false);
    const [watchedBatchId, setWatchedBatchId] = useState<string | null>(null);

    // Validation progress (per-chunk, client-side — not polled)
    const [validateProgress, setValidateProgress] = useState<{ processed: number; total: number } | null>(null);

    // Import history state
    const [showHistory, setShowHistory] = useState(false);
    const [batches, setBatches] = useState<ImportBatchRecord[]>([]);
    const [loadingBatches, setLoadingBatches] = useState(false);
    const [undoingBatchId, setUndoingBatchId] = useState<string | null>(null);
    const [confirmUndoId, setConfirmUndoId] = useState<string | null>(null);

    // Filter + paginate rows
    const filteredRows = useMemo(() => {
        if (rowFilter === 'valid') return rows.filter((r) => r.valid);
        if (rowFilter === 'errors') return rows.filter((r) => !r.valid);
        return rows;
    }, [rows, rowFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);

    const paginatedRows = useMemo(
        () => filteredRows.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE),
        [filteredRows, safePage],
    );

    const reset = useCallback(() => {
        setStep('idle');
        setValidateProgress(null);
        setRows([]);
        setSummary({ total: 0, valid: 0, errors: 0 });
        setSelectedRow(null);
        setDetailOpen(false);
        setSelectedFile(null);
        setImportToken(null);
        setCurrentPage(1);
        setRowFilter('all');
        setUploadPhase('parsing');
        setShowHistory(false);
        setConfirmUndoId(null);
        setWatchImport(false);
        setWatchedBatchId(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    const handleClose = useCallback(() => {
        reset();
        onClose();
    }, [reset, onClose]);

    /**
     * Live progress for the import being watched.
     *
     * Closing the dialog only stops watching — the worker carries on, and the
     * banner on the liquidation page keeps showing it.
     */
    const { progress: importProgress, stalling: importStalling } = useImportProgress({
        enabled: isOpen && watchImport,
        batchId: watchedBatchId,
        onFinished: useCallback((progress: ImportProgress) => {
            if (progress.failed) {
                toast.error(progress.failed_reason || 'The import did not complete.');
            } else if (progress.imported > 0) {
                toast.success(`Imported ${progress.imported.toLocaleString()} liquidation(s).`);
            }

            onImportComplete({ imported: progress.imported, errors: [] });
            handleClose();
        }, [onImportComplete, handleClose]),
    });

    // An import is running — whether we just started it or found it already in
    // flight after a refresh — so show the progress view.
    useEffect(() => {
        if (importProgress && !importProgress.done) {
            setStep('importing');
        }
    }, [importProgress]);

    // On open, ask whether the user already has an import running. The hook stops
    // polling by itself when the answer is no, so this costs one request.
    useEffect(() => {
        if (isOpen) setWatchImport(true);
    }, [isOpen]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedFile(file);
        await validateFile(file);
    };


    /**
     * Parse the Excel file client-side, then send the parsed rows to the backend
     * in chunks for DB-level validation. This avoids both PhpSpreadsheet memory
     * issues and long single-request timeouts.
     */
    const validateFile = useCallback(async (file: File) => {
        setStep('validating');
        setUploadPhase('parsing');
        setValidateProgress(null);
        setSelectedRow(null);
        setDetailOpen(false);

        // Phase 1 — Parse the workbook off the main thread. Row count isn't known
        // until the sheet has been walked, so show rows-found as both figures and
        // let the bar sit at full for this phase; the label says "Reading".
        let parsedRows: ParsedExcelRow[];
        try {
            parsedRows = await parseExcel(file, (rowsFound) => {
                setValidateProgress({ processed: rowsFound, total: rowsFound });
            });
        } catch (err: unknown) {
            toast.error(errorMessage(err, 'Failed to parse Excel file.'));
            setStep('idle');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        setValidateProgress({ processed: parsedRows.length, total: parsedRows.length });

        if (parsedRows.length === 0) {
            toast.error('No data rows found in the Excel file.');
            setStep('idle');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        // Phase 2 — Send chunks to backend for DB-level validation
        setUploadPhase('processing');

        // Split into chunks
        const chunks: ParsedExcelRow[][] = [];
        for (let i = 0; i < parsedRows.length; i += VALIDATION_CHUNK_SIZE) {
            chunks.push(parsedRows.slice(i, i + VALIDATION_CHUNK_SIZE));
        }

        let importToken: string | null = null;
        let seenControlNos: Record<string, number> = {};
        const allValidatedRows: ValidatedRow[] = [];
        let totalValid = 0;
        let totalErrors = 0;

        try {
            for (let i = 0; i < chunks.length; i++) {
                const response: AxiosResponse<ImportValidationResponse> = await axios.post(route('liquidation.validate-parsed-import'), {
                    rows: chunks[i],
                    file_name: file.name,
                    import_token: importToken,
                    seen_control_nos: seenControlNos,
                });

                // A chunk that comes back unsuccessful used to be skipped silently,
                // dropping up to VALIDATION_CHUNK_SIZE rows and leaving the summary
                // quietly wrong. Fail the whole validation instead.
                if (!response.data.success) {
                    throw new Error('Validation failed partway through the file. Please try again.');
                }

                importToken = response.data.token;
                seenControlNos = response.data.seen_control_nos ?? seenControlNos;
                allValidatedRows.push(...response.data.rows);
                totalValid += response.data.summary.valid;
                totalErrors += response.data.summary.errors;

                // The server's running total must match the valid rows we've sent.
                // Any drift means a chunk didn't land — catch it here rather than
                // discovering it as a short import.
                const serverRowCount = response.data.row_count;
                if (serverRowCount !== undefined && serverRowCount !== totalValid) {
                    throw new Error(
                        `Validation is out of sync (server holds ${serverRowCount} of ${totalValid} rows). Please re-upload the file.`,
                    );
                }

                // Update progress after each chunk
                const processed = Math.min((i + 1) * VALIDATION_CHUNK_SIZE, parsedRows.length);
                setValidateProgress({ processed, total: parsedRows.length });
            }

            setRows(allValidatedRows);
            setSummary({ total: allValidatedRows.length, valid: totalValid, errors: totalErrors });
            setImportToken(importToken);
            setStep('preview');
        } catch (error: unknown) {
            toast.error(errorMessage(error, 'Failed to validate rows.'));
            setStep('idle');
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    const handleReUpload = () => {
        setSelectedRow(null);
        setDetailOpen(false);
        fileInputRef.current?.click();
    };

    const handleImport = async () => {
        if (!importToken || summary.valid === 0) return;

        const total = summary.valid;
        setStep('importing');

        // The original Excel rides along so the backend can persist it to S3 and
        // link it to the batch for later download.
        const formData = new FormData();
        formData.append('import_token', importToken);
        // Preflight: the server refuses the import outright if its cached row set
        // no longer matches the preview the user just approved.
        formData.append('expected_rows', String(total));
        if (selectedFile) {
            // Tell the backend a file is being sent so it can detect and warn
            // when PHP silently drops it (post_max_size / upload_max_filesize).
            formData.append('expects_source_file', '1');
            formData.append('source_file', selectedFile);
        }

        try {
            const { data } = await axios.post<BulkImportDispatchResponse>(
                route('liquidation.bulk-import'),
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } },
            );

            if (data.source_file_warning) {
                toast.warning(data.source_file_warning, { duration: 8000 });
            }

            // Hand off to the poller; the worker owns the import from here.
            setWatchedBatchId(data.batch_id);
            setWatchImport(true);
        } catch (error: unknown) {
            // Nothing was queued, so nothing was written — keep the user on the
            // preview with the reason rather than closing into a failure report
            // for records that were never attempted.
            toast.error(errorMessage(error, 'Import could not be started. Please re-validate the file.'));
            setStep('preview');
        }
    };

    const handleRowClick = (row: ValidatedRow) => {
        if (selectedRow?.row === row.row && detailOpen) {
            setDetailOpen(false);
            setTimeout(() => setSelectedRow(null), 200);
        } else {
            setSelectedRow(row);
            setDetailOpen(true);
        }
    };

    const fetchBatches = useCallback(async () => {
        setLoadingBatches(true);
        try {
            const res = await axios.get<{ batches?: ImportBatchRecord[] }>(route('liquidation.import-batches'), {
                params: highlightBatchId ? { batch_id: highlightBatchId } : {},
            });
            setBatches(res.data.batches ?? []);
        } catch {
            toast.error('Failed to load import history.');
        } finally {
            setLoadingBatches(false);
        }
    }, [highlightBatchId]);

    // Effects live below the callbacks they depend on — dependency arrays are
    // evaluated during render, so a `const` declared later would be in its TDZ.

    // Auto-validate when opened with an initialFile from the popover
    React.useEffect(() => {
        if (isOpen && initialFile && initialFile !== processedFileRef.current) {
            processedFileRef.current = initialFile;
            setSelectedFile(initialFile);
            validateFile(initialFile);
        }
        if (!isOpen) {
            processedFileRef.current = null;
        }
    }, [isOpen, initialFile, validateFile]);

    // Auto-open history when opened via "Import History" menu.
    // Tracked with a ref rather than reading `showHistory`, so toggling history
    // closed while the dialog is open doesn't immediately snap it back open.
    const autoOpenedHistoryRef = useRef(false);
    React.useEffect(() => {
        if (!isOpen) {
            autoOpenedHistoryRef.current = false;
            return;
        }
        if (initialShowHistory && !autoOpenedHistoryRef.current) {
            autoOpenedHistoryRef.current = true;
            setShowHistory(true);
            fetchBatches();
        }
    }, [isOpen, initialShowHistory, fetchBatches]);

    const toggleHistory = async () => {
        const next = !showHistory;
        setShowHistory(next);
        if (next) await fetchBatches();
    };

    const handleUndoBatch = async (batchId: string) => {
        setUndoingBatchId(batchId);
        try {
            const res = await axios.post<{ message: string }>(route('liquidation.undo-import-batch', { batchId }));
            toast.success(res.data.message);
            await fetchBatches();
            // Refresh the parent table
            onImportComplete({ imported: 0, errors: [] });
        } catch (error: unknown) {
            toast.error(errorMessage(error, 'Failed to undo import batch.'));
        } finally {
            setUndoingBatchId(null);
            setConfirmUndoId(null);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
            <DialogContent
                className="max-w-[90vw] sm:max-w-[90vw] w-[1400px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
                // Validation is client-side work that dies with the dialog, so it stays
                // modal. An import belongs to the worker, so let the user leave.
                onInteractOutside={(e) => { if (step === 'validating') e.preventDefault(); }}
                onEscapeKeyDown={(e) => { if (step === 'validating') e.preventDefault(); }}
            >
                {/* Header */}
                <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b pr-14">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            {showHistory ? (
                                <History className="h-5 w-5 text-blue-600 shrink-0" />
                            ) : (
                                <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />
                            )}
                            <DialogTitle>
                                {showHistory && 'Import History'}
                                {!showHistory && step === 'idle' && 'Bulk Import'}
                                {!showHistory && step === 'validating' && 'Validating...'}
                                {!showHistory && step === 'preview' && 'Import Preview'}
                                {!showHistory && step === 'importing' && 'Importing...'}
                            </DialogTitle>
                        </div>
                        {(step === 'preview' || step === 'idle') && (
                            <Button
                                variant={showHistory ? 'default' : 'outline'}
                                size="sm"
                                onClick={toggleHistory}
                                className="shrink-0"
                            >
                                {showHistory ? (
                                    step === 'preview' ? (
                                        <>
                                            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                                            Back to Preview
                                        </>
                                    ) : (
                                        <>
                                            <X className="h-3.5 w-3.5 mr-1.5" />
                                            Close History
                                        </>
                                    )
                                ) : (
                                    <>
                                        <History className="h-3.5 w-3.5 mr-1.5" />
                                        Import History
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                    <DialogDescription>
                        {showHistory && 'View and undo recent bulk imports.'}
                        {!showHistory && step === 'validating' && 'Checking your file for errors...'}
                        {!showHistory && step === 'preview' && 'Review the validation results below. Click a row to see details.'}
                        {!showHistory && step === 'importing' && 'Creating liquidation records...'}
                    </DialogDescription>
                </DialogHeader>

                {/* Body */}
                <div className="flex-1 min-h-0 flex overflow-hidden">

                    {/* Import history view */}
                    {showHistory && (
                        <div className="flex-1 overflow-y-auto p-6">
                            {loadingBatches ? (
                                <div className="flex flex-col items-center justify-center gap-4 py-16">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <p className="text-sm text-muted-foreground">Loading import history...</p>
                                </div>
                            ) : batches.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                                    <FileX2 className="h-10 w-10" />
                                    <p className="text-sm">No import batches found.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {batches.map((batch) => (
                                        <div
                                            key={batch.id}
                                            className={cn(
                                                'flex items-center justify-between rounded-lg border px-4 py-3',
                                                batch.status === 'undone'
                                                    ? 'bg-muted/40 opacity-60'
                                                    : 'bg-card',
                                                highlightBatchId === batch.id &&
                                                    'border-blue-400 bg-blue-50/70 opacity-100 ring-2 ring-blue-500/30 dark:bg-blue-950/20',
                                            )}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                                                    <p className="text-sm font-medium truncate">{batch.file_name}</p>
                                                    {highlightBatchId === batch.id && (
                                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                                                            Selected
                                                        </span>
                                                    )}
                                                    <span className={cn(
                                                        'text-[10px] font-medium px-2 py-0.5 rounded-full border',
                                                        BATCH_STATUS_STYLES[batch.status],
                                                    )}>
                                                        {BATCH_STATUS_LABELS[batch.status]}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                    <span>{batch.imported_count} of {batch.total_rows} imported</span>
                                                    {batch.imported_by && <span>by {batch.imported_by}</span>}
                                                    <span>{batch.created_at}</span>
                                                    {batch.undone_at && (
                                                        <span className="text-orange-600 dark:text-orange-400">
                                                            Undone {batch.undone_at}
                                                        </span>
                                                    )}
                                                </div>
                                                {batch.failed_reason && (
                                                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                                                        {batch.failed_reason}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="ml-4 shrink-0">
                                                {confirmUndoId === batch.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-destructive font-medium">Are you sure?</span>
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            disabled={undoingBatchId === batch.id}
                                                            onClick={() => handleUndoBatch(batch.id)}
                                                        >
                                                            {undoingBatchId === batch.id ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                                            ) : (
                                                                <Undo2 className="h-3.5 w-3.5 mr-1" />
                                                            )}
                                                            Yes, Undo
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setConfirmUndoId(null)}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        {batch.can_download && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        asChild
                                                                    >
                                                                        <a
                                                                            href={route('liquidation.download-import-batch-file', { batchId: batch.id })}
                                                                            download
                                                                        >
                                                                            <Download className="h-3.5 w-3.5 mr-1.5" />
                                                                            Download
                                                                        </a>
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    Download the original Excel file
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                        {batch.status === 'processing' && (
                                                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                Importing in the background
                                                            </span>
                                                        )}
                                                        {batch.can_undo && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => setConfirmUndoId(batch.id)}
                                                                    >
                                                                        <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                                                                        Undo
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    Delete all un-submitted records from this import
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Validating with progress + skeleton */}
                    {!showHistory && step === 'validating' && (() => {
                        const isProcessing = uploadPhase === 'processing';
                        const hasValidateData = isProcessing && validateProgress && validateProgress.total > 0;
                        // The parse phase can't be a percentage — the row count isn't
                        // known until the worker has walked the whole sheet. Show an
                        // indeterminate bar with a live rows-read count instead.
                        const rowsRead = !isProcessing ? (validateProgress?.processed ?? 0) : 0;
                        const displayPct = hasValidateData
                            ? Math.round((validateProgress!.processed / validateProgress!.total) * 100)
                            : 0;
                        const isDeterminate = Boolean(hasValidateData);

                        return (
                            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                                {/* Progress section */}
                                <div className="px-6 pt-6 pb-4 shrink-0 border-b">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                                                <span className="text-sm font-medium">
                                                    {isProcessing ? 'Validating rows...' : 'Reading Excel file...'}
                                                </span>
                                            </div>
                                            <span className="text-2xl font-bold font-mono tabular-nums text-foreground">
                                                {isDeterminate ? `${displayPct}%` : '—'}
                                            </span>
                                        </div>
                                        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                                            {isDeterminate ? (
                                                <div
                                                    className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                                                    style={{ width: `${displayPct}%` }}
                                                />
                                            ) : (
                                                <div className="h-full w-full rounded-full bg-primary/30 relative overflow-hidden">
                                                    <div className="absolute inset-0 bg-primary animate-progress-indeterminate" />
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {isProcessing
                                                ? hasValidateData
                                                    ? `${validateProgress!.processed.toLocaleString()} of ${validateProgress!.total.toLocaleString()} rows checked`
                                                    : 'Preparing validation — this may take a moment for large files.'
                                                : rowsRead > 0
                                                    ? `${rowsRead.toLocaleString()} rows read so far`
                                                    : 'Reading the Excel file — the window stays responsive.'
                                            }
                                        </p>
                                    </div>
                                </div>

                                {/* Skeleton preview — mimics the table that will appear */}
                                <div className="flex-1 overflow-hidden">
                                    <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b shrink-0">
                                        <div className="h-5 w-24 rounded-full bg-muted animate-pulse" />
                                        <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
                                        <div className="h-5 w-22 rounded-full bg-muted animate-pulse" />
                                    </div>
                                    <div className="flex items-center gap-3 px-4 py-2 bg-muted/20 border-b">
                                        {[10, 8, 12, 16, 24, 16, 14].map((w, i) => (
                                            <div key={i} className="h-2.5 rounded bg-muted animate-pulse flex-shrink-0" style={{ width: `${w * 4}px` }} />
                                        ))}
                                    </div>
                                    {[...Array(10)].map((_, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-3 px-4 py-3 border-b"
                                            style={{ opacity: 1 - i * 0.08 }}
                                        >
                                            <div className="h-3 w-10 rounded bg-muted animate-pulse flex-shrink-0" />
                                            <div className="h-4 w-4 rounded-full bg-muted animate-pulse flex-shrink-0" />
                                            <div className="h-3 w-12 rounded bg-muted animate-pulse flex-shrink-0" />
                                            <div className="h-3 w-16 rounded bg-muted animate-pulse flex-shrink-0" />
                                            <div className="h-3 flex-1 rounded bg-muted animate-pulse" />
                                            <div className="h-3 w-20 rounded bg-muted animate-pulse flex-shrink-0" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Importing — spinner + progress, no skeleton */}
                    {!showHistory && step === 'importing' && (() => {
                        const pct = importProgress?.percent ?? 0;
                        // Every row can be in while the batch is still open, so the
                        // phase comes from the counts — that's what stops "4,334 of
                        // 4,334" sitting next to a percentage that disagrees with it.
                        const phase = importProgress ? importPhase(importProgress) : 'inserting';

                        return (
                            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-10 py-12 max-w-lg mx-auto w-full">
                                {/* Spinner + label */}
                                <div className="flex items-center gap-3">
                                    <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                                    <span className="text-sm font-medium">
                                        {phase === 'finalising' ? 'Finalising...' : 'Importing records...'}
                                    </span>
                                </div>

                                {/* Progress */}
                                <div className="w-full space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-muted-foreground">
                                            {(importProgress?.processed ?? 0).toLocaleString()} of {(importProgress?.total ?? 0).toLocaleString()} rows
                                        </p>
                                        <span className="text-2xl font-bold font-mono tabular-nums text-foreground">
                                            {pct}%
                                        </span>
                                    </div>
                                    <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-primary transition-all duration-200 ease-out"
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    {importStalling ? (
                                        <p className="text-xs text-center text-amber-600 dark:text-amber-500">
                                            Taking longer than usual — still finishing up on the server.
                                            You can close this window; we'll sort it out either way.
                                        </p>
                                    ) : (
                                        <p className="text-xs text-muted-foreground text-center">
                                            This runs on the server — you can close this window or leave the
                                            page and the import will keep going.
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Preview — two panel layout */}
                    {!showHistory && step === 'preview' && (
                        <>
                            {/* Left panel — row list */}
                            <div
                                className={cn(
                                    'flex flex-col min-h-0 transition-all duration-300 ease-in-out border-r',
                                    detailOpen ? 'w-[55%]' : 'w-full',
                                )}
                            >
                                {/* Summary bar + filter */}
                                <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b shrink-0">
                                    <div className="flex items-center gap-3">
                                        <Badge variant="outline" className="gap-1.5 font-normal">
                                            <FileSpreadsheet className="h-3 w-3" />
                                            {summary.total} row(s)
                                        </Badge>
                                        <Badge className="gap-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 shadow-none font-normal">
                                            <CheckCircle2 className="h-3 w-3" />
                                            {summary.valid} valid
                                        </Badge>
                                        {summary.errors > 0 && (
                                            <Badge className="gap-1.5 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-800 shadow-none font-normal">
                                                <XCircle className="h-3 w-3" />
                                                {summary.errors} error(s)
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Filter className="h-3 w-3 text-muted-foreground" />
                                        {(['all', 'errors', 'valid'] as const).map((f) => (
                                            <button
                                                key={f}
                                                onClick={() => { setRowFilter(f); setCurrentPage(1); }}
                                                className={cn(
                                                    'px-2 py-0.5 rounded text-[11px] font-medium transition-colors capitalize',
                                                    rowFilter === f
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'text-muted-foreground hover:bg-muted',
                                                )}
                                            >
                                                {f === 'all' ? `All (${summary.total})` : f === 'errors' ? `Errors (${summary.errors})` : `Valid (${summary.valid})`}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Table */}
                                <div className="flex-1 overflow-auto min-h-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground w-16">Row</th>
                                                <th className="px-3 py-2 text-center text-[11px] font-medium text-muted-foreground w-12">Status</th>
                                                <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground w-16">Program</th>
                                                <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground">UII</th>
                                                <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground">HEI Name</th>
                                                <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground">Control / Ledger No.</th>
                                                {!detailOpen && (
                                                    <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground">Error</th>
                                                )}
                                                <th className="px-3 py-2 w-8"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {paginatedRows.map((row) => (
                                                <tr
                                                    key={row.row}
                                                    onClick={() => handleRowClick(row)}
                                                    className={cn(
                                                        'cursor-pointer transition-colors',
                                                        selectedRow?.row === row.row && detailOpen
                                                            ? 'bg-primary/5 dark:bg-primary/10'
                                                            : 'hover:bg-muted/40',
                                                        !row.valid && 'bg-red-50/50 dark:bg-red-950/10',
                                                    )}
                                                >
                                                    <td className="px-3 py-2 text-xs font-mono text-muted-foreground">
                                                        {row.row}
                                                        <span className="text-[10px] text-muted-foreground/60 ml-1">#{row.seq}</span>
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        {row.valid ? (
                                                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                                                        ) : (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                                                                </TooltipTrigger>
                                                                <TooltipContent side="right" className="max-w-xs text-xs">
                                                                    {row.errors.length} error(s)
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-xs font-mono">{row.program || '-'}</td>
                                                    <td className="px-3 py-2 text-xs font-mono">{row.uii || '-'}</td>
                                                    <td className="px-3 py-2 text-xs truncate max-w-[160px]">{row.hei_name || '-'}</td>
                                                    <td className="px-3 py-2 text-xs font-mono">
                                                        {row.control_no
                                                            ? (() => {
                                                                const parts = row.control_no.split(' / ');
                                                                if (parts.length <= 1) return row.control_no;
                                                                return (
                                                                    <span className="inline-flex items-center gap-1.5">
                                                                        <span className="truncate max-w-[120px]">{parts[0]}</span>
                                                                        <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                                            +{parts.length - 1}
                                                                        </span>
                                                                    </span>
                                                                );
                                                            })()
                                                            : <span className="text-muted-foreground italic">auto</span>}
                                                    </td>
                                                    {!detailOpen && (
                                                        <td className="px-3 py-2 text-xs text-red-600 dark:text-red-400 truncate max-w-[200px]">
                                                            {row.errors[0] || ''}
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-2">
                                                        <ChevronRight className={cn(
                                                            'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
                                                            selectedRow?.row === row.row && detailOpen && 'rotate-180',
                                                        )} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20 shrink-0">
                                        <p className="text-[11px] text-muted-foreground">
                                            Showing {((safePage - 1) * ROWS_PER_PAGE) + 1}–{Math.min(safePage * ROWS_PER_PAGE, filteredRows.length)} of {filteredRows.length}
                                        </p>
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={safePage <= 1} onClick={() => setCurrentPage(1)}>
                                                <ChevronsLeft className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={safePage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                                                <ChevronLeft className="h-3.5 w-3.5" />
                                            </Button>
                                            <span className="text-xs text-muted-foreground px-2">
                                                Page {safePage} of {totalPages}
                                            </span>
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={safePage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                                                <ChevronRight className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={safePage >= totalPages} onClick={() => setCurrentPage(totalPages)}>
                                                <ChevronsRight className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right panel — detail slide */}
                            <div
                                className={cn(
                                    'transition-all duration-300 ease-in-out overflow-hidden flex flex-col',
                                    detailOpen ? 'w-[45%] opacity-100' : 'w-0 opacity-0',
                                )}
                            >
                                {selectedRow && (
                                    <div className="flex flex-col h-full min-w-[340px]">
                                        {/* Detail header */}
                                        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b shrink-0">
                                            <div className="flex items-center gap-2.5">
                                                <div className={cn(
                                                    'flex items-center justify-center h-7 w-7 rounded-md text-[11px] font-bold',
                                                    selectedRow.valid
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                                        : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
                                                )}>
                                                    {selectedRow.valid ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold leading-tight">Row {selectedRow.row}</p>
                                                    <p className="text-[10px] text-muted-foreground leading-tight">SEQ {selectedRow.seq}</p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 rounded-full hover:bg-muted"
                                                onClick={() => {
                                                    setDetailOpen(false);
                                                    setTimeout(() => setSelectedRow(null), 200);
                                                }}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>

                                        {/* Errors */}
                                        {selectedRow.errors.length > 0 && (
                                            <div className="px-4 py-3 border-b bg-red-50/50 dark:bg-red-950/20 shrink-0">
                                                <div className="flex items-center gap-1.5 mb-2">
                                                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                                                    <p className="text-[11px] font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">
                                                        {selectedRow.errors.length} Error{selectedRow.errors.length > 1 ? 's' : ''} Found
                                                    </p>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {selectedRow.errors.map((err, i) => (
                                                        <div key={i} className="flex items-start gap-2 bg-red-100/60 dark:bg-red-950/40 rounded-md px-2.5 py-1.5">
                                                            <XCircle className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />
                                                            <p className="text-[11px] text-red-700 dark:text-red-400 leading-snug">{err}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Field values — grouped by section */}
                                        <div className="flex-1 overflow-auto">
                                            {/* Institution */}
                                            <DetailSection icon={Building2} title="Institution">
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                                                    <DetailField label="Program" value={selectedRow.program} />
                                                    <DetailField label="UII" value={selectedRow.uii} mono />
                                                </div>
                                                <DetailField label="HEI Name" value={selectedRow.hei_name} className="mt-2.5" />
                                            </DetailSection>

                                            {/* Period & Identification */}
                                            <DetailSection icon={Calendar} title="Period & Identification">
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                                                    <DetailField label="Academic Year" value={selectedRow.academic_year} />
                                                    <DetailField label="Semester" value={selectedRow.semester} />
                                                    <DetailField label="Date Fund Released" value={selectedRow.date_fund_released} />
                                                    <DetailField label="Due Date" value={selectedRow.due_date} />
                                                    <DetailField label="Batch No." value={selectedRow.batch_no} />
                                                </div>
                                                <LedgerNoField value={selectedRow.control_no} className="mt-2.5" />
                                            </DetailSection>

                                            {/* Financial */}
                                            <DetailSection icon={Banknote} title="Financial">
                                                <div className="grid grid-cols-3 gap-3">
                                                    <FinancialCard
                                                        label="Grantees"
                                                        value={selectedRow.grantees?.toLocaleString() ?? '-'}
                                                    />
                                                    <FinancialCard
                                                        label="Disbursements"
                                                        value={selectedRow.disbursements ? `₱${selectedRow.disbursements.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                                                        highlight
                                                    />
                                                    <FinancialCard
                                                        label="Amt Liquidated"
                                                        value={selectedRow.amount_liquidated ? `₱${selectedRow.amount_liquidated.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                                                    />
                                                </div>
                                                {selectedRow.ledger_breakdown && selectedRow.ledger_breakdown.length > 1 && (
                                                    <LedgerBreakdownTable
                                                        breakdown={selectedRow.ledger_breakdown}
                                                        total={selectedRow.grantees ?? 0}
                                                        className="mt-3"
                                                    />
                                                )}
                                            </DetailSection>

                                            {/* Status */}
                                            <DetailSection icon={ClipboardList} title="Status" last>
                                                <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground mb-1">Documents Status</p>
                                                        <StatusPill value={selectedRow.doc_status} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground mb-1">RC Notes</p>
                                                        <StatusPill value={selectedRow.rc_notes} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground mb-1">Liquidation Status</p>
                                                        <StatusPill value={selectedRow.liquidation_status} />
                                                    </div>
                                                </div>
                                            </DetailSection>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {step === 'preview' && !showHistory && (
                    <div className="flex items-center justify-between px-6 py-4 border-t shrink-0 bg-muted/20">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={handleReUpload}>
                                <Upload className="h-3.5 w-3.5 mr-1.5" />
                                Re-upload
                            </Button>
                            {selectedFile && (
                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                    {selectedFile.name}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={handleClose}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={summary.valid === 0 || !importToken}
                            >
                                <ArrowRight className="h-4 w-4 mr-1.5" />
                                Import {summary.valid} Record{summary.valid !== 1 ? 's' : ''}
                                {summary.errors > 0 && (
                                    <span className="ml-1 text-xs opacity-75">
                                        ({summary.errors} skipped)
                                    </span>
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {/* History footer */}
                {showHistory && (
                    <div className="flex items-center justify-end px-6 py-4 border-t shrink-0 bg-muted/20">
                        <Button variant="outline" onClick={handleClose}>
                            Close
                        </Button>
                    </div>
                )}

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileSelect}
                />
            </DialogContent>
        </Dialog>
    );
}

// --- Detail helpers -------------------------------------------------------

function DetailSection({
    icon: Icon,
    title,
    children,
    last,
}: {
    icon: React.ElementType;
    title: string;
    children: React.ReactNode;
    last?: boolean;
}) {
    return (
        <div className={cn('px-4 py-3', !last && 'border-b')}>
            <div className="flex items-center gap-1.5 mb-3">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
            </div>
            {children}
        </div>
    );
}

function DetailField({
    label,
    value,
    mono,
    className: extraClass,
}: {
    label: string;
    value: string | null | undefined;
    mono?: boolean;
    className?: string;
}) {
    return (
        <div className={extraClass}>
            <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
            <p className={cn('text-xs leading-snug', mono && 'font-mono', !value && 'text-muted-foreground italic')}>
                {value || '-'}
            </p>
        </div>
    );
}

/** Renders Control / Ledger No. — single value as mono text, multiple as a wrapping badge list. */
function LedgerNoField({ value, className }: { value: string; className?: string }) {
    const tokens = value ? value.split(' / ').filter(Boolean) : [];
    if (tokens.length === 0) {
        return (
            <div className={className}>
                <p className="text-[10px] text-muted-foreground mb-0.5">Control / Ledger No.</p>
                <p className="text-xs font-mono text-muted-foreground italic">Auto-generated</p>
            </div>
        );
    }
    if (tokens.length === 1) {
        return (
            <div className={className}>
                <p className="text-[10px] text-muted-foreground mb-0.5">Control / Ledger No.</p>
                <p className="text-xs font-mono leading-snug">{tokens[0]}</p>
            </div>
        );
    }
    return (
        <div className={className}>
            <p className="text-[10px] text-muted-foreground mb-1">
                Control / Ledger Nos. <span className="text-muted-foreground/70">({tokens.length})</span>
            </p>
            <div className="flex flex-wrap gap-1">
                {tokens.map((tok, i) => (
                    <span
                        key={`${tok}-${i}`}
                        className="text-[11px] font-mono px-1.5 py-0.5 rounded border bg-muted/40"
                    >
                        {tok}
                    </span>
                ))}
            </div>
        </div>
    );
}

/** Per-ledger grantee breakdown — renders a compact ledger → grantees table with a total row. */
function LedgerBreakdownTable({
    breakdown,
    total,
    className,
}: {
    breakdown: LedgerBreakdownEntry[];
    total: number;
    className?: string;
}) {
    return (
        <div className={cn('rounded-md border overflow-hidden', className)}>
            <div className="px-3 py-1.5 bg-muted/30 border-b">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Per-Ledger Breakdown
                </p>
            </div>
            <table className="w-full text-xs">
                <thead className="bg-muted/20 border-b">
                    <tr>
                        <th className="px-3 py-1.5 text-left text-[10px] font-medium text-muted-foreground">Ledger</th>
                        <th className="px-3 py-1.5 text-right text-[10px] font-medium text-muted-foreground">Grantees</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {breakdown.map((entry, i) => (
                        <tr key={`${entry.ledger}-${i}`}>
                            <td className="px-3 py-1.5 font-mono">{entry.ledger}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{entry.grantees.toLocaleString()}</td>
                        </tr>
                    ))}
                    <tr className="bg-muted/30 border-t-2">
                        <td className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total</td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{total.toLocaleString()}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

function FinancialCard({
    label,
    value,
    highlight,
}: {
    label: string;
    value: string;
    highlight?: boolean;
}) {
    return (
        <div className={cn(
            'rounded-lg border px-3 py-2 text-center',
            highlight ? 'bg-primary/5 border-primary/20' : 'bg-muted/30',
        )}>
            <p className="text-[10px] text-muted-foreground mb-0.5 truncate">{label}</p>
            <p className={cn(
                'text-xs font-semibold font-mono truncate',
                highlight && 'text-primary',
                value === '-' && 'text-muted-foreground font-normal',
            )}>
                {value}
            </p>
        </div>
    );
}

function StatusPill({ value }: { value: string | null | undefined }) {
    if (!value) {
        return <span className="text-xs text-muted-foreground italic">-</span>;
    }

    const upper = value.toUpperCase();
    const variant =
        upper.includes('FULLY LIQUIDATED') ? 'emerald' :
        upper.includes('PARTIALLY LIQUIDATED') ? 'amber' :
        upper.includes('UNLIQUIDATED') ? 'orange' :
        upper.includes('COMPLETE') && !upper.includes('PARTIAL') ? 'emerald' :
        upper.includes('PARTIAL') ? 'amber' :
        upper.includes('ENDORSED') ? 'emerald' :
        upper.includes('COMPLIANCE') ? 'orange' :
        upper.includes('REVIEW') ? 'blue' :
        upper === 'NONE' || upper === 'N/A' ? 'gray' :
        'gray';

    const colors: Record<string, string> = {
        emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
        amber:   'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-800',
        orange:  'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 border-orange-200 dark:border-orange-800',
        blue:    'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        gray:    'bg-muted text-muted-foreground border-border',
    };

    return (
        <span className={cn('inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border', colors[variant])}>
            {value}
        </span>
    );
}
