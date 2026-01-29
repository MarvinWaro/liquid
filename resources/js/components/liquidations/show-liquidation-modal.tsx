import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
    Download, Upload, Plus, Search, Users, FileText, Banknote,
    MoreHorizontal, Loader2, Send, CheckCircle, XCircle, Building
} from 'lucide-react';

interface LiquidationItem {
    id: number;
    student_no: string;
    full_name: string;
    award_no: string;
    amount: number;
    date_disbursed: string;
}

interface Liquidation {
    id: number;
    control_no: string;
    hei_id: number;
    program_id: number;
    academic_year: string;
    semester: string;
    amount_received: number;
    amount_disbursed: number;
    amount_refunded: number;
    status: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    liquidation: Liquidation | null;
    permissions: {
        can_submit: boolean;
        can_endorse_accounting: boolean;
        can_endorse_coa: boolean;
        can_return: boolean;
    };
}

export function ShowLiquidationModal({ isOpen, onClose, liquidation, permissions }: Props) {
    const [items, setItems] = useState<LiquidationItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const { post, processing: processingAction } = useForm({});
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const refreshItems = () => {
        if (liquidation?.id) {
            setLoading(true);
            axios.get(route('liquidations.items', liquidation.id))
                .then(response => {
                    setItems(response.data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setLoading(false);
                });
        }
    };

    useEffect(() => {
        if (isOpen && liquidation?.id) {
            refreshItems();
        } else {
            setItems([]);
        }
    }, [isOpen, liquidation]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && liquidation) {
            const file = e.target.files[0];
            const formData = new FormData();
            formData.append('csv_file', file);

            setUploading(true);

            axios.post(route('liquidations.upload', liquidation.id), formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            .then((response) => {
                toast.success(response.data.message || "CSV Imported Successfully");
                refreshItems();
            })
            .catch((err) => {
                console.error(err);
                const msg = err.response?.data?.message || "Failed to upload CSV. Please check format.";
                toast.error(msg);
            })
            .finally(() => {
                setUploading(false);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            });
        }
    };

    // --- ACTIONS ---

    const handleSubmitReport = () => {
        if (!liquidation) return;
        if (!confirm("Are you sure you want to submit this report?")) return;
        post(route('liquidations.submit', liquidation.id), { onSuccess: () => onClose() });
    };

    const handleEndorseAccounting = () => {
        if (!liquidation) return;
        if (!confirm("Endorse this report to Accounting?")) return;
        post(route('liquidations.endorse', liquidation.id), { onSuccess: () => onClose() });
    };

    const handleEndorseCOA = () => {
        if (!liquidation) return;
        if (!confirm("Endorse this report to COA?")) return;
        post(route('liquidations.endorse-coa', liquidation.id), { onSuccess: () => onClose() });
    };

    const handleReturn = () => {
        if (!liquidation) return;
        if (!confirm("Return this report to HEI for corrections?")) return;
        post(route('liquidations.return', liquidation.id), { onSuccess: () => onClose() });
    };

    const getProgramName = (id: number) => id === 1 ? 'TES' : 'TDP';

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

    const filteredItems = items.filter(item =>
        item.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.student_no && item.student_no.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const totalDisbursed = items.reduce((sum, item) => sum + Number(item.amount), 0);
    const remaining = liquidation ? Number(liquidation.amount_received) - totalDisbursed : 0;

    if (!liquidation) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-5xl w-full max-h-[90vh] flex flex-col p-0 gap-0">

                <DialogHeader className="p-5 pb-3 border-b bg-background flex flex-row items-center justify-between space-y-0 pr-10">
                    <div>
                        <div className="flex items-center gap-3">
                            <DialogTitle className="text-xl font-bold tracking-tight">
                                {liquidation.control_no}
                            </DialogTitle>
                            <Badge className={`${getStatusColor(liquidation.status)} shadow-none border font-normal text-xs px-2 h-5`}>
                                {liquidation.status}
                            </Badge>
                        </div>
                        <DialogDescription className="mt-1 text-xs">
                            {getProgramName(liquidation.program_id)} • AY {liquidation.academic_year}, {liquidation.semester}
                        </DialogDescription>
                    </div>

                    {liquidation.status === 'Draft' && (
                        <div className="flex items-center gap-3">
                            <a href={route('liquidations.template')} target="_blank" rel="noreferrer">
                                <Button variant="outline" size="sm" className="h-8 text-xs shadow-sm">
                                    <Download className="mr-2 h-3 w-3" />
                                    Template
                                </Button>
                            </a>
                            <Button
                                variant="outline" size="sm" className="h-8 text-xs shadow-sm"
                                onClick={() => fileInputRef.current?.click()} disabled={uploading}
                            >
                                {uploading ? <Loader2 className="mr-2 h-3 w-3 animate-spin"/> : <Upload className="mr-2 h-3 w-3" />}
                                Upload CSV
                            </Button>
                            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileChange} />
                            <Button size="sm" className="h-8 text-xs shadow-sm">
                                <Plus className="mr-2 h-3 w-3" />
                                Add Student
                            </Button>
                        </div>
                    )}
                </DialogHeader>

                <div className="flex-1 overflow-y-auto bg-muted/30 p-5 space-y-5">
                    {/* Financial Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-background border-primary/20 shadow-sm">
                            <CardHeader className="p-4 pb-1">
                                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                    <Banknote className="h-3.5 w-3.5 text-primary" /> Amount Received
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-1">
                                <div className="text-xl font-bold font-mono text-primary">
                                    ₱{parseFloat(liquidation.amount_received.toString()).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-background shadow-sm">
                            <CardHeader className="p-4 pb-1">
                                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                    <Users className="h-3.5 w-3.5" /> Disbursed to Students
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-1">
                                <div className="text-xl font-bold font-mono">
                                    ₱{totalDisbursed.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-background shadow-sm">
                            <CardHeader className="p-4 pb-1">
                                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                    <FileText className="h-3.5 w-3.5" /> Remaining / Refund
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-1">
                                <div className={`text-xl font-bold font-mono ${remaining < 0 ? 'text-destructive' : 'text-amber-600'}`}>
                                    ₱{remaining.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Student List */}
                    <Card className="shadow-sm border-border/50 bg-background">
                        <CardHeader className="px-5 py-3 border-b">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base font-semibold">Beneficiaries</CardTitle>
                                    <CardDescription className="text-xs">List of students who received funds.</CardDescription>
                                </div>
                                <div className="relative w-56">
                                    <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        placeholder="Search student..."
                                        className="pl-8 h-9 text-sm bg-background"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="h-10">
                                        <TableHead className="pl-5 text-xs">Student No.</TableHead>
                                        <TableHead className="text-xs">Full Name</TableHead>
                                        <TableHead className="text-xs">Award No.</TableHead>
                                        <TableHead className="text-xs">Date Disbursed</TableHead>
                                        <TableHead className="text-right pr-5 text-xs">Amount</TableHead>
                                        <TableHead className="w-[40px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center">
                                                <div className="flex justify-center items-center gap-2 text-muted-foreground text-sm">
                                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading data...
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                                <div className="flex flex-col items-center gap-1">
                                                    <Users className="h-8 w-8 text-muted-foreground/30" />
                                                    <p className="text-sm">No students found.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredItems.map((item) => (
                                            <TableRow key={item.id} className="hover:bg-muted/50 h-10">
                                                <TableCell className="pl-5 font-mono text-xs text-muted-foreground">{item.student_no || '-'}</TableCell>
                                                <TableCell className="font-medium text-sm">{item.full_name}</TableCell>
                                                <TableCell className="text-muted-foreground text-xs">{item.award_no || '-'}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{new Date(item.date_disbursed).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-right font-mono text-xs pr-5">₱{parseFloat(item.amount.toString()).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                                <TableCell><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>

                <DialogFooter className="p-4 border-t bg-background flex justify-between items-center sm:justify-between">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Current Status</span>
                        <span className="text-sm font-medium">{liquidation.status}</span>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} size="sm">Close</Button>

                        {/* 1. HEI ACTION */}
                        {liquidation.status === 'Draft' && (
                            <Button
                                onClick={handleSubmitReport}
                                disabled={processingAction || loading}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                <Send className="mr-2 h-3 w-3" /> Submit Report
                            </Button>
                        )}

                        {/* 2. REGIONAL COORDINATOR ACTION */}
                        {liquidation.status === 'Submitted' && permissions.can_endorse_accounting && (
                            <>
                                <Button onClick={handleReturn} disabled={processingAction} size="sm" variant="destructive">
                                    <XCircle className="mr-2 h-3 w-3" /> Return
                                </Button>
                                <Button onClick={handleEndorseAccounting} disabled={processingAction} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                                    <CheckCircle className="mr-2 h-3 w-3" /> Endorse to Accounting
                                </Button>
                            </>
                        )}

                        {/* 3. ACCOUNTANT ACTION */}
                        {liquidation.status === 'Verified' && permissions.can_endorse_coa && (
                            <>
                                <Button onClick={handleReturn} disabled={processingAction} size="sm" variant="destructive">
                                    <XCircle className="mr-2 h-3 w-3" /> Return to Coordinator
                                </Button>
                                <Button onClick={handleEndorseCOA} disabled={processingAction} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                    <Building className="mr-2 h-3 w-3" /> Endorse to COA
                                </Button>
                            </>
                        )}

                        {/* 4. FINAL STATE (COA) */}
                        {liquidation.status === 'Endorsed to COA' && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-md text-indigo-700 text-xs font-semibold">
                                <Building className="h-3 w-3" /> Transmitted to COA
                            </div>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
