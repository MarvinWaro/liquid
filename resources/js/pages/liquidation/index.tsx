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
import {
    Card,
    CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Search, FileText, Eye, Download, Upload, Plus } from 'lucide-react';
import { CreateLiquidationModal } from '@/components/liquidations/create-liquidation-modal';
import { toast } from 'sonner';
import axios from 'axios';
import { type BreadcrumbItem } from '@/types';

interface Program {
    id: string;
    name: string;
    code: string;
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
    percentage_liquidation: number;
    lapsing_period: number;
    status: string;
    status_label: string;
    status_badge: string;
}

interface Props {
    liquidations: {
        data: Liquidation[];
        links: any[];
        meta: any;
    };
    programs: Program[];
    filters: {
        search?: string;
        program?: string;
        document_status?: string;
        liquidation_status?: string;
    };
    permissions: {
        review: boolean;
        create: boolean;
    };
    userRole: string;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Liquidation Management', href: route('liquidation.index') },
];

export default function Index({ liquidations, programs, filters, permissions, userRole }: Props) {
    const [searchQuery, setSearchQuery] = useState(filters.search || '');
    const [programFilter, setProgramFilter] = useState(filters.program || '');
    const [documentStatusFilter, setDocumentStatusFilter] = useState(filters.document_status || '');
    const [liquidationStatusFilter, setLiquidationStatusFilter] = useState(filters.liquidation_status || '');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

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

    const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post(route('liquidation.bulk-import'), formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                toast.success(response.data.message);

                // Show individual errors if any
                if (response.data.errors && response.data.errors.length > 0) {
                    response.data.errors.slice(0, 3).forEach((err: string) => {
                        toast.warning(err);
                    });
                }

                router.reload();
            }
        } catch (error: any) {
            const message = error.response?.data?.message || 'Failed to import liquidations';
            toast.error(message);

            // Show individual errors if available
            if (error.response?.data?.errors) {
                error.response.data.errors.slice(0, 3).forEach((err: string) => {
                    toast.error(err);
                });
            }
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const getDocumentStatusColor = (status: string) => {
        if (status?.includes('Complete')) {
            return 'bg-green-100 text-green-700 border-green-200';
        }
        if (status?.includes('Partial')) {
            return 'bg-amber-100 text-amber-700 border-amber-200';
        }
        // No Submission - highlighted in red
        return 'bg-red-100 text-red-700 border-red-200';
    };

    const getLiquidationStatusColor = (status: string) => {
        if (status?.includes('Fully Liquidated')) {
            return 'bg-green-100 text-green-700 border-green-200';
        }
        if (status?.includes('Partially Liquidated')) {
            return 'bg-blue-100 text-blue-700 border-blue-200';
        }
        // Unliquidated - highlighted in red
        return 'bg-red-100 text-red-700 border-red-200';
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Liquidation Management" />

            {/* Create Liquidation Modal */}
            <CreateLiquidationModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                programs={programs}
                onSuccess={() => router.reload()}
            />

            <div className="py-8 w-full">
                <div className="w-full max-w-[100%] mx-auto">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Liquidation Management</h1>
                            <p className="text-muted-foreground my-1">
                                {userRole === 'Regional Coordinator' && 'Review and endorse liquidations to Accounting'}
                                {userRole === 'Accountant' && 'Review and endorse liquidations to COA'}
                                {!['Regional Coordinator', 'Accountant'].includes(userRole) && 'Manage liquidation records and submissions'}
                            </p>
                        </div>
                        {canCreate && (
                            <div className="flex gap-2">
                                <Button onClick={() => setIsCreateModalOpen(true)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create Liquidation
                                </Button>
                                <Button variant="outline" onClick={handleDownloadTemplate}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download Template
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                >
                                    <Upload className="h-4 w-4 mr-2" />
                                    {isUploading ? 'Uploading...' : 'Bulk Upload'}
                                </Button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls"
                                    className="hidden"
                                    onChange={handleBulkUpload}
                                />
                            </div>
                        )}
                    </div>


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
                                        <SelectTrigger className="w-[150px]">
                                            <SelectValue placeholder="Program" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Programs</SelectItem>
                                            {programs.map((program) => (
                                                <SelectItem key={program.id} value={program.id}>
                                                    {program.code || program.name}
                                                </SelectItem>
                                            ))}
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
                                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                                    No Submission
                                                </span>
                                            </SelectItem>
                                            <SelectItem value="PARTIAL">
                                                <span className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                                    Partial Submission
                                                </span>
                                            </SelectItem>
                                            <SelectItem value="COMPLETE">
                                                <span className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
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
                                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                                    Unliquidated
                                                </span>
                                            </SelectItem>
                                            <SelectItem value="partially_liquidated">
                                                <span className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                    Partially Liquidated
                                                </span>
                                            </SelectItem>
                                            <SelectItem value="fully_liquidated">
                                                <span className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                    Fully Liquidated
                                                </span>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button type="submit">Search</Button>
                                </div>
                                {/* Color Legend */}
                                <div className="flex items-center gap-4 my-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                        Needs Attention
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                        In Progress
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                        Partial
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                        Complete
                                    </span>
                                </div>
                            </form>

                            <div className="rounded-t-md border border-b-0 overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px] pl-4">SEQ</TableHead>
                                            <TableHead>Program</TableHead>
                                            <TableHead className="max-w-[300px]">HEI</TableHead>
                                            <TableHead>Period</TableHead>
                                            <TableHead>Dates</TableHead>
                                            <TableHead>Batch</TableHead>
                                            <TableHead>DV Control No.</TableHead>
                                            <TableHead className="text-right">Grantees</TableHead>
                                            <TableHead className="text-right">Disbursements</TableHead>
                                            <TableHead className="text-right">Liquidated</TableHead>
                                            <TableHead className="text-right">Unliquidated</TableHead>
                                            <TableHead>Documents</TableHead>
                                            <TableHead>RC Notes</TableHead>
                                            <TableHead>Liquidation Status</TableHead>
                                            <TableHead className="text-right">%</TableHead>
                                            <TableHead className="text-right">Lapsing</TableHead>
                                            <TableHead className="text-right pr-4">Actions</TableHead>
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
                                                <TableRow key={liquidation.id} className="hover:bg-transparent">
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
                                                        <div
                                                            className="font-medium text-sm truncate"
                                                            title={liquidation.hei_name}
                                                        >
                                                            {liquidation.hei_name}
                                                        </div>
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
                                                    <TableCell className="font-medium text-sm py-3">
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
                                                    <TableCell className="max-w-[100px] py-3">
                                                        {liquidation.rc_notes ? (
                                                            <span className="text-xs truncate block" title={liquidation.rc_notes}>
                                                                {liquidation.rc_notes}
                                                            </span>
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
                                                            <span className="text-red-600 font-medium">{liquidation.lapsing_period}</span>
                                                        ) : (
                                                            <span className="text-green-600 font-medium">0</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right pr-4 py-3">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            asChild
                                                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        >
                                                            <Link href={route('liquidation.show', liquidation.id)}>
                                                                <Eye className="h-4 w-4" />
                                                                View
                                                            </Link>
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Table Footer with Record Counter and Pagination */}
                            <div className="flex items-center justify-between px-4 py-3 bg-blue-100 dark:bg-blue-950/20 border rounded-b-md">
                                {/* Record Counter - Left Side */}
                                <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
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
