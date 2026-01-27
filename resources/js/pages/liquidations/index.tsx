import React, { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreateLiquidationModal } from '@/components/liquidations/create-liquidation-modal';
import { ShowLiquidationModal } from '@/components/liquidations/show-liquidation-modal';
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
    Plus,
    Search,
    FileText,
    MoreHorizontal,
    Eye,
    Pencil,
    FileCheck
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';


interface Hei {
    id: number;
    name: string;
}

interface Liquidation {
    id: number;
    control_no: string;
    batch_no?: string;
    hei_id: number;
    hei?: Hei;
    program_id: number;
    academic_year: string;
    semester: string;
    amount_received: number;
    amount_disbursed: number;
    amount_refunded: number;
    status: 'Draft' | 'Submitted' | 'Verified' | 'Returned' | 'Cleared' | 'Endorsed to COA';
    created_at: string;
}

interface Program {
    id: number;
    name: string;
}

interface School {
    id: number;
    name: string;
}

interface Props {
    auth: { user: any };
    liquidations: Liquidation[];
    nextSequence: string;
    currentYear: string;
    programs: Program[];
    schools: School[];
    // ✅ Permissions received from Controller
    userPermissions: {
        can_submit: boolean;
        can_endorse_accounting: boolean;
        can_endorse_coa: boolean;
        can_return: boolean;
    };
}

export default function Index({ auth, liquidations, nextSequence, currentYear, programs, schools, userPermissions }: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isShowModalOpen, setIsShowModalOpen] = useState(false);
    const [selectedLiquidation, setSelectedLiquidation] = useState<Liquidation | null>(null);

    const getHeiName = (liq: Liquidation) => {
        if (liq.hei) return liq.hei.name;
        return `School ${liq.hei_id} (Sample HEI)`;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Draft': return 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200';
            case 'Submitted': return 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200';
            case 'Verified': return 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200';
            case 'Returned': return 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200';
            case 'Cleared': return 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200';
            case 'Endorsed to COA': return 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-indigo-200';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const handleViewDetails = (liquidation: Liquidation) => {
        setSelectedLiquidation(liquidation);
        setIsShowModalOpen(true);
    };

    const filteredLiquidations = liquidations.filter(liq =>
        liq.control_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getHeiName(liq).toLowerCase().includes(searchQuery.toLowerCase()) ||
        liq.academic_year.includes(searchQuery)
    );

    return (
        <AppLayout>
            <Head title="Liquidation Reports" />

            <CreateLiquidationModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                nextSequence={nextSequence}
                currentYear={currentYear}
                programs={programs}
                schools={schools}
            />

            {/* ✅ Pass Permissions to Modal */}
            <ShowLiquidationModal
                isOpen={isShowModalOpen}
                onClose={() => setIsShowModalOpen(false)}
                liquidation={selectedLiquidation}
                permissions={userPermissions}
            />

            <div className="py-8 w-full">
                <div className="w-full max-w-[95%] mx-auto">

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight">Liquidation Reports</h2>
                            <p className="text-muted-foreground mt-1">
                                Monitor fund utilization reports submitted by Higher Education Institutions.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                             <div className="relative w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search Control No, HEI..."
                                    className="pl-9 bg-background"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <Button onClick={() => setIsCreateModalOpen(true)} className="bg-primary hover:bg-primary/90 shadow-sm">
                                <Plus className="mr-2 h-4 w-4" />
                                New Report
                            </Button>
                        </div>
                    </div>

                    <Card className="shadow-sm border-border/50">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="pl-6 h-12">Control No.</TableHead>
                                        <TableHead>HEI / Institution</TableHead>
                                        <TableHead>Program & Term</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right pr-6">Date Created</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredLiquidations.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                                <div className="flex flex-col items-center gap-2">
                                                    <FileText className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>No liquidation reports found.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredLiquidations.map((liq) => (
                                            <TableRow key={liq.id} className="hover:bg-muted/50 transition-colors">
                                                <TableCell className="pl-6 py-4 font-medium">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <FileText className="h-4 w-4 text-primary/70" />
                                                            <span className="font-mono text-sm">{liq.control_no}</span>
                                                        </div>
                                                        {liq.batch_no && (
                                                            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded w-fit ml-6">
                                                                {liq.batch_no}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-medium text-sm text-foreground/90">
                                                        {getHeiName(liq)}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium">
                                                            {liq.program_id === 1 ? 'TES' : 'TDP'}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {liq.semester}, AY {liq.academic_year}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-mono font-medium text-sm">
                                                        ₱{parseFloat(liq.amount_received.toString()).toLocaleString(undefined, {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2
                                                        })}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={`${getStatusColor(liq.status)} shadow-none border font-normal`}>
                                                        {liq.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right text-muted-foreground text-sm pr-6">
                                                    {new Date(liq.created_at).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                                <span className="sr-only">Open menu</span>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                            <DropdownMenuItem onClick={() => handleViewDetails(liq)} className="cursor-pointer">
                                                                <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                                                                View Details
                                                            </DropdownMenuItem>
                                                            {liq.status === 'Draft' && (
                                                                <DropdownMenuItem className="cursor-pointer">
                                                                    <Pencil className="mr-2 h-4 w-4 text-muted-foreground" />
                                                                    Edit Report
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="cursor-pointer">
                                                                <FileCheck className="mr-2 h-4 w-4 text-muted-foreground" />
                                                                History Logs
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                </div>
            </div>
        </AppLayout>
    );
}
