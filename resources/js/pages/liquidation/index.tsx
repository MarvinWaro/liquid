import React, { useState, useCallback, useEffect, useRef } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { CardContent } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { FileText, Download, Upload, Plus, TableProperties, ChevronDown, AlertTriangle, XCircle, FileSpreadsheet, Send, X, History, CheckCircle2, Banknote, FileBarChart2, TrendingDown, Percent, Printer, Pin, Users, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { CreateLiquidationModal } from '@/components/liquidations/create-liquidation-modal';
import { BulkEntryModal } from '@/components/liquidations/bulk-entry-modal';
import { ImportPreviewDialog } from '@/components/liquidations/import-preview-dialog';
import { EndorseToAccountingModal } from '@/components/liquidations/endorsement-modals';
import { toast } from '@/lib/toast';
import { type BreadcrumbItem } from '@/types';

import type { Liquidation, Program, HEIOption, AcademicYearOption, RcNoteStatusOption } from '@/components/liquidations/index/types';

interface RegionOption {
    id: string;
    code: string;
    name: string;
}
import { LiquidationFilters } from '@/components/liquidations/index/liquidation-filters';
import { LiquidationTableRow } from '@/components/liquidations/index/liquidation-table-row';
import { LiquidationTableSkeleton } from '@/components/liquidations/index/liquidation-table-skeleton';

interface TableSummary {
    total_records: number;
    total_grantees: number;
    total_disbursed: number;
    total_liquidated: number;
    total_unliquidated: number;
    for_endorsement: number;
}

interface Props {
    liquidations?: {
        data: Liquidation[];
        links: any[];
        meta: any;
    };
    pinnedLiquidations?: Liquidation[];
    pinLimit?: number;
    tableSummary?: TableSummary;
    programs: Program[];
    createPrograms?: Program[];
    academicYears?: AcademicYearOption[];
    rcNoteStatuses?: RcNoteStatusOption[];
    heis?: HEIOption[];
    regions?: RegionOption[];
    filters: {
        search?: string;
        program?: string | string[];
        document_status?: string | string[];
        liquidation_status?: string | string[];
        academic_year?: string | string[];
        rc_note_status?: string | string[];
        region?: string | string[];
    };
    permissions: {
        review: boolean;
        create: boolean;
        void: boolean;
    };
    userRole: string;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Liquidation Management', href: route('liquidation.index') },
];

// Retain the last non-undefined value so Inertia's deferred re-fetches
// (pagination, filter changes, partial reloads) can keep rendering the
// previous data instead of flashing a skeleton on every request.
function useStaleWhileRevalidate<T>(value: T | undefined): T | undefined {
    const ref = useRef<T | undefined>(value);
    if (value !== undefined) {
        ref.current = value;
    }
    return ref.current;
}

export default function Index({ liquidations, pinnedLiquidations, pinLimit = 10, tableSummary, programs, createPrograms, academicYears, rcNoteStatuses, heis, regions, filters, permissions, userRole }: Props) {
    const toArr = (v: string | string[] | undefined): string[] =>
        !v ? [] : Array.isArray(v) ? v : v === 'all' ? [] : [v];

    const [searchQuery, setSearchQuery] = useState(filters.search || '');
    const [programFilter, setProgramFilter] = useState<string[]>(toArr(filters.program));
    const [documentStatusFilter, setDocumentStatusFilter] = useState<string[]>(toArr(filters.document_status));
    const [liquidationStatusFilter, setLiquidationStatusFilter] = useState<string[]>(toArr(filters.liquidation_status));
    const [academicYearFilter, setAcademicYearFilter] = useState<string[]>(toArr(filters.academic_year));
    const [rcNoteStatusFilter, setRcNoteStatusFilter] = useState<string[]>(toArr(filters.rc_note_status));
    const [regionFilter, setRegionFilter] = useState<string[]>(toArr(filters.region));
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isBulkEntryOpen, setIsBulkEntryOpen] = useState(false);
    const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isUploadPopoverOpen, setIsUploadPopoverOpen] = useState(false);
    const [openImportHistory, setOpenImportHistory] = useState(false);
    const bulkActionsRef = React.useRef<HTMLButtonElement>(null);
    const bulkUploadRef = React.useRef<HTMLInputElement>(null);
    const [importResult, setImportResult] = useState<{
        imported: number;
        errors: { row: number; seq: string; uii: string; program: string; error: string }[];
    } | null>(null);
    const [lastImportCount, setLastImportCount] = useState<number | null>(null);

    // Selection state for bulk endorsement (ids are UUIDs at runtime)
    const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
    const [allPagesSelected, setAllPagesSelected] = useState(false);
    const [isEndorseModalOpen, setIsEndorseModalOpen] = useState(false);
    const [endorseTarget, setEndorseTarget] = useState<Liquidation | null>(null);
    const [isEndorsing, setIsEndorsing] = useState(false);
    const [exportKind, setExportKind] = useState<null | 'excel' | 'csv'>(null);
    const exportAbortRef = useRef<AbortController | null>(null);

    const isRC = userRole === 'Regional Coordinator';
    const isHEI = userRole === 'HEI';
    const canCreate = (permissions.create || isRC) && !isHEI;
    const canFilterByRegion = userRole === 'Super Admin' || userRole === 'Admin';

    // Stale-while-revalidate: show the previous page's data during subsequent
    // navigations (pagination, filter changes) instead of a disruptive skeleton.
    // The skeleton only shows on the very first cold load when no cached data exists.
    const cachedLiquidations = useStaleWhileRevalidate(liquidations);
    const cachedPinned = useStaleWhileRevalidate(pinnedLiquidations);
    const cachedSummary = useStaleWhileRevalidate(tableSummary);
    const isRevalidating = !!cachedLiquidations && !liquidations;

    const getFilterParams = (overrides: Record<string, any> = {}) => {
        const raw: Record<string, any> = {
            search: searchQuery,
            program: programFilter,
            document_status: documentStatusFilter,
            liquidation_status: liquidationStatusFilter,
            academic_year: academicYearFilter,
            rc_note_status: rcNoteStatusFilter,
            ...(canFilterByRegion ? { region: regionFilter } : {}),
            ...overrides,
        };
        // Strip empty arrays / empty strings so they don't pollute the URL
        const params: Record<string, any> = {};
        for (const [k, v] of Object.entries(raw)) {
            if (Array.isArray(v) ? v.length > 0 : v) params[k] = v;
        }
        return params;
    };

    const navigate = (overrides: Record<string, any> = {}) => {
        router.get(route('liquidation.index'), getFilterParams(overrides), {
            preserveState: true,
            preserveScroll: true,
        });
    };

    // Debounce multi-select filter changes so rapid checkbox toggles
    // collapse into a single request (350ms after the last change).
    const isInitialFilterMount = useRef(true);
    useEffect(() => {
        if (isInitialFilterMount.current) {
            isInitialFilterMount.current = false;
            return;
        }
        const timeout = setTimeout(() => {
            router.get(route('liquidation.index'), getFilterParams(), {
                preserveState: true,
                preserveScroll: true,
            });
        }, 350);
        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [programFilter, documentStatusFilter, liquidationStatusFilter, academicYearFilter, rcNoteStatusFilter, regionFilter]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        navigate();
    };

    const handleProgramFilter = useCallback((value: string[]) => {
        setProgramFilter(value);
    }, []);

    const handleDocumentStatusFilter = useCallback((value: string[]) => {
        setDocumentStatusFilter(value);
    }, []);

    const handleLiquidationStatusFilter = useCallback((value: string[]) => {
        setLiquidationStatusFilter(value);
    }, []);

    const handleAcademicYearFilter = useCallback((value: string[]) => {
        setAcademicYearFilter(value);
    }, []);

    const handleRcNoteStatusFilter = useCallback((value: string[]) => {
        setRcNoteStatusFilter(value);
    }, []);

    const handleRegionFilter = useCallback((value: string[]) => {
        setRegionFilter(value);
    }, []);

    const handleDownloadTemplate = () => {
        window.location.href = route('liquidation.download-rc-template');
    };

    const buildReportQueryString = () => {
        const params = new URLSearchParams();
        if (searchQuery) params.set('search', searchQuery);
        programFilter.forEach(v => params.append('program[]', v));
        documentStatusFilter.forEach(v => params.append('document_status[]', v));
        liquidationStatusFilter.forEach(v => params.append('liquidation_status[]', v));
        academicYearFilter.forEach(v => params.append('academic_year[]', v));
        rcNoteStatusFilter.forEach(v => params.append('rc_note_status[]', v));
        if (canFilterByRegion) {
            regionFilter.forEach(v => params.append('region[]', v));
        }
        return params.toString();
    };

    const handlePrintReport = () => {
        const qs = buildReportQueryString();
        const url = route('liquidation.print-report') + (qs ? `?${qs}` : '');
        const newTab = window.open('', '_blank');
        if (!newTab) {
            window.open(url, '_blank');
            return;
        }
        newTab.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Generating Liquidation Report…</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #f8fafc; color: #0f172a;
  }
  .loader { text-align: center; max-width: 420px; padding: 32px; }
  .spinner {
    width: 56px; height: 56px; margin: 0 auto 20px;
    border: 5px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }
  h2 { font-size: 18px; font-weight: 600; margin: 0 0 8px; }
  p  { font-size: 13px; margin: 0; color: #475569; line-height: 1.5; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <h2>Generating Liquidation Report</h2>
    <p>Preparing the printable monitoring sheet. This may take a few seconds for large datasets — please don't close this tab.</p>
  </div>
</body>
</html>`);
        newTab.document.close();
        newTab.location.href = url;
    };

    const downloadReport = async (kind: 'excel' | 'csv') => {
        if (exportKind) return; // one at a time

        const qs = buildReportQueryString();
        const routeName = kind === 'excel' ? 'liquidation.export-excel' : 'liquidation.export-csv';
        const url = route(routeName) + (qs ? `?${qs}` : '');
        const fallbackName = `liquidation-report-${new Date().toISOString().slice(0, 10)}.${kind === 'excel' ? 'xlsx' : 'csv'}`;
        const label = kind === 'excel' ? 'Excel' : 'CSV';

        const controller = new AbortController();
        exportAbortRef.current = controller;
        setExportKind(kind);
        const toastId = toast.loading(`Preparing ${label} export — this may take a while for large datasets…`, {
            duration: Infinity,
            action: {
                label: 'Cancel',
                onClick: () => controller.abort(),
            },
        });

        let blobUrl: string | null = null;
        try {
            const res = await fetch(url, {
                credentials: 'same-origin',
                headers: { Accept: '*/*' },
                signal: controller.signal,
            });
            if (!res.ok) {
                throw new Error(res.status === 403 ? 'You are not allowed to export this report.' : `Export failed (${res.status}).`);
            }

            const disposition = res.headers.get('Content-Disposition') || '';
            const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
            const filename = match ? decodeURIComponent(match[1]) : fallbackName;

            const blob = await res.blob();
            blobUrl = URL.createObjectURL(blob);

            const anchor = document.createElement('a');
            anchor.href = blobUrl;
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();

            toast.dismiss(toastId);
            toast.success(`${label} downloaded`);
        } catch (e: any) {
            toast.dismiss(toastId);
            if (e?.name === 'AbortError') {
                toast.info(`${label} export cancelled.`);
            } else {
                toast.error(e?.message || `${label} export failed.`);
            }
        } finally {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
            if (exportAbortRef.current === controller) exportAbortRef.current = null;
            setExportKind(null);
        }
    };

    const handleExportExcel = () => { downloadReport('excel'); };
    const handleExportCsv = () => { downloadReport('csv'); };

    // Cancel any in-flight export on unmount so we don't leak a request.
    useEffect(() => {
        return () => { exportAbortRef.current?.abort(); };
    }, []);

    const handleImportComplete = (result: { imported: number; errors: any[] }) => {
        if (result.errors.length > 0) {
            setImportResult({ imported: result.imported, errors: result.errors });
        }
        if (result.imported > 0) {
            setLastImportCount(result.imported);
        }
        // Always reload to refresh the table (covers both import and undo)
        router.reload();
    };

    const handleVoid = useCallback((liquidation: Liquidation) => {
        router.post(route('liquidation.void', liquidation.id), {}, {
            preserveScroll: true,
            onError: () => toast.error('Failed to void liquidation.'),
        });
    }, []);

    const handleRestore = useCallback((liquidation: Liquidation) => {
        router.post(route('liquidation.restore', liquidation.id), {}, {
            preserveScroll: true,
            onError: () => toast.error('Failed to restore liquidation.'),
        });
    }, []);

    const handleTogglePin = useCallback((liquidation: Liquidation) => {
        router.post(route('liquidation.toggle-pin', liquidation.id), {}, {
            preserveScroll: true,
            preserveState: true,
            only: ['liquidations', 'pinnedLiquidations'],
            onError: (errors) => {
                const msg = (errors as any)?.pin || 'Failed to update pin.';
                toast.error(msg);
            },
        });
    }, []);

    const handleSelect = useCallback((id: number, checked: boolean) => {
        setAllPagesSelected(false);
        setSelectedIds(prev => {
            const next = new Set(prev);
            checked ? next.add(id) : next.delete(id);
            return next;
        });
    }, []);

    const handleSelectAll = useCallback((checked: boolean) => {
        if (!liquidations?.data) return;
        if (checked) {
            const ids = liquidations.data.filter(l => !l.is_voided && !l.is_endorsed).map(l => l.id);
            setSelectedIds(new Set(ids));
        } else {
            setAllPagesSelected(false);
            setSelectedIds(new Set());
        }
    }, [liquidations?.data]);

    const handleEndorseSingle = useCallback((liquidation: Liquidation) => {
        setEndorseTarget(liquidation);
        setIsEndorseModalOpen(true);
    }, []);

    const handleBulkEndorseClick = useCallback(() => {
        setEndorseTarget(null);
        setIsEndorseModalOpen(true);
    }, []);

    const handleEndorseSubmit = useCallback((data: { reviewRemarks: string }) => {
        setIsEndorsing(true);
        const payload = { review_remarks: data.reviewRemarks };

        if (endorseTarget) {
            // Single endorse
            router.post(route('liquidation.endorse-to-accounting', endorseTarget.id), payload, {
                onSuccess: () => { setIsEndorsing(false); setIsEndorseModalOpen(false); setEndorseTarget(null); router.reload(); },
                onError: () => setIsEndorsing(false),
            });
        } else {
            // Bulk endorse — when all pages selected, send flag so server resolves all eligible IDs
            router.post(route('liquidation.bulk-endorse-to-accounting'), {
                ...payload,
                liquidation_ids: allPagesSelected ? [] : Array.from(selectedIds),
                select_all: allPagesSelected,
            }, {
                onSuccess: () => {
                    setIsEndorsing(false);
                    setIsEndorseModalOpen(false);
                    setSelectedIds(new Set());
                    setAllPagesSelected(false);
                    router.reload();
                },
                onError: () => setIsEndorsing(false),
            });
        }
    }, [endorseTarget, selectedIds, allPagesSelected]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Liquidation Management" />

            {/* Create Liquidation Modal */}
            <CreateLiquidationModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                programs={createPrograms ?? []}
                academicYears={academicYears ?? []}
                rcNoteStatuses={rcNoteStatuses ?? []}
                heis={heis ?? []}
                onSuccess={() => router.reload()}
            />

            {/* Bulk Entry Modal */}
            <BulkEntryModal
                isOpen={isBulkEntryOpen}
                onClose={() => setIsBulkEntryOpen(false)}
                programs={createPrograms ?? []}
                academicYears={academicYears ?? []}
                rcNoteStatuses={rcNoteStatuses ?? []}
                heis={heis ?? []}
                onSuccess={() => router.reload()}
            />

            {/* Import Preview Dialog */}
            <ImportPreviewDialog
                isOpen={isImportPreviewOpen}
                onClose={() => { setIsImportPreviewOpen(false); setImportFile(null); setOpenImportHistory(false); }}
                onImportComplete={handleImportComplete}
                initialFile={importFile}
                initialShowHistory={openImportHistory}
            />

            <div className="py-8 w-full min-w-0 overflow-hidden">
                <div>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <h1 className="text-xl font-semibold tracking-tight">Liquidation Management</h1>
                            <p className="text-sm text-muted-foreground">
                                {userRole === 'Regional Coordinator' && 'Review and endorse liquidations to Accounting'}
                                {userRole === 'Accountant' && 'Review and endorse liquidations to COA'}
                                {!['Regional Coordinator', 'Accountant'].includes(userRole) && 'Manage liquidation records and submissions'}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" disabled={exportKind !== null}>
                                        {exportKind ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Preparing {exportKind === 'excel' ? 'Excel' : 'CSV'}…
                                            </>
                                        ) : (
                                            <>
                                                <Printer className="h-4 w-4 mr-2" />
                                                Print Report
                                                <ChevronDown className="h-3.5 w-3.5 ml-1.5 opacity-60" />
                                            </>
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem onClick={handlePrintReport} disabled={exportKind !== null}>
                                        <Printer className="h-4 w-4 mr-2" />
                                        Print
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleExportExcel} disabled={exportKind !== null}>
                                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                                        Export to Excel
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleExportCsv} disabled={exportKind !== null}>
                                        <FileText className="h-4 w-4 mr-2" />
                                        Export to CSV
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            {canCreate && (
                                <>
                                <Button onClick={() => setIsCreateModalOpen(true)} className="bg-foreground text-background shadow-sm hover:bg-foreground/90">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create Liquidation
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button ref={bulkActionsRef} variant="outline">
                                            <TableProperties className="h-4 w-4 mr-2" />
                                            Bulk Actions
                                            <ChevronDown className="h-3.5 w-3.5 ml-1.5 opacity-60" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem onClick={() => setIsBulkEntryOpen(true)}>
                                            <TableProperties className="h-4 w-4 mr-2" />
                                            Bulk Entry
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={handleDownloadTemplate}>
                                            <Download className="h-4 w-4 mr-2" />
                                            Download Template
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setIsUploadPopoverOpen(true)}>
                                            <Upload className="h-4 w-4 mr-2" />
                                            Bulk Upload
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => { setOpenImportHistory(true); setIsImportPreviewOpen(true); }}>
                                            <History className="h-4 w-4 mr-2" />
                                            Import History
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                </>
                            )}
                        </div>
                    </div>

                        {/* Upload popover — positioned relative to Bulk Actions button */}
                        {isUploadPopoverOpen && (
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setIsUploadPopoverOpen(false)}
                            />
                        )}
                        {isUploadPopoverOpen && bulkActionsRef.current && (() => {
                            const rect = bulkActionsRef.current!.getBoundingClientRect();
                            return (
                                <div
                                    className="fixed z-50 w-72 rounded-md border bg-popover p-4 shadow-md animate-in fade-in-0 zoom-in-95"
                                    style={{
                                        top: rect.bottom + 6,
                                        left: rect.right - 288,
                                    }}
                                >
                                    <div className="flex items-center gap-2.5 mb-3">
                                        <div className="rounded-md bg-emerald-100 dark:bg-emerald-900/30 p-1.5">
                                            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Upload Excel File</p>
                                            <p className="text-xs text-muted-foreground">Validate before importing</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        Select an Excel file (.xlsx, .xls) to validate your liquidation records before importing.
                                    </p>
                                    <Button size="sm" className="w-full" onClick={() => bulkUploadRef.current?.click()}>
                                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                                        Choose File
                                    </Button>
                                    <input
                                        ref={bulkUploadRef}
                                        type="file"
                                        accept=".xlsx,.xls"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                setImportFile(file);
                                                setIsUploadPopoverOpen(false);
                                                setIsImportPreviewOpen(true);
                                            }
                                            e.target.value = '';
                                        }}
                                    />
                                </div>
                            );
                        })()}

                        {/* Import result dialog */}
                        <Dialog open={!!importResult} onOpenChange={(open) => { if (!open) setImportResult(null); }}>
                            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                                <DialogHeader>
                                    <div className="flex items-center gap-2.5">
                                        {importResult && importResult.imported > 0 ? (
                                            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                                        ) : (
                                            <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                                        )}
                                        <DialogTitle>
                                            {importResult && importResult.imported > 0
                                                ? 'Import Completed with Errors'
                                                : 'Import Failed'
                                            }
                                        </DialogTitle>
                                    </div>
                                    <DialogDescription>
                                        {importResult && importResult.imported > 0
                                            ? `${importResult.imported} record(s) imported successfully. ${importResult.errors.length} row(s) failed and were skipped.`
                                            : `No records were saved. The rows below could not be imported — they may already exist in the system from a previous import.`
                                        }
                                    </DialogDescription>
                                </DialogHeader>

                                {importResult && importResult.errors.length > 0 && (
                                    <div className="flex-1 overflow-auto border rounded-md min-h-0">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/50 sticky top-0">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-16">Row</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-20">Program</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-24">UII</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Error Details</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {importResult.errors.map((err, i) => (
                                                    <tr key={i} className="hover:bg-muted/30">
                                                        <td className="px-3 py-2 text-xs font-mono font-medium">{err.row}</td>
                                                        <td className="px-3 py-2 text-xs font-mono">{err.program || '-'}</td>
                                                        <td className="px-3 py-2 text-xs font-mono">{err.uii || '-'}</td>
                                                        <td className="px-3 py-2 text-xs text-red-600 dark:text-red-400">{err.error}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                <div className="flex justify-end pt-2">
                                    <Button variant="outline" onClick={() => setImportResult(null)}>
                                        Close
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>

                        {/* Endorse to Accounting Modal */}
                        <EndorseToAccountingModal
                            isOpen={isEndorseModalOpen}
                            onClose={() => { setIsEndorseModalOpen(false); setEndorseTarget(null); }}
                            onSubmit={handleEndorseSubmit}
                            isProcessing={isEndorsing}
                        />

                        {/* Bulk Selection Action Bar */}
                        {selectedIds.size > 0 && (
                            <div className="flex flex-wrap items-center gap-3 px-4 py-3 mb-4 rounded-lg border bg-muted/50 animate-in fade-in-0 slide-in-from-top-2">
                                <span className="text-sm font-medium">
                                    {allPagesSelected
                                        ? `All ${tableSummary?.total_records?.toLocaleString() ?? ''} records selected`
                                        : `${selectedIds.size} selected`}
                                </span>

                                {/* Gmail-style: offer to select across all pages when current page is fully selected */}
                                {!allPagesSelected && tableSummary && selectedIds.size > 0 && tableSummary.total_records > selectedIds.size && (
                                    <span className="text-xs text-muted-foreground">
                                        |{' '}
                                        <button
                                            className="text-primary underline-offset-2 hover:underline font-medium"
                                            onClick={() => setAllPagesSelected(true)}
                                        >
                                            Select all {tableSummary.total_records.toLocaleString()} records
                                        </button>
                                    </span>
                                )}
                                {allPagesSelected && (
                                    <span className="text-xs text-muted-foreground">
                                        |{' '}
                                        <button
                                            className="text-primary underline-offset-2 hover:underline font-medium"
                                            onClick={() => { setAllPagesSelected(false); setSelectedIds(new Set()); }}
                                        >
                                            Clear selection
                                        </button>
                                    </span>
                                )}

                                <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleBulkEndorseClick}>
                                    <Send className="h-3.5 w-3.5" />
                                    Endorse to Accounting
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setSelectedIds(new Set()); setAllPagesSelected(false); }}>
                                    <X className="h-3.5 w-3.5 mr-1" />
                                    Clear
                                </Button>
                            </div>
                        )}

                        <CardContent className="pt-6 px-0">
                            {/* Extracted filter components */}
                            <LiquidationFilters
                                searchQuery={searchQuery}
                                onSearchChange={setSearchQuery}
                                onSearchSubmit={handleSearch}
                                programFilter={programFilter}
                                onProgramFilter={handleProgramFilter}
                                programs={programs}
                                documentStatusFilter={documentStatusFilter}
                                onDocumentStatusFilter={handleDocumentStatusFilter}
                                liquidationStatusFilter={liquidationStatusFilter}
                                onLiquidationStatusFilter={handleLiquidationStatusFilter}
                                academicYearFilter={academicYearFilter}
                                onAcademicYearFilter={handleAcademicYearFilter}
                                academicYears={academicYears ?? []}
                                rcNoteStatusFilter={rcNoteStatusFilter}
                                onRcNoteStatusFilter={handleRcNoteStatusFilter}
                                rcNoteStatuses={rcNoteStatuses ?? []}
                                regions={canFilterByRegion ? regions : undefined}
                                regionFilter={regionFilter}
                                onRegionFilter={canFilterByRegion ? handleRegionFilter : undefined}
                            />

                            {/* Summary stats bar */}
                            {cachedSummary ? (
                                <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4 transition-opacity duration-150 ${isRevalidating ? 'opacity-60' : ''}`}>
                                    <div className="rounded-lg border bg-card p-3">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <FileBarChart2 className="h-3.5 w-3.5 text-blue-600" />
                                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Records</p>
                                        </div>
                                        <p className="text-lg font-bold tracking-tight">{cachedSummary.total_records.toLocaleString()}</p>
                                    </div>
                                    <div className="rounded-lg border bg-card p-3">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Users className="h-3.5 w-3.5 text-sky-600" />
                                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Grantees</p>
                                        </div>
                                        <p className="text-lg font-bold tracking-tight text-sky-700 dark:text-sky-400">
                                            {cachedSummary.total_grantees.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border bg-card p-3">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Banknote className="h-3.5 w-3.5 text-emerald-600" />
                                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Disbursed</p>
                                        </div>
                                        <p className="text-lg font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
                                            {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(cachedSummary.total_disbursed)}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border bg-card p-3">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Liquidated</p>
                                        </div>
                                        <p className="text-lg font-bold tracking-tight text-green-700 dark:text-green-400">
                                            {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(cachedSummary.total_liquidated)}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border bg-card p-3">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Unliquidated</p>
                                        </div>
                                        <p className="text-lg font-bold tracking-tight text-red-600 dark:text-red-400">
                                            {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(cachedSummary.total_unliquidated)}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border bg-card p-3">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Percent className="h-3.5 w-3.5 text-violet-600" />
                                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">%Age of Liquidation</p>
                                        </div>
                                        <p className="text-lg font-bold tracking-tight text-violet-700 dark:text-violet-400">
                                            {cachedSummary.total_disbursed > 0
                                                ? (((cachedSummary.total_liquidated + cachedSummary.for_endorsement) / cachedSummary.total_disbursed) * 100).toFixed(2)
                                                : '0.00'}%
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                                    {[...Array(6)].map((_, i) => (
                                        <div key={i} className="rounded-lg border bg-card p-3 animate-pulse">
                                            <div className="h-3 w-20 bg-muted rounded mb-2" />
                                            <div className="h-5 w-28 bg-muted rounded" />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Table with stale-while-revalidate loading */}
                            {cachedLiquidations ? (
                                <div className={`transition-opacity duration-150 ${isRevalidating ? 'opacity-60 pointer-events-none' : ''}`}>
                                    <LiquidationTable
                                        liquidations={cachedLiquidations}
                                        pinnedLiquidations={cachedPinned}
                                        pinLimit={pinLimit}
                                        permissions={permissions}
                                        selectedIds={selectedIds}
                                        onSelect={handleSelect}
                                        onSelectAll={handleSelectAll}
                                        onVoid={handleVoid}
                                        onRestore={handleRestore}
                                        onEndorse={handleEndorseSingle}
                                        onTogglePin={handleTogglePin}
                                        lastImportCount={lastImportCount}
                                        onDismissImport={() => setLastImportCount(null)}
                                    />
                                </div>
                            ) : (
                                <LiquidationTableSkeleton />
                            )}

                        </CardContent>

                </div>
            </div>
        </AppLayout>
    );
}

/* ── Table + Pagination (only renders when liquidations is loaded) ── */

const LiquidationTable = React.memo(function LiquidationTable({
    liquidations,
    pinnedLiquidations,
    pinLimit,
    permissions,
    selectedIds,
    onSelect,
    onSelectAll,
    onVoid,
    onRestore,
    onEndorse,
    onTogglePin,
    lastImportCount,
    onDismissImport,
}: {
    liquidations: NonNullable<Props['liquidations']>;
    pinnedLiquidations?: Liquidation[];
    pinLimit: number;
    permissions: Props['permissions'];
    selectedIds: Set<number | string>;
    onSelect: (id: number, checked: boolean) => void;
    onSelectAll: (checked: boolean) => void;
    onVoid: (l: Liquidation) => void;
    onRestore: (l: Liquidation) => void;
    onEndorse: (l: Liquidation) => void;
    onTogglePin: (l: Liquidation) => void;
    lastImportCount: number | null;
    onDismissImport: () => void;
}) {
    const selectableCount = liquidations.data.filter(l => !l.is_voided).length;
    const allSelected = selectableCount > 0 && selectedIds.size >= selectableCount;
    const someSelected = selectedIds.size > 0 && !allSelected;

    const isFirstPage = (liquidations.meta?.current_page ?? 1) === 1;
    const pinnedCount = pinnedLiquidations?.length ?? 0;
    const pinDisabled = pinnedCount >= pinLimit;
    const pinnedIdSet = new Set(pinnedLiquidations?.map(p => p.id) ?? []);
    // On page 1 the pinned rows already render above; suppress duplicates in main list.
    const mainRows = isFirstPage
        ? liquidations.data.filter(l => !pinnedIdSet.has(l.id))
        : liquidations.data;

    return (
        <>
            {isFirstPage && pinnedCount > 0 && (
                <div className="mb-3 overflow-hidden rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/10">
                    <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-amber-200/70 dark:border-amber-900/40 bg-amber-100/40 dark:bg-amber-900/10">
                        <div className="flex items-center gap-2">
                            <Pin className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 fill-current" />
                            <span className="text-xs font-medium uppercase tracking-wider text-amber-800 dark:text-amber-300">
                                Pinned ({pinnedCount}/{pinLimit})
                            </span>
                        </div>
                        <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                            Visible only on page 1 • Personal to you
                        </span>
                    </div>
                    <div className="overflow-x-auto [&_td]:border-r [&_td]:border-border/40 [&_th]:border-r [&_th]:border-border/40 [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0">
                        <Table>
                            <TableBody>
                                {pinnedLiquidations!.map((liquidation, index) => (
                                    <LiquidationTableRow
                                        key={`pinned-${liquidation.id}`}
                                        liquidation={liquidation}
                                        index={index}
                                        canVoid={permissions.void}
                                        canReview={permissions.review}
                                        isSelected={selectedIds.has(liquidation.id)}
                                        onSelect={onSelect}
                                        onVoid={onVoid}
                                        onRestore={onRestore}
                                        onEndorse={onEndorse}
                                        onTogglePin={onTogglePin}
                                        pinDisabled={false}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
            <div className="overflow-hidden rounded-t-lg border border-b-0 overflow-x-auto [&_td]:border-r [&_td]:border-border/40 [&_th]:border-r [&_th]:border-border/40 [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0">
                <Table>
                    <TableHeader>
                        <TableRow className="border-b hover:bg-transparent">
                            <TableHead className="h-9 w-[36px] pl-4 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                <span className="sr-only">Pin</span>
                            </TableHead>
                            <TableHead className="h-9 w-[40px]">
                                {permissions.review && (
                                    <Checkbox
                                        checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                        onCheckedChange={(checked) => onSelectAll(!!checked)}
                                        aria-label="Select all"
                                    />
                                )}
                            </TableHead>
                            <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Program</TableHead>
                            <TableHead className="h-9 max-w-[300px] text-xs font-medium tracking-wider text-muted-foreground uppercase">HEI</TableHead>
                            <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Period</TableHead>
                            <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Dates</TableHead>
                            <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Batch</TableHead>
                            <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Control / Ledger No.</TableHead>
                            <TableHead className="h-9 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">Grantees</TableHead>
                            <TableHead className="h-9 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">Disbursements</TableHead>
                            <TableHead className="h-9 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">Liquidated</TableHead>
                            <TableHead className="h-9 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">Unliquidated</TableHead>
                            <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Documents Status</TableHead>
                            <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">RC Notes</TableHead>
                            <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Liquidation Status</TableHead>
                            <TableHead className="h-9 text-center px-3 text-xs font-medium tracking-wider text-muted-foreground uppercase leading-tight">Percentage of<br />Liquidation</TableHead>
                            <TableHead className="h-9 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">Lapsing</TableHead>
                            <TableHead className="h-9 text-right pr-4 text-xs font-medium tracking-wider text-muted-foreground uppercase">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mainRows.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={18} className="text-center py-8 text-muted-foreground">
                                    <FileText className="mx-auto h-12 w-12 mb-2 opacity-50" />
                                    <p>{liquidations.data.length === 0 ? 'No liquidation records found' : 'All records on this page are pinned above'}</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            mainRows.map((liquidation, index) => (
                                <LiquidationTableRow
                                    key={liquidation.id}
                                    liquidation={liquidation}
                                    index={index}
                                    canVoid={permissions.void}
                                    canReview={permissions.review}
                                    isSelected={selectedIds.has(liquidation.id)}
                                    onSelect={onSelect}
                                    onVoid={onVoid}
                                    onRestore={onRestore}
                                    onEndorse={onEndorse}
                                    onTogglePin={onTogglePin}
                                    pinDisabled={pinDisabled}
                                />
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Table Footer with Record Counter and Pagination */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border rounded-b-lg">
                {/* Record Counter - Left Side */}
                <div className="text-sm text-foreground flex items-center gap-3">
                    {liquidations.data.length > 0 ? (
                        <span className="font-medium">
                            Showing{' '}
                            <span className="font-semibold">
                                {((liquidations.meta?.current_page || 1) - 1) * (liquidations.meta?.per_page || 15) + 1}
                            </span>
                            {' '}-{' '}
                            <span className="font-semibold">
                                {Math.min(
                                    (liquidations.meta?.current_page || 1) * (liquidations.meta?.per_page || 15),
                                    liquidations.meta?.total || liquidations.data.length
                                )}
                            </span>
                            {' '}of{' '}
                            <span className="font-semibold">
                                {(liquidations.meta?.total || liquidations.data.length).toLocaleString()}
                            </span>
                            {' '}records
                        </span>
                    ) : (
                        <span className="font-medium">No records found</span>
                    )}
                    {lastImportCount !== null && (
                        <>
                            <span className="text-muted-foreground">|</span>
                            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {lastImportCount.toLocaleString()} imported
                                <button onClick={onDismissImport} className="ml-0.5 opacity-60 hover:opacity-100">
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        </>
                    )}
                </div>

                {/* Pagination - Right Side */}
                {liquidations.data.length > 0 && liquidations.links && (
                    <div className="flex items-center gap-1">
                        {liquidations.links.map((link: any, index: number) => (
                            <Button
                                key={index}
                                variant={link.active ? "default" : "outline"}
                                size="sm"
                                onClick={() => link.url && router.visit(link.url, { preserveState: true, preserveScroll: true })}
                                disabled={!link.url}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                                className="h-8 min-w-[32px]"
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
});
