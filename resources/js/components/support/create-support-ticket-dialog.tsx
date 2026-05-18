import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useForm } from '@inertiajs/react';
import { Check, ChevronsUpDown, FileText } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

export interface SupportTicketOption {
    value: string;
    label: string;
}

export interface SupportTicketLiquidationOption {
    id: string;
    control_no: string;
    hei_name: string | null;
    program_code: string | null;
    document_status: string | null;
    liquidation_status: string | null;
}

export const SUPPORT_TICKET_CATEGORIES: SupportTicketOption[] = [
    { value: 'liquidation_record', label: 'Liquidation Entry' },
    { value: 'status_follow_up', label: 'Status Follow-up' },
    { value: 'document_upload', label: 'Document Upload' },
    { value: 'account_access', label: 'Account Access' },
    { value: 'technical_issue', label: 'Technical Issue' },
    { value: 'other', label: 'Other Concern' },
];

export const SUPPORT_TICKET_PRIORITIES: SupportTicketOption[] = [
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
];

interface CreateSupportTicketDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    liquidationOptions?: SupportTicketLiquidationOption[];
    categories?: SupportTicketOption[];
    priorities?: SupportTicketOption[];
    initialLiquidationId?: string;
    lockLiquidation?: boolean;
    defaultCategory?: string;
    defaultPriority?: string;
}

export function CreateSupportTicketDialog({
    open,
    onOpenChange,
    liquidationOptions = [],
    categories = SUPPORT_TICKET_CATEGORIES,
    priorities = SUPPORT_TICKET_PRIORITIES,
    initialLiquidationId = '',
    lockLiquidation = false,
    defaultCategory = 'status_follow_up',
    defaultPriority = 'normal',
}: CreateSupportTicketDialogProps) {
    const defaultFormData = useMemo(() => ({
        category: defaultCategory,
        priority: defaultPriority,
        liquidation_id: initialLiquidationId,
        subject: '',
        description: '',
    }), [defaultCategory, defaultPriority, initialLiquidationId]);

    const form = useForm(defaultFormData);

    useEffect(() => {
        if (!open) {
            return;
        }

        form.clearErrors();
        form.setData(defaultFormData);
    }, [open, defaultFormData]);

    const selectedLiquidation = liquidationOptions.find((item) => item.id === form.data.liquidation_id);
    const showLockedLiquidation = lockLiquidation && selectedLiquidation;
    const canSubmit = !form.processing
        && form.data.category.trim().length > 0
        && form.data.priority.trim().length > 0
        && form.data.subject.trim().length > 0
        && form.data.description.trim().length > 0;

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!canSubmit) {
            return;
        }

        form.post(route('support-tickets.store'), {
            preserveScroll: true,
            onSuccess: () => {
                form.clearErrors();
                form.setData(defaultFormData);
                onOpenChange(false);
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create Support Ticket</DialogTitle>
                </DialogHeader>

                <form onSubmit={submit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="support-ticket-category">
                                Category <span aria-hidden="true" className="text-red-500">*</span>
                            </Label>
                            <Select value={form.data.category} onValueChange={(value) => form.setData('category', value)}>
                                <SelectTrigger
                                    id="support-ticket-category"
                                    aria-invalid={!!form.errors.category}
                                    className={form.errors.category ? 'border-red-500' : ''}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((category) => (
                                        <SelectItem key={category.value} value={category.value}>
                                            {category.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {form.errors.category && <p className="mt-1 text-sm text-red-500">{form.errors.category}</p>}
                        </div>

                        <div>
                            <Label htmlFor="support-ticket-priority">
                                Priority <span aria-hidden="true" className="text-red-500">*</span>
                            </Label>
                            <Select value={form.data.priority} onValueChange={(value) => form.setData('priority', value)}>
                                <SelectTrigger
                                    id="support-ticket-priority"
                                    aria-invalid={!!form.errors.priority}
                                    className={form.errors.priority ? 'border-red-500' : ''}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {priorities.map((priority) => (
                                        <SelectItem key={priority.value} value={priority.value}>
                                            {priority.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {form.errors.priority && <p className="mt-1 text-sm text-red-500">{form.errors.priority}</p>}
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="support-ticket-liquidation">Related Liquidation</Label>
                        {showLockedLiquidation ? (
                            <LinkedLiquidationSummary liquidation={selectedLiquidation} />
                        ) : (
                            <LiquidationCombobox
                                value={form.data.liquidation_id || 'none'}
                                onChange={(value) => form.setData('liquidation_id', value === 'none' ? '' : value)}
                                options={liquidationOptions}
                                invalid={!!form.errors.liquidation_id}
                            />
                        )}
                        {!showLockedLiquidation && selectedLiquidation && (
                            <p className="mt-1 text-xs text-muted-foreground">
                                {selectedLiquidation.document_status ?? 'No document status'} - {selectedLiquidation.liquidation_status ?? 'No liquidation status'}
                            </p>
                        )}
                        {form.errors.liquidation_id && <p className="mt-1 text-sm text-red-500">{form.errors.liquidation_id}</p>}
                    </div>

                    <div>
                        <Label htmlFor="support-ticket-subject">
                            Subject <span aria-hidden="true" className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="support-ticket-subject"
                            value={form.data.subject}
                            onChange={(event) => form.setData('subject', event.target.value)}
                            placeholder="Short summary of the concern"
                            required
                            aria-invalid={!!form.errors.subject}
                            className={form.errors.subject ? 'border-red-500' : ''}
                        />
                        {form.errors.subject && <p className="mt-1 text-sm text-red-500">{form.errors.subject}</p>}
                    </div>

                    <div>
                        <Label htmlFor="support-ticket-description">
                            Details <span aria-hidden="true" className="text-red-500">*</span>
                        </Label>
                        <Textarea
                            id="support-ticket-description"
                            value={form.data.description}
                            onChange={(event) => form.setData('description', event.target.value)}
                            rows={5}
                            placeholder="Describe the issue, question, or follow-up request."
                            required
                            aria-invalid={!!form.errors.description}
                            className={form.errors.description ? 'border-red-500' : ''}
                        />
                        {form.errors.description && <p className="mt-1 text-sm text-red-500">{form.errors.description}</p>}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={form.processing}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!canSubmit}>
                            {form.processing ? 'Creating...' : 'Create Ticket'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function LiquidationCombobox({
    value,
    onChange,
    options,
    invalid,
}: {
    value: string;
    onChange: (value: string) => void;
    options: SupportTicketLiquidationOption[];
    invalid: boolean;
}) {
    const [open, setOpen] = useState(false);
    const selected = options.find((option) => option.id === value);
    const selectedLabel = selected
        ? liquidationLabel(selected)
        : 'No specific liquidation';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id="support-ticket-liquidation"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-invalid={invalid}
                    className={cn(
                        'mt-1 h-9 w-full justify-between px-3 font-normal',
                        invalid && 'border-red-500',
                    )}
                >
                    <span className={cn('truncate', !selected && 'text-muted-foreground')}>
                        {selectedLabel}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="z-[60] w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search liquidation..." />
                    <CommandList>
                        <CommandEmpty>No liquidation found.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value="No specific liquidation"
                                onSelect={() => {
                                    onChange('none');
                                    setOpen(false);
                                }}
                            >
                                <Check className={cn('h-4 w-4', value === 'none' ? 'opacity-100' : 'opacity-0')} />
                                No specific liquidation
                            </CommandItem>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.id}
                                    value={liquidationSearchValue(option)}
                                    onSelect={() => {
                                        onChange(option.id);
                                        setOpen(false);
                                    }}
                                >
                                    <Check className={cn('h-4 w-4', value === option.id ? 'opacity-100' : 'opacity-0')} />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm">{liquidationLabel(option)}</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {option.document_status ?? 'No document status'} - {option.liquidation_status ?? 'No liquidation status'}
                                        </p>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function liquidationLabel(liquidation: SupportTicketLiquidationOption) {
    return `${liquidation.control_no} - ${liquidation.program_code ?? 'Program'} - ${liquidation.hei_name ?? 'No HEI'}`;
}

function liquidationSearchValue(liquidation: SupportTicketLiquidationOption) {
    return [
        liquidation.control_no,
        liquidation.program_code,
        liquidation.hei_name,
        liquidation.document_status,
        liquidation.liquidation_status,
    ].filter(Boolean).join(' ');
}

function LinkedLiquidationSummary({ liquidation }: { liquidation: SupportTicketLiquidationOption }) {
    return (
        <div className="mt-1 rounded-md border bg-muted/30 p-3">
            <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{liquidation.control_no}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {liquidation.program_code ?? 'Program'} - {liquidation.hei_name ?? 'No HEI'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {liquidation.document_status && (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                Docs: {liquidation.document_status}
                            </Badge>
                        )}
                        {liquidation.liquidation_status && (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                Status: {liquidation.liquidation_status}
                            </Badge>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
