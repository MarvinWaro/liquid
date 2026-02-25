import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import axios from 'axios';

interface Program {
    id: string;
    name: string;
    code: string;
}

interface HEIOption {
    id: string;
    uii: string;
    name: string;
}

interface AcademicYearOption {
    id: string;
    code: string;
    name: string;
}

interface CreateLiquidationModalProps {
    isOpen: boolean;
    onClose: () => void;
    programs: Program[];
    academicYears: AcademicYearOption[];
    heis: HEIOption[];
    onSuccess: () => void;
}

const SEMESTERS = [
    { value: '1st Semester', label: '1st Semester' },
    { value: '2nd Semester', label: '2nd Semester' },
    { value: 'Summer', label: 'Summer' },
];

const DOCUMENT_STATUSES = [
    { value: 'NONE', label: 'No Submission' },
    { value: 'PARTIAL', label: 'Partial Submission' },
    { value: 'COMPLETE', label: 'Complete Submission' },
];

// Matches the Excel list provided
const RC_NOTES_OPTIONS = [
    { value: 'For Review', label: 'For Review' },
    { value: 'For Compliance', label: 'For Compliance' },
    { value: 'For Endorsement', label: 'For Endorsement' },
    { value: 'Fully Endorsed', label: 'Fully Endorsed' },
    { value: 'Partially Endorsed', label: 'Partially Endorsed' },
];

export function CreateLiquidationModal({
    isOpen,
    onClose,
    programs,
    academicYears,
    heis,
    onSuccess,
}: CreateLiquidationModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [heiPopoverOpen, setHeiPopoverOpen] = useState(false);
    const [selectedHei, setSelectedHei] = useState<HEIOption | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const [formData, setFormData] = useState({
        program_id: '',
        uii: '',
        date_fund_released: '',
        due_date: '',
        academic_year_id: '',
        semester: '',
        batch_no: '',
        dv_control_no: '',
        number_of_grantees: '',
        total_disbursements: '',
        total_amount_liquidated: '',
        document_status: '',
        rc_notes: '',
    });

    // Reset form when modal closes
    useEffect(() => {
        if (!isOpen) {
            setFormData({
                program_id: '',
                uii: '',
                date_fund_released: '',
                due_date: '',
                academic_year_id: '',
                semester: '',
                batch_no: '',
                dv_control_no: '',
                number_of_grantees: '',
                total_disbursements: '',
                total_amount_liquidated: '',
                document_status: '',
                rc_notes: '',
            });
            setSelectedHei(null);
            setFieldErrors({});
        }
    }, [isOpen]);

    const handleSelectHei = (hei: HEIOption) => {
        setSelectedHei(hei);
        setFormData(prev => ({ ...prev, uii: hei.uii }));
        setHeiPopoverOpen(false);
        if (fieldErrors.uii) {
            setFieldErrors(prev => {
                const updated = { ...prev };
                delete updated.uii;
                return updated;
            });
        }
    };

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear field error when user starts typing
        if (fieldErrors[field]) {
            setFieldErrors(prev => {
                const updated = { ...prev };
                delete updated[field];
                return updated;
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFieldErrors({});

        if (!selectedHei) {
            setFieldErrors({ uii: 'Please select an HEI' });
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await axios.post(route('liquidation.store'), formData);

            if (response.data.success) {
                toast.success('Liquidation created successfully');
                onSuccess();
                onClose();
            }
        } catch (error: any) {
            if (error.response?.data?.errors) {
                // Map Laravel validation errors to field errors
                const errors: Record<string, string> = {};
                Object.entries(error.response.data.errors).forEach(([field, messages]: [string, any]) => {
                    errors[field] = Array.isArray(messages) ? messages[0] : messages;
                });
                setFieldErrors(errors);
            } else {
                const message = error.response?.data?.message || 'Failed to create liquidation';
                toast.error(message);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create Liquidation Report</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Program */}
                        <div className="space-y-2">
                            <Label htmlFor="program_id">Program *</Label>
                            <Select
                                value={formData.program_id}
                                onValueChange={(value) => handleInputChange('program_id', value)}
                            >
                                <SelectTrigger className={fieldErrors.program_id ? 'border-red-500' : ''}>
                                    <SelectValue placeholder="Select program" />
                                </SelectTrigger>
                                <SelectContent>
                                    {programs.map((program) => (
                                        <SelectItem key={program.id} value={program.id}>
                                            {program.code} - {program.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {fieldErrors.program_id && (
                                <p className="text-sm text-red-500">{fieldErrors.program_id}</p>
                            )}
                        </div>

                        {/* HEI (searchable dropdown with UII + Name) */}
                        <div className="space-y-2">
                            <Label>UII *</Label>
                            <Popover open={heiPopoverOpen} onOpenChange={setHeiPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={heiPopoverOpen}
                                        className={cn(
                                            'w-full justify-between font-normal',
                                            !selectedHei && 'text-muted-foreground',
                                            fieldErrors.uii && 'border-red-500',
                                        )}
                                    >
                                        <span className="truncate">
                                            {selectedHei
                                                ? `${selectedHei.uii} — ${selectedHei.name}`
                                                : 'Search HEI by UII or name...'}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Type UII or school name..." />
                                        <CommandList>
                                            <CommandEmpty>No HEI found.</CommandEmpty>
                                            <CommandGroup>
                                                {heis.map((hei) => (
                                                    <CommandItem
                                                        key={hei.id}
                                                        value={`${hei.uii} ${hei.name}`}
                                                        onSelect={() => handleSelectHei(hei)}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                'mr-2 h-4 w-4',
                                                                selectedHei?.id === hei.id ? 'opacity-100' : 'opacity-0',
                                                            )}
                                                        />
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{hei.uii}</span>
                                                            <span className="text-xs text-muted-foreground">{hei.name}</span>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {fieldErrors.uii && (
                                <p className="text-sm text-red-500">{fieldErrors.uii}</p>
                            )}
                        </div>

                        {/* HEI Name (auto-filled, read-only) */}
                        <div className="space-y-2">
                            <Label htmlFor="hei_name">HEI Name</Label>
                            <Input
                                id="hei_name"
                                value={selectedHei?.name || ''}
                                disabled
                                placeholder="Auto-filled from selection"
                                className={`bg-muted ${selectedHei ? 'border-green-500 text-foreground' : ''}`}
                            />
                        </div>

                        {/* Date of Fund Released */}
                        <div className="space-y-2">
                            <Label htmlFor="date_fund_released">Date of Fund Released *</Label>
                            <Input
                                id="date_fund_released"
                                type="date"
                                value={formData.date_fund_released}
                                onChange={(e) => handleInputChange('date_fund_released', e.target.value)}
                                className={fieldErrors.date_fund_released ? 'border-red-500' : ''}
                            />
                            {fieldErrors.date_fund_released && (
                                <p className="text-sm text-red-500">{fieldErrors.date_fund_released}</p>
                            )}
                        </div>

                        {/* Due Date */}
                        <div className="space-y-2">
                            <Label htmlFor="due_date">Due Date</Label>
                            <Input
                                id="due_date"
                                type="date"
                                value={formData.due_date}
                                onChange={(e) => handleInputChange('due_date', e.target.value)}
                                className={fieldErrors.due_date ? 'border-red-500' : ''}
                            />
                            {fieldErrors.due_date && (
                                <p className="text-sm text-red-500">{fieldErrors.due_date}</p>
                            )}
                        </div>

                        {/* Academic Year */}
                        <div className="space-y-2">
                            <Label htmlFor="academic_year_id">Academic Year *</Label>
                            <Select
                                value={formData.academic_year_id}
                                onValueChange={(value) => handleInputChange('academic_year_id', value)}
                            >
                                <SelectTrigger className={fieldErrors.academic_year_id ? 'border-red-500' : ''}>
                                    <SelectValue placeholder="Select academic year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {academicYears.map((ay) => (
                                        <SelectItem key={ay.id} value={ay.id}>
                                            {ay.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {fieldErrors.academic_year_id && (
                                <p className="text-sm text-red-500">{fieldErrors.academic_year_id}</p>
                            )}
                        </div>

                        {/* Semester */}
                        <div className="space-y-2">
                            <Label htmlFor="semester">Semester *</Label>
                            <Select
                                value={formData.semester}
                                onValueChange={(value) => handleInputChange('semester', value)}
                            >
                                <SelectTrigger className={fieldErrors.semester ? 'border-red-500' : ''}>
                                    <SelectValue placeholder="Select semester" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SEMESTERS.map((sem) => (
                                        <SelectItem key={sem.value} value={sem.value}>
                                            {sem.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {fieldErrors.semester && (
                                <p className="text-sm text-red-500">{fieldErrors.semester}</p>
                            )}
                        </div>

                        {/* Batch No */}
                        <div className="space-y-2">
                            <Label htmlFor="batch_no">Batch No.</Label>
                            <Input
                                id="batch_no"
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.batch_no}
                                onChange={(e) => handleInputChange('batch_no', e.target.value)}
                                placeholder="e.g., 1, 2, 3"
                                className={fieldErrors.batch_no ? 'border-red-500' : ''}
                            />
                            {fieldErrors.batch_no && (
                                <p className="text-sm text-red-500">{fieldErrors.batch_no}</p>
                            )}
                        </div>

                        {/* DV Control No */}
                        <div className="space-y-2">
                            <Label htmlFor="dv_control_no">DV Control No. *</Label>
                            <Input
                                id="dv_control_no"
                                value={formData.dv_control_no}
                                onChange={(e) => handleInputChange('dv_control_no', e.target.value)}
                                placeholder="e.g., 2025-0001"
                                className={fieldErrors.dv_control_no ? 'border-red-500' : ''}
                            />
                            {fieldErrors.dv_control_no && (
                                <p className="text-sm text-red-500">{fieldErrors.dv_control_no}</p>
                            )}
                        </div>

                        {/* Number of Grantees */}
                        <div className="space-y-2">
                            <Label htmlFor="number_of_grantees">Number of Grantees</Label>
                            <Input
                                id="number_of_grantees"
                                type="number"
                                min="0"
                                value={formData.number_of_grantees}
                                onChange={(e) => handleInputChange('number_of_grantees', e.target.value)}
                                placeholder="Enter number"
                                className={fieldErrors.number_of_grantees ? 'border-red-500' : ''}
                            />
                            {fieldErrors.number_of_grantees && (
                                <p className="text-sm text-red-500">{fieldErrors.number_of_grantees}</p>
                            )}
                        </div>

                        {/* Total Disbursements */}
                        <div className="space-y-2">
                            <Label htmlFor="total_disbursements">Total Disbursements *</Label>
                            <Input
                                id="total_disbursements"
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.total_disbursements}
                                onChange={(e) => handleInputChange('total_disbursements', e.target.value)}
                                placeholder="Enter amount"
                                className={fieldErrors.total_disbursements ? 'border-red-500' : ''}
                            />
                            {fieldErrors.total_disbursements && (
                                <p className="text-sm text-red-500">{fieldErrors.total_disbursements}</p>
                            )}
                        </div>

                        {/* Total Amount Liquidated */}
                        <div className="space-y-2">
                            <Label htmlFor="total_amount_liquidated">Total Amount Liquidated</Label>
                            <Input
                                id="total_amount_liquidated"
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.total_amount_liquidated}
                                onChange={(e) => handleInputChange('total_amount_liquidated', e.target.value)}
                                placeholder="Enter amount (default: 0)"
                                className={fieldErrors.total_amount_liquidated ? 'border-red-500' : ''}
                            />
                            {fieldErrors.total_amount_liquidated && (
                                <p className="text-sm text-red-500">{fieldErrors.total_amount_liquidated}</p>
                            )}
                        </div>

                        {/* Status of Documents */}
                        <div className="space-y-2">
                            <Label htmlFor="document_status">Status of Documents</Label>
                            <Select
                                value={formData.document_status}
                                onValueChange={(value) => handleInputChange('document_status', value)}
                            >
                                <SelectTrigger className={fieldErrors.document_status ? 'border-red-500' : ''}>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {DOCUMENT_STATUSES.map((status) => (
                                        <SelectItem key={status.value} value={status.value}>
                                            {status.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {fieldErrors.document_status && (
                                <p className="text-sm text-red-500">{fieldErrors.document_status}</p>
                            )}
                        </div>

                        {/* Regional Coordinator's Note (Previously RC Notes) */}
                        <div className="space-y-2">
                            <Label htmlFor="rc_notes">Regional Coordinator's Note</Label>
                            <Select
                                value={formData.rc_notes}
                                onValueChange={(value) => handleInputChange('rc_notes', value)}
                            >
                                <SelectTrigger className={fieldErrors.rc_notes ? 'border-red-500' : ''}>
                                    <SelectValue placeholder="Select note (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {RC_NOTES_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {fieldErrors.rc_notes && (
                                <p className="text-sm text-red-500">{fieldErrors.rc_notes}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || !selectedHei}
                        >
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Liquidation
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
