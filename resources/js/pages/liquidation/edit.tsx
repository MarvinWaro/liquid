import React, { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, useForm, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Upload, Trash2, FileText, Send, CheckCircle, XCircle, Download } from 'lucide-react';

interface HEI {
    id: number;
    name: string;
    code: string;
}

interface Document {
    id: number;
    document_type: string;
    file_name: string;
    file_size: string;
    description: string | null;
    uploaded_by: string;
    uploaded_at: string;
}

interface Liquidation {
    id: number;
    reference_number: string;
    hei_id: number;
    hei: HEI;
    disbursed_amount: number;
    disbursement_date: string | null;
    fund_source: string | null;
    liquidated_amount: number;
    purpose: string | null;
    remarks: string | null;
    status: string;
    status_label: string;
    review_remarks: string | null;
    accountant_remarks: string | null;
    documents: Document[];
    can_edit: boolean;
    can_submit: boolean;
}

interface Props {
    auth: {
        user: any;
    };
    liquidation: Liquidation;
    heis: HEI[];
    can: {
        edit: boolean;
        delete: boolean;
    };
}

export default function Edit({ auth, liquidation, heis, can }: Props) {
    const userRole = auth.user.role?.name;

    const { data, setData, put, processing, errors } = useForm({
        hei_id: liquidation.hei_id.toString(),
        disbursed_amount: liquidation.disbursed_amount.toString(),
        disbursement_date: liquidation.disbursement_date || '',
        fund_source: liquidation.fund_source || '',
        liquidated_amount: liquidation.liquidated_amount.toString(),
        purpose: liquidation.purpose || '',
        remarks: liquidation.remarks || '',
    });

    const [uploadForm, setUploadForm] = useState({
        document_type: '',
        file: null as File | null,
        description: '',
    });
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [showActionDialog, setShowActionDialog] = useState(false);
    const [actionType, setActionType] = useState<'submit' | 'endorse' | 'return_hei' | 'endorse_coa' | 'return_rc' | null>(null);
    const [actionRemarks, setActionRemarks] = useState('');

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        put(route('liquidation.update', liquidation.id));
    };

    const handleUploadDocument = () => {
        if (!uploadForm.file || !uploadForm.document_type) {
            alert('Please select a file and document type');
            return;
        }

        const formData = new FormData();
        formData.append('document_type', uploadForm.document_type);
        formData.append('file', uploadForm.file);
        formData.append('description', uploadForm.description);

        router.post(route('liquidation.upload-document', liquidation.id), formData, {
            preserveScroll: true,
            onSuccess: () => {
                setShowUploadDialog(false);
                setUploadForm({ document_type: '', file: null, description: '' });
            },
        });
    };

    const handleDeleteDocument = (documentId: number) => {
        if (confirm('Are you sure you want to delete this document?')) {
            router.delete(route('liquidation.delete-document', documentId), {
                preserveScroll: true,
            });
        }
    };

    const handleAction = () => {
        if (!actionType) return;

        const routes: Record<string, string> = {
            'submit': route('liquidation.submit', liquidation.id),
            'endorse': route('liquidation.endorse-to-accounting', liquidation.id),
            'return_hei': route('liquidation.return-to-hei', liquidation.id),
            'endorse_coa': route('liquidation.endorse-to-coa', liquidation.id),
            'return_rc': route('liquidation.return-to-rc', liquidation.id),
        };

        const payload: any = {};
        if (actionType === 'submit') payload.remarks = actionRemarks;
        if (actionType === 'endorse') payload.review_remarks = actionRemarks;
        if (actionType === 'return_hei') payload.review_remarks = actionRemarks;
        if (actionType === 'endorse_coa') payload.accountant_remarks = actionRemarks;
        if (actionType === 'return_rc') payload.accountant_remarks = actionRemarks;

        router.post(routes[actionType], payload, {
            onSuccess: () => {
                setShowActionDialog(false);
                setActionRemarks('');
                setActionType(null);
            },
        });
    };

    const openActionDialog = (type: typeof actionType) => {
        setActionType(type);
        setActionRemarks('');
        setShowActionDialog(true);
    };

    const getActionDialogContent = () => {
        const content: Record<string, { title: string; description: string; requireRemarks: boolean; showRemarks: boolean }> = {
            'submit': {
                title: 'Submit for Initial Review',
                description: 'This liquidation will be submitted to the Regional Coordinator for initial review. You may add optional remarks to provide context about this submission.',
                requireRemarks: false,
                showRemarks: true, // HEI can add optional remarks when submitting
            },
            'endorse': {
                title: 'Endorse to Accounting',
                description: 'This liquidation will be endorsed to the Accounting department for review.',
                requireRemarks: false,
                showRemarks: true, // RC can add optional remarks
            },
            'return_hei': {
                title: 'Return to HEI',
                description: 'This liquidation will be returned to the HEI for corrections. Please provide remarks explaining what needs to be corrected.',
                requireRemarks: true,
                showRemarks: true,
            },
            'endorse_coa': {
                title: 'Endorse to COA',
                description: 'This liquidation will be endorsed to the Commission on Audit (COA) for final review.',
                requireRemarks: false,
                showRemarks: true, // Accountant can add optional remarks
            },
            'return_rc': {
                title: 'Return to Regional Coordinator',
                description: 'This liquidation will be returned to the Regional Coordinator for review. Please provide remarks explaining the issues.',
                requireRemarks: true,
                showRemarks: true,
            },
        };
        return content[actionType || 'submit'];
    };

    return (
        <AppLayout>
            <Head title={`Edit Liquidation - ${liquidation.reference_number}`} />

            {/* Upload Dialog */}
            <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload Document</DialogTitle>
                        <DialogDescription>
                            Upload supporting documents for this liquidation
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="document_type">Document Type *</Label>
                            <Input
                                id="document_type"
                                placeholder="e.g., Receipt, Invoice, Certificate"
                                value={uploadForm.document_type}
                                onChange={(e) => setUploadForm({ ...uploadForm, document_type: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="file">File *</Label>
                            <Input
                                id="file"
                                type="file"
                                onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
                            />
                            <p className="text-xs text-muted-foreground">Maximum file size: 10MB</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                placeholder="Brief description of the document..."
                                value={uploadForm.description}
                                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
                        <Button onClick={handleUploadDocument}>Upload</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Action Dialog */}
            <AlertDialog open={showActionDialog} onOpenChange={setShowActionDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{getActionDialogContent()?.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {getActionDialogContent()?.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {getActionDialogContent()?.showRemarks && (
                        <div className="py-4">
                            <Label htmlFor="action_remarks">
                                Remarks {getActionDialogContent()?.requireRemarks ? '*' : '(Optional)'}
                            </Label>
                            <Textarea
                                id="action_remarks"
                                placeholder={getActionDialogContent()?.requireRemarks
                                    ? "Enter your remarks here..."
                                    : "Enter any additional remarks..."}
                                value={actionRemarks}
                                onChange={(e) => setActionRemarks(e.target.value)}
                                rows={4}
                                className="mt-2"
                            />
                        </div>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleAction}
                            disabled={getActionDialogContent()?.requireRemarks && !actionRemarks.trim()}
                        >
                            Confirm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="py-8 w-full">
                <div className="w-full max-w-6xl mx-auto">
                    <div className="mb-6">
                        <Button
                            variant="ghost"
                            onClick={() => router.visit(route('liquidation.index'))}
                            className="mb-4"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Liquidations
                        </Button>
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">
                                    {liquidation.reference_number}
                                </h1>
                                <p className="text-muted-foreground mt-1">
                                    {liquidation.hei.name} ({liquidation.hei.code})
                                </p>
                            </div>
                            <Badge variant="default" className="text-base px-4 py-2">
                                {liquidation.status_label}
                            </Badge>
                        </div>
                    </div>

                    {/* Remarks from reviewers */}
                    {liquidation.remarks && (
                        <Card className="mb-6 border-green-200 bg-green-50 dark:bg-green-950/20">
                            <CardHeader>
                                <CardTitle className="text-base">HEI Remarks</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm">{liquidation.remarks}</p>
                            </CardContent>
                        </Card>
                    )}

                    {liquidation.review_remarks && (
                        <Card className="mb-6 border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                            <CardHeader>
                                <CardTitle className="text-base">Regional Coordinator Remarks</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm">{liquidation.review_remarks}</p>
                            </CardContent>
                        </Card>
                    )}

                    {liquidation.accountant_remarks && (
                        <Card className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                            <CardHeader>
                                <CardTitle className="text-base">Accountant Remarks</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm">{liquidation.accountant_remarks}</p>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main form */}
                        <div className="lg:col-span-2">
                            <form onSubmit={handleUpdate}>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Liquidation Details</CardTitle>
                                        <CardDescription>
                                            {liquidation.can_edit
                                                ? 'Update the liquidation information'
                                                : 'Viewing liquidation details (read-only)'}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="hei_id">HEI *</Label>
                                            <Select
                                                value={data.hei_id}
                                                onValueChange={(value) => setData('hei_id', value)}
                                                disabled={!liquidation.can_edit}
                                            >
                                                <SelectTrigger id="hei_id">
                                                    <SelectValue placeholder="Select HEI" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {heis.map((hei) => (
                                                        <SelectItem key={hei.id} value={hei.id.toString()}>
                                                            {hei.name} ({hei.code})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {errors.hei_id && (
                                                <p className="text-sm text-destructive">{errors.hei_id}</p>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label htmlFor="disbursed_amount">Disbursed Amount *</Label>
                                                <Input
                                                    id="disbursed_amount"
                                                    type="number"
                                                    step="0.01"
                                                    value={data.disbursed_amount}
                                                    onChange={(e) => setData('disbursed_amount', e.target.value)}
                                                    disabled={!liquidation.can_edit}
                                                />
                                                {errors.disbursed_amount && (
                                                    <p className="text-sm text-destructive">{errors.disbursed_amount}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="disbursement_date">Disbursement Date</Label>
                                                <Input
                                                    id="disbursement_date"
                                                    type="date"
                                                    value={data.disbursement_date}
                                                    onChange={(e) => setData('disbursement_date', e.target.value)}
                                                    disabled={!liquidation.can_edit}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label htmlFor="fund_source">Fund Source</Label>
                                                <Input
                                                    id="fund_source"
                                                    value={data.fund_source}
                                                    onChange={(e) => setData('fund_source', e.target.value)}
                                                    disabled={!liquidation.can_edit}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="liquidated_amount">Liquidated Amount</Label>
                                                <Input
                                                    id="liquidated_amount"
                                                    type="number"
                                                    step="0.01"
                                                    value={data.liquidated_amount}
                                                    onChange={(e) => setData('liquidated_amount', e.target.value)}
                                                    disabled={!liquidation.can_edit}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="purpose">Purpose of Fund</Label>
                                            <Textarea
                                                id="purpose"
                                                value={data.purpose}
                                                onChange={(e) => setData('purpose', e.target.value)}
                                                disabled={!liquidation.can_edit}
                                                rows={3}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="remarks">Remarks</Label>
                                            <Textarea
                                                id="remarks"
                                                value={data.remarks}
                                                onChange={(e) => setData('remarks', e.target.value)}
                                                disabled={!liquidation.can_edit}
                                                rows={2}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                {liquidation.can_edit && (
                                    <div className="mt-6 flex justify-end">
                                        <Button type="submit" disabled={processing}>
                                            {processing ? 'Updating...' : 'Update Liquidation'}
                                        </Button>
                                    </div>
                                )}
                            </form>
                        </div>

                        {/* Sidebar - Documents & Actions */}
                        <div className="space-y-6">
                            {/* Documents */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base">Documents</CardTitle>
                                        {liquidation.can_edit && (
                                            <Button size="sm" onClick={() => setShowUploadDialog(true)}>
                                                <Upload className="h-4 w-4 mr-1" />
                                                Upload
                                            </Button>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {liquidation.documents.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
                                            <p className="text-sm">No documents uploaded</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {liquidation.documents.map((doc) => (
                                                <div key={doc.id} className="border rounded-lg p-3">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-sm truncate">
                                                                {doc.file_name}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {doc.document_type}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {doc.file_size} • {doc.uploaded_at}
                                                            </p>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => window.open(route('liquidation.download-document', doc.id), '_blank')}
                                                                title="Download document"
                                                            >
                                                                <Download className="h-4 w-4" />
                                                            </Button>
                                                            {liquidation.can_edit && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleDeleteDocument(doc.id)}
                                                                    title="Delete document"
                                                                >
                                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Workflow Actions */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Actions</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {/* HEI user can submit */}
                                    {liquidation.can_submit && userRole !== 'Regional Coordinator' && userRole !== 'Accountant' && (
                                        <Button
                                            className="w-full"
                                            onClick={() => openActionDialog('submit')}
                                        >
                                            <Send className="mr-2 h-4 w-4" />
                                            Submit for Initial Review
                                        </Button>
                                    )}

                                    {/* Regional Coordinator actions */}
                                    {(liquidation.status === 'for_initial_review' || liquidation.status === 'returned_to_rc') && (userRole === 'Regional Coordinator' || auth.user.role?.name === 'Super Admin') && (
                                        <>
                                            <Button
                                                className="w-full"
                                                onClick={() => openActionDialog('endorse')}
                                            >
                                                <CheckCircle className="mr-2 h-4 w-4" />
                                                Endorse to Accounting
                                            </Button>
                                            <Button
                                                className="w-full"
                                                variant="destructive"
                                                onClick={() => openActionDialog('return_hei')}
                                            >
                                                <XCircle className="mr-2 h-4 w-4" />
                                                Return to HEI
                                            </Button>
                                        </>
                                    )}

                                    {/* Accountant actions */}
                                    {liquidation.status === 'endorsed_to_accounting' && (userRole === 'Accountant' || auth.user.role?.name === 'Super Admin') && (
                                        <>
                                            <Button
                                                className="w-full"
                                                onClick={() => openActionDialog('endorse_coa')}
                                            >
                                                <CheckCircle className="mr-2 h-4 w-4" />
                                                Endorse to COA
                                            </Button>
                                            <Button
                                                className="w-full"
                                                variant="destructive"
                                                onClick={() => openActionDialog('return_rc')}
                                            >
                                                <XCircle className="mr-2 h-4 w-4" />
                                                Return to Regional Coordinator
                                            </Button>
                                        </>
                                    )}

                                    {!liquidation.can_submit &&
                                        liquidation.status !== 'for_initial_review' &&
                                        liquidation.status !== 'returned_to_rc' &&
                                        liquidation.status !== 'endorsed_to_accounting' && (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            No actions available for current status
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
