import React, { useState, useDeferredValue, useCallback } from 'react';
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
import { Download, Upload, Search, FileText, Send, File, X, Loader2, BarChart3, Pencil, Link2, ExternalLink, MessageSquare, ClipboardList, MapPin, FolderArchive, User, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
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
import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from '@/components/ui/tabs';
import { Stepper } from '@/components/ui/stepper';
import {
    EndorseToAccountingModal,
    ReturnToHEIModal,
    SubmitForReviewModal,
    EndorseToCOAModal,
    ReturnToRCModal,
    EditLiquidationModal,
} from './endorsement-modals';

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
    is_gdrive?: boolean;
    gdrive_link?: string;
}

interface ReviewHistoryEntry {
    returned_at?: string;
    returned_by?: string;
    returned_by_id?: number;
    review_remarks?: string;
    documents_for_compliance?: string | null;
    // HEI Resubmission fields
    resubmitted_at?: string;
    resubmitted_by?: string;
    resubmitted_by_id?: number;
    hei_remarks?: string;
    type?: string;
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
    remarks?: string | null;
    review_remarks?: string | null;
    documents_for_compliance?: string | null;
    compliance_status?: string | null;
    review_history?: ReviewHistoryEntry[];
    accountant_review_history?: AccountantReviewHistoryEntry[];
    accountant_remarks?: string | null;
    beneficiaries: Beneficiary[];
    documents?: Document[];
    // Endorsement details (from RC to Accounting)
    receiver_name?: string | null;
    document_location?: string | null;
    transmittal_reference_no?: string | null;
    number_of_folders?: number | null;
    folder_location_number?: string | null;
    group_transmittal?: string | null;
    reviewed_by_name?: string | null;
    reviewed_at?: string | null;
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
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploadingDoc, setIsUploadingDoc] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isEndorseModalOpen, setIsEndorseModalOpen] = useState(false);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Accountant modals
    const [isEndorseToCOAModalOpen, setIsEndorseToCOAModalOpen] = useState(false);
    const [isReturnToRCModalOpen, setIsReturnToRCModalOpen] = useState(false);

    // Edit modal state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // Google Drive link state
    const [showGdriveInput, setShowGdriveInput] = useState(false);
    const [gdriveLink, setGdriveLink] = useState('');
    const [isAddingGdriveLink, setIsAddingGdriveLink] = useState(false);

    // Open edit modal handler
    const handleOpenEditModal = () => setIsEditModalOpen(true);

    // Callback handlers - must be before early return for React Rules of Hooks
    const handleSubmitForReview = useCallback((remarks: string) => {
        if (!liquidation) return;
        setIsSubmitting(true);
        router.post(route('liquidation.submit', liquidation.id), {
            remarks: remarks,
        }, {
            onSuccess: () => {
                setIsSubmitting(false);
                setIsSubmitModalOpen(false);
                onClose();
            },
            onError: () => {
                setIsSubmitting(false);
            },
        });
    }, [liquidation, onClose]);

    const handleEndorseToAccounting = useCallback((data: {
        reviewRemarks: string;
        receiverName: string;
        documentLocation: string;
        transmittalRefNo: string;
        numberOfFolders: string;
        folderLocationNumber: string;
        groupTransmittal: string;
    }) => {
        if (!liquidation) return;
        setIsProcessing(true);
        router.post(route('liquidation.endorse-to-accounting', liquidation.id), {
            review_remarks: data.reviewRemarks,
            receiver_name: data.receiverName,
            document_location: data.documentLocation,
            transmittal_reference_no: data.transmittalRefNo,
            number_of_folders: data.numberOfFolders ? parseInt(data.numberOfFolders) : null,
            folder_location_number: data.folderLocationNumber,
            group_transmittal: data.groupTransmittal,
        }, {
            onSuccess: () => {
                setIsProcessing(false);
                setIsEndorseModalOpen(false);
                onClose();
            },
            onError: () => {
                setIsProcessing(false);
            },
        });
    }, [liquidation, onClose]);

    const handleReturnToHEI = useCallback((data: {
        reviewRemarks: string;
        documentsForCompliance: string;
        receiverName: string;
    }) => {
        if (!liquidation) return;
        setIsProcessing(true);
        router.post(route('liquidation.return-to-hei', liquidation.id), {
            review_remarks: data.reviewRemarks,
            documents_for_compliance: data.documentsForCompliance,
            receiver_name: data.receiverName,
        }, {
            onSuccess: () => {
                setIsProcessing(false);
                setIsReturnModalOpen(false);
                onClose();
            },
            onError: () => {
                setIsProcessing(false);
            },
        });
    }, [liquidation, onClose]);

    const handleEndorseToCOA = useCallback((remarks: string) => {
        if (!liquidation) return;
        setIsProcessing(true);
        router.post(route('liquidation.endorse-to-coa', liquidation.id), {
            accountant_remarks: remarks,
        }, {
            onSuccess: () => {
                setIsProcessing(false);
                setIsEndorseToCOAModalOpen(false);
                onClose();
            },
            onError: () => {
                setIsProcessing(false);
            },
        });
    }, [liquidation, onClose]);

    const handleReturnToRC = useCallback((remarks: string) => {
        if (!liquidation) return;
        setIsProcessing(true);
        router.post(route('liquidation.return-to-rc', liquidation.id), {
            accountant_remarks: remarks,
        }, {
            onSuccess: () => {
                setIsProcessing(false);
                setIsReturnToRCModalOpen(false);
                onClose();
            },
            onError: () => {
                setIsProcessing(false);
            },
        });
    }, [liquidation, onClose]);

    const handleUpdateLiquidation = useCallback((amountReceived: string) => {
        if (!liquidation) return;
        setIsUpdating(true);
        router.put(route('liquidation.update', liquidation.id), {
            amount_received: parseFloat(amountReceived),
        }, {
            onSuccess: async () => {
                try {
                    const response = await axios.get(route('liquidation.show', liquidation.id));
                    if (onDataChange) {
                        onDataChange(response.data);
                    }
                } catch (error) {
                    console.error('Error reloading liquidation:', error);
                }
                setIsUpdating(false);
                setIsEditModalOpen(false);
            },
            onError: () => {
                setIsUpdating(false);
            },
        });
    }, [liquidation, onDataChange]);

    // Helper function to get user initials
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
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

    if (!liquidation) return null;

    // Define workflow steps
    const workflowSteps = [
        { label: 'HEI Submission', description: 'Draft & Submit' },
        { label: 'RC Review', description: 'Regional Coordinator' },
        { label: 'Accounting Review', description: 'Financial Verification' },
        { label: 'COA Endorsement', description: 'Final Approval' },
    ];

    // Map status to current step
    const getCurrentStep = (status: string): number => {
        switch (status) {
            case 'draft':
            case 'returned_to_hei':
                return 1; // HEI Submission
            case 'for_initial_review':
            case 'returned_to_rc':
                return 2; // RC Review
            case 'endorsed_to_accounting':
                return 3; // Accounting Review
            case 'endorsed_to_coa':
                return 4; // COA Endorsement
            default:
                return 1;
        }
    };

    const currentStep = getCurrentStep(liquidation.status);
    const isFullyCompleted = liquidation.status === 'endorsed_to_coa';

    const filteredBeneficiaries = liquidation.beneficiaries.filter(beneficiary =>
        beneficiary.student_no.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
        beneficiary.first_name.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
        beneficiary.last_name.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
        beneficiary.award_no.toLowerCase().includes(deferredSearchQuery.toLowerCase())
    );

    // Calculate % Age of Liquidation: (total_disbursed / amount_received) * 100
    const percentLiquidated = liquidation.amount_received > 0
        ? (liquidation.total_disbursed / liquidation.amount_received) * 100
        : 0;

    const handleDownloadTemplate = () => {
        window.location.href = route('liquidation.download-beneficiary-template', liquidation.id);
    };

    const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
            toast.error('Please upload an Excel file (.xlsx or .xls)');
            e.target.value = '';
            return;
        }

        setIsUploading(true);
        setIsLoadingData(true);
        const formData = new FormData();
        formData.append('beneficiary_file', file);

        router.post(route('liquidation.import-beneficiaries', liquidation.id), formData, {
            onSuccess: async () => {
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
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // Get current PDF document count (exclude gdrive links)
        const currentPdfCount = liquidation.documents?.filter(doc => !doc.is_gdrive).length || 0;
        const filesToUpload = Array.from(files);

        // Validation: Check file limit (max 3 PDFs)
        if (currentPdfCount + filesToUpload.length > 3) {
            toast.error(`Maximum of 3 PDF files allowed. You currently have ${currentPdfCount} file(s).`);
            e.target.value = '';
            return;
        }

        // Validation: Check each file
        for (const file of filesToUpload) {
            // Check file type (PDF only)
            if (file.type !== 'application/pdf') {
                toast.error(`"${file.name}" is not a PDF file. Only PDF files are allowed.`);
                e.target.value = '';
                return;
            }

            // Check file size (max 20MB)
            const maxSize = 20 * 1024 * 1024; // 20MB in bytes
            if (file.size > maxSize) {
                toast.error(`"${file.name}" exceeds the 20MB size limit.`);
                e.target.value = '';
                return;
            }
        }

        setIsUploadingDoc(true);

        let successCount = 0;
        let errorCount = 0;

        // Upload files sequentially using axios
        for (const file of filesToUpload) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('document_type', 'Supporting Document');

                await axios.post(route('liquidation.upload-document', liquidation.id), formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                successCount++;
            } catch (error: any) {
                errorCount++;
                const errorMessage = error.response?.data?.message || `Failed to upload "${file.name}"`;
                toast.error(errorMessage);
            }
        }

        // Reload liquidation data after all uploads complete
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

        // Show success message
        if (successCount > 0) {
            toast.success(`${successCount} document(s) uploaded successfully.`);
        }
    };

    const handleAddGdriveLink = async () => {
        if (!gdriveLink.trim()) {
            toast.error('Please enter a Google Drive link.');
            return;
        }

        // Validate Google Drive link format
        const gdrivePattern = /^https:\/\/(drive\.google\.com|docs\.google\.com)/i;
        if (!gdrivePattern.test(gdriveLink)) {
            toast.error('Please enter a valid Google Drive link.');
            return;
        }

        setIsAddingGdriveLink(true);

        try {
            await axios.post(route('liquidation.store-gdrive-link', liquidation.id), {
                gdrive_link: gdriveLink,
                document_type: 'Supporting Document (Google Drive)',
            });

            // Reload liquidation data
            const response = await axios.get(route('liquidation.show', liquidation.id));
            if (onDataChange) {
                onDataChange(response.data);
            }

            toast.success('Google Drive link added successfully.');
            setGdriveLink('');
            setShowGdriveInput(false);
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'Failed to add Google Drive link.';
            toast.error(errorMessage);
        } finally {
            setIsAddingGdriveLink(false);
        }
    };

    const handleDeleteDocument = (documentId: number) => {
        router.delete(route('liquidation.delete-document', documentId), {
            onSuccess: async () => {
                try {
                    const response = await axios.get(route('liquidation.show', liquidation.id));
                    if (onDataChange) {
                        onDataChange(response.data);
                    }
                    toast.success('Document deleted successfully.');
                } catch (error) {
                    console.error('Error reloading liquidation:', error);
                }
            },
            onError: () => {
                toast.error('Failed to delete document.');
            },
        });
    };

    // Check if HEI can edit (only in draft or returned_to_hei status)
    const canEdit = canSubmit && ['draft', 'returned_to_hei'].includes(liquidation.status);

    return (
        <>
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[80vw] max-w-[1200px] max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-2xl">{liquidation.control_no}</DialogTitle>
                        {canEdit && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleOpenEditModal}
                                className="me-5"
                            >
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <Badge className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-sm font-semibold border-0 shadow-sm">
                            {liquidation.program_name}
                        </Badge>
                        <span className="text-muted-foreground">·</span>
                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-900 px-3 py-1 text-sm font-medium">
                            AY {liquidation.academic_year}
                        </Badge>
                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-900 px-3 py-1 text-sm font-medium">
                            {liquidation.semester}
                        </Badge>
                        <span className="text-muted-foreground">·</span>
                        <Badge className={`${getStatusColor(liquidation.status)} shadow-none border px-3 py-1 text-sm font-medium`}>
                            {liquidation.status_label}
                        </Badge>
                    </div>
                </DialogHeader>

                {/* Workflow Stepper */}
                <div className={`flex-shrink-0 px-6 py-4 border-y ${isFullyCompleted ? 'bg-green-50/50 dark:bg-green-950/10' : 'bg-muted/20'}`}>
                    <Stepper steps={workflowSteps} currentStep={currentStep} isFullyCompleted={isFullyCompleted} />
                </div>

                <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
                    <TabsList variant="line" className="flex-shrink-0">
                        <TabsTrigger value="overview">Overview & Files</TabsTrigger>
                        {['endorsed_to_accounting', 'endorsed_to_coa'].includes(liquidation.status) && liquidation.transmittal_reference_no && (
                            <TabsTrigger value="endorsement">Endorsement</TabsTrigger>
                        )}
                        <TabsTrigger value="history">History</TabsTrigger>
                        <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    </TabsList>

                    {/* Overview & Files Tab */}
                    <TabsContent value="overview" className="flex-1 overflow-y-auto mt-4 space-y-4 px-1">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardDescription className="text-xs">Amount Received</CardDescription>
                                    <CardTitle className="text-2xl">₱{Number(liquidation.amount_received).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</CardTitle>
                                </CardHeader>
                            </Card>

                            <Card>
                                <CardHeader className="pb-3">
                                    <CardDescription className="text-xs">Disbursed to Students</CardDescription>
                                    <CardTitle className="text-2xl text-blue-600">₱{Number(liquidation.total_disbursed).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</CardTitle>
                                </CardHeader>
                            </Card>

                            <Card>
                                <CardHeader className="pb-3">
                                    <CardDescription className="text-xs">Remaining / Unliquidated</CardDescription>
                                    <CardTitle className="text-2xl text-orange-600">₱{Number(liquidation.remaining_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</CardTitle>
                                </CardHeader>
                            </Card>

                            <Card>
                                <CardHeader className="pb-3">
                                    <CardDescription className="text-xs">% Age of Liquidation</CardDescription>
                                    <CardTitle className="text-2xl text-green-600">{percentLiquidated.toFixed(2)}%</CardTitle>
                                </CardHeader>
                            </Card>
                        </div>

                        {/* HEI Latest Remarks */}
                        {(() => {
                            const heiResubmissions = liquidation.review_history?.filter(entry => entry.type === 'hei_resubmission') || [];
                            const latestResubmission = heiResubmissions.length > 0 ? heiResubmissions[heiResubmissions.length - 1] : null;
                            const latestRemarks = latestResubmission?.hei_remarks || liquidation.remarks;
                            const isResubmission = !!latestResubmission;

                            return latestRemarks ? (
                                <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
                                    <CardHeader>
                                        <CardTitle className="text-base">
                                            {isResubmission ? 'HEI Latest Remarks' : 'HEI Initial Remarks'}
                                        </CardTitle>
                                        <CardDescription>
                                            {isResubmission
                                                ? `Latest remarks from resubmission on ${new Date(latestResubmission.resubmitted_at!).toLocaleDateString()}`
                                                : 'Notes provided by the HEI on initial submission'
                                            }
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="p-3 bg-background rounded-md border">
                                            <p className="text-sm">{latestRemarks}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : null;
                        })()}

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
                                                onClick={() => document.getElementById('excel-upload')?.click()}
                                                disabled={isUploading}
                                            >
                                                <Upload className="h-4 w-4 mr-2" />
                                                {isUploading ? 'Uploading...' : 'Upload Excel'}
                                            </Button>
                                        )}
                                        <input
                                            id="excel-upload"
                                            type="file"
                                            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                                            className="hidden"
                                            onChange={handleUploadExcel}
                                        />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
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

                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Student No.</TableHead>
                                                <TableHead>Full Name</TableHead>
                                                <TableHead>Award No.</TableHead>
                                                <TableHead>Date Disbursed</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                                <TableHead className="text-center w-[80px]">Remarks</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isLoadingData ? (
                                                Array.from({ length: 5 }).map((_, index) => (
                                                    <TableRow key={`skeleton-${index}`}>
                                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                                                    </TableRow>
                                                ))
                                            ) : filteredBeneficiaries.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                                                        <TableCell className="text-center">
                                                            {beneficiary.remarks ? (
                                                                <Popover>
                                                                    <PopoverTrigger asChild>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-8 w-8 p-0"
                                                                        >
                                                                            <MessageSquare className="h-4 w-4 text-blue-500" />
                                                                        </Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-80" align="end">
                                                                        <div className="space-y-2">
                                                                            <h4 className="font-medium text-sm">Remarks</h4>
                                                                            <p className="text-sm text-muted-foreground">
                                                                                {beneficiary.remarks}
                                                                            </p>
                                                                        </div>
                                                                    </PopoverContent>
                                                                </Popover>
                                                            ) : (
                                                                <span className="text-muted-foreground text-xs">—</span>
                                                            )}
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
                                        <CardDescription className="text-xs">
                                            PDF only, max 20MB each, up to 3 files. Or add a Google Drive link.
                                        </CardDescription>
                                    </div>
                                    {canSubmit && ['draft', 'returned_to_hei'].includes(liquidation.status) && (
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setShowGdriveInput(!showGdriveInput)}
                                                disabled={isAddingGdriveLink}
                                            >
                                                <Link2 className="h-4 w-4 mr-2" />
                                                Google Drive
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => document.getElementById('document-upload')?.click()}
                                                disabled={isUploadingDoc || (liquidation.documents?.filter(d => !d.is_gdrive).length || 0) >= 3}
                                            >
                                                <Upload className="h-4 w-4 mr-2" />
                                                {isUploadingDoc ? 'Uploading...' : 'Upload PDF'}
                                            </Button>
                                        </div>
                                    )}
                                    <input
                                        id="document-upload"
                                        type="file"
                                        accept=".pdf,application/pdf"
                                        className="hidden"
                                        multiple
                                        onChange={handleUploadDocument}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                {/* Google Drive Link Input */}
                                {showGdriveInput && canSubmit && ['draft', 'returned_to_hei'].includes(liquidation.status) && (
                                    <div className="mb-4 p-3 border rounded-md bg-muted/30">
                                        <Label className="text-sm font-medium mb-2 block">Google Drive Link</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="url"
                                                placeholder="https://drive.google.com/..."
                                                value={gdriveLink}
                                                onChange={(e) => setGdriveLink(e.target.value)}
                                                className="flex-1"
                                            />
                                            <Button
                                                size="sm"
                                                onClick={handleAddGdriveLink}
                                                disabled={isAddingGdriveLink || !gdriveLink.trim()}
                                            >
                                                {isAddingGdriveLink ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    'Add'
                                                )}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => {
                                                    setShowGdriveInput(false);
                                                    setGdriveLink('');
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Enter a valid Google Drive or Google Docs link
                                        </p>
                                    </div>
                                )}

                                {/* File Count Indicator */}
                                {liquidation.documents && liquidation.documents.length > 0 && (
                                    <div className="mb-3 text-xs text-muted-foreground">
                                        PDF files: {liquidation.documents.filter(d => !d.is_gdrive).length}/3
                                        {liquidation.documents.filter(d => d.is_gdrive).length > 0 && (
                                            <span> | Google Drive links: {liquidation.documents.filter(d => d.is_gdrive).length}</span>
                                        )}
                                    </div>
                                )}

                                {liquidation.documents && liquidation.documents.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {liquidation.documents.map((doc) => (
                                            <div key={doc.id} className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50 transition-colors">
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                    {doc.is_gdrive ? (
                                                        <Link2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                                    ) : (
                                                        <File className="h-4 w-4 text-red-500 flex-shrink-0" />
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium truncate">
                                                            {doc.is_gdrive ? 'Google Drive Link' : doc.file_name}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {doc.is_gdrive ? (
                                                                <span className="text-blue-500 truncate block max-w-[200px]">{doc.gdrive_link}</span>
                                                            ) : (
                                                                new Date(doc.uploaded_at).toLocaleDateString()
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {doc.is_gdrive ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            onClick={() => window.open(doc.gdrive_link, '_blank')}
                                                        >
                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            onClick={() => window.open(route('liquidation.download-document', doc.id), '_blank')}
                                                        >
                                                            <Download className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
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
                    </TabsContent>

                    {/* History Tab */}
                    <TabsContent value="history" className="flex-1 overflow-y-auto mt-4 space-y-4 px-1">
                        {/* RC Review History Section */}
                        {liquidation.review_history && liquidation.review_history.length > 0 && (() => {
                            const heiResubmissions = liquidation.review_history.filter(entry => entry.type === 'hei_resubmission');
                            const latestResubmissionIndex = heiResubmissions.length > 0
                                ? liquidation.review_history.lastIndexOf(heiResubmissions[heiResubmissions.length - 1])
                                : -1;

                            const historyEntries = liquidation.review_history.filter((_, index) => index !== latestResubmissionIndex);

                            return historyEntries.length > 0 ? (
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Review & Resubmission History</CardTitle>
                                    <CardDescription className="text-xs">
                                        Past history of RC returns and HEI resubmissions
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <Accordion type="single" collapsible className="w-full">
                                        {[...historyEntries].reverse().map((entry, displayIndex) => {
                                            const isHEIResubmission = entry.type === 'hei_resubmission';
                                            const entryNumber = historyEntries.length - displayIndex;

                                            return (
                                                <AccordionItem key={displayIndex} value={`review-item-${displayIndex}`}>
                                                    <AccordionTrigger className="hover:no-underline">
                                                        <div className="flex items-center justify-between w-full pr-2">
                                                            <div className="flex items-center gap-2">
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Avatar className="h-6 w-6">
                                                                                <AvatarFallback className={`text-xs ${isHEIResubmission ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                                    {getInitials(isHEIResubmission ? entry.resubmitted_by! : entry.returned_by!)}
                                                                                </AvatarFallback>
                                                                            </Avatar>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>{isHEIResubmission ? entry.resubmitted_by : entry.returned_by}</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                                <Badge
                                                                    variant={isHEIResubmission ? "secondary" : "outline"}
                                                                    className={`text-xs ${isHEIResubmission ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' : ''}`}
                                                                >
                                                                    {isHEIResubmission ? `HEI Resubmission #${entryNumber}` : `RC Return #${entryNumber}`}
                                                                </Badge>
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">
                                                                {new Date(isHEIResubmission ? entry.resubmitted_at! : entry.returned_at!).toLocaleString('en-US', {
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
                                                            {isHEIResubmission ? (
                                                                entry.hei_remarks && (
                                                                    <div>
                                                                        <Label className="text-xs font-semibold">HEI Remarks on Resubmission:</Label>
                                                                        <div className="mt-1 p-2 bg-green-50 dark:bg-green-950/20 rounded text-xs border border-green-200">
                                                                            <p>{entry.hei_remarks}</p>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            ) : (
                                                                <>
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
                                                                            <Label className="text-xs font-semibold">RC Remarks:</Label>
                                                                            <div className="mt-1 p-2 bg-muted/50 rounded text-xs">
                                                                                <p>{entry.review_remarks}</p>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            );
                                        })}
                                    </Accordion>
                                </CardContent>
                            </Card>
                            ) : (
                                <Card>
                                    <CardContent className="pt-6 text-center text-muted-foreground">
                                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No review history yet</p>
                                    </CardContent>
                                </Card>
                            );
                        })()}

                        {/* Accountant Review History Section */}
                        {liquidation.accountant_review_history && liquidation.accountant_review_history.length > 0 ? (
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
                                            const returnNumber = liquidation.accountant_review_history!.length - displayIndex;
                                            return (
                                                <AccordionItem key={displayIndex} value={`acc-item-${displayIndex}`}>
                                                    <AccordionTrigger className="hover:no-underline">
                                                        <div className="flex items-center justify-between w-full pr-2">
                                                            <div className="flex items-center gap-2">
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Avatar className="h-6 w-6">
                                                                                <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                                                                                    {getInitials(entry.returned_by)}
                                                                                </AvatarFallback>
                                                                            </Avatar>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>{entry.returned_by}</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                                <Badge variant="outline" className="text-xs">
                                                                    Return #{returnNumber}
                                                                </Badge>
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
                        ) : !liquidation.review_history || liquidation.review_history.length === 0 ? (
                            <Card>
                                <CardContent className="pt-6 text-center text-muted-foreground">
                                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No accountant review history yet</p>
                                </CardContent>
                            </Card>
                        ) : null}
                    </TabsContent>

                    {/* Analytics Tab */}
                    <TabsContent value="analytics" className="flex-1 overflow-y-auto mt-4 space-y-4 px-1">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5" />
                                    Liquidation Analytics
                                </CardTitle>
                                <CardDescription>
                                    View detailed statistics and progress of this liquidation
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Progress Bar */}
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <span className="text-sm font-medium">Liquidation Progress</span>
                                        <span className="text-sm font-semibold text-green-600">{percentLiquidated.toFixed(2)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3">
                                        <div
                                            className="bg-green-600 h-3 rounded-full transition-all"
                                            style={{ width: `${Math.min(percentLiquidated, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Formula: (Total Disbursed ÷ Amount Received) × 100
                                    </p>
                                </div>

                                {/* Statistics Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 border rounded-lg">
                                        <p className="text-xs text-muted-foreground mb-1">Total Beneficiaries</p>
                                        <p className="text-2xl font-bold">{liquidation.beneficiaries.length}</p>
                                    </div>
                                    <div className="p-4 border rounded-lg">
                                        <p className="text-xs text-muted-foreground mb-1">Total Documents</p>
                                        <p className="text-2xl font-bold">{liquidation.documents?.length || 0}</p>
                                    </div>
                                    <div className="p-4 border rounded-lg">
                                        <p className="text-xs text-muted-foreground mb-1">Average per Student</p>
                                        <p className="text-2xl font-bold">
                                            ₱{liquidation.beneficiaries.length > 0
                                                ? (liquidation.total_disbursed / liquidation.beneficiaries.length).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                                : '0.00'
                                            }
                                        </p>
                                    </div>
                                    <div className="p-4 border rounded-lg">
                                        <p className="text-xs text-muted-foreground mb-1">Unliquidated Amount</p>
                                        <p className="text-2xl font-bold text-orange-600">
                                            ₱{Number(liquidation.remaining_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>

                                {/* Breakdown */}
                                <div>
                                    <h4 className="font-semibold mb-3">Fund Breakdown</h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                                            <span className="text-sm">Disbursed to Students</span>
                                            <span className="text-sm font-semibold">
                                                ₱{Number(liquidation.total_disbursed).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                <span className="text-xs text-muted-foreground ml-2">({percentLiquidated.toFixed(2)}%)</span>
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center p-2 bg-orange-50 dark:bg-orange-950/20 rounded">
                                            <span className="text-sm">Unliquidated/Remaining</span>
                                            <span className="text-sm font-semibold">
                                                ₱{Number(liquidation.remaining_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                <span className="text-xs text-muted-foreground ml-2">({(100 - percentLiquidated).toFixed(2)}%)</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Endorsement Tab */}
                    <TabsContent value="endorsement" className="flex-1 overflow-y-auto mt-4 space-y-4 px-1">
                        <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <ClipboardList className="h-5 w-5 text-purple-600" />
                                    Endorsement Details
                                </CardTitle>
                                <CardDescription>
                                    Information provided by the Regional Coordinator during endorsement
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {/* Transmittal Reference */}
                                    <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                                        <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900/30">
                                            <FileText className="h-4 w-4 text-purple-600" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs text-muted-foreground font-medium">Transmittal Reference No.</p>
                                            <p className="text-sm font-semibold truncate">{liquidation.transmittal_reference_no}</p>
                                        </div>
                                    </div>

                                    {/* Receiver */}
                                    {liquidation.receiver_name && (
                                        <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                                            <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
                                                <User className="h-4 w-4 text-blue-600" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs text-muted-foreground font-medium">Receiver (Accountant)</p>
                                                <p className="text-sm font-semibold truncate">{liquidation.receiver_name}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Document Location */}
                                    {liquidation.document_location && (
                                        <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                                            <div className="p-2 rounded-md bg-green-100 dark:bg-green-900/30">
                                                <MapPin className="h-4 w-4 text-green-600" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs text-muted-foreground font-medium">Document Location</p>
                                                <p className="text-sm font-semibold truncate">{liquidation.document_location}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Number of Folders */}
                                    {liquidation.number_of_folders && (
                                        <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                                            <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-900/30">
                                                <FolderArchive className="h-4 w-4 text-amber-600" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs text-muted-foreground font-medium">Number of Folders</p>
                                                <p className="text-sm font-semibold">{liquidation.number_of_folders}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Folder Location Number */}
                                    {liquidation.folder_location_number && (
                                        <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                                            <div className="p-2 rounded-md bg-cyan-100 dark:bg-cyan-900/30">
                                                <FolderArchive className="h-4 w-4 text-cyan-600" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs text-muted-foreground font-medium">Folder Location Number</p>
                                                <p className="text-sm font-semibold truncate">{liquidation.folder_location_number}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Group Transmittal */}
                                    {liquidation.group_transmittal && (
                                        <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                                            <div className="p-2 rounded-md bg-indigo-100 dark:bg-indigo-900/30">
                                                <ClipboardList className="h-4 w-4 text-indigo-600" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs text-muted-foreground font-medium">Group Transmittal</p>
                                                <p className="text-sm font-semibold truncate">{liquidation.group_transmittal}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Endorsed By Info */}
                                {(liquidation.reviewed_by_name || liquidation.reviewed_at) && (
                                    <div className="mt-4 pt-4 border-t flex items-center gap-4 text-sm text-muted-foreground">
                                        {liquidation.reviewed_by_name && (
                                            <div className="flex items-center gap-1.5">
                                                <User className="h-3.5 w-3.5" />
                                                <span>Endorsed by <span className="font-medium text-foreground">{liquidation.reviewed_by_name}</span></span>
                                            </div>
                                        )}
                                        {liquidation.reviewed_at && (
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="h-3.5 w-3.5" />
                                                <span>{new Date(liquidation.reviewed_at).toLocaleString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* RC Review Remarks */}
                                {liquidation.review_remarks && (
                                    <div className="mt-4 pt-4 border-t">
                                        <Label className="text-sm font-semibold">RC Review Remarks</Label>
                                        <div className="mt-2 p-3 bg-background rounded-md border">
                                            <p className="text-sm">{liquidation.review_remarks}</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

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

                        {/* Resubmit to RC Button */}
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
                                    onClick={() => setIsReturnModalOpen(true)}
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Return to HEI
                                </Button>
                                <Button
                                    onClick={() => setIsEndorseModalOpen(true)}
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
                                    onClick={() => setIsReturnToRCModalOpen(true)}
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Return to RC
                                </Button>
                                <Button
                                    onClick={() => setIsEndorseToCOAModalOpen(true)}
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
        <SubmitForReviewModal
            isOpen={isSubmitModalOpen}
            onClose={() => setIsSubmitModalOpen(false)}
            onSubmit={handleSubmitForReview}
            isProcessing={isSubmitting}
            isResubmission={liquidation?.status === 'returned_to_hei'}
        />

        {/* Endorse to Accounting Modal */}
        <EndorseToAccountingModal
            isOpen={isEndorseModalOpen}
            onClose={() => setIsEndorseModalOpen(false)}
            onSubmit={handleEndorseToAccounting}
            isProcessing={isProcessing}
            accountants={accountants}
        />

        {/* Return to HEI Modal */}
        <ReturnToHEIModal
            isOpen={isReturnModalOpen}
            onClose={() => setIsReturnModalOpen(false)}
            onSubmit={handleReturnToHEI}
            isProcessing={isProcessing}
            regionalCoordinators={regionalCoordinators}
        />

        {/* Accountant: Endorse to COA Modal */}
        <EndorseToCOAModal
            isOpen={isEndorseToCOAModalOpen}
            onClose={() => setIsEndorseToCOAModalOpen(false)}
            onSubmit={handleEndorseToCOA}
            isProcessing={isProcessing}
        />

        {/* Accountant: Return to RC Modal */}
        <ReturnToRCModal
            isOpen={isReturnToRCModalOpen}
            onClose={() => setIsReturnToRCModalOpen(false)}
            onSubmit={handleReturnToRC}
            isProcessing={isProcessing}
        />

        {/* Edit Liquidation Modal */}
        <EditLiquidationModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSubmit={handleUpdateLiquidation}
            isProcessing={isUpdating}
            initialAmount={liquidation?.amount_received?.toString() || '0'}
            totalDisbursed={liquidation?.total_disbursed || 0}
        />
    </>
    );
}
