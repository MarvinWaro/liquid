import React, { useState, useCallback, useMemo } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, router, Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { FileText, Send, X, BarChart3, Pencil, ClipboardList, MapPin, FolderArchive, User, Calendar, ArrowLeft, Building2, Save, RotateCcw, Plus, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
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
import { VerticalStepper } from '@/components/ui/vertical-stepper';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { type BreadcrumbItem } from '@/types';
import { toast } from 'sonner';

const RC_NOTES_OPTIONS = [
    { value: 'For Review', label: 'For Review' },
    { value: 'For Compliance', label: 'For Compliance' },
    { value: 'For Endorsement', label: 'For Endorsement' },
    { value: 'Fully Endorsed', label: 'Fully Endorsed' },
    { value: 'Partially Endorsed', label: 'Partially Endorsed' },
];

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

interface TrackingEntry {
    id?: string;
    document_status: string;
    received_by: string;
    date_received: string;
    document_location: string;
    reviewed_by: string;
    date_reviewed: string;
    rc_note: string;
    date_endorsement: string;
    liquidation_status: string;
}

interface RunningDataEntry {
    id?: string;
    grantees_liquidated: number | null;
    amount_complete_docs: number | null;
    amount_refunded: number | null;
    refund_or_no: string;
    total_amount_liquidated: number | null;
    transmittal_ref_no: string;
    group_transmittal_ref_no: string;
}

interface Liquidation {
    id: number;
    control_no: string;
    hei_name: string;
    program_name: string;
    academic_year: string;
    semester: string;
    batch_no: string;
    dv_control_no: string;
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
    tracking_entries?: TrackingEntry[];
    running_data?: RunningDataEntry[];
    receiver_name?: string | null;
    document_location?: string | null;
    transmittal_reference_no?: string | null;
    number_of_folders?: number | null;
    folder_location_number?: string | null;
    group_transmittal?: string | null;
    reviewed_by_name?: string | null;
    reviewed_at?: string | null;
    date_fund_released?: string | null;
    due_date?: string | null;
    fund_source?: string | null;
    number_of_grantees?: number | null;
    amount_liquidated?: number;
    lapsing_period?: number;
    document_status?: string;
    liquidation_status?: string;
    date_submitted?: string | null;
    created_by_name?: string | null;
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
    documentLocations: string[];
    permissions: {
        review: boolean;
        submit: boolean;
        edit: boolean;
    };
    userRole: string;
}

// Format number with commas and 2 decimal places (e.g. 50,000.00)
const formatAmount = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    if (value === 0) return '0.00';
    return Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Parse formatted amount string back to number (removes commas)
const parseAmount = (value: string): number | null => {
    if (!value) return null;
    const cleaned = value.replace(/,/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
};

// Calculator-style amount input: digits build right-to-left (like ATM/POS terminal)
// e.g. type "5" → 0.05, type "0" → 0.50, type "0" → 5.00, type "0" → 50.00
function AmountInput({ value, onValueChange, placeholder = '0.00', className = '', disabled = false }: {
    value: number | null | undefined;
    onValueChange: (val: number | null) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}) {
    const isFocused = React.useRef(false);

    // Internal digit string (represents cents): "5000" = 50.00
    const [digits, setDigits] = React.useState<string>(() =>
        value ? Math.round(value * 100).toString() : ''
    );

    // Sync when value changes from outside (e.g. on load/save) but not while typing
    React.useEffect(() => {
        if (!isFocused.current) {
            setDigits(value ? Math.round(value * 100).toString() : '');
        }
    }, [value]);

    const display = React.useMemo(() => {
        if (!digits) return '';
        const cents = parseInt(digits, 10);
        return (cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }, [digits]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key >= '0' && e.key <= '9') {
            e.preventDefault();
            const newDigits = digits + e.key;
            setDigits(newDigits);
            onValueChange(parseInt(newDigits, 10) / 100);
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            const newDigits = digits.slice(0, -1);
            setDigits(newDigits);
            onValueChange(newDigits ? parseInt(newDigits, 10) / 100 : null);
        }
        // Allow Tab, Enter, arrows, etc. to pass through normally
    };

    return (
        <Input
            type="text"
            value={display}
            onFocus={() => { isFocused.current = true; }}
            onBlur={() => { isFocused.current = false; }}
            onKeyDown={handleKeyDown}
            onChange={() => {}} // fully controlled via keyDown
            disabled={disabled}
            className={`text-right ${className}`}
            placeholder={placeholder}
        />
    );
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
    documentLocations,
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

    // Inline edit state for details
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editForm, setEditForm] = useState({
        academic_year: liquidation.academic_year ?? '',
        semester: liquidation.semester ?? '',
        batch_no: liquidation.batch_no ?? '',
        date_fund_released: liquidation.date_fund_released ?? '',
        due_date: liquidation.due_date ?? '',
        number_of_grantees: String(liquidation.number_of_grantees ?? liquidation.beneficiaries?.length ?? 0),
        total_disbursed: String(liquidation.total_disbursed ?? 0),
        amount_received: String(liquidation.amount_received ?? 0),
        document_status: liquidation.document_status ?? '',
        liquidation_status: liquidation.liquidation_status ?? '',
        review_remarks: liquidation.review_remarks ?? '',
    });

    // Tracking entries state
    const createEmptyEntry = (): TrackingEntry => ({
        document_status: 'No Submission',
        received_by: '',
        date_received: '',
        document_location: '',
        reviewed_by: '',
        date_reviewed: '',
        rc_note: '',
        date_endorsement: '',
        liquidation_status: 'Unliquidated',
    });

    const [trackingEntries, setTrackingEntries] = useState<TrackingEntry[]>(
        liquidation.tracking_entries && liquidation.tracking_entries.length > 0
            ? liquidation.tracking_entries
            : [createEmptyEntry()]
    );
    const [isSavingTracking, setIsSavingTracking] = useState(false);

    const addTrackingEntry = useCallback(() => {
        setTrackingEntries(prev => [...prev, createEmptyEntry()]);
    }, []);

    const removeTrackingEntry = useCallback((index: number) => {
        setTrackingEntries(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
    }, []);

    const updateTrackingEntry = useCallback((index: number, field: keyof TrackingEntry, value: string) => {
        setTrackingEntries(prev => prev.map((entry, i) => i === index ? { ...entry, [field]: value } : entry));
    }, []);

    const saveTrackingEntries = useCallback(() => {
        setIsSavingTracking(true);
        router.post(route('liquidation.save-tracking-entries', liquidation.id), {
            entries: trackingEntries,
        }, {
            onSuccess: () => setIsSavingTracking(false),
            onError: () => setIsSavingTracking(false),
            preserveScroll: true,
        });
    }, [liquidation.id, trackingEntries]);

    // Running data entries state
    const createEmptyRunningData = (): RunningDataEntry => ({
        grantees_liquidated: null,
        amount_complete_docs: null,
        amount_refunded: null,
        refund_or_no: '',
        total_amount_liquidated: null,
        transmittal_ref_no: '',
        group_transmittal_ref_no: '',
    });

    const [runningDataEntries, setRunningDataEntries] = useState<RunningDataEntry[]>(
        liquidation.running_data && liquidation.running_data.length > 0
            ? liquidation.running_data
            : [createEmptyRunningData()]
    );
    const [isSavingRunningData, setIsSavingRunningData] = useState(false);

    const addRunningDataEntry = useCallback(() => {
        setRunningDataEntries(prev => [...prev, createEmptyRunningData()]);
    }, []);

    const removeRunningDataEntry = useCallback((index: number) => {
        setRunningDataEntries(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
    }, []);

    const updateRunningDataEntry = useCallback((index: number, field: keyof RunningDataEntry, value: string | number | null) => {
        setRunningDataEntries(prev => prev.map((entry, i) => i === index ? { ...entry, [field]: value } : entry));
    }, []);

    const saveRunningData = useCallback(() => {
        // Validate before saving
        const totalDisb = Number(liquidation.amount_received ?? 0);
        const totalGrant = Number(liquidation.number_of_grantees ?? 0);

        let totalGranteesUsed = 0;
        let totalAmtLiquidated = 0;
        for (const entry of runningDataEntries) {
            totalGranteesUsed += Number(entry.grantees_liquidated ?? 0);
            totalAmtLiquidated += Number(entry.amount_complete_docs ?? 0) + Number(entry.amount_refunded ?? 0);
        }

        if (totalGranteesUsed > totalGrant) {
            toast.error(`Total grantees liquidated (${totalGranteesUsed}) exceeds total grantees (${totalGrant}).`);
            return;
        }

        if (totalAmtLiquidated > totalDisb) {
            toast.error(`Total amount liquidated (${totalAmtLiquidated.toLocaleString('en-PH', { minimumFractionDigits: 2 })}) exceeds total disbursements (${totalDisb.toLocaleString('en-PH', { minimumFractionDigits: 2 })}).`);
            return;
        }

        setIsSavingRunningData(true);
        // Compute total_amount_liquidated for each entry before saving
        const entriesWithComputed = runningDataEntries.map(entry => ({
            ...entry,
            total_amount_liquidated: Number(entry.amount_complete_docs ?? 0) + Number(entry.amount_refunded ?? 0),
        }));
        router.post(route('liquidation.save-running-data', liquidation.id), {
            entries: entriesWithComputed,
        }, {
            onSuccess: () => setIsSavingRunningData(false),
            onError: () => {
                setIsSavingRunningData(false);
                toast.error('Failed to save running data. Please check your inputs.');
            },
            preserveScroll: true,
        });
    }, [liquidation.id, liquidation.amount_received, liquidation.number_of_grantees, runningDataEntries]);

    // Computed running data values
    const totalDisbursements = Number(liquidation.amount_received ?? 0);
    const totalGrantees = Number(liquidation.number_of_grantees ?? 0);

    const computeRunningTotals = useMemo(() => {
        return runningDataEntries.map((entry, index) => {
            // Total Amt Liquidated = Amount with Complete Docs + Amount Refunded
            const totalAmtLiquidated = Number(entry.amount_complete_docs ?? 0) + Number(entry.amount_refunded ?? 0);

            // Running unliquidated: start from totalDisbursements, subtract all previous + current
            let cumulativeLiquidated = 0;
            for (let i = 0; i <= index; i++) {
                cumulativeLiquidated += Number(runningDataEntries[i].amount_complete_docs ?? 0) + Number(runningDataEntries[i].amount_refunded ?? 0);
            }
            const totalUnliquidated = totalDisbursements - cumulativeLiquidated;
            const percentage = totalDisbursements > 0 ? ((cumulativeLiquidated / totalDisbursements) * 100) : 0;

            // Running grantees: remaining = total - sum of all previous entries' grantees
            let previousGrantees = 0;
            for (let i = 0; i < index; i++) {
                previousGrantees += Number(runningDataEntries[i].grantees_liquidated ?? 0);
            }
            const remainingGrantees = totalGrantees - previousGrantees;

            // Running disbursements: row 0 = full amount, row n = previous row's unliquidated amount
            let previousLiquidated = 0;
            for (let i = 0; i < index; i++) {
                previousLiquidated += Number(runningDataEntries[i].amount_complete_docs ?? 0) + Number(runningDataEntries[i].amount_refunded ?? 0);
            }
            const remainingDisbursements = Math.max(0, totalDisbursements - previousLiquidated);

            return {
                totalAmtLiquidated,
                totalUnliquidated: Math.max(0, totalUnliquidated),
                percentage: Math.min(100, Math.max(0, percentage)),
                remainingGrantees: Math.max(0, remainingGrantees),
                remainingDisbursements,
            };
        });
    }, [runningDataEntries, totalDisbursements, totalGrantees]);

    // Sum of all running data total_amount_liquidated (used for Liquidation Details)
    const runningDataTotalLiquidated = useMemo(() => {
        return runningDataEntries.reduce((sum, entry) => sum + Number(entry.amount_complete_docs ?? 0) + Number(entry.amount_refunded ?? 0), 0);
    }, [runningDataEntries]);

    const handleStartEdit = useCallback(() => {
        setEditForm({
            academic_year: liquidation.academic_year ?? '',
            semester: liquidation.semester ?? '',
            batch_no: liquidation.batch_no ?? '',
            date_fund_released: liquidation.date_fund_released ?? '',
            due_date: liquidation.due_date ?? '',
            number_of_grantees: String(liquidation.number_of_grantees ?? liquidation.beneficiaries?.length ?? 0),
            total_disbursed: String(liquidation.total_disbursed ?? 0),
            amount_received: String(liquidation.amount_received ?? 0),
            document_status: liquidation.document_status ?? '',
            liquidation_status: liquidation.liquidation_status ?? '',
            review_remarks: liquidation.review_remarks ?? '',
        });
        setIsEditing(true);
    }, [liquidation]);

    const handleCancelEdit = useCallback(() => {
        setIsEditing(false);
    }, []);

    const handleSaveDetails = useCallback(() => {
        setIsSaving(true);
        router.put(route('liquidation.update', liquidation.id), {
            academic_year: editForm.academic_year || null,
            semester: editForm.semester || null,
            batch_no: editForm.batch_no || null,
            date_fund_released: editForm.date_fund_released || null,
            due_date: editForm.due_date || null,
            number_of_grantees: editForm.number_of_grantees ? parseInt(editForm.number_of_grantees) : null,
            amount_received: parseFloat(editForm.amount_received),
            document_status: editForm.document_status,
            liquidation_status: editForm.liquidation_status,
            review_remarks: editForm.review_remarks || null,
        }, {
            onSuccess: () => {
                setIsSaving(false);
                setIsEditing(false);
            },
            onError: () => {
                setIsSaving(false);
            },
            preserveScroll: true,
        });
    }, [liquidation.id, editForm]);

    const updateField = useCallback((field: keyof typeof editForm, value: string) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
    }, []);

    const canSubmit = permissions.submit;
    const canReview = permissions.review;
    const canEditDetails = permissions.edit || permissions.review;

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
        ? ((liquidation.amount_liquidated ?? 0) / liquidation.amount_received) * 100
        : 0;

    const canEdit = canSubmit;

    // Determine workflow step based on status
    const getWorkflowSteps = () => {
        const normalizedStatus = liquidation.liquidation_status?.toLowerCase().replace(/\s+/g, '_') || 'draft';

        // Steps 3 (Accounting) and 4 (COA) are not yet implemented.
        // Fully/Partially Liquidated means RC Review is complete — stop there.
        const rcDoneStatuses = ['fully_liquidated', 'partially_liquidated'];

        // For statuses beyond RC scope (future modules)
        const accountingCurrentStatuses = ['endorsed_to_accounting', 'returned_to_rc'];
        const coaCurrentStatuses = ['endorsed_to_coa'];

        if (coaCurrentStatuses.includes(normalizedStatus)) {
            return {
                steps: [
                    { label: 'HEI Submission', description: 'Draft & Submit' },
                    { label: 'RC Review', description: 'Regional Coordinator' },
                    { label: 'Accounting Review', description: 'Financial Verification' },
                    { label: 'COA Endorsement', description: 'Final Approval' },
                ],
                currentStep: 4,
                isFullyCompleted: false,
                lastCompletedStep: undefined,
            };
        }

        if (accountingCurrentStatuses.includes(normalizedStatus)) {
            return {
                steps: [
                    { label: 'HEI Submission', description: 'Draft & Submit' },
                    { label: 'RC Review', description: 'Regional Coordinator' },
                    { label: 'Accounting Review', description: 'Financial Verification' },
                    { label: 'COA Endorsement', description: 'Final Approval' },
                ],
                currentStep: 3,
                isFullyCompleted: false,
                lastCompletedStep: undefined,
            };
        }

        if (rcDoneStatuses.includes(normalizedStatus)) {
            // RC Review done — steps 1 & 2 completed, steps 3 & 4 stay gray (not implemented yet)
            return {
                steps: [
                    { label: 'HEI Submission', description: 'Draft & Submit' },
                    { label: 'RC Review', description: 'Regional Coordinator' },
                    { label: 'Accounting Review', description: 'Financial Verification' },
                    { label: 'COA Endorsement', description: 'Final Approval' },
                ],
                currentStep: 2,
                isFullyCompleted: false,
                lastCompletedStep: 2,
            };
        }

        // Default: HEI submission / under RC review
        const stepMap: Record<string, number> = {
            'draft': 1,
            'unliquidated': 1,
            'for_initial_review': 2,
            'returned_to_hei': 2,
        };
        const currentStepNumber = stepMap[normalizedStatus] || 1;

        return {
            steps: [
                { label: 'HEI Submission', description: 'Draft & Submit' },
                { label: 'RC Review', description: 'Regional Coordinator' },
                { label: 'Accounting Review', description: 'Financial Verification' },
                { label: 'COA Endorsement', description: 'Final Approval' },
            ],
            currentStep: currentStepNumber,
            isFullyCompleted: false,
            lastCompletedStep: undefined,
        };
    };

    const workflowState = getWorkflowSteps();

    const getDocumentStatusColor = (status: string) => {
        if (status?.toLowerCase().includes('complete')) return 'bg-green-100 text-green-700 border-green-200';
        if (status?.toLowerCase().includes('partial')) return 'bg-amber-100 text-amber-700 border-amber-200';
        return 'bg-red-100 text-red-700 border-red-200';
    };

    const getLiquidationStatusColor = (status: string) => {
        if (status?.toLowerCase().includes('fully')) return 'bg-green-100 text-green-700 border-green-200';
        if (status?.toLowerCase().includes('partially')) return 'bg-blue-100 text-blue-700 border-blue-200';
        return 'bg-red-100 text-red-700 border-red-200';
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Liquidation - ${liquidation.control_no}`} />

            <div className="py-3">
                {/* Header Section - Full Width */}
                <div className="mb-3">
                    <Button variant="ghost" size="sm" asChild className="mb-2">
                        <Link href={route('liquidation.index')}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to List
                        </Link>
                    </Button>

                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">{liquidation.control_no}</h1>
                            <p className="text-sm text-muted-foreground mt-0.5">{liquidation.hei_name}</p>
                        </div>
                        {canEdit && (
                            <Button variant="outline" size="sm" onClick={handleOpenEditModal}>
                                <Pencil className="h-3.5 w-3.5 mr-2" />
                                Edit
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-0.5 text-xs font-semibold border-0">
                            {liquidation.program_name}
                        </Badge>
                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-900 px-2.5 py-0.5 text-xs">
                            AY {liquidation.academic_year}
                        </Badge>
                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-900 px-2.5 py-0.5 text-xs">
                            {liquidation.semester}
                        </Badge>
                        <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700 px-2.5 py-0.5 text-xs font-medium">
                            {liquidation.number_of_grantees || liquidation.beneficiaries.length} Grantees
                        </Badge>
                    </div>
                </div>

                {/* Main Content Grid: Details (8 cols) + Stepper (4 cols) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-3 items-stretch">
                    {/* Liquidation Details - 8 columns */}
                    <div className="lg:col-span-8 flex flex-col">
                        <Card className="flex-1">
                            <CardHeader className="pb-2 pt-3">
                                <CardTitle className="text-sm font-semibold">Liquidation Details</CardTitle>
                                <CardDescription className="text-xs">Financial and document information</CardDescription>
                            </CardHeader>
                            <CardContent className="pb-3">
                                {/* Liquidation Details - Context Menu + Inline Edit */}
                                <ContextMenu>
                            <ContextMenuTrigger asChild disabled={!canEditDetails}>
                                <div className={`${canEditDetails && !isEditing ? 'cursor-context-menu' : ''} ${isEditing ? 'ring-2 ring-blue-200 rounded-lg p-3 -m-3 bg-blue-50/30' : ''}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Liquidation Details</h3>
                                            {isEditing && (
                                                <Badge className="bg-blue-100 text-blue-700 border-blue-200 shadow-none text-[10px] px-1.5 py-0">Editing</Badge>
                                            )}
                                            {!isEditing && canEditDetails && (
                                                <span className="text-[10px] text-muted-foreground italic">Right-click to edit</span>
                                            )}
                                        </div>
                                        {isEditing && (
                                            <div className="flex items-center gap-1.5">
                                                <Button variant="ghost" size="sm" onClick={handleCancelEdit} disabled={isSaving} className="h-7 text-xs px-2">
                                                    <RotateCcw className="h-3 w-3 mr-1" />
                                                    Cancel
                                                </Button>
                                                <Button size="sm" onClick={handleSaveDetails} disabled={isSaving} className="h-7 text-xs px-3">
                                                    <Save className="h-3 w-3 mr-1" />
                                                    {isSaving ? 'Saving...' : 'Save'}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    {/* ── General Info ── */}
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 mt-1">General Info</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-3 mb-4">
                                        {/* Row 1: Period & Identification */}
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Academic Year</Label>
                                            <Input
                                                value={isEditing ? editForm.academic_year : liquidation.academic_year}
                                                onChange={(e) => updateField('academic_year', e.target.value)}
                                                disabled={!isEditing}
                                                className={`h-8 text-xs disabled:opacity-100 disabled:cursor-default ${isEditing ? 'border-blue-300 bg-white' : ''}`}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Semester</Label>
                                            <Input
                                                value={isEditing ? editForm.semester : liquidation.semester}
                                                onChange={(e) => updateField('semester', e.target.value)}
                                                disabled={!isEditing}
                                                className={`h-8 text-xs disabled:opacity-100 disabled:cursor-default ${isEditing ? 'border-blue-300 bg-white' : ''}`}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Batch No.</Label>
                                            <Input
                                                value={isEditing ? editForm.batch_no : (liquidation.batch_no || 'N/A')}
                                                onChange={(e) => updateField('batch_no', e.target.value)}
                                                disabled={!isEditing}
                                                className={`h-8 text-xs disabled:opacity-100 disabled:cursor-default ${isEditing ? 'border-blue-300 bg-white' : ''}`}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">DV Control No.</Label>
                                            <Input value={liquidation.dv_control_no} disabled className="h-8 text-xs disabled:opacity-100 disabled:cursor-default" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Date of Fund Release</Label>
                                            <Input
                                                type="date"
                                                value={isEditing ? editForm.date_fund_released : (liquidation.date_fund_released || '')}
                                                onChange={(e) => updateField('date_fund_released', e.target.value)}
                                                disabled={!isEditing}
                                                className={`h-8 text-xs disabled:opacity-100 disabled:cursor-default ${isEditing ? 'border-blue-300 bg-white' : ''}`}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Due Date</Label>
                                            <Input
                                                type="date"
                                                value={isEditing ? editForm.due_date : (liquidation.due_date || '')}
                                                onChange={(e) => updateField('due_date', e.target.value)}
                                                disabled={!isEditing}
                                                className={`h-8 text-xs disabled:opacity-100 disabled:cursor-default ${isEditing ? 'border-blue-300 bg-white' : ''}`}
                                            />
                                        </div>

                                    </div>

                                    {/* ── Financial Summary ── */}
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Financial Summary</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-3 mb-4 p-3 rounded-lg bg-slate-50 border border-slate-100">
                                        {/* Row 2: Financial & Status */}
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">No. of Grantees</Label>
                                            <Input
                                                type={isEditing ? 'number' : 'text'}
                                                value={isEditing ? editForm.number_of_grantees : (liquidation.number_of_grantees || liquidation.beneficiaries.length)}
                                                onChange={(e) => updateField('number_of_grantees', e.target.value)}
                                                disabled={!isEditing}
                                                className={`h-8 text-xs disabled:opacity-100 disabled:cursor-default ${isEditing ? 'border-blue-300 bg-white' : ''}`}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Total Disbursements</Label>
                                            {isEditing ? (
                                                <AmountInput
                                                    value={editForm.amount_received ? Number(editForm.amount_received) : null}
                                                    onValueChange={(val) => updateField('amount_received', val !== null ? String(val) : '')}
                                                    className="h-8 text-xs font-semibold border-blue-300 bg-white"
                                                />
                                            ) : (
                                                <Input
                                                    type="text"
                                                    value={`₱${Number(liquidation.amount_received).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                                                    disabled
                                                    className="h-8 text-xs font-semibold disabled:opacity-100 disabled:cursor-default"
                                                />
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Amount Liquidated</Label>
                                            <Input
                                                value={`₱${runningDataTotalLiquidated.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                                                disabled
                                                className="h-8 text-xs font-semibold text-blue-600 disabled:opacity-100 disabled:cursor-default"
                                            />
                                            <span className="text-[9px] text-muted-foreground italic">Auto-computed from Running Data</span>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Unliquidated</Label>
                                            <Input
                                                value={`₱${Math.max(0, totalDisbursements - runningDataTotalLiquidated).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                                                disabled
                                                className="h-8 text-xs font-semibold text-orange-600 disabled:opacity-100 disabled:cursor-default"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Document Status</Label>
                                            {isEditing ? (
                                                <Select
                                                    value={editForm.document_status}
                                                    onValueChange={(value) => updateField('document_status', value)}
                                                >
                                                    <SelectTrigger className="h-8 text-xs border-blue-300 bg-white">
                                                        <SelectValue placeholder="Select status" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="No Submission" className="text-xs">No Submission</SelectItem>
                                                        <SelectItem value="Partial Submission" className="text-xs">Partial Submission</SelectItem>
                                                        <SelectItem value="Complete Submission" className="text-xs">Complete Submission</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <div className="h-8 flex items-center">
                                                    <Badge className={`${getDocumentStatusColor(liquidation.document_status || '')} shadow-none border font-normal text-[10px] px-1.5 py-0`}>
                                                        {liquidation.document_status || 'N/A'}
                                                    </Badge>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Liquidation Status</Label>
                                            {isEditing ? (
                                                <Select
                                                    value={editForm.liquidation_status}
                                                    onValueChange={(value) => updateField('liquidation_status', value)}
                                                >
                                                    <SelectTrigger className="h-8 text-xs border-blue-300 bg-white">
                                                        <SelectValue placeholder="Select status" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Unliquidated" className="text-xs">Unliquidated</SelectItem>
                                                        <SelectItem value="Partially Liquidated" className="text-xs">Partially Liquidated</SelectItem>
                                                        <SelectItem value="Fully Liquidated" className="text-xs">Fully Liquidated</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <div className="h-8 flex items-center">
                                                    <Badge className={`${getLiquidationStatusColor(liquidation.liquidation_status || '')} shadow-none border font-normal text-[10px] px-1.5 py-0`}>
                                                        {liquidation.liquidation_status || 'N/A'}
                                                    </Badge>
                                                </div>
                                            )}
                                        </div>

                                    </div>

                                    {/* ── Status & Notes ── */}
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Status & Notes</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-3">
                                        {/* Row 3: Percentage, Lapsing, Review */}
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">% Liquidation</Label>
                                            <Input value={`${(totalDisbursements > 0 ? ((runningDataTotalLiquidated / totalDisbursements) * 100) : 0).toFixed(2)}%`} disabled className="h-8 text-xs font-semibold text-green-600 disabled:opacity-100 disabled:cursor-default" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Lapsing (Days)</Label>
                                            <Input value={liquidation.lapsing_period || 0} disabled className={`h-8 text-xs font-semibold disabled:opacity-100 disabled:cursor-default ${(liquidation.lapsing_period || 0) > 0 ? 'text-red-600' : 'text-green-600'}`} />
                                        </div>
                                        {liquidation.reviewed_by_name && (
                                            <>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] text-muted-foreground">Reviewed By</Label>
                                                    <Input value={liquidation.reviewed_by_name} disabled className="h-8 text-xs disabled:opacity-100 disabled:cursor-default" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] text-muted-foreground">Date Reviewed</Label>
                                                    <Input value={liquidation.reviewed_at ? new Date(liquidation.reviewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'} disabled className="h-8 text-xs disabled:opacity-100 disabled:cursor-default" />
                                                </div>
                                            </>
                                        )}

                                        {/* RC Notes */}
                                        {(liquidation.review_remarks || isEditing) && (
                                            <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground">Regional Coordinator's Note</Label>
                                                {isEditing ? (
                                                    <Select
                                                        value={editForm.review_remarks}
                                                        onValueChange={(value) => updateField('review_remarks', value)}
                                                    >
                                                        <SelectTrigger className="h-8 text-xs border-blue-300 bg-white">
                                                            <SelectValue placeholder="Select note (optional)" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {RC_NOTES_OPTIONS.map((option) => (
                                                                <SelectItem key={option.value} value={option.value} className="text-xs">
                                                                    {option.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <Input
                                                        value={liquidation.review_remarks || ''}
                                                        disabled
                                                        className="h-8 text-xs disabled:opacity-100 disabled:cursor-default"
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-48">
                                {!isEditing ? (
                                    <ContextMenuItem onClick={handleStartEdit} className="text-xs">
                                        <Pencil className="h-3.5 w-3.5 mr-2" />
                                        Edit Details
                                    </ContextMenuItem>
                                ) : (
                                    <>
                                        <ContextMenuItem onClick={handleSaveDetails} disabled={isSaving} className="text-xs">
                                            <Save className="h-3.5 w-3.5 mr-2" />
                                            {isSaving ? 'Saving...' : 'Save Changes'}
                                        </ContextMenuItem>
                                        <ContextMenuSeparator />
                                        <ContextMenuItem onClick={handleCancelEdit} disabled={isSaving} className="text-xs text-destructive">
                                            <RotateCcw className="h-3.5 w-3.5 mr-2" />
                                            Cancel Editing
                                        </ContextMenuItem>
                                    </>
                                )}
                            </ContextMenuContent>
                        </ContextMenu>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Workflow Stepper - 4 columns */}
                    <div className="lg:col-span-4 flex flex-col">
                        <Card className="flex-1">
                            <CardHeader className="pb-2 pt-3">
                                <CardTitle className="text-sm font-semibold">Workflow Progress</CardTitle>
                                <CardDescription className="text-xs">Track liquidation status</CardDescription>
                            </CardHeader>
                            <CardContent className="pb-4">
                                <VerticalStepper
                                    steps={workflowState.steps}
                                    currentStep={workflowState.currentStep}
                                    isFullyCompleted={workflowState.isFullyCompleted}
                                    lastCompletedStep={workflowState.lastCompletedStep}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Document Tracking - Always visible */}
                <div className="mb-3">
                    <Card>
                            <CardHeader className="pb-2 pt-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-sm font-semibold">Document Tracking</CardTitle>
                                        <CardDescription className="text-xs">Track document submissions and review status</CardDescription>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={saveTrackingEntries}
                                        disabled={isSavingTracking}
                                        className="h-7 text-xs px-3"
                                    >
                                        <Save className="h-3 w-3 mr-1" />
                                        {isSavingTracking ? 'Saving...' : 'Save'}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pb-3">
                                <div className="overflow-x-auto -mx-3">
                                    <table className="w-full text-xs min-w-[900px]">
                                        <thead>
                                            <tr className="bg-blue-50 border-b border-blue-100">
                                                <th className="text-left font-semibold text-blue-700 px-2 py-2 text-xs">Status of Documents</th>
                                                <th className="text-left font-semibold text-blue-700 px-2 py-2 text-xs">Received by</th>
                                                <th className="text-left font-semibold text-blue-700 px-2 py-2 text-xs">Date Received</th>
                                                <th className="text-left font-semibold text-blue-700 px-2 py-2 text-xs">Document Location</th>
                                                <th className="text-left font-semibold text-blue-700 px-2 py-2 text-xs">Reviewed by</th>
                                                <th className="text-left font-semibold text-blue-700 px-2 py-2 text-xs">Date Reviewed</th>
                                                <th className="text-left font-semibold text-blue-700 px-2 py-2 text-xs">RC Note</th>
                                                <th className="text-left font-semibold text-blue-700 px-2 py-2 text-xs">Date of Endorsement</th>
                                                <th className="text-left font-semibold text-blue-700 px-2 py-2 text-xs">Status of Liquidation</th>
                                                <th className="px-2 py-2 w-8 bg-blue-50"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {trackingEntries.map((entry, index) => (
                                                <tr key={entry.id || index} className="border-b last:border-0 hover:bg-blue-50/50">
                                                    <td className="px-2 py-1.5">
                                                        <Select value={entry.document_status} onValueChange={(v) => updateTrackingEntry(index, 'document_status', v)}>
                                                            <SelectTrigger className="h-7 text-xs min-w-[130px]">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="No Submission" className="text-xs">No Submission</SelectItem>
                                                                <SelectItem value="Partial Submission" className="text-xs">Partial Submission</SelectItem>
                                                                <SelectItem value="Complete Submission" className="text-xs">Complete Submission</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" size="sm" className="h-7 text-xs min-w-[130px] justify-between font-normal">
                                                                    <span className="truncate">
                                                                        {entry.received_by
                                                                            ? entry.received_by.split(',').length + ' selected'
                                                                            : 'Select RC'}
                                                                    </span>
                                                                    <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-[200px] p-2" align="start">
                                                                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                                                                    {regionalCoordinators.map((rc) => {
                                                                        const selected = (entry.received_by || '').split(',').filter(Boolean);
                                                                        const isChecked = selected.includes(rc.name);
                                                                        return (
                                                                            <label key={rc.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-xs">
                                                                                <Checkbox
                                                                                    checked={isChecked}
                                                                                    onCheckedChange={(checked) => {
                                                                                        const current = (entry.received_by || '').split(',').filter(Boolean);
                                                                                        const updated = checked
                                                                                            ? [...current, rc.name]
                                                                                            : current.filter(n => n !== rc.name);
                                                                                        updateTrackingEntry(index, 'received_by', updated.join(','));
                                                                                    }}
                                                                                />
                                                                                {rc.name}
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <Input
                                                            type="date"
                                                            value={entry.date_received}
                                                            onChange={(e) => updateTrackingEntry(index, 'date_received', e.target.value)}
                                                            className="h-7 text-xs min-w-[120px]"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" size="sm" className="h-7 text-xs min-w-[140px] justify-between font-normal">
                                                                    <span className="truncate">
                                                                        {entry.document_location
                                                                            ? entry.document_location.split(',').length + ' selected'
                                                                            : 'Select location'}
                                                                    </span>
                                                                    <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-[220px] p-0" align="start">
                                                                <Command>
                                                                    <CommandInput placeholder="Search shelf..." className="h-8 text-xs" />
                                                                    <CommandList className="max-h-[300px] overflow-y-auto">
                                                                        <CommandEmpty className="text-xs p-2">No location found.</CommandEmpty>
                                                                        <CommandGroup>
                                                                            {documentLocations.map((loc) => {
                                                                                const selectedLocs = (entry.document_location || '').split(',').filter(Boolean);
                                                                                const isChecked = selectedLocs.includes(loc);
                                                                                return (
                                                                                    <CommandItem
                                                                                        key={loc}
                                                                                        value={loc}
                                                                                        onSelect={() => {
                                                                                            const current = (entry.document_location || '').split(',').filter(Boolean);
                                                                                            const updated = isChecked
                                                                                                ? current.filter(l => l !== loc)
                                                                                                : [...current, loc];
                                                                                            updateTrackingEntry(index, 'document_location', updated.join(','));
                                                                                        }}
                                                                                        className="text-xs"
                                                                                    >
                                                                                        <Check className={`h-3 w-3 mr-1.5 ${isChecked ? 'opacity-100' : 'opacity-0'}`} />
                                                                                        {loc}
                                                                                    </CommandItem>
                                                                                );
                                                                            })}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" size="sm" className="h-7 text-xs min-w-[130px] justify-between font-normal">
                                                                    <span className="truncate">
                                                                        {entry.reviewed_by
                                                                            ? entry.reviewed_by.split(',').length + ' selected'
                                                                            : 'Select RC'}
                                                                    </span>
                                                                    <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-[200px] p-2" align="start">
                                                                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                                                                    {regionalCoordinators.map((rc) => {
                                                                        const selected = (entry.reviewed_by || '').split(',').filter(Boolean);
                                                                        const isChecked = selected.includes(rc.name);
                                                                        return (
                                                                            <label key={rc.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-xs">
                                                                                <Checkbox
                                                                                    checked={isChecked}
                                                                                    onCheckedChange={(checked) => {
                                                                                        const current = (entry.reviewed_by || '').split(',').filter(Boolean);
                                                                                        const updated = checked
                                                                                            ? [...current, rc.name]
                                                                                            : current.filter(n => n !== rc.name);
                                                                                        updateTrackingEntry(index, 'reviewed_by', updated.join(','));
                                                                                    }}
                                                                                />
                                                                                {rc.name}
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <Input
                                                            type="date"
                                                            value={entry.date_reviewed}
                                                            onChange={(e) => updateTrackingEntry(index, 'date_reviewed', e.target.value)}
                                                            className="h-7 text-xs min-w-[120px]"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <Select value={entry.rc_note || ''} onValueChange={(v) => updateTrackingEntry(index, 'rc_note', v)}>
                                                            <SelectTrigger className="h-7 text-xs min-w-[130px]">
                                                                <SelectValue placeholder="Select note" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {RC_NOTES_OPTIONS.map((opt) => (
                                                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <Input
                                                            type="date"
                                                            value={entry.date_endorsement}
                                                            onChange={(e) => updateTrackingEntry(index, 'date_endorsement', e.target.value)}
                                                            className="h-7 text-xs min-w-[120px]"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <Select value={entry.liquidation_status} onValueChange={(v) => updateTrackingEntry(index, 'liquidation_status', v)}>
                                                            <SelectTrigger className="h-7 text-xs min-w-[130px]">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Unliquidated" className="text-xs">Unliquidated</SelectItem>
                                                                <SelectItem value="Partially Liquidated" className="text-xs">Partially Liquidated</SelectItem>
                                                                <SelectItem value="Fully Liquidated" className="text-xs">Fully Liquidated</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        {trackingEntries.length > 1 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => removeTrackingEntry(index)}
                                                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={addTrackingEntry}
                                    className="mt-3 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 shadow-sm"
                                >
                                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                                    Add Entry
                                </Button>
                            </CardContent>
                    </Card>
                </div>

                {/* Running Data Table */}
                <div className="mb-3">
                    <Card>
                        <CardHeader className="pb-2 pt-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-sm font-semibold">Running Data</CardTitle>
                                    <CardDescription className="text-xs">Liquidation running financial data and transmittal references</CardDescription>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={saveRunningData}
                                    disabled={isSavingRunningData}
                                    className="h-7 text-xs px-3"
                                >
                                    <Save className="h-3 w-3 mr-1" />
                                    {isSavingRunningData ? 'Saving...' : 'Save'}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pb-3">
                            <div className="overflow-x-auto -mx-3">
                                <table className="w-full text-xs min-w-[1400px]">
                                    <thead>
                                        <tr className="bg-emerald-50 border-b border-emerald-100">
                                            <th className="text-left font-semibold text-emerald-700 px-2 py-2 text-xs">Total Disbursements</th>
                                            <th className="text-left font-semibold text-emerald-700 px-2 py-2 text-xs">Total Grantees</th>
                                            <th className="text-left font-semibold text-emerald-700 px-2 py-2 text-xs">No. of Grantees Liquidated</th>
                                            <th className="text-left font-semibold text-emerald-700 px-2 py-2 text-xs">Amt w/ Complete Docs</th>
                                            <th className="text-left font-semibold text-emerald-700 px-2 py-2 text-xs">Amt Refunded</th>
                                            <th className="text-left font-semibold text-emerald-700 px-2 py-2 text-xs">Refund OR No.</th>
                                            <th className="text-left font-semibold text-emerald-700 px-2 py-2 text-xs">Total Amt Liquidated</th>
                                            <th className="text-left font-semibold text-emerald-700 px-2 py-2 text-xs">Total Unliquidated Amt</th>
                                            <th className="text-left font-semibold text-emerald-700 px-2 py-2 text-xs">% of Liquidation</th>
                                            <th className="text-left font-semibold text-emerald-700 px-2 py-2 text-xs">Transmittal Ref No.</th>
                                            <th className="text-left font-semibold text-emerald-700 px-2 py-2 text-xs">Group Transmittal Ref No.</th>
                                            <th className="px-2 py-2 w-8 bg-emerald-50"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {runningDataEntries.map((entry, index) => {
                                            const computed = computeRunningTotals[index];
                                            return (
                                                <tr key={entry.id || index} className="border-b last:border-0 hover:bg-emerald-50/50">
                                                    <td className="px-2 py-1.5">
                                                        <span className="font-medium text-xs">
                                                            {computed.remainingDisbursements.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <span className="font-medium text-xs">
                                                            {index === 0 ? totalGrantees : computed.remainingGrantees}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            value={entry.grantees_liquidated ?? ''}
                                                            onChange={(e) => {
                                                                const val = e.target.value ? parseInt(e.target.value) : null;
                                                                if (val !== null && val > computed.remainingGrantees) {
                                                                    toast.error(`Cannot exceed remaining grantees. Only ${computed.remainingGrantees} grantee(s) remaining.`);
                                                                }
                                                                if (val !== null && val < 0) {
                                                                    toast.error('Grantees liquidated cannot be negative.');
                                                                }
                                                                const clamped = val !== null ? Math.min(Math.max(0, val), computed.remainingGrantees) : null;
                                                                updateRunningDataEntry(index, 'grantees_liquidated', clamped);
                                                            }}
                                                            className="h-7 text-xs min-w-[90px]"
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <AmountInput
                                                            value={entry.amount_complete_docs}
                                                            onValueChange={(val) => {
                                                                if (val !== null && val < 0) {
                                                                    toast.error('Amount with Complete Docs cannot be negative.');
                                                                    return;
                                                                }
                                                                if (val !== null) {
                                                                    const refunded = Number(entry.amount_refunded ?? 0);
                                                                    let otherEntriesTotal = 0;
                                                                    runningDataEntries.forEach((e, i) => {
                                                                        if (i !== index) otherEntriesTotal += Number(e.amount_complete_docs ?? 0) + Number(e.amount_refunded ?? 0);
                                                                    });
                                                                    const newCumulative = otherEntriesTotal + val + refunded;
                                                                    if (newCumulative > totalDisbursements) {
                                                                        toast.error(`Total amount liquidated across all entries (${newCumulative.toLocaleString('en-PH', { minimumFractionDigits: 2 })}) would exceed total disbursements (${totalDisbursements.toLocaleString('en-PH', { minimumFractionDigits: 2 })}).`);
                                                                    }
                                                                }
                                                                updateRunningDataEntry(index, 'amount_complete_docs', val);
                                                            }}
                                                            className="h-7 text-xs min-w-[120px]"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <AmountInput
                                                            value={entry.amount_refunded}
                                                            onValueChange={(val) => {
                                                                if (val !== null && val < 0) {
                                                                    toast.error('Amount Refunded cannot be negative.');
                                                                    return;
                                                                }
                                                                if (val !== null) {
                                                                    const completeDocs = Number(entry.amount_complete_docs ?? 0);
                                                                    let otherEntriesTotal = 0;
                                                                    runningDataEntries.forEach((e, i) => {
                                                                        if (i !== index) otherEntriesTotal += Number(e.amount_complete_docs ?? 0) + Number(e.amount_refunded ?? 0);
                                                                    });
                                                                    const newCumulative = otherEntriesTotal + completeDocs + val;
                                                                    if (newCumulative > totalDisbursements) {
                                                                        toast.error(`Total amount liquidated across all entries (${newCumulative.toLocaleString('en-PH', { minimumFractionDigits: 2 })}) would exceed total disbursements (${totalDisbursements.toLocaleString('en-PH', { minimumFractionDigits: 2 })}).`);
                                                                    }
                                                                }
                                                                updateRunningDataEntry(index, 'amount_refunded', val);
                                                            }}
                                                            className="h-7 text-xs min-w-[120px]"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <Input
                                                            type="text"
                                                            value={entry.refund_or_no}
                                                            onChange={(e) => updateRunningDataEntry(index, 'refund_or_no', e.target.value)}
                                                            className="h-7 text-xs min-w-[100px]"
                                                            placeholder="OR No."
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <span className="font-medium text-xs text-green-700">
                                                            {computed.totalAmtLiquidated.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <span className="font-medium text-xs text-orange-600">
                                                            {computed.totalUnliquidated.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <span className="font-medium text-xs">
                                                            {computed.percentage.toFixed(2)}%
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <Input
                                                            type="text"
                                                            value={entry.transmittal_ref_no}
                                                            onChange={(e) => updateRunningDataEntry(index, 'transmittal_ref_no', e.target.value)}
                                                            className="h-7 text-xs min-w-[120px]"
                                                            placeholder="Ref No."
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <Input
                                                            type="text"
                                                            value={entry.group_transmittal_ref_no}
                                                            onChange={(e) => updateRunningDataEntry(index, 'group_transmittal_ref_no', e.target.value)}
                                                            className="h-7 text-xs min-w-[120px]"
                                                            placeholder="Group Ref No."
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        {runningDataEntries.length > 1 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => removeRunningDataEntry(index)}
                                                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <Button
                                size="sm"
                                onClick={addRunningDataEntry}
                                className="mt-3 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 shadow-sm"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1.5" />
                                Add Entry
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs Content - Hidden for now */}
                {false && (
                <Tabs defaultValue="history" className="space-y-4">
                    <TabsList variant="line">
                        <TabsTrigger value="overview">Overview & Files</TabsTrigger>
                        {liquidation.transmittal_reference_no && (
                            <TabsTrigger value="endorsement">Endorsement</TabsTrigger>
                        )}
                        <TabsTrigger value="history">History</TabsTrigger>
                        <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    </TabsList>

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
                )}

                {/* Action Buttons removed - will be added to the details form later */}
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
