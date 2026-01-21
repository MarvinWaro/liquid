import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Download, Upload, Search, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Beneficiary {
    id: number;
    student_no: string;
    last_name: string;
    first_name: string;
    middle_name: string | null;
    extension_name: string | null;
    award_no: string;
    date_disbursed: string;
    amount: string;
    remarks: string | null;
}

interface Liquidation {
    id: number;
    control_no: string;
    hei_name: string;
    program_name: string;
    academic_year: string;
    semester: string;
    batch_no: string;
    amount_received: number;
    total_disbursed: number;
    remaining_amount: number;
    status: string;
    status_label: string;
    beneficiaries: Beneficiary[];
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    liquidation: Liquidation | null;
    onDataChange?: (updatedLiquidation: Liquidation) => void;
}

export function ViewLiquidationModal({ isOpen, onClose, liquidation, onDataChange }: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    if (!liquidation) return null;

    const filteredBeneficiaries = liquidation.beneficiaries.filter(beneficiary =>
        beneficiary.student_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        beneficiary.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        beneficiary.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        beneficiary.award_no.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDownloadTemplate = () => {
        window.location.href = route('liquidation.download-beneficiary-template', liquidation.id);
    };

    const handleUploadCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('csv_file', file);

        router.post(route('liquidation.import-beneficiaries', liquidation.id), formData, {
            onSuccess: async () => {
                // Reload the liquidation data to show updated beneficiaries
                try {
                    const response = await axios.get(route('liquidation.show', liquidation.id));
                    if (onDataChange) {
                        onDataChange(response.data);
                    }
                } catch (error) {
                    console.error('Error reloading liquidation:', error);
                }
                setIsUploading(false);
                e.target.value = '';
            },
            onError: () => {
                setIsUploading(false);
                e.target.value = '';
            },
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[80vw] max-w-[1200px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl">{liquidation.control_no}</DialogTitle>
                    <DialogDescription>
                        {liquidation.program_name} · AY {liquidation.academic_year}, {liquidation.semester}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardDescription className="text-xs">Amount Received</CardDescription>
                                <CardTitle className="text-2xl">₱{liquidation.amount_received.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</CardTitle>
                            </CardHeader>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardDescription className="text-xs">Disbursed to Students</CardDescription>
                                <CardTitle className="text-2xl text-blue-600">₱{liquidation.total_disbursed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</CardTitle>
                            </CardHeader>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardDescription className="text-xs">Remaining / Refund</CardDescription>
                                <CardTitle className="text-2xl text-orange-600">₱{liquidation.remaining_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</CardTitle>
                            </CardHeader>
                        </Card>
                    </div>

                    {/* Beneficiaries Section */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Beneficiaries</CardTitle>
                                    <CardDescription>List of students who received funds</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleDownloadTemplate}
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Template
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => document.getElementById('csv-upload')?.click()}
                                        disabled={isUploading}
                                    >
                                        <Upload className="h-4 w-4 mr-2" />
                                        {isUploading ? 'Uploading...' : 'Upload CSV'}
                                    </Button>
                                    <input
                                        id="csv-upload"
                                        type="file"
                                        accept=".csv"
                                        className="hidden"
                                        onChange={handleUploadCSV}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {/* Search */}
                            <div className="mb-4">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        placeholder="Search student..."
                                        className="pl-8"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Table */}
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Student No.</TableHead>
                                            <TableHead>Full Name</TableHead>
                                            <TableHead>Award No.</TableHead>
                                            <TableHead>Date Disbursed</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredBeneficiaries.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <FileText className="h-8 w-8 opacity-50" />
                                                        <p>No students found.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredBeneficiaries.map((beneficiary) => (
                                                <TableRow key={beneficiary.id}>
                                                    <TableCell className="font-mono text-sm">
                                                        {beneficiary.student_no}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">
                                                                {beneficiary.last_name}, {beneficiary.first_name} {beneficiary.middle_name || ''}
                                                            </span>
                                                            {beneficiary.extension_name && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    {beneficiary.extension_name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm">
                                                        {beneficiary.award_no}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {new Date(beneficiary.date_disbursed).toLocaleDateString()}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        ₱{parseFloat(beneficiary.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {filteredBeneficiaries.length > 0 && (
                                <div className="mt-4 text-sm text-muted-foreground">
                                    Showing {filteredBeneficiaries.length} of {liquidation.beneficiaries.length} beneficiaries
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </DialogContent>
        </Dialog>
    );
}
