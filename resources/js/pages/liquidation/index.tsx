import React, { useState, useCallback } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Deferred, Head, router } from '@inertiajs/react';
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
import { FileText, Download, Upload, Plus, TableProperties, ChevronDown, AlertTriangle, XCircle, FileSpreadsheet, Send, X, History, CheckCircle2, Banknote, FileBarChart2, TrendingDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { CreateLiquidationModal } from '@/components/liquidations/create-liquidation-modal';
import { BulkEntryModal } from '@/components/liquidations/bulk-entry-modal';
import { ImportPreviewDialog } from '@/components/liquidations/import-preview-dialog';
import { EndorseToAccountingModal } from '@/components/liquidations/endorsement-modals';
import { toast } from '@/lib/toast';
import { type BreadcrumbItem } from '@/types';

import type { Liquidation, Program, HEIOption, AcademicYearOption, RcNoteStatusOption } from '@/components/liquidations/index/types';
import { LiquidationFilters } from '@/components/liquidations/index/liquidation-filters';
import { LiquidationTableRow } from '@/components/liquidations/index/liquidation-table-row';
import { LiquidationTableSkeleton } from '@/components/liquidations/index/liquidation-table-skeleton';

interface TableSummary {
    total_records: number;
    total_disbursed: number;
    total_liquidated: number;
    total_unliquidated: number;
}

interface Props {
    liquidations?: {
        data: Liquidation[];
        links: any[];
        meta: any;
    };
    tableSummary?: TableSummary;
    programs: Program[];
    createPrograms?: Program[];
    academicYears?: AcademicYearOption[];
    rcNoteStatuses?: RcNoteStatusOption[];
    heis?: HEIOption[];
    filters: {
        search?: string;
        program?: string;
        document_status?: string;
        liquidation_status?: string;
        academic_year?: string;
        rc_note_status?: string;
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

export default function Index({ liquidations, tableSummary, programs, createPrograms, academicYears, rcNoteStatuses, heis, filters, permissions, userRole }: Props) {
    const [searchQuery, setSearchQuery] = useState(filters.search || '');
    const [programFilter, setProgramFilter] = useState(filters.program || '');
    const [documentStatusFilter, setDocumentStatusFilter] = useState(filters.document_status || '');
    const [liquidationStatusFilter, setLiquidationStatusFilter] = useState(filters.liquidation_status || '');
    const [academicYearFilter, setAcademicYearFilter] = useState(filters.academic_year || '');
    const [rcNoteStatusFilter, setRcNoteStatusFilter] = useState(filters.rc_note_status || '');
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

    const isRC = userRole === 'Regional Coordinator';
    const isHEI = userRole === 'HEI';
    const canCreate = (permissions.create || isRC) && !isHEI;

    const getFilterParams = (overrides: Record<string, string> = {}) => ({
        search: searchQuery,
        program: programFilter,
        document_status: documentStatusFilter,
        liquidation_status: liquidationStatusFilter,
        academic_year: academicYearFilter,
        rc_note_status: rcNoteStatusFilter,
        ...overrides,
    });

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(route('liquidation.index'), getFilterParams(), {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleProgramFilter = useCallback((value: string) => {
        setProgramFilter(value);
        router.get(route('liquidation.index'), getFilterParams({ program: value }), {
            preserveState: true,
            preserveScroll: true,
        });
    }, [searchQuery, documentStatusFilter, liquidationStatusFilter, academicYearFilter, rcNoteStatusFilter]);

    const handleDocumentStatusFilter = useCallback((value: string) => {
        setDocumentStatusFilter(value);
        router.get(route('liquidation.index'), getFilterParams({ document_status: value }), {
            preserveState: true,
            preserveScroll: true,
        });
    }, [searchQuery, programFilter, liquidationStatusFilter, academicYearFilter, rcNoteStatusFilter]);

    const handleLiquidationStatusFilter = useCallback((value: string) => {
        setLiquidationStatusFilter(value);
        router.get(route('liquidation.index'), getFilterParams({ liquidation_status: value }), {
            preserveState: true,
            preserveScroll: true,
        });
    }, [searchQuery, programFilter, documentStatusFilter, academicYearFilter, rcNoteStatusFilter]);

    const handleAcademicYearFilter = useCallback((value: string) => {
        setAcademicYearFilter(value);
        router.get(route('liquidation.index'), getFilterParams({ academic_year: value }), {
            preserveState: true,
            preserveScroll: true,
        });
    }, [searchQuery, programFilter, documentStatusFilter, liquidationStatusFilter, rcNoteStatusFilter]);

    const handleRcNoteStatusFilter = useCallback((value: string) => {
        setRcNoteStatusFilter(value);
        router.get(route('liquidation.index'), getFilterParams({ rc_note_status: value }), {
            preserveState: true,
            preserveScroll: true,
        });
    }, [searchQuery, programFilter, documentStatusFilter, liquidationStatusFilter, academicYearFilter]);

    const handleDownloadTemplate = () => {
        window.location.href = route('liquidation.download-rc-template');
    };

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
                        {canCreate && (
                            <div className="flex gap-2">
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
                            </div>
                        )}
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
                            />

                            {/* Summary stats bar */}
                            <Deferred data="tableSummary" fallback={
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                    {[...Array(4)].map((_, i) => (
                                        <div key={i} className="rounded-lg border bg-card p-3 animate-pulse">
                                            <div className="h-3 w-20 bg-muted rounded mb-2" />
                                            <div className="h-5 w-28 bg-muted rounded" />
                                        </div>
                                    ))}
                                </div>
                            }>
                                {tableSummary && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                        <div className="rounded-lg border bg-card p-3">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <FileBarChart2 className="h-3.5 w-3.5 text-blue-600" />
                                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Records</p>
                                            </div>
                                            <p className="text-lg font-bold tracking-tight">{tableSummary.total_records.toLocaleString()}</p>
                                        </div>
                                        <div className="rounded-lg border bg-card p-3">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Banknote className="h-3.5 w-3.5 text-emerald-600" />
                                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Disbursed</p>
                                            </div>
                                            <p className="text-lg font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
                                                {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(tableSummary.total_disbursed)}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border bg-card p-3">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Liquidated</p>
                                            </div>
                                            <p className="text-lg font-bold tracking-tight text-green-700 dark:text-green-400">
                                                {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(tableSummary.total_liquidated)}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border bg-card p-3">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Unliquidated</p>
                                            </div>
                                            <p className="text-lg font-bold tracking-tight text-red-600 dark:text-red-400">
                                                {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(tableSummary.total_unliquidated)}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </Deferred>

                            {/* Table with deferred loading */}
                            <Deferred data="liquidations" fallback={<LiquidationTableSkeleton />}>
                                <LiquidationTable
                                    liquidations={liquidations!}
                                    permissions={permissions}
                                    selectedIds={selectedIds}
                                    onSelect={handleSelect}
                                    onSelectAll={handleSelectAll}
                                    onVoid={handleVoid}
                                    onRestore={handleRestore}
                                    onEndorse={handleEndorseSingle}
                                    lastImportCount={lastImportCount}
                                    onDismissImport={() => setLastImportCount(null)}
                                />
                            </Deferred>

                        </CardContent>

                </div>
            </div>
        </AppLayout>
    );
}

/* ── Table + Pagination (only renders when liquidations is loaded) ── */

const LiquidationTable = React.memo(function LiquidationTable({
    liquidations,
    permissions,
    selectedIds,
    onSelect,
    onSelectAll,
    onVoid,
    onRestore,
    onEndorse,
    lastImportCount,
    onDismissImport,
}: {
    liquidations: NonNullable<Props['liquidations']>;
    permissions: Props['permissions'];
    selectedIds: Set<number | string>;
    onSelect: (id: number, checked: boolean) => void;
    onSelectAll: (checked: boolean) => void;
    onVoid: (l: Liquidation) => void;
    onRestore: (l: Liquidation) => void;
    onEndorse: (l: Liquidation) => void;
    lastImportCount: number | null;
    onDismissImport: () => void;
}) {
    if (!liquidations?.data) return <LiquidationTableSkeleton />;

    const selectableCount = liquidations.data.filter(l => !l.is_voided).length;
    const allSelected = selectableCount > 0 && selectedIds.size >= selectableCount;
    const someSelected = selectedIds.size > 0 && !allSelected;

    return (
        <>
            <div className="overflow-hidden rounded-t-lg border border-b-0 overflow-x-auto [&_td]:border-r [&_td]:border-border/40 [&_th]:border-r [&_th]:border-border/40 [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0">
                <Table>
                    <TableHeader>
                        <TableRow className="border-b hover:bg-transparent">
                            <TableHead className="h-9 w-[40px] pl-4">
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
                            <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Control No.</TableHead>
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
                        {liquidations.data.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={17} className="text-center py-8 text-muted-foreground">
                                    <FileText className="mx-auto h-12 w-12 mb-2 opacity-50" />
                                    <p>No liquidation records found</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            liquidations.data.map((liquidation, index) => (
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
                                onClick={() => link.url && router.visit(link.url)}
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
