import React, { useState, useCallback } from 'react';
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
    FileSpreadsheet,
    ArrowRight,
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
}

interface ImportPreviewDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete: (result: { imported: number; errors: any[] }) => void;
}

// --- Component ------------------------------------------------------------

export function ImportPreviewDialog({
    isOpen,
    onClose,
    onImportComplete,
}: ImportPreviewDialogProps) {
    const [step, setStep] = useState<'idle' | 'validating' | 'preview' | 'importing'>('idle');
    const [rows, setRows] = useState<ValidatedRow[]>([]);
    const [summary, setSummary] = useState({ total: 0, valid: 0, errors: 0 });
    const [selectedRow, setSelectedRow] = useState<ValidatedRow | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const reset = useCallback(() => {
        setStep('idle');
        setRows([]);
        setSummary({ total: 0, valid: 0, errors: 0 });
        setSelectedRow(null);
        setDetailOpen(false);
        setSelectedFile(null);
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
        if (!selectedFile || summary.valid === 0) return;

        setStep('importing');
        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await axios.post(route('liquidation.bulk-import'), formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
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

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
            <DialogContent className="max-w-[90vw] sm:max-w-[90vw] w-[1400px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                {/* Header */}
                <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
                    <div className="flex items-center gap-2.5">
                        <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />
                        <DialogTitle>
                            {step === 'idle' && 'Upload Excel File'}
                            {step === 'validating' && 'Validating...'}
                            {step === 'preview' && 'Import Preview'}
                            {step === 'importing' && 'Importing...'}
                        </DialogTitle>
                    </div>
                    <DialogDescription>
                        {step === 'idle' && 'Select an Excel file to validate before importing.'}
                        {step === 'validating' && 'Checking your file for errors...'}
                        {step === 'preview' && 'Review the validation results below. Click a row to see details.'}
                        {step === 'importing' && 'Creating liquidation records...'}
                    </DialogDescription>
                </DialogHeader>

                {/* Body */}
                <div className="flex-1 min-h-0 flex overflow-hidden">
                    {/* Idle state — upload prompt */}
                    {step === 'idle' && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-10">
                            <div className="rounded-full bg-muted p-6">
                                <Upload className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-medium mb-1">Select your Excel file</p>
                                <p className="text-xs text-muted-foreground">
                                    Supports .xlsx and .xls files (max 10MB)
                                </p>
                            </div>
                            <Button onClick={() => fileInputRef.current?.click()}>
                                <Upload className="h-4 w-4 mr-2" />
                                Choose File
                            </Button>
                        </div>
                    )}

                    {/* Validating spinner */}
                    {step === 'validating' && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-10">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Validating your file...</p>
                        </div>
                    )}

                    {/* Importing spinner */}
                    {step === 'importing' && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-10">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">
                                Importing {summary.valid} record(s)...
                            </p>
                        </div>
                    )}

                    {/* Preview — two panel layout */}
                    {step === 'preview' && (
                        <>
                            {/* Left panel — row list */}
                            <div
                                className={cn(
                                    'flex flex-col min-h-0 transition-all duration-300 ease-in-out border-r',
                                    detailOpen ? 'w-[55%]' : 'w-full',
                                )}
                            >
                                {/* Summary bar */}
                                <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b shrink-0">
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

                                {/* Table */}
                                <div className="flex-1 overflow-auto min-h-0">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground w-10">#</th>
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
                                            {rows.map((row) => (
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
                                                    <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{row.seq}</td>
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
                                        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b shrink-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-muted-foreground">Row {selectedRow.seq}</span>
                                                {selectedRow.valid ? (
                                                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 shadow-none text-[10px] px-1.5 py-0">
                                                        Valid
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-800 shadow-none text-[10px] px-1.5 py-0">
                                                        {selectedRow.errors.length} error(s)
                                                    </Badge>
                                                )}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                onClick={() => {
                                                    setDetailOpen(false);
                                                    setTimeout(() => setSelectedRow(null), 200);
                                                }}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        {/* Errors */}
                                        {selectedRow.errors.length > 0 && (
                                            <div className="px-4 py-3 border-b bg-red-50/50 dark:bg-red-950/20 shrink-0">
                                                <p className="text-[11px] font-medium text-red-700 dark:text-red-400 mb-1.5 uppercase tracking-wider">Errors</p>
                                                <div className="space-y-1">
                                                    {selectedRow.errors.map((err, i) => (
                                                        <div key={i} className="flex items-start gap-1.5">
                                                            <XCircle className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />
                                                            <p className="text-xs text-red-600 dark:text-red-400">{err}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Field values */}
                                        <div className="flex-1 overflow-auto px-4 py-3">
                                            <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Row Data</p>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                                <DetailField label="Program" value={selectedRow.program} />
                                                <DetailField label="UII" value={selectedRow.uii} mono />
                                                <DetailField label="HEI Name" value={selectedRow.hei_name} full />
                                                <DetailField label="Fund Released" value={selectedRow.date_fund_released} />
                                                <DetailField label="Due Date" value={selectedRow.due_date} />
                                                <DetailField label="Academic Year" value={selectedRow.academic_year} />
                                                <DetailField label="Semester" value={selectedRow.semester} />
                                                <DetailField label="Batch No." value={selectedRow.batch_no} />
                                                <DetailField label="Control No." value={selectedRow.control_no || 'Auto-generated'} mono />
                                                <DetailField label="Grantees" value={selectedRow.grantees?.toString()} />
                                                <DetailField label="Disbursements" value={selectedRow.disbursements ? `₱${selectedRow.disbursements.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : null} />
                                                <DetailField label="Amt Liquidated" value={selectedRow.amount_liquidated ? `₱${selectedRow.amount_liquidated.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : null} />
                                                <DetailField label="Doc Status" value={selectedRow.doc_status} />
                                                <DetailField label="RC Notes" value={selectedRow.rc_notes} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {step === 'preview' && (
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
                                disabled={summary.valid === 0}
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

// --- Detail field helper --------------------------------------------------

function DetailField({
    label,
    value,
    mono,
    full,
}: {
    label: string;
    value: string | null | undefined;
    mono?: boolean;
    full?: boolean;
}) {
    return (
        <div className={full ? 'col-span-2' : ''}>
            <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
            <p className={cn('text-xs', mono && 'font-mono', !value && 'text-muted-foreground italic')}>
                {value || '-'}
            </p>
        </div>
    );
}
