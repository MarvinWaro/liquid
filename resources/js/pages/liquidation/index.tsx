import React, { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, router, Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Search, FileText, Eye, Download, Upload, Plus, TableProperties, ChevronDown, Ban, RotateCcw, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { CreateLiquidationModal } from '@/components/liquidations/create-liquidation-modal';
import { BulkEntryModal } from '@/components/liquidations/bulk-entry-modal';
import { ImportPreviewDialog } from '@/components/liquidations/import-preview-dialog';
import { toast } from '@/lib/toast';
import axios from 'axios';
import { type BreadcrumbItem } from '@/types';

interface Program {
    id: string;
    name: string;
    code: string;
    parent_id: string | null;
}

interface Liquidation {
    id: number;
    program: Program | null;
    uii: string;
    hei_name: string;
    date_fund_released: string | null;
    due_date: string | null;
    academic_year: string | null;
    semester: string | null;
    batch_no: string | null;
    dv_control_no: string;
    number_of_grantees: number | null;
    total_disbursements: string;
    total_amount_liquidated: string;
    total_unliquidated_amount: string;
    document_status: string;
    document_status_code: string;
    rc_notes: string | null;
    liquidation_status: string;
    liquidation_status_code: string;
    percentage_liquidation: number;
    lapsing_period: number;
    is_voided: boolean;
}

interface HEIOption {
    id: string;
    name: string;
    uii: string;
}

interface AcademicYearOption {
    id: string;
    code: string;
    name: string;
}

interface RcNoteStatusOption {
    id: string;
    code: string;
    name: string;
    badge_color: string;
}

interface Props {
    liquidations: {
        data: Liquidation[];
        links: any[];
        meta: any;
    };
    programs: Program[];
    createPrograms: Program[];
    academicYears: AcademicYearOption[];
    rcNoteStatuses: RcNoteStatusOption[];
    heis: HEIOption[];
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
    const [importResult, setImportResult] = useState<{
        imported: number;
        errors: { row: number; seq: string; uii: string; program: string; error: string }[];
    } | null>(null);
    const [voidConfirmInput, setVoidConfirmInput] = useState('');
    const [voidPopoverOpen, setVoidPopoverOpen] = useState<number | null>(null);
    const [restoreConfirmInput, setRestoreConfirmInput] = useState('');
    const [restorePopoverOpen, setRestorePopoverOpen] = useState<number | null>(null);

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

    const handleProgramFilter = (value: string) => {
        setProgramFilter(value);
        router.get(route('liquidation.index'), getFilterParams({ program: value }), {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleDocumentStatusFilter = (value: string) => {
        setDocumentStatusFilter(value);
        router.get(route('liquidation.index'), getFilterParams({ document_status: value }), {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleLiquidationStatusFilter = (value: string) => {
        setLiquidationStatusFilter(value);
        router.get(route('liquidation.index'), getFilterParams({ liquidation_status: value }), {
            preserveState: true,
            preserveScroll: true,
        });
    };

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

    const handleVoid = (liquidation: Liquidation) => {
        router.post(route('liquidation.void', liquidation.id), {}, {
            preserveScroll: true,
            onError: () => toast.error('Failed to void liquidation.'),
        });
    };

    const handleRestore = (liquidation: Liquidation) => {
        router.post(route('liquidation.restore', liquidation.id), {}, {
            preserveScroll: true,
            onError: () => toast.error('Failed to restore liquidation.'),
        });
    };

    const getDocumentStatusColor = (status: string) => {
        if (status?.includes('Complete')) {
            return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60';
        }
        if (status?.includes('Partial')) {
            return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60';
        }
        // No Submission - highlighted in red
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60';
    };

    const getLiquidationStatusColor = (status: string) => {
        if (status?.includes('Voided')) {
            return 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-950/40 dark:text-gray-400 dark:border-gray-800/60';
        }
        if (status?.includes('Fully Liquidated')) {
            return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60';
        }
        if (status?.includes('Partially Liquidated')) {
            return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60';
        }
        // Unliquidated - highlighted in red
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60';
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Liquidation Management" />

            {/* Create Liquidation Modal */}
            <CreateLiquidationModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                programs={createPrograms}
                academicYears={academicYears}
                rcNoteStatuses={rcNoteStatuses}
                heis={heis}
                onSuccess={() => router.reload()}
            />

            {/* Bulk Entry Modal */}
            <BulkEntryModal
                isOpen={isBulkEntryOpen}
                onClose={() => setIsBulkEntryOpen(false)}
                programs={createPrograms}
                academicYears={academicYears}
                rcNoteStatuses={rcNoteStatuses}
                heis={heis}
                onSuccess={() => router.reload()}
            />

            {/* Import Preview Dialog */}
            <ImportPreviewDialog
                isOpen={isImportPreviewOpen}
                onClose={() => setIsImportPreviewOpen(false)}
                onImportComplete={handleImportComplete}
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
                                        <Button variant="outline">
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
                                        <DropdownMenuItem onClick={() => setIsImportPreviewOpen(true)}>
                                            <Upload className="h-4 w-4 mr-2" />
                                            Bulk Upload
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}
                    </div>


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

                        <CardContent className="pt-6 px-0">
                            <form onSubmit={handleSearch} className="mb-4">
                                <div className="flex gap-2 flex-wrap items-center">
                                    <div className="relative flex-1 min-w-[200px]">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="search"
                                            placeholder="Search by reference number or HEI name..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-8"
                                        />
                                    </div>
                                    <Select value={programFilter} onValueChange={handleProgramFilter}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Program" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Programs</SelectItem>
                                            <SelectSeparator />
                                            {(() => {
                                                const unifastCodes = ['TES', 'TDP'];
                                                const unifastPrograms = programs.filter(p => !p.parent_id && unifastCodes.includes(p.code?.toUpperCase()));
                                                const stufapsParents = programs.filter(p => !p.parent_id && !unifastCodes.includes(p.code?.toUpperCase()));
                                                const childPrograms = programs.filter(p => p.parent_id);
                                                const childrenByParent = new Map<string, Program[]>();
                                                childPrograms.forEach(p => {
                                                    const list = childrenByParent.get(p.parent_id!) || [];
                                                    list.push(p);
                                                    childrenByParent.set(p.parent_id!, list);
                                                });

                                                return (
                                                    <>
                                                        <SelectGroup>
                                                            <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">UniFAST</SelectLabel>
                                                            <SelectItem value="unifast">All UniFAST</SelectItem>
                                                            {unifastPrograms.map(p => (
                                                                <SelectItem key={p.id} value={p.id} className="pl-6">{p.code}</SelectItem>
                                                            ))}
                                                        </SelectGroup>
                                                        <SelectSeparator />
                                                        <SelectGroup>
                                                            <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">STuFAPs</SelectLabel>
                                                            <SelectItem value="stufaps">All STuFAPs</SelectItem>
                                                            {stufapsParents.map(parent => {
                                                                const children = childrenByParent.get(parent.id) || [];
                                                                if (children.length > 0) {
                                                                    return (
                                                                        <React.Fragment key={parent.id}>
                                                                            <SelectItem value={parent.id} className="pl-6 font-medium">{parent.code}</SelectItem>
                                                                            {children.map(child => (
                                                                                <SelectItem key={child.id} value={child.id} className="pl-10 text-xs">{child.code}</SelectItem>
                                                                            ))}
                                                                        </React.Fragment>
                                                                    );
                                                                }
                                                                return <SelectItem key={parent.id} value={parent.id} className="pl-6">{parent.code}</SelectItem>;
                                                            })}
                                                        </SelectGroup>
                                                    </>
                                                );
                                            })()}
                                        </SelectContent>
                                    </Select>
                                    <Select value={documentStatusFilter} onValueChange={handleDocumentStatusFilter}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Document Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Documents</SelectItem>
                                            <SelectItem value="NONE">
                                                <span className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-red-500 dark:bg-red-400"></span>
                                                    No Submission
                                                </span>
                                            </SelectItem>
                                            <SelectItem value="PARTIAL">
                                                <span className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400"></span>
                                                    Partial Submission
                                                </span>
                                            </SelectItem>
                                            <SelectItem value="COMPLETE">
                                                <span className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                    Complete Submission
                                                </span>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={liquidationStatusFilter} onValueChange={handleLiquidationStatusFilter}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Liquidation Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Liquidation</SelectItem>
                                            <SelectItem value="unliquidated">
                                                <span className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-red-500 dark:bg-red-400"></span>
                                                    Unliquidated
                                                </span>
                                            </SelectItem>
                                            <SelectItem value="partially_liquidated">
                                                <span className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400"></span>
                                                    Partially Liquidated
                                                </span>
                                            </SelectItem>
                                            <SelectItem value="fully_liquidated">
                                                <span className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                    Fully Liquidated
                                                </span>
                                            </SelectItem>
                                            <SelectItem value="voided">
                                                <span className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500"></span>
                                                    Voided
                                                </span>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button type="submit" className="bg-foreground text-background hover:bg-foreground/90">Search</Button>
                                </div>
                                {/* Color Legend */}
                                <div className="flex items-center gap-4 my-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-red-500 dark:bg-red-400"></span>
                                        Needs Attention
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400"></span>
                                        In Progress
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400"></span>
                                        Partial
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        Complete
                                    </span>
                                </div>
                            </form>

                            <div className="overflow-hidden rounded-t-lg border border-b-0 overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-b hover:bg-transparent">
                                            <TableHead className="h-9 w-[50px] pl-4 text-xs font-medium tracking-wider text-muted-foreground uppercase">SEQ</TableHead>
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
                                                <TableRow key={liquidation.id} className={`transition-colors hover:bg-muted/50 ${liquidation.is_voided ? 'opacity-50' : ''}`}>
                                                    <TableCell className="font-medium text-center pl-4 py-3">
                                                        {index + 1}
                                                    </TableCell>
                                                    <TableCell className="py-3">
                                                        {liquidation.program ? (
                                                            <Badge variant="outline" className="font-normal">
                                                                {liquidation.program.code || liquidation.program.name}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                    {/* Combined: HEI Name + UII */}
                                                    <TableCell className="max-w-[250px] py-3">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className="font-medium text-sm truncate cursor-default">
                                                                    {liquidation.hei_name}
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top" className="max-w-xs">
                                                                {liquidation.hei_name}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                        <div className="text-xs text-muted-foreground font-mono">{liquidation.uii}</div>
                                                    </TableCell>
                                                    {/* Combined: Academic Year + Semester */}
                                                    <TableCell className="py-3">
                                                        <div className="text-sm">{liquidation.academic_year || '-'}</div>
                                                        <div className="text-xs text-muted-foreground">{liquidation.semester || '-'}</div>
                                                    </TableCell>
                                                    {/* Combined: Fund Released + Due Date */}
                                                    <TableCell className="py-3">
                                                        <div className="text-sm">{liquidation.date_fund_released || '-'}</div>
                                                        <div className="text-xs text-muted-foreground">Due: {liquidation.due_date || '-'}</div>
                                                    </TableCell>
                                                    <TableCell className="py-3">
                                                        {liquidation.batch_no || <span className="text-muted-foreground">-</span>}
                                                    </TableCell>
                                                    <TableCell className={`font-medium text-sm py-3 ${liquidation.is_voided ? 'line-through' : ''}`}>
                                                        {liquidation.dv_control_no}
                                                    </TableCell>
                                                    <TableCell className="text-right py-3">
                                                        {liquidation.number_of_grantees ?? <span className="text-muted-foreground">-</span>}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium py-3">
                                                        ₱{liquidation.total_disbursements}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium py-3">
                                                        ₱{liquidation.total_amount_liquidated ?? '0.00'}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium py-3">
                                                        ₱{liquidation.total_unliquidated_amount ?? '0.00'}
                                                    </TableCell>
                                                    <TableCell className="py-3">
                                                        <Badge className={`${getDocumentStatusColor(liquidation.document_status)} shadow-none border font-normal text-xs`}>
                                                            {liquidation.document_status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="max-w-[200px] py-3">
                                                        {liquidation.rc_notes ? (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span className="text-xs truncate block cursor-default" title={liquidation.rc_notes}>
                                                                        {liquidation.rc_notes}
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top" className="max-w-xs whitespace-pre-wrap">
                                                                    {liquidation.rc_notes}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="py-3">
                                                        <Badge className={`${getLiquidationStatusColor(liquidation.liquidation_status)} shadow-none border font-normal text-xs whitespace-nowrap`}>
                                                            {liquidation.liquidation_status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium py-3">
                                                        {(liquidation.percentage_liquidation ?? 0).toFixed(0)}%
                                                    </TableCell>
                                                    <TableCell className="text-right py-3">
                                                        {(liquidation.lapsing_period ?? 0) > 0 ? (
                                                            <span className="text-red-600 dark:text-red-400 font-medium">{liquidation.lapsing_period}</span>
                                                        ) : (
                                                            <span className="text-muted-foreground font-medium">0</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right pr-4 py-3">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        asChild
                                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                                    >
                                                                        <Link href={route('liquidation.show', liquidation.id)}>
                                                                            <Eye className="h-4 w-4" />
                                                                        </Link>
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>View details</TooltipContent>
                                                            </Tooltip>
                                                            {permissions.void && !liquidation.is_voided && (
                                                                <Popover
                                                                    open={voidPopoverOpen === liquidation.id}
                                                                    onOpenChange={(open) => {
                                                                        setVoidPopoverOpen(open ? liquidation.id : null);
                                                                        if (!open) setVoidConfirmInput('');
                                                                    }}
                                                                >
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <PopoverTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                                                >
                                                                                    <Ban className="h-4 w-4" />
                                                                                </Button>
                                                                            </PopoverTrigger>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>Void liquidation</TooltipContent>
                                                                    </Tooltip>
                                                                    <PopoverContent align="end" className="w-80">
                                                                        <div className="space-y-3">
                                                                            <div className="space-y-1">
                                                                                <h4 className="font-medium text-sm">Void Liquidation</h4>
                                                                                <p className="text-sm text-muted-foreground">
                                                                                    This record will be excluded from all consolidation reports and marked as voided.
                                                                                </p>
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label htmlFor={`void-confirm-${liquidation.id}`} className="text-sm">
                                                                                    Type <strong>{liquidation.dv_control_no}</strong> to confirm
                                                                                </Label>
                                                                                <Input
                                                                                    id={`void-confirm-${liquidation.id}`}
                                                                                    value={voidConfirmInput}
                                                                                    onChange={(e) => setVoidConfirmInput(e.target.value)}
                                                                                    placeholder={liquidation.dv_control_no}
                                                                                    className="h-8 text-sm"
                                                                                />
                                                                            </div>
                                                                            <Button
                                                                                variant="destructive"
                                                                                size="sm"
                                                                                className="w-full"
                                                                                disabled={voidConfirmInput !== liquidation.dv_control_no}
                                                                                onClick={() => {
                                                                                    handleVoid(liquidation);
                                                                                    setVoidPopoverOpen(null);
                                                                                    setVoidConfirmInput('');
                                                                                }}
                                                                            >
                                                                                Void this liquidation
                                                                            </Button>
                                                                        </div>
                                                                    </PopoverContent>
                                                                </Popover>
                                                            )}
                                                            {permissions.void && liquidation.is_voided && (
                                                                <Popover
                                                                    open={restorePopoverOpen === liquidation.id}
                                                                    onOpenChange={(open) => {
                                                                        setRestorePopoverOpen(open ? liquidation.id : null);
                                                                        if (!open) setRestoreConfirmInput('');
                                                                    }}
                                                                >
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <PopoverTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-8 w-8 text-muted-foreground hover:text-emerald-600"
                                                                                >
                                                                                    <RotateCcw className="h-4 w-4" />
                                                                                </Button>
                                                                            </PopoverTrigger>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>Restore liquidation</TooltipContent>
                                                                    </Tooltip>
                                                                    <PopoverContent align="end" className="w-80">
                                                                        <div className="space-y-3">
                                                                            <div className="space-y-1">
                                                                                <h4 className="font-medium text-sm">Restore Liquidation</h4>
                                                                                <p className="text-sm text-muted-foreground">
                                                                                    This record will be included back in consolidation reports.
                                                                                </p>
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label htmlFor={`restore-confirm-${liquidation.id}`} className="text-sm">
                                                                                    Type <strong>{liquidation.dv_control_no}</strong> to confirm
                                                                                </Label>
                                                                                <Input
                                                                                    id={`restore-confirm-${liquidation.id}`}
                                                                                    value={restoreConfirmInput}
                                                                                    onChange={(e) => setRestoreConfirmInput(e.target.value)}
                                                                                    placeholder={liquidation.dv_control_no}
                                                                                    className="h-8 text-sm"
                                                                                />
                                                                            </div>
                                                                            <Button
                                                                                size="sm"
                                                                                className="w-full"
                                                                                disabled={restoreConfirmInput !== liquidation.dv_control_no}
                                                                                onClick={() => {
                                                                                    handleRestore(liquidation);
                                                                                    setRestorePopoverOpen(null);
                                                                                    setRestoreConfirmInput('');
                                                                                }}
                                                                            >
                                                                                Restore this liquidation
                                                                            </Button>
                                                                        </div>
                                                                    </PopoverContent>
                                                                </Popover>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
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
                        </CardContent>

                </div>
            </div>
        </AppLayout>
    );
}
