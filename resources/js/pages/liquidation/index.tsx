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
import { FileText, Download, Upload, Plus, TableProperties, ChevronDown, AlertTriangle, XCircle, FileSpreadsheet, Send, X } from 'lucide-react';
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

interface Props {
    liquidations?: {
        data: Liquidation[];
        links: any[];
        meta: any;
    };
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

export default function Index({ liquidations, programs, createPrograms, academicYears, rcNoteStatuses, heis, filters, permissions, userRole }: Props) {
    const [searchQuery, setSearchQuery] = useState(filters.search || '');
    const [programFilter, setProgramFilter] = useState(filters.program || '');
    const [documentStatusFilter, setDocumentStatusFilter] = useState(filters.document_status || '');
    const [liquidationStatusFilter, setLiquidationStatusFilter] = useState(filters.liquidation_status || '');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isBulkEntryOpen, setIsBulkEntryOpen] = useState(false);
    const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isUploadPopoverOpen, setIsUploadPopoverOpen] = useState(false);
    const bulkActionsRef = React.useRef<HTMLButtonElement>(null);
    const bulkUploadRef = React.useRef<HTMLInputElement>(null);
    const [importResult, setImportResult] = useState<{
        imported: number;
        errors: { row: number; seq: string; uii: string; program: string; error: string }[];
    } | null>(null);

    // Selection state for bulk endorsement (ids are UUIDs at runtime)
    const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
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
    }, [searchQuery, documentStatusFilter, liquidationStatusFilter]);

    const handleDocumentStatusFilter = useCallback((value: string) => {
        setDocumentStatusFilter(value);
        router.get(route('liquidation.index'), getFilterParams({ document_status: value }), {
            preserveState: true,
            preserveScroll: true,
        });
    }, [searchQuery, programFilter, liquidationStatusFilter]);

    const handleLiquidationStatusFilter = useCallback((value: string) => {
        setLiquidationStatusFilter(value);
        router.get(route('liquidation.index'), getFilterParams({ liquidation_status: value }), {
            preserveState: true,
            preserveScroll: true,
        });
    }, [searchQuery, programFilter, documentStatusFilter]);

    const handleDownloadTemplate = () => {
        window.location.href = route('liquidation.download-rc-template');
    };

    const handleImportComplete = (result: { imported: number; errors: any[] }) => {
        if (result.errors.length > 0) {
            setImportResult({ imported: result.imported, errors: result.errors });
        }
        if (result.imported > 0) {
            router.reload();
        }
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
            // Bulk endorse
            router.post(route('liquidation.bulk-endorse-to-accounting'), {
                ...payload,
                liquidation_ids: Array.from(selectedIds),
            }, {
                onSuccess: () => { setIsEndorsing(false); setIsEndorseModalOpen(false); setSelectedIds(new Set()); router.reload(); },
                onError: () => setIsEndorsing(false),
            });
        }
    }, [endorseTarget, selectedIds]);

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
                onClose={() => { setIsImportPreviewOpen(false); setImportFile(null); }}
                onImportComplete={handleImportComplete}
                initialFile={importFile}
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
                                            : `All rows failed validation. No records were imported. Please fix the errors below and try again.`
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
                            <div className="flex items-center gap-3 px-4 py-3 mb-4 rounded-lg border bg-muted/50 animate-in fade-in-0 slide-in-from-top-2">
                                <span className="text-sm font-medium">
                                    {selectedIds.size} selected
                                </span>
                                <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleBulkEndorseClick}>
                                    <Send className="h-3.5 w-3.5" />
                                    Endorse to Accounting
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelectedIds(new Set())}>
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
                            />

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
}: {
    liquidations: NonNullable<Props['liquidations']>;
    permissions: Props['permissions'];
    selectedIds: Set<number | string>;
    onSelect: (id: number, checked: boolean) => void;
    onSelectAll: (checked: boolean) => void;
    onVoid: (l: Liquidation) => void;
    onRestore: (l: Liquidation) => void;
    onEndorse: (l: Liquidation) => void;
}) {
    if (!liquidations?.data) return <LiquidationTableSkeleton />;

    const selectableCount = liquidations.data.filter(l => !l.is_voided).length;
    const allSelected = selectableCount > 0 && selectedIds.size >= selectableCount;
    const someSelected = selectedIds.size > 0 && !allSelected;

    return (
        <>
            <div className="overflow-hidden rounded-t-lg border border-b-0 overflow-x-auto">
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
                            <TableHead className="h-9 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">%</TableHead>
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
                <div className="text-sm font-medium text-foreground">
                    {liquidations.data.length > 0 ? (
                        <>
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
                                {liquidations.meta?.total || liquidations.data.length}
                            </span>
                            {' '}records
                        </>
                    ) : (
                        <span>No records found</span>
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
