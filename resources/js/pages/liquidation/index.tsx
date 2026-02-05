import React, { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
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
import { ViewLiquidationModal } from '@/components/liquidations/view-liquidation-modal';
import { CreateLiquidationModal } from '@/components/liquidations/create-liquidation-modal';
import axios from 'axios';
import { toast } from 'sonner';

interface HEI {
    id: number;
    name: string;
    code: string;
    uii: string;
}

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
    status: string;
    status_label: string;
    status_badge: string;
}

interface User {
    id: number;
    name: string;
}

interface Props {
    liquidations: {
        data: Liquidation[];
        links: any[];
        meta: any;
    };
    userHei: HEI | null;
    regionalCoordinators: User[];
    accountants: User[];
    programs: Program[];
    filters: {
        search?: string;
        status?: string;
        program?: string;
    };
    permissions: {
        review: boolean;
        create: boolean;
    };
    userRole: string;
}

export default function Index({ liquidations, userHei, regionalCoordinators, accountants, programs, filters, permissions, userRole }: Props) {
    const [searchQuery, setSearchQuery] = useState(filters.search || '');
    const [statusFilter, setStatusFilter] = useState(filters.status || '');
    const [programFilter, setProgramFilter] = useState(filters.program || '');
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedLiquidation, setSelectedLiquidation] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const isRC = userRole === 'Regional Coordinator';
    const isHEI = userRole === 'HEI';
    const canCreate = (permissions.create || isRC) && !isHEI;

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(route('liquidation.index'), { search: searchQuery, status: statusFilter, program: programFilter }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleStatusFilter = (value: string) => {
        setStatusFilter(value);
        router.get(route('liquidation.index'), { search: searchQuery, status: value, program: programFilter }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleProgramFilter = (value: string) => {
        setProgramFilter(value);
        router.get(route('liquidation.index'), { search: searchQuery, status: statusFilter, program: value }, {
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

    const getStatusColor = (status: string) => {
        switch (status) {
            // Draft - gray
            case 'draft':
            case 'Draft':
                return 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200';

            // For RC Review - black/dark gray
            case 'for_initial_review':
                return 'bg-gray-800 text-gray-100 hover:bg-gray-900 border-gray-800';

            // Endorsed to Accounting - purple/violet
            case 'endorsed_to_accounting':
                return 'bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200';

            // Endorsed to COA - green (success)
            case 'endorsed_to_coa':
            case 'Endorsed to COA':
                return 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200';

            // Returned to HEI or RC - red (destructive)
            case 'returned_to_hei':
            case 'returned_to_rc':
            case 'Returned':
                return 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200';

            // Old statuses for backward compatibility
            case 'Submitted': return 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200';
            case 'Verified': return 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200';
            case 'Cleared': return 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200';

            default: return 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200';
        }
    };

    const handleViewLiquidation = async (liquidationId: number) => {
        try {
            const response = await axios.get(route('liquidation.show', liquidationId));
            setSelectedLiquidation(response.data);
            setIsViewModalOpen(true);
        } catch (error) {
            console.error('Error loading liquidation:', error);
        }
    };

    return (
        <AppLayout>
            <Head title="Liquidation Management" />

            {/* View Liquidation Modal */}
            <ViewLiquidationModal
                isOpen={isViewModalOpen}
                onClose={() => {
                    setIsViewModalOpen(false);
                    setSelectedLiquidation(null);
                }}
                liquidation={selectedLiquidation}
                onDataChange={(updatedLiquidation) => {
                    setSelectedLiquidation(updatedLiquidation);
                }}
                canSubmit={userHei !== null}
                canReview={permissions.review}
                userRole={userRole}
                regionalCoordinators={regionalCoordinators}
                accountants={accountants}
            />

            {/* Create Liquidation Modal */}
            <CreateLiquidationModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                programs={programs}
                onSuccess={() => router.reload()}
            />

            <div className="py-8 w-full">
                <div className="w-full max-w-[95%] mx-auto">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Liquidation Management</h1>
                            <p className="text-muted-foreground mt-1">
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

                    <Card>
                        <CardContent className="pt-6">
                            <form onSubmit={handleSearch} className="mb-4">
                                <div className="flex gap-2 flex-wrap">
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
                                            <SelectValue placeholder="Filter by program" />
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
                                    <Select value={statusFilter} onValueChange={handleStatusFilter}>
                                        <SelectTrigger className="w-[200px]">
                                            <SelectValue placeholder="Filter by status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Statuses</SelectItem>
                                            <SelectItem value="draft">Draft</SelectItem>
                                            <SelectItem value="for_initial_review">For Initial Review</SelectItem>
                                            <SelectItem value="returned_to_hei">Returned to HEI</SelectItem>
                                            <SelectItem value="endorsed_to_accounting">Endorsed to Accounting</SelectItem>
                                            <SelectItem value="returned_to_rc">Returned to RC</SelectItem>
                                            <SelectItem value="endorsed_to_coa">Endorsed to COA</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button type="submit">Search</Button>
                                </div>
                            </form>

                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">SEQ</TableHead>
                                            <TableHead>Program</TableHead>
                                            <TableHead>UII</TableHead>
                                            <TableHead>HEI Name</TableHead>
                                            <TableHead>Date of Fund Released</TableHead>
                                            <TableHead>Due Date</TableHead>
                                            <TableHead>Academic Year</TableHead>
                                            <TableHead>Semester</TableHead>
                                            <TableHead>Batch No.</TableHead>
                                            <TableHead>DV Control No.</TableHead>
                                            <TableHead className="text-right">No. of Grantees</TableHead>
                                            <TableHead className="text-right">Total Disbursements</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {liquidations.data.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                                                    <FileText className="mx-auto h-12 w-12 mb-2 opacity-50" />
                                                    <p>No liquidation records found</p>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            liquidations.data.map((liquidation, index) => (
                                                <TableRow key={liquidation.id}>
                                                    <TableCell className="font-medium text-center">
                                                        {index + 1}
                                                    </TableCell>
                                                    <TableCell>
                                                        {liquidation.program ? (
                                                            <Badge variant="outline" className="font-normal">
                                                                {liquidation.program.code || liquidation.program.name}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm">
                                                        {liquidation.uii}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{liquidation.hei_name}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {liquidation.date_fund_released || <span className="text-muted-foreground">-</span>}
                                                    </TableCell>
                                                    <TableCell>
                                                        {liquidation.due_date || <span className="text-muted-foreground">-</span>}
                                                    </TableCell>
                                                    <TableCell>
                                                        {liquidation.academic_year || <span className="text-muted-foreground">-</span>}
                                                    </TableCell>
                                                    <TableCell>
                                                        {liquidation.semester || <span className="text-muted-foreground">-</span>}
                                                    </TableCell>
                                                    <TableCell>
                                                        {liquidation.batch_no || <span className="text-muted-foreground">-</span>}
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {liquidation.dv_control_no}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {liquidation.number_of_grantees ?? <span className="text-muted-foreground">-</span>}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        ₱{liquidation.total_disbursements}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={`${getStatusColor(liquidation.status)} shadow-none border font-normal text-xs`}>
                                                            {liquidation.status_label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleViewLiquidation(liquidation.id)}
                                                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        >
                                                            <Eye className="h-4 w-4 mr-1" />
                                                            View
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {liquidations.data.length > 0 && liquidations.links && (
                                <div className="flex items-center justify-center gap-2 mt-4">
                                    {liquidations.links.map((link: any, index: number) => (
                                        <Button
                                            key={index}
                                            variant={link.active ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => link.url && router.visit(link.url)}
                                            disabled={!link.url}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
