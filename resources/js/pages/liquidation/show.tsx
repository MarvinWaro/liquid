import React, { useState, useCallback } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, router, Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { FileText, Send, X, BarChart3, Pencil, ClipboardList, MapPin, FolderArchive, User, Calendar, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
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
import {
    EndorseToAccountingModal,
    ReturnToHEIModal,
    SubmitForReviewModal,
    EndorseToCOAModal,
    ReturnToRCModal,
    EditLiquidationModal,
} from '@/components/liquidations/endorsement-modals';
import { type BreadcrumbItem } from '@/types';

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
    remarks?: string | null;
    review_remarks?: string | null;
    documents_for_compliance?: string | null;
    compliance_status?: string | null;
    review_history?: ReviewHistoryEntry[];
    accountant_review_history?: AccountantReviewHistoryEntry[];
    accountant_remarks?: string | null;
    beneficiaries: Beneficiary[];
    documents?: Document[];
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

interface HEI {
    id: number;
    name: string;
}

interface Props {
    liquidation: Liquidation;
    userHei: HEI | null;
    regionalCoordinators: User[];
    accountants: User[];
    permissions: {
        review: boolean;
        submit: boolean;
        edit: boolean;
    };
    userRole: string;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Liquidation Management', href: route('liquidation.index') },
    { title: 'Details', href: '#' },
];

export default function Show({
    liquidation,
    userHei,
    regionalCoordinators,
    accountants,
    permissions,
    userRole,
}: Props) {
    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEndorseModalOpen, setIsEndorseModalOpen] = useState(false);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isEndorseToCOAModalOpen, setIsEndorseToCOAModalOpen] = useState(false);
    const [isReturnToRCModalOpen, setIsReturnToRCModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    const canSubmit = permissions.submit;
    const canReview = permissions.review;

    const handleOpenEditModal = () => setIsEditModalOpen(true);

    const handleSubmitForReview = useCallback((remarks: string) => {
        setIsSubmitting(true);
        router.post(route('liquidation.submit', liquidation.id), {
            remarks: remarks,
        }, {
            onSuccess: () => {
                setIsSubmitting(false);
                setIsSubmitModalOpen(false);
            },
            onError: () => {
                setIsSubmitting(false);
            },
        });
    }, [liquidation.id]);

    const handleEndorseToAccounting = useCallback((data: {
        reviewRemarks: string;
        receiverName: string;
        documentLocation: string;
        transmittalRefNo: string;
        numberOfFolders: string;
        folderLocationNumber: string;
        groupTransmittal: string;
    }) => {
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
            },
            onError: () => {
                setIsProcessing(false);
            },
        });
    }, [liquidation.id]);

    const handleReturnToHEI = useCallback((data: {
        reviewRemarks: string;
        documentsForCompliance: string;
        receiverName: string;
    }) => {
        setIsProcessing(true);
        router.post(route('liquidation.return-to-hei', liquidation.id), {
            review_remarks: data.reviewRemarks,
            documents_for_compliance: data.documentsForCompliance,
            receiver_name: data.receiverName,
        }, {
            onSuccess: () => {
                setIsProcessing(false);
                setIsReturnModalOpen(false);
            },
            onError: () => {
                setIsProcessing(false);
            },
        });
    }, [liquidation.id]);

    const handleEndorseToCOA = useCallback((remarks: string) => {
        setIsProcessing(true);
        router.post(route('liquidation.endorse-to-coa', liquidation.id), {
            accountant_remarks: remarks,
        }, {
            onSuccess: () => {
                setIsProcessing(false);
                setIsEndorseToCOAModalOpen(false);
            },
            onError: () => {
                setIsProcessing(false);
            },
        });
    }, [liquidation.id]);

    const handleReturnToRC = useCallback((remarks: string) => {
        setIsProcessing(true);
        router.post(route('liquidation.return-to-rc', liquidation.id), {
            accountant_remarks: remarks,
        }, {
            onSuccess: () => {
                setIsProcessing(false);
                setIsReturnToRCModalOpen(false);
            },
            onError: () => {
                setIsProcessing(false);
            },
        });
    }, [liquidation.id]);

    const handleUpdateLiquidation = useCallback((amountReceived: string) => {
        setIsUpdating(true);
        router.put(route('liquidation.update', liquidation.id), {
            amount_received: parseFloat(amountReceived),
        }, {
            onSuccess: () => {
                setIsUpdating(false);
                setIsEditModalOpen(false);
                router.reload();
            },
            onError: () => {
                setIsUpdating(false);
            },
        });
    }, [liquidation.id]);

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const isHEIUser = userRole === 'HEI';

    // Check if this is a resubmission by looking at review history
    const hasBeenReturned = (liquidation.review_history?.length ?? 0) > 0;

    const percentLiquidated = liquidation.amount_received > 0
        ? (liquidation.total_disbursed / liquidation.amount_received) * 100
        : 0;

    const canEdit = canSubmit;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Liquidation - ${liquidation.control_no}`} />

            <div className="py-6 px-4 max-w-7xl mx-auto">
                {/* Back Button and Header */}
                <div className="mb-6">
                    <Button variant="ghost" size="sm" asChild className="mb-4">
                        <Link href={route('liquidation.index')}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to List
                        </Link>
                    </Button>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">{liquidation.control_no}</h1>
                            <p className="text-muted-foreground mt-1">{liquidation.hei_name}</p>
                        </div>
                        {canEdit && (
                            <Button variant="outline" onClick={handleOpenEditModal}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 mt-4 flex-wrap">
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
                    </div>
                </div>

                {/* Tabs Content */}
                <Tabs defaultValue="overview" className="space-y-4">
                    <TabsList variant="line">
                        <TabsTrigger value="overview">Overview & Files</TabsTrigger>
                        {liquidation.transmittal_reference_no && (
                            <TabsTrigger value="endorsement">Endorsement</TabsTrigger>
                        )}
                        <TabsTrigger value="history">History</TabsTrigger>
                        <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    </TabsList>

                    {/* Overview & Files Tab */}
                    <TabsContent value="overview" className="space-y-4">
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

                        {/* RC Review Remarks - Show when there are compliance requirements */}
                        {(liquidation.review_remarks || liquidation.documents_for_compliance) && (
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

                        {/* Accountant Review Remarks */}
                        {liquidation.accountant_remarks && (
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
                    </TabsContent>

                    {/* History Tab */}
                    <TabsContent value="history" className="space-y-4">
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
                    <TabsContent value="analytics" className="space-y-4">
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
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                    <TabsContent value="endorsement" className="space-y-4">
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
                                    {liquidation.transmittal_reference_no && (
                                        <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                                            <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900/30">
                                                <FileText className="h-4 w-4 text-purple-600" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs text-muted-foreground font-medium">Transmittal Reference No.</p>
                                                <p className="text-sm font-semibold truncate">{liquidation.transmittal_reference_no}</p>
                                            </div>
                                        </div>
                                    )}

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

                {/* Action Buttons */}
                {(
                    (canSubmit && isHEIUser) ||
                    (canReview && userRole === 'Regional Coordinator') ||
                    (canReview && userRole === 'Accountant')
                ) && (
                    <Card className="mt-6">
                        <CardContent className="pt-6">
                            {/* HEI Submit/Resubmit Button */}
                            {canSubmit && isHEIUser && (
                                <div className="flex justify-end gap-2">
                                    <Button
                                        onClick={() => setIsSubmitModalOpen(true)}
                                        disabled={liquidation.beneficiaries.length === 0}
                                    >
                                        <Send className="h-4 w-4 mr-2" />
                                        {hasBeenReturned ? 'Resubmit to RC' : 'Submit for Review'}
                                    </Button>
                                </div>
                            )}

                            {/* Regional Coordinator Actions */}
                            {canReview && userRole === 'Regional Coordinator' && (
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
                            {canReview && userRole === 'Accountant' && (
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
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Modals */}
            <SubmitForReviewModal
                isOpen={isSubmitModalOpen}
                onClose={() => setIsSubmitModalOpen(false)}
                onSubmit={handleSubmitForReview}
                isProcessing={isSubmitting}
                isResubmission={hasBeenReturned}
            />

            <EndorseToAccountingModal
                isOpen={isEndorseModalOpen}
                onClose={() => setIsEndorseModalOpen(false)}
                onSubmit={handleEndorseToAccounting}
                isProcessing={isProcessing}
                accountants={accountants}
            />

            <ReturnToHEIModal
                isOpen={isReturnModalOpen}
                onClose={() => setIsReturnModalOpen(false)}
                onSubmit={handleReturnToHEI}
                isProcessing={isProcessing}
                regionalCoordinators={regionalCoordinators}
            />

            <EndorseToCOAModal
                isOpen={isEndorseToCOAModalOpen}
                onClose={() => setIsEndorseToCOAModalOpen(false)}
                onSubmit={handleEndorseToCOA}
                isProcessing={isProcessing}
            />

            <ReturnToRCModal
                isOpen={isReturnToRCModalOpen}
                onClose={() => setIsReturnToRCModalOpen(false)}
                onSubmit={handleReturnToRC}
                isProcessing={isProcessing}
            />

            <EditLiquidationModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSubmit={handleUpdateLiquidation}
                isProcessing={isUpdating}
                initialAmount={liquidation.amount_received?.toString() || '0'}
                totalDisbursed={liquidation.total_disbursed || 0}
            />
        </AppLayout>
    );
}
