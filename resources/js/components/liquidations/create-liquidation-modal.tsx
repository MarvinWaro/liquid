import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
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
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { addDays, format, parse, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import axios from 'axios';
import {
    SEMESTERS,
    DOCUMENT_STATUSES,
    type Program,
    type HEIOption,
    type AcademicYearOption,
    type RcNoteStatusOption,
} from './liquidation-constants';

/**
 * Renders program items grouped by parent program.
 * Top-level programs without children render as plain items.
 * Parent programs render as group labels with their children as selectable items.
 */
function GroupedProgramItems({ programs }: { programs: Program[] }) {
    // Parents = programs that have children (not selectable themselves)
    const parents = programs.filter((p) => !p.parent_id && (p.children_count ?? 0) > 0);
    // Standalone = top-level programs with no children (selectable)
    const standalone = programs.filter((p) => !p.parent_id && (p.children_count ?? 0) === 0 && p.is_selectable !== false);
    // Children grouped by parent_id
    const childrenByParent = new Map<string, Program[]>();
    programs.filter((p) => p.parent_id).forEach((p) => {
        const list = childrenByParent.get(p.parent_id!) || [];
        list.push(p);
        childrenByParent.set(p.parent_id!, list);
    });

    return (
        <>
            {standalone.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                    {p.code} — {p.name}
                </SelectItem>
            ))}
            {parents.map((parent) => {
                const children = childrenByParent.get(parent.id) || [];
                if (children.length === 0) return null;
                return (
                    <SelectGroup key={parent.id}>
                        <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {parent.code} — {parent.name}
                        </SelectLabel>
                        {children.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                                {p.code} — {p.name}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                );
            })}
        </>
    );
}

interface CreateLiquidationModalProps {
    isOpen: boolean;
    onClose: () => void;
    programs: Program[];
    academicYears: AcademicYearOption[];
    rcNoteStatuses: RcNoteStatusOption[];
    heis: HEIOption[];
    onSuccess: () => void;
}

export function CreateLiquidationModal({
    isOpen,
    onClose,
    programs,
    academicYears,
    rcNoteStatuses,
    heis,
    onSuccess,
}: CreateLiquidationModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [heiPopoverOpen, setHeiPopoverOpen] = useState(false);
    const [fundReleasedCalOpen, setFundReleasedCalOpen] = useState(false);
    const [dueDateCalOpen, setDueDateCalOpen] = useState(false);
    const [heiSearch, setHeiSearch] = useState('');
    const [selectedHei, setSelectedHei] = useState<HEIOption | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const MAX_VISIBLE_HEIS = 50;

    const filteredHeis = useMemo(() => {
        const search = heiSearch.trim().toLowerCase();
        if (!search) return heis.slice(0, MAX_VISIBLE_HEIS);
        return heis
            .filter(hei =>
                hei.uii.toLowerCase().includes(search) ||
                hei.name.toLowerCase().includes(search)
            )
            .slice(0, MAX_VISIBLE_HEIS);
    }, [heis, heiSearch]);

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
            setHeiSearch('');
            setFieldErrors({});
            setControlNoManuallyEdited(false);
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

    // Get due date days based on program: STUFAPS sub-programs = 30 days, others = 90 days
    const getDueDateDays = (programId: string): number => {
        const program = programs.find(p => p.id === programId);
        return program?.parent_id ? 30 : 90;
    };

    // Program code prefix for control number
    const controlNoPrefix = useMemo(() => {
        const program = programs.find(p => p.id === formData.program_id);
        return program ? `${program.code}-` : '';
    }, [formData.program_id, programs]);

    // Auto-fetch next control number when program + date_fund_released are set
    const [isAutoFillingControlNo, setIsAutoFillingControlNo] = useState(false);
    const [controlNoManuallyEdited, setControlNoManuallyEdited] = useState(false);

    useEffect(() => {
        if (!formData.program_id || !formData.date_fund_released || controlNoManuallyEdited) return;

        const year = new Date(formData.date_fund_released + 'T00:00:00').getFullYear();
        if (isNaN(year)) return;

        const controller = new AbortController();
        setIsAutoFillingControlNo(true);

        axios.get(route('liquidation.next-control-no'), {
            params: { program_id: formData.program_id, year },
            signal: controller.signal,
        })
        .then(res => {
            const fullControlNo = res.data.control_no as string;
            // Strip the program prefix to get just the suffix (e.g., "2026-0001")
            const prefix = controlNoPrefix;
            const suffix = fullControlNo.startsWith(prefix) ? fullControlNo.slice(prefix.length) : fullControlNo;
            setFormData(prev => ({ ...prev, dv_control_no: suffix }));
        })
        .catch(() => {})
        .finally(() => setIsAutoFillingControlNo(false));

        return () => controller.abort();
    }, [formData.program_id, formData.date_fund_released, controlNoManuallyEdited, controlNoPrefix]);

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            // Reset control no and auto-fill flag when program changes
            if (field === 'program_id') {
                updated.dv_control_no = '';
                setControlNoManuallyEdited(false);
            }
            // Reset auto-fill flag when date changes
            if (field === 'date_fund_released') {
                setControlNoManuallyEdited(false);
            }
            // Auto-compute due date based on program type
            const shouldRecomputeDueDate = field === 'date_fund_released' || field === 'program_id';
            const releaseDate = field === 'date_fund_released' ? value : updated.date_fund_released;
            if (shouldRecomputeDueDate && releaseDate) {
                const released = parse(releaseDate, 'yyyy-MM-dd', new Date());
                if (isValid(released)) {
                    const days = getDueDateDays(updated.program_id);
                    const due = addDays(released, days);
                    updated.due_date = format(due, 'yyyy-MM-dd');
                }
            }
            return updated;
        });
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
            const submitData = {
                ...formData,
                dv_control_no: formData.dv_control_no.trim()
                    ? controlNoPrefix + formData.dv_control_no.trim()
                    : null,
            };
            const response = await axios.post(route('liquidation.store'), submitData);

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
                                    <GroupedProgramItems programs={programs} />
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
                                <PopoverContent
                                    className="w-[--radix-popover-trigger-width] p-0"
                                    align="start"
                                    onWheel={(e) => e.stopPropagation()}
                                    onTouchMove={(e) => e.stopPropagation()}
                                >
                                    <Command shouldFilter={false}>
                                        <CommandInput
                                            placeholder="Type UII or school name..."
                                            value={heiSearch}
                                            onValueChange={setHeiSearch}
                                        />
                                        <CommandList className="max-h-[200px] overflow-y-auto overscroll-contain">
                                            <CommandEmpty>No HEI found.</CommandEmpty>
                                            <CommandGroup>
                                                {filteredHeis.map((hei) => (
                                                    <CommandItem
                                                        key={hei.id}
                                                        value={hei.id}
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
                                            {!heiSearch && heis.length > MAX_VISIBLE_HEIS && (
                                                <p className="p-2 text-center text-xs text-muted-foreground">
                                                    Type to search {heis.length.toLocaleString()} HEIs...
                                                </p>
                                            )}
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
                            <Label>Date of Fund Released *</Label>
                            <Popover open={fundReleasedCalOpen} onOpenChange={setFundReleasedCalOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            'w-full justify-start text-left font-normal',
                                            !formData.date_fund_released && 'text-muted-foreground',
                                            fieldErrors.date_fund_released && 'border-red-500',
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {formData.date_fund_released
                                            ? format(parse(formData.date_fund_released, 'yyyy-MM-dd', new Date()), 'MMM dd, yyyy')
                                            : 'Pick a date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={formData.date_fund_released ? parse(formData.date_fund_released, 'yyyy-MM-dd', new Date()) : undefined}
                                        onSelect={(date) => {
                                            handleInputChange('date_fund_released', date ? format(date, 'yyyy-MM-dd') : '');
                                            setFundReleasedCalOpen(false);
                                        }}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                            {fieldErrors.date_fund_released && (
                                <p className="text-sm text-red-500">{fieldErrors.date_fund_released}</p>
                            )}
                        </div>

                        {/* Due Date */}
                        <div className="space-y-2">
                            <Label>Due Date</Label>
                            <Popover open={dueDateCalOpen} onOpenChange={setDueDateCalOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            'w-full justify-start text-left font-normal',
                                            !formData.due_date && 'text-muted-foreground',
                                            fieldErrors.due_date && 'border-red-500',
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {formData.due_date
                                            ? format(parse(formData.due_date, 'yyyy-MM-dd', new Date()), 'MMM dd, yyyy')
                                            : 'Pick a date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={formData.due_date ? parse(formData.due_date, 'yyyy-MM-dd', new Date()) : undefined}
                                        onSelect={(date) => {
                                            handleInputChange('due_date', date ? format(date, 'yyyy-MM-dd') : '');
                                            setDueDateCalOpen(false);
                                        }}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
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
                            <Label htmlFor="semester">Semester</Label>
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

                        {/* Control No */}
                        <div className="space-y-2">
                            <Label htmlFor="dv_control_no">Control No.</Label>
                            <div className={`flex items-center rounded-md border bg-background font-mono text-sm ${fieldErrors.dv_control_no ? 'border-red-500' : 'border-input'}`}>
                                {controlNoPrefix && (
                                    <span className="px-3 py-2 text-muted-foreground bg-muted border-r border-input rounded-l-md select-none">
                                        {controlNoPrefix}
                                    </span>
                                )}
                                <Input
                                    id="dv_control_no"
                                    value={formData.dv_control_no}
                                    onChange={(e) => {
                                        setControlNoManuallyEdited(true);
                                        handleInputChange('dv_control_no', e.target.value.toUpperCase());
                                    }}
                                    placeholder={!formData.program_id ? 'Select program first' : 'Auto-generated'}
                                    disabled={!formData.program_id}
                                    className="border-0 shadow-none focus-visible:ring-0 font-mono"
                                />
                                {isAutoFillingControlNo && (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2 text-muted-foreground" />
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">Leave blank to auto-generate from program &amp; date</p>
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
                            <CurrencyInput
                                id="total_disbursements"
                                value={formData.total_disbursements}
                                onValueChange={(v) => handleInputChange('total_disbursements', v)}
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
                            <CurrencyInput
                                id="total_amount_liquidated"
                                value={formData.total_amount_liquidated}
                                onValueChange={(v) => handleInputChange('total_amount_liquidated', v)}
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
                                    {rcNoteStatuses.map((option) => (
                                        <SelectItem key={option.id} value={option.name}>
                                            {option.name}
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
