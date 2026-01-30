import React, { useState, memo } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface User {
    id: number;
    name: string;
}

// Endorse to Accounting Modal
interface EndorseToAccountingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: {
        reviewRemarks: string;
        receiverName: string;
        documentLocation: string;
        transmittalRefNo: string;
        numberOfFolders: string;
        folderLocationNumber: string;
        groupTransmittal: string;
    }) => void;
    isProcessing: boolean;
    accountants: User[];
}

export const EndorseToAccountingModal = memo(function EndorseToAccountingModal({
    isOpen,
    onClose,
    onSubmit,
    isProcessing,
    accountants,
}: EndorseToAccountingModalProps) {
    const [receiverName, setReceiverName] = useState('');
    const [documentLocation, setDocumentLocation] = useState('');
    const [transmittalRefNo, setTransmittalRefNo] = useState('');
    const [numberOfFolders, setNumberOfFolders] = useState('');
    const [folderLocationNumber, setFolderLocationNumber] = useState('');
    const [groupTransmittal, setGroupTransmittal] = useState('');
    const [reviewRemarks, setReviewRemarks] = useState('');

    const handleClose = () => {
        setReceiverName('');
        setDocumentLocation('');
        setTransmittalRefNo('');
        setNumberOfFolders('');
        setFolderLocationNumber('');
        setGroupTransmittal('');
        setReviewRemarks('');
        onClose();
    };

    const handleSubmit = () => {
        onSubmit({
            reviewRemarks,
            receiverName,
            documentLocation,
            transmittalRefNo,
            numberOfFolders,
            folderLocationNumber,
            groupTransmittal,
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Endorse to Accounting</DialogTitle>
                    <DialogDescription>
                        Complete the endorsement details to forward this liquidation to the Accounting department
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
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
                            <Input
                                id="doc-location"
                                placeholder="e.g., Shelf 1B R1"
                                value={documentLocation}
                                onChange={(e) => setDocumentLocation(e.target.value)}
                            />
                        </div>
                    </div>

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
                        onClick={handleClose}
                        disabled={isProcessing}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isProcessing || !transmittalRefNo.trim()}
                    >
                        {isProcessing ? 'Endorsing...' : 'Endorse to Accounting'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
});

// Return to HEI Modal
interface ReturnToHEIModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: {
        reviewRemarks: string;
        documentsForCompliance: string;
        receiverName: string;
    }) => void;
    isProcessing: boolean;
    regionalCoordinators: User[];
}

export const ReturnToHEIModal = memo(function ReturnToHEIModal({
    isOpen,
    onClose,
    onSubmit,
    isProcessing,
    regionalCoordinators,
}: ReturnToHEIModalProps) {
    const [receiverName, setReceiverName] = useState('');
    const [documentsForCompliance, setDocumentsForCompliance] = useState('');
    const [reviewRemarks, setReviewRemarks] = useState('');

    const handleClose = () => {
        setReceiverName('');
        setDocumentsForCompliance('');
        setReviewRemarks('');
        onClose();
    };

    const handleSubmit = () => {
        onSubmit({
            reviewRemarks,
            documentsForCompliance,
            receiverName,
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Return to HEI for Compliance</DialogTitle>
                    <DialogDescription>
                        Specify the compliance issues and documents needed from the HEI
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
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
                        onClick={handleClose}
                        disabled={isProcessing}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleSubmit}
                        disabled={isProcessing || !reviewRemarks.trim() || !documentsForCompliance.trim()}
                    >
                        {isProcessing ? 'Returning...' : 'Return to HEI'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
});

// Submit for Review Modal
interface SubmitForReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (remarks: string) => void;
    isProcessing: boolean;
    isResubmission: boolean;
}

export const SubmitForReviewModal = memo(function SubmitForReviewModal({
    isOpen,
    onClose,
    onSubmit,
    isProcessing,
    isResubmission,
}: SubmitForReviewModalProps) {
    const [remarks, setRemarks] = useState('');

    const handleClose = () => {
        setRemarks('');
        onClose();
    };

    const handleSubmit = () => {
        onSubmit(remarks);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {isResubmission ? 'Resubmit to Regional Coordinator' : 'Submit for Initial Review'}
                    </DialogTitle>
                    <DialogDescription>
                        {isResubmission
                            ? 'Confirm that you have addressed all compliance requirements before resubmitting to the Regional Coordinator.'
                            : 'Are you sure you want to submit this liquidation report to the Regional Coordinator for initial review?'}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="remarks">Remarks (Optional)</Label>
                        <Textarea
                            id="remarks"
                            placeholder={isResubmission
                                ? 'Describe what corrections/updates you made...'
                                : 'Add any additional notes or comments...'}
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            rows={4}
                            className="max-h-[200px] resize-none"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={isProcessing}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isProcessing}
                    >
                        {isProcessing ? 'Submitting...' : (isResubmission ? 'Resubmit to RC' : 'Submit for Review')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
});

// Endorse to COA Modal
interface EndorseToCOAModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (remarks: string) => void;
    isProcessing: boolean;
}

export const EndorseToCOAModal = memo(function EndorseToCOAModal({
    isOpen,
    onClose,
    onSubmit,
    isProcessing,
}: EndorseToCOAModalProps) {
    const [remarks, setRemarks] = useState('');

    const handleClose = () => {
        setRemarks('');
        onClose();
    };

    const handleSubmit = () => {
        onSubmit(remarks);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
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
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            rows={4}
                            className="max-h-[200px] resize-none"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={isProcessing}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isProcessing}
                    >
                        {isProcessing ? 'Endorsing...' : 'Endorse to COA'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
});

// Return to RC Modal
interface ReturnToRCModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (remarks: string) => void;
    isProcessing: boolean;
}

export const ReturnToRCModal = memo(function ReturnToRCModal({
    isOpen,
    onClose,
    onSubmit,
    isProcessing,
}: ReturnToRCModalProps) {
    const [remarks, setRemarks] = useState('');

    const handleClose = () => {
        setRemarks('');
        onClose();
    };

    const handleSubmit = () => {
        onSubmit(remarks);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
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
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
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
                        onClick={handleClose}
                        disabled={isProcessing}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleSubmit}
                        disabled={isProcessing || !remarks.trim()}
                    >
                        {isProcessing ? 'Returning...' : 'Return to RC'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
});

// Edit Liquidation Modal
interface EditLiquidationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (amountReceived: string) => void;
    isProcessing: boolean;
    initialAmount: string;
    totalDisbursed: number;
}

export const EditLiquidationModal = memo(function EditLiquidationModal({
    isOpen,
    onClose,
    onSubmit,
    isProcessing,
    initialAmount,
    totalDisbursed,
}: EditLiquidationModalProps) {
    const [amount, setAmount] = useState(initialAmount);

    // Reset amount when modal opens with new initial value
    React.useEffect(() => {
        if (isOpen) {
            setAmount(initialAmount);
        }
    }, [isOpen, initialAmount]);

    const handleClose = () => {
        setAmount('');
        onClose();
    };

    const handleSubmit = () => {
        onSubmit(amount);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Liquidation</DialogTitle>
                    <DialogDescription>
                        Update the amount received from CHED for this liquidation report
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-amount">Amount Received from CHED *</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₱</span>
                            <Input
                                id="edit-amount"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Enter the total amount disbursed by CHED for this liquidation
                        </p>
                    </div>

                    {/* Show current values for reference */}
                    <div className="rounded-md border p-3 bg-muted/30 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Current Values:</p>
                        <div className="flex justify-between text-sm">
                            <span>Disbursed to Students:</span>
                            <span className="font-mono text-blue-600">
                                ₱{Number(totalDisbursed).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span>Remaining/Unliquidated:</span>
                            <span className="font-mono text-orange-600">
                                ₱{(parseFloat(amount || '0') - totalDisbursed).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={isProcessing}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isProcessing || !amount || parseFloat(amount) < 0}
                    >
                        {isProcessing ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
});
