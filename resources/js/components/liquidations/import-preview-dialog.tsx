import React, { useState, useCallback, useMemo } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import axios from 'axios';

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
    disbursements: number;
    amount_liquidated: number;
    doc_status: string;
    rc_notes: string;
    liquidation_status: string | null;
}

interface ImportBatchRecord {
    id: string;
    file_name: string;
    total_rows: number;
    imported_count: number;
    status: 'active' | 'undone';
    created_at: string;
    undone_at: string | null;
}

interface ImportPreviewDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete: (result: { imported: number; errors: any[] }) => void;
    initialFile?: File | null;
}

// --- Component ------------------------------------------------------------

export function ImportPreviewDialog({
    isOpen,
    onClose,
    onImportComplete,
    initialFile,
}: ImportPreviewDialogProps) {
    const ROWS_PER_PAGE = 100;

    const [step, setStep] = useState<'idle' | 'validating' | 'preview' | 'importing'>('idle');
    const [rows, setRows] = useState<ValidatedRow[]>([]);
    const [summary, setSummary] = useState({ total: 0, valid: 0, errors: 0 });
    const [selectedRow, setSelectedRow] = useState<ValidatedRow | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [importToken, setImportToken] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowFilter, setRowFilter] = useState<'all' | 'valid' | 'errors'>('all');
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const processedFileRef = React.useRef<File | null>(null);

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
    }, [isOpen, initialFile]);

    const reset = useCallback(() => {
        setStep('idle');
        setRows([]);
        setSummary({ total: 0, valid: 0, errors: 0 });
        setSelectedRow(null);
        setDetailOpen(false);
        setSelectedFile(null);
        setImportToken(null);
        setCurrentPage(1);
        setRowFilter('all');
        setShowHistory(false);
        setConfirmUndoId(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedFile(file);
        await validateFile(file);
    };

    const validateFile = async (file: File) => {
        setStep('validating');
        setSelectedRow(null);
        setDetailOpen(false);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post(route('liquidation.validate-import'), formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (response.data.success) {
                setRows(response.data.rows);
                setSummary(response.data.summary);
                setImportToken(response.data.token ?? null);
                setStep('preview');
            }
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Failed to validate file.';
            toast.error(msg);
            setStep('idle');
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleReUpload = () => {
        setSelectedRow(null);
        setDetailOpen(false);
        fileInputRef.current?.click();
    };

    const handleImport = async () => {
        if (!importToken || summary.valid === 0) return;

        setStep('importing');

        try {
            // Send the server-side token — no file re-upload needed
            const response = await axios.post(route('liquidation.bulk-import'), {
                import_token: importToken,
            });

            const imported = response.data.imported ?? 0;
            const errors = response.data.errors ?? [];

            if (imported > 0 && errors.length === 0) {
                toast.success(response.data.message);
            }

            onImportComplete({ imported, errors });
            handleClose();
        } catch (error: any) {
            const errors = error.response?.data?.errors ?? [];
            const imported = error.response?.data?.imported ?? 0;
            onImportComplete({ imported, errors });
            handleClose();
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

    const fetchBatches = async () => {
        setLoadingBatches(true);
        try {
            const res = await axios.get(route('liquidation.import-batches'));
            setBatches(res.data.batches ?? []);
        } catch {
            toast.error('Failed to load import history.');
        } finally {
            setLoadingBatches(false);
        }
    };

    const toggleHistory = async () => {
        const next = !showHistory;
        setShowHistory(next);
        if (next) await fetchBatches();
    };

    const handleUndoBatch = async (batchId: string) => {
        setUndoingBatchId(batchId);
        try {
            const res = await axios.post(route('liquidation.undo-import-batch', { batchId }));
            toast.success(res.data.message);
            await fetchBatches();
            // Refresh the parent table
            onImportComplete({ imported: 0, errors: [] });
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to undo import batch.');
        } finally {
            setUndoingBatchId(null);
            setConfirmUndoId(null);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
            <DialogContent className="max-w-[90vw] sm:max-w-[90vw] w-[1400px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                {/* Header */}
                <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
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
                                            )}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                                                    <p className="text-sm font-medium truncate">{batch.file_name}</p>
                                                    <span className={cn(
                                                        'text-[10px] font-medium px-2 py-0.5 rounded-full border',
                                                        batch.status === 'active'
                                                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800'
                                                            : 'bg-muted text-muted-foreground border-border',
                                                    )}>
                                                        {batch.status === 'active' ? 'Active' : 'Undone'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                    <span>{batch.imported_count} of {batch.total_rows} imported</span>
                                                    <span>{batch.created_at}</span>
                                                    {batch.undone_at && (
                                                        <span className="text-orange-600 dark:text-orange-400">
                                                            Undone {batch.undone_at}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {batch.status === 'active' && (
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
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Validating spinner */}
                    {!showHistory && step === 'validating' && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-10">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Validating your file...</p>
                        </div>
                    )}

                    {/* Importing spinner */}
                    {!showHistory && step === 'importing' && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-10">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">
                                Importing {summary.valid} record(s)...
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Large files are processed in batches — please do not close this window.
                            </p>
                        </div>
                    )}

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
                                                <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground">Control No.</th>
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
                                                    <td className="px-3 py-2 text-xs font-mono">{row.control_no || <span className="text-muted-foreground italic">auto</span>}</td>
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
                                                    <DetailField label="Control No." value={selectedRow.control_no || 'Auto-generated'} mono />
                                                </div>
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
