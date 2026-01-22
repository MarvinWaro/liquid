import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Download, Upload, Search, FileText, Send, File, X, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';

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

interface Document {
    id: number;
    file_name: string;
    file_path: string;
    uploaded_at: string;
}

interface ReviewHistoryEntry {
    returned_at: string;
    returned_by: string;
    returned_by_id: number;
    review_remarks: string;
    documents_for_compliance?: string | null;
}

interface AccountantReviewHistoryEntry {
    returned_at: string;
    returned_by: string;
    returned_by_id: number;
    accountant_remarks: string;
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
    review_remarks?: string | null;
    documents_for_compliance?: string | null;
    compliance_status?: string | null;
    review_history?: ReviewHistoryEntry[];
    accountant_review_history?: AccountantReviewHistoryEntry[];
    accountant_remarks?: string | null;
    beneficiaries: Beneficiary[];
    documents?: Document[];
}

interface User {
    id: number;
    name: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    liquidation: Liquidation | null;
    onDataChange?: (updatedLiquidation: Liquidation) => void;
    canSubmit?: boolean;
    canReview?: boolean;
    userRole?: string;
    regionalCoordinators?: User[];
    accountants?: User[];
}

export function ViewLiquidationModal({
    isOpen,
    onClose,
    liquidation,
    onDataChange,
    canSubmit = false,
    canReview = false,
    userRole = '',
    regionalCoordinators = [],
    accountants = []
}: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
    const [submitRemarks, setSubmitRemarks] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploadingDoc, setIsUploadingDoc] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isEndorseModalOpen, setIsEndorseModalOpen] = useState(false);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [reviewRemarks, setReviewRemarks] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // RC Endorse fields
    const [receiverName, setReceiverName] = useState('');
    const [documentLocation, setDocumentLocation] = useState('');
    const [transmittalRefNo, setTransmittalRefNo] = useState('');
    const [numberOfFolders, setNumberOfFolders] = useState('');
    const [folderLocationNumber, setFolderLocationNumber] = useState('');
    const [groupTransmittal, setGroupTransmittal] = useState('');

    // RC Return fields
    const [documentsForCompliance, setDocumentsForCompliance] = useState('');

    // Accountant modals
    const [isEndorseToCOAModalOpen, setIsEndorseToCOAModalOpen] = useState(false);
    const [isReturnToRCModalOpen, setIsReturnToRCModalOpen] = useState(false);
    const [accountantRemarks, setAccountantRemarks] = useState('');

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
        setIsLoadingData(true);
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
                setIsLoadingData(false);
                e.target.value = '';
            },
            onError: () => {
                setIsUploading(false);
                setIsLoadingData(false);
                e.target.value = '';
            },
        });
    };

    const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingDoc(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('document_type', 'Supporting Document');

        router.post(route('liquidation.upload-document', liquidation.id), formData, {
            onSuccess: async () => {
                // Reload the liquidation data to show updated documents
                try {
                    const response = await axios.get(route('liquidation.show', liquidation.id));
                    if (onDataChange) {
                        onDataChange(response.data);
                    }
                } catch (error) {
                    console.error('Error reloading liquidation:', error);
                }
                setIsUploadingDoc(false);
                e.target.value = '';
            },
            onError: () => {
                setIsUploadingDoc(false);
                e.target.value = '';
            },
        });
    };

    const handleDeleteDocument = (documentId: number) => {
        if (confirm('Are you sure you want to delete this document?')) {
            router.delete(route('liquidation.delete-document', documentId), {
                onSuccess: async () => {
                    try {
                        const response = await axios.get(route('liquidation.show', liquidation.id));
                        if (onDataChange) {
                            onDataChange(response.data);
                        }
                    } catch (error) {
                        console.error('Error reloading liquidation:', error);
                    }
                },
            });
        }
    };

    const handleSubmitForReview = () => {
        setIsSubmitting(true);
        router.post(route('liquidation.submit', liquidation.id), {
            remarks: submitRemarks,
        }, {
            onSuccess: () => {
                setIsSubmitting(false);
                setIsSubmitModalOpen(false);
                setSubmitRemarks('');
                onClose();
            },
            onError: () => {
                setIsSubmitting(false);
            },
        });
    };

    const handleEndorseToAccounting = () => {
        setIsProcessing(true);
        router.post(route('liquidation.endorse-to-accounting', liquidation.id), {
            review_remarks: reviewRemarks,
            receiver_name: receiverName,
            document_location: documentLocation,
            transmittal_reference_no: transmittalRefNo,
            number_of_folders: numberOfFolders ? parseInt(numberOfFolders) : null,
            folder_location_number: folderLocationNumber,
            group_transmittal: groupTransmittal,
        }, {
            onSuccess: () => {
                setIsProcessing(false);
                setIsEndorseModalOpen(false);
                setReviewRemarks('');
                setReceiverName('');
                setDocumentLocation('');
                setTransmittalRefNo('');
                setNumberOfFolders('');
                setFolderLocationNumber('');
                setGroupTransmittal('');
                onClose();
            },
            onError: () => {
                setIsProcessing(false);
            },
        });
    };

    const handleReturnToHEI = () => {
        setIsProcessing(true);
        router.post(route('liquidation.return-to-hei', liquidation.id), {
            review_remarks: reviewRemarks,
            documents_for_compliance: documentsForCompliance,
            receiver_name: receiverName,
        }, {
            onSuccess: () => {
                setIsProcessing(false);
                setIsReturnModalOpen(false);
                setReviewRemarks('');
                setDocumentsForCompliance('');
                setReceiverName('');
                onClose();
            },
            onError: () => {
                setIsProcessing(false);
            },
        });
    };

    const handleEndorseToCOA = () => {
        setIsProcessing(true);
        router.post(route('liquidation.endorse-to-coa', liquidation.id), {
            accountant_remarks: accountantRemarks,
        }, {
            onSuccess: () => {
                setIsProcessing(false);
                setIsEndorseToCOAModalOpen(false);
                setAccountantRemarks('');
                onClose();
            },
            onError: () => {
                setIsProcessing(false);
            },
        });
    };

    const handleReturnToRC = () => {
        setIsProcessing(true);
        router.post(route('liquidation.return-to-rc', liquidation.id), {
            accountant_remarks: accountantRemarks,
        }, {
            onSuccess: () => {
                setIsProcessing(false);
                setIsReturnToRCModalOpen(false);
                setAccountantRemarks('');
                onClose();
            },
            onError: () => {
                setIsProcessing(false);
            },
        });
    };

    return (
        <>
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[80vw] max-w-[1200px] max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="text-2xl">{liquidation.control_no}</DialogTitle>
                    <DialogDescription>
                        {liquidation.program_name} · AY {liquidation.academic_year}, {liquidation.semester}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 overflow-y-auto flex-1 px-1">
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

                    {/* RC Review Remarks - Show when returned to HEI */}
                    {liquidation.status === 'returned_to_hei' && (liquidation.review_remarks || liquidation.documents_for_compliance) && (
                        <Card className="border-destructive bg-destructive/5">
                            <CardHeader>
                                <CardTitle className="text-destructive flex items-center gap-2">
                                    <X className="h-5 w-5" />
                                    Returned for Compliance
                                </CardTitle>
                                <CardDescription>
                                    Please address the following issues and resubmit
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {liquidation.documents_for_compliance && (
                                    <div>
                                        <Label className="text-sm font-semibold">Documents Required for Compliance:</Label>
                                        <div className="mt-2 p-3 bg-background rounded-md border">
                                            <pre className="text-sm whitespace-pre-wrap font-sans">{liquidation.documents_for_compliance}</pre>
                                        </div>
                                    </div>
                                )}
                                {liquidation.review_remarks && (
                                    <div>
                                        <Label className="text-sm font-semibold">Review Remarks:</Label>
                                        <div className="mt-2 p-3 bg-background rounded-md border">
                                            <p className="text-sm">{liquidation.review_remarks}</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Accountant Review Remarks - Show when returned to RC */}
                    {liquidation.status === 'returned_to_rc' && liquidation.accountant_remarks && (
                        <Card className="border-destructive bg-destructive/5">
                            <CardHeader>
                                <CardTitle className="text-destructive flex items-center gap-2">
                                    <X className="h-5 w-5" />
                                    Returned by Accountant
                                </CardTitle>
                                <CardDescription>
                                    Please address the following issues before re-endorsing
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {liquidation.accountant_remarks && (
                                    <div>
                                        <Label className="text-sm font-semibold">Accountant Remarks:</Label>
                                        <div className="mt-2 p-3 bg-background rounded-md border">
                                            <p className="text-sm">{liquidation.accountant_remarks}</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

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
                                    {canSubmit && ['draft', 'returned_to_hei'].includes(liquidation.status) && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => document.getElementById('csv-upload')?.click()}
                                            disabled={isUploading}
                                        >
                                            <Upload className="h-4 w-4 mr-2" />
                                            {isUploading ? 'Uploading...' : 'Upload CSV'}
                                        </Button>
                                    )}
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
                                        {isLoadingData ? (
                                            // Show skeleton loader when uploading
                                            Array.from({ length: 5 }).map((_, index) => (
                                                <TableRow key={`skeleton-${index}`}>
                                                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                                                </TableRow>
                                            ))
                                        ) : filteredBeneficiaries.length === 0 ? (
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

                    {/* Documents Section */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">Supporting Documents</CardTitle>
                                    <CardDescription className="text-xs">Upload liquidation reports and supporting files</CardDescription>
                                </div>
                                {canSubmit && ['draft', 'returned_to_hei'].includes(liquidation.status) && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => document.getElementById('document-upload')?.click()}
                                        disabled={isUploadingDoc}
                                    >
                                        <Upload className="h-4 w-4 mr-2" />
                                        {isUploadingDoc ? 'Uploading...' : 'Upload'}
                                    </Button>
                                )}
                                <input
                                    id="document-upload"
                                    type="file"
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                                    className="hidden"
                                    onChange={handleUploadDocument}
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {liquidation.documents && liquidation.documents.length > 0 ? (
                                <div className="space-y-1.5">
                                    {liquidation.documents.map((doc) => (
                                        <div key={doc.id} className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50 transition-colors">
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(doc.uploaded_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    onClick={() => window.open(route('liquidation.download-document', doc.id), '_blank')}
                                                >
                                                    <Download className="h-3.5 w-3.5" />
                                                </Button>
                                                {canSubmit && ['draft', 'returned_to_hei'].includes(liquidation.status) && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                        onClick={() => handleDeleteDocument(doc.id)}
                                                    >
                                                        <X className="h-3.5 w-3.5 text-destructive" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-muted-foreground">
                                    <File className="h-6 w-6 mx-auto mb-1.5 opacity-50" />
                                    <p className="text-sm">No documents uploaded yet</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>


                    {/* RC Review History Section */}
                    {liquidation.review_history && liquidation.review_history.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">RC Review History</CardTitle>
                                <CardDescription className="text-xs">
                                    History of Regional Coordinator returns and compliance requirements
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <Accordion type="single" collapsible className="w-full">
                                    {[...liquidation.review_history].reverse().map((entry, displayIndex) => {
                                        const returnNumber = displayIndex + 1;
                                        return (
                                            <AccordionItem key={displayIndex} value={`rc-item-${displayIndex}`}>
                                                <AccordionTrigger className="hover:no-underline">
                                                    <div className="flex items-center justify-between w-full pr-2">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className="text-xs">
                                                                Return #{returnNumber}
                                                            </Badge>
                                                            <span className="text-xs text-muted-foreground">
                                                                by {entry.returned_by}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Date(entry.returned_at).toLocaleString('en-US', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="space-y-3 pt-2">
                                                        {entry.documents_for_compliance && (
                                                            <div>
                                                                <Label className="text-xs font-semibold">Documents Required:</Label>
                                                                <div className="mt-1 p-2 bg-muted/50 rounded text-xs">
                                                                    <pre className="whitespace-pre-wrap font-sans">{entry.documents_for_compliance}</pre>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {entry.review_remarks && (
                                                            <div>
                                                                <Label className="text-xs font-semibold">Remarks:</Label>
                                                                <div className="mt-1 p-2 bg-muted/50 rounded text-xs">
                                                                    <p>{entry.review_remarks}</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        );
                                    })}
                                </Accordion>
                            </CardContent>
                        </Card>
                    )}

                    {/* Accountant Review History Section */}
                    {liquidation.accountant_review_history && liquidation.accountant_review_history.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Accountant Review History</CardTitle>
                                <CardDescription className="text-xs">
                                    History of Accountant returns to Regional Coordinator
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <Accordion type="single" collapsible className="w-full">
                                    {[...liquidation.accountant_review_history].reverse().map((entry, displayIndex) => {
                                        const returnNumber = displayIndex + 1;
                                        return (
                                            <AccordionItem key={displayIndex} value={`acc-item-${displayIndex}`}>
                                                <AccordionTrigger className="hover:no-underline">
                                                    <div className="flex items-center justify-between w-full pr-2">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className="text-xs">
                                                                Return #{returnNumber}
                                                            </Badge>
                                                            <span className="text-xs text-muted-foreground">
                                                                by {entry.returned_by}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Date(entry.returned_at).toLocaleString('en-US', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="space-y-3 pt-2">
                                                        {entry.accountant_remarks && (
                                                            <div>
                                                                <Label className="text-xs font-semibold">Remarks:</Label>
                                                                <div className="mt-1 p-2 bg-muted/50 rounded text-xs">
                                                                    <p>{entry.accountant_remarks}</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        );
                                    })}
                                </Accordion>
                            </CardContent>
                        </Card>
                    )}

                </div>

                {/* Sticky Footer */}
                {(
                    (canSubmit && ['draft', 'returned_to_hei'].includes(liquidation.status)) ||
                    (canReview && userRole === 'Regional Coordinator' && ['for_initial_review', 'returned_to_rc'].includes(liquidation.status)) ||
                    (canReview && userRole === 'Accountant' && liquidation.status === 'endorsed_to_accounting')
                ) && (
                    <div className="flex-shrink-0 border-t bg-background pt-4 pb-2 px-1">
                        {/* Submit Button */}
                        {canSubmit && liquidation.status === 'draft' && (
                            <div className="flex justify-end gap-2">
                                <Button
                                    onClick={() => setIsSubmitModalOpen(true)}
                                    disabled={liquidation.beneficiaries.length === 0}
                                >
                                    <Send className="h-4 w-4 mr-2" />
                                    Submit for Review
                                </Button>
                            </div>
                        )}

                        {/* Resubmit to RC Button - After addressing compliance issues */}
                        {canSubmit && liquidation.status === 'returned_to_hei' && (
                            <div className="flex justify-end gap-2">
                                <Button
                                    onClick={() => setIsSubmitModalOpen(true)}
                                    disabled={liquidation.beneficiaries.length === 0}
                                >
                                    <Send className="h-4 w-4 mr-2" />
                                    Resubmit to RC
                                </Button>
                            </div>
                        )}

                        {/* Regional Coordinator Actions */}
                        {canReview && userRole === 'Regional Coordinator' && ['for_initial_review', 'returned_to_rc'].includes(liquidation.status) && (
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setReviewRemarks('');
                                        setIsReturnModalOpen(true);
                                    }}
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Return to HEI
                                </Button>
                                <Button
                                    onClick={() => {
                                        setReviewRemarks('');
                                        setIsEndorseModalOpen(true);
                                    }}
                                >
                                    <Send className="h-4 w-4 mr-2" />
                                    Endorse to Accounting
                                </Button>
                            </div>
                        )}

                        {/* Accountant Actions */}
                        {canReview && userRole === 'Accountant' && liquidation.status === 'endorsed_to_accounting' && (
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setAccountantRemarks('');
                                        setIsReturnToRCModalOpen(true);
                                    }}
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Return to RC
                                </Button>
                                <Button
                                    onClick={() => {
                                        setAccountantRemarks('');
                                        setIsEndorseToCOAModalOpen(true);
                                    }}
                                >
                                    <Send className="h-4 w-4 mr-2" />
                                    Endorse to COA
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>

        {/* Submit Confirmation Modal */}
        <Dialog open={isSubmitModalOpen} onOpenChange={setIsSubmitModalOpen}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {liquidation && liquidation.status === 'returned_to_hei' ? 'Resubmit to Regional Coordinator' : 'Submit for Initial Review'}
                    </DialogTitle>
                    <DialogDescription>
                        {liquidation && liquidation.status === 'returned_to_hei'
                            ? 'Confirm that you have addressed all compliance requirements before resubmitting to the Regional Coordinator.'
                            : 'Are you sure you want to submit this liquidation report to the Regional Coordinator for initial review?'}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="remarks">Remarks (Optional)</Label>
                        <Textarea
                            id="remarks"
                            placeholder={liquidation && liquidation.status === 'returned_to_hei'
                                ? 'Describe what corrections/updates you made...'
                                : 'Add any additional notes or comments...'}
                            value={submitRemarks}
                            onChange={(e) => setSubmitRemarks(e.target.value)}
                            rows={4}
                            className="max-h-[200px] resize-none"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setIsSubmitModalOpen(false);
                            setSubmitRemarks('');
                        }}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmitForReview}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Submitting...' : (liquidation && liquidation.status === 'returned_to_hei' ? 'Resubmit to RC' : 'Submit for Review')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Endorse to Accounting Modal */}
        <Dialog open={isEndorseModalOpen} onOpenChange={setIsEndorseModalOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Endorse to Accounting</DialogTitle>
                    <DialogDescription>
                        Complete the endorsement details to forward this liquidation to the Accounting department
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {/* Document Tracking */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="receiver">Receiver (Accountant)</Label>
                            <Select value={receiverName} onValueChange={setReceiverName}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select accountant" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accountants.map((accountant) => (
                                        <SelectItem key={accountant.id} value={accountant.name}>
                                            {accountant.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="doc-location">Document Location</Label>
                            <Select value={documentLocation} onValueChange={setDocumentLocation}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select location" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Shelf 1B R1">Shelf 1B R1</SelectItem>
                                    <SelectItem value="Shelf 1B R2">Shelf 1B R2</SelectItem>
                                    <SelectItem value="Shelf 1B R3">Shelf 1B R3</SelectItem>
                                    <SelectItem value="Shelf 1B R4">Shelf 1B R4</SelectItem>
                                    <SelectItem value="Shelf 1B R5">Shelf 1B R5</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Transmittal Information */}
                    <div className="space-y-2">
                        <Label htmlFor="transmittal-ref">Transmittal Reference Number *</Label>
                        <Input
                            id="transmittal-ref"
                            placeholder="e.g., TES-2026-01210"
                            value={transmittalRefNo}
                            onChange={(e) => setTransmittalRefNo(e.target.value)}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="num-folders">Number of Folders</Label>
                            <Input
                                id="num-folders"
                                type="number"
                                placeholder="e.g., 2"
                                value={numberOfFolders}
                                onChange={(e) => setNumberOfFolders(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="folder-location">Folder Location Number</Label>
                            <Input
                                id="folder-location"
                                placeholder="e.g., 2/UniFAST R12-CMFCI"
                                value={folderLocationNumber}
                                onChange={(e) => setFolderLocationNumber(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="group-transmittal">Group Transmittal</Label>
                        <Input
                            id="group-transmittal"
                            placeholder="e.g., Transmittal No. 2026-0001"
                            value={groupTransmittal}
                            onChange={(e) => setGroupTransmittal(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="endorse-remarks">Review Remarks (Optional)</Label>
                        <Textarea
                            id="endorse-remarks"
                            placeholder="Add any review comments or recommendations..."
                            value={reviewRemarks}
                            onChange={(e) => setReviewRemarks(e.target.value)}
                            rows={3}
                            className="max-h-[200px] resize-none"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setIsEndorseModalOpen(false);
                            setReviewRemarks('');
                            setReceiverName('');
                            setDocumentLocation('');
                            setTransmittalRefNo('');
                            setNumberOfFolders('');
                            setFolderLocationNumber('');
                            setGroupTransmittal('');
                        }}
                        disabled={isProcessing}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleEndorseToAccounting}
                        disabled={isProcessing || !transmittalRefNo.trim()}
                    >
                        {isProcessing ? 'Endorsing...' : 'Endorse to Accounting'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Return to HEI Modal */}
        <Dialog open={isReturnModalOpen} onOpenChange={setIsReturnModalOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Return to HEI for Compliance</DialogTitle>
                    <DialogDescription>
                        Specify the compliance issues and documents needed from the HEI
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {/* Receiver Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="return-receiver">Receiver (Regional Coordinator)</Label>
                        <Select value={receiverName} onValueChange={setReceiverName}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Regional Coordinator" />
                            </SelectTrigger>
                            <SelectContent>
                                {regionalCoordinators.map((rc) => (
                                    <SelectItem key={rc.id} value={rc.name}>
                                        {rc.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="compliance-docs">Documents for Compliance *</Label>
                        <Textarea
                            id="compliance-docs"
                            placeholder="List the missing or required documents (e.g., - Revised FUR&#10;- Updated beneficiary list&#10;- Supporting receipts)"
                            value={documentsForCompliance}
                            onChange={(e) => setDocumentsForCompliance(e.target.value)}
                            rows={5}
                            required
                            className="max-h-[200px] resize-none"
                        />
                        <p className="text-xs text-muted-foreground">
                            Provide a checklist of specific documents that need to be submitted
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="return-remarks">Additional Remarks *</Label>
                        <Textarea
                            id="return-remarks"
                            placeholder="Specify the reason for returning (e.g., missing documents, incorrect data)..."
                            value={reviewRemarks}
                            onChange={(e) => setReviewRemarks(e.target.value)}
                            rows={3}
                            required
                            className="max-h-[200px] resize-none"
                        />
                        <p className="text-xs text-muted-foreground">
                            Please provide a clear reason for returning the liquidation
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setIsReturnModalOpen(false);
                            setReviewRemarks('');
                            setDocumentsForCompliance('');
                            setReceiverName('');
                        }}
                        disabled={isProcessing}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleReturnToHEI}
                        disabled={isProcessing || !reviewRemarks.trim() || !documentsForCompliance.trim()}
                    >
                        {isProcessing ? 'Returning...' : 'Return to HEI'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Accountant: Endorse to COA Modal */}
        <Dialog open={isEndorseToCOAModalOpen} onOpenChange={setIsEndorseToCOAModalOpen}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Endorse to COA</DialogTitle>
                    <DialogDescription>
                        Forward this liquidation to the Commission on Audit (COA)
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="coa-remarks">Accountant Remarks (Optional)</Label>
                        <Textarea
                            id="coa-remarks"
                            placeholder="Add any review comments or recommendations..."
                            value={accountantRemarks}
                            onChange={(e) => setAccountantRemarks(e.target.value)}
                            rows={4}
                            className="max-h-[200px] resize-none"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setIsEndorseToCOAModalOpen(false);
                            setAccountantRemarks('');
                        }}
                        disabled={isProcessing}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleEndorseToCOA}
                        disabled={isProcessing}
                    >
                        {isProcessing ? 'Endorsing...' : 'Endorse to COA'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Accountant: Return to RC Modal */}
        <Dialog open={isReturnToRCModalOpen} onOpenChange={setIsReturnToRCModalOpen}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Return to Regional Coordinator</DialogTitle>
                    <DialogDescription>
                        Return this liquidation to the Regional Coordinator for corrections
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="rc-remarks">Accountant Remarks *</Label>
                        <Textarea
                            id="rc-remarks"
                            placeholder="Specify the reason for returning (e.g., missing documents, incorrect calculations)..."
                            value={accountantRemarks}
                            onChange={(e) => setAccountantRemarks(e.target.value)}
                            rows={4}
                            required
                            className="max-h-[200px] resize-none"
                        />
                        <p className="text-xs text-muted-foreground">
                            Please provide a clear reason for returning to the RC
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setIsReturnToRCModalOpen(false);
                            setAccountantRemarks('');
                        }}
                        disabled={isProcessing}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleReturnToRC}
                        disabled={isProcessing || !accountantRemarks.trim()}
                    >
                        {isProcessing ? 'Returning...' : 'Return to RC'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
    );
}
