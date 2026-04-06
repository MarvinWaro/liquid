import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
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
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from '@/components/ui/tooltip';
import { Loader2, Plus, Trash2, AlertCircle, Copy, Save, FileWarning, ChevronsUpDown, Check, CalendarIcon } from 'lucide-react';
import { addDays, format, parse, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import axios from 'axios';
import { usePage } from '@inertiajs/react';
import { type SharedData } from '@/types';
import {
    SEMESTERS,
    DOCUMENT_STATUSES,
    type Program,
    type HEIOption,
    type AcademicYearOption,
    type RcNoteStatusOption,
} from './liquidation-constants';

// --- Draft persistence (scoped per user) -------------------------------

const DRAFT_KEY_PREFIX = 'liquidation_bulk_entry_draft';

interface DraftRow {
    program_id: string;
    uii: string;
    date_fund_released: string;
    due_date: string;
    academic_year_id: string;
    semester: string;
    batch_no: string;
    dv_control_no: string;
    number_of_grantees: string;
    total_disbursements: string;
    total_amount_liquidated: string;
    document_status: string;
    rc_notes: string;
}

function getDraftKey(userId: number | string) {
    return `${DRAFT_KEY_PREFIX}_${userId}`;
}

function saveDraftToStorage(userId: number | string, rows: BulkEntryRow[]) {
    const draft: DraftRow[] = rows.map(({ program_id, uii, date_fund_released, due_date, academic_year_id, semester, batch_no, dv_control_no, number_of_grantees, total_disbursements, total_amount_liquidated, document_status, rc_notes }) => ({
        program_id, uii, date_fund_released, due_date, academic_year_id, semester,
        batch_no, dv_control_no, number_of_grantees, total_disbursements, total_amount_liquidated,
        document_status, rc_notes,
    }));
    localStorage.setItem(getDraftKey(userId), JSON.stringify({ rows: draft, savedAt: new Date().toISOString() }));
}

function loadDraftFromStorage(userId: number | string): { rows: DraftRow[]; savedAt: string } | null {
    try {
        const raw = localStorage.getItem(getDraftKey(userId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.rows) && parsed.rows.length > 0) return parsed;
    } catch { /* ignore corrupt data */ }
    return null;
}

function clearDraftFromStorage(userId: number | string) {
    localStorage.removeItem(getDraftKey(userId));
}

// --- Types -------------------------------------------------------------

interface BulkEntryRow {
    id: string;
    program_id: string;
    uii: string;
    hei_name: string;
    date_fund_released: string;
    due_date: string;
    academic_year_id: string;
    semester: string;
    batch_no: string;
    dv_control_no: string;
    number_of_grantees: string;
    total_disbursements: string;
    total_amount_liquidated: string;
    document_status: string;
    rc_notes: string;
}

/** Grouped program items for the compact bulk-entry select (shows code only). */
function BulkProgramItems({ programs }: { programs: Program[] }) {
    const parents = programs.filter((p) => !p.parent_id && (p.children_count ?? 0) > 0);
    const standalone = programs.filter((p) => !p.parent_id && (p.children_count ?? 0) === 0 && p.is_selectable !== false);
    const childrenByParent = new Map<string, Program[]>();
    programs.filter((p) => p.parent_id).forEach((p) => {
        const list = childrenByParent.get(p.parent_id!) || [];
        list.push(p);
        childrenByParent.set(p.parent_id!, list);
    });

    return (
        <>
            {standalone.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.code}</SelectItem>
            ))}
            {parents.map((parent) => {
                const children = childrenByParent.get(parent.id) || [];
                if (children.length === 0) return null;
                return (
                    <SelectGroup key={parent.id}>
                        <SelectLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{parent.code}</SelectLabel>
                        {children.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.code}</SelectItem>
                        ))}
                    </SelectGroup>
                );
            })}
        </>
    );
}

interface BulkEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    programs: Program[];
    academicYears: AcademicYearOption[];
    rcNoteStatuses: RcNoteStatusOption[];
    heis: HEIOption[];
    onSuccess: () => void;
}

// --- Helpers -----------------------------------------------------------

const createEmptyRow = (): BulkEntryRow => ({
    id: crypto.randomUUID(),
    program_id: '',
    uii: '',
    hei_name: '',
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

function rowHasData(r: BulkEntryRow): boolean {
    return !!(r.program_id || r.uii || r.date_fund_released || r.due_date ||
        r.academic_year_id || r.semester || r.number_of_grantees ||
        (r.total_disbursements && r.total_disbursements !== '0.00') ||
        (r.total_amount_liquidated && r.total_amount_liquidated !== '0.00') ||
        r.document_status || r.rc_notes);
}

function hydrateRow(draft: DraftRow, heiMap: Map<string, HEIOption>): BulkEntryRow {
    const match = heiMap.get(draft.uii.trim().toLowerCase());
    return {
        ...draft,
        id: crypto.randomUUID(),
        hei_name: match?.name || '',
    };
}

// --- HEI Combobox for table cells --------------------------------------

const MAX_VISIBLE = 50;

function HeiComboboxCell({
    heis,
    selectedUii,
    heiName,
    onSelect,
}: {
    heis: HEIOption[];
    selectedUii: string;
    heiName: string;
    onSelect: (hei: HEIOption) => void;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return heis.slice(0, MAX_VISIBLE);
        return heis
            .filter(h => h.uii.toLowerCase().includes(q) || h.name.toLowerCase().includes(q))
            .slice(0, MAX_VISIBLE);
    }, [heis, search]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        'h-7 w-full justify-between px-2 text-xs font-normal',
                        !selectedUii && 'text-muted-foreground',
                        selectedUii && heiName ? 'border-green-400' : selectedUii ? 'border-amber-400' : '',
                    )}
                >
                    <span className="truncate font-mono">
                        {selectedUii || 'Select HEI...'}
                    </span>
                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start" onWheel={(e) => e.stopPropagation()}>
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Search UII or name..."
                        value={search}
                        onValueChange={setSearch}
                        className="h-8 text-xs"
                    />
                    <CommandList onWheel={(e) => e.stopPropagation()}>
                        <CommandEmpty className="py-2 text-center text-xs">No HEI found.</CommandEmpty>
                        <CommandGroup>
                            {filtered.map(hei => (
                                <CommandItem
                                    key={hei.id}
                                    value={hei.id}
                                    onSelect={() => {
                                        onSelect(hei);
                                        setOpen(false);
                                        setSearch('');
                                    }}
                                    className="text-xs"
                                >
                                    <Check className={cn('mr-1.5 h-3 w-3', selectedUii === hei.uii ? 'opacity-100' : 'opacity-0')} />
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-mono font-medium">{hei.uii}</span>
                                        <span className="text-[10px] text-muted-foreground truncate">{hei.name}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        {!search && heis.length > MAX_VISIBLE && (
                            <p className="p-1.5 text-center text-[10px] text-muted-foreground">
                                Type to search {heis.length.toLocaleString()} HEIs...
                            </p>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

// --- Cell Tooltip wrapper -----------------------------------------------

function CellTooltip({ content, children }: { content: string; children: React.ReactNode }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            {content && (
                <TooltipContent side="top" className="max-w-xs break-words">{content}</TooltipContent>
            )}
        </Tooltip>
    );
}

// --- Date Picker for table cells ----------------------------------------

function DatePickerCell({
    value,
    onChange,
    placeholder = 'Pick date',
}: {
    value: string; // YYYY-MM-DD or empty
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    const [open, setOpen] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    const dateValue = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;
    const displayText = dateValue && isValid(dateValue) ? format(dateValue, 'MMM dd, yyyy') : '';

    const handleTextSubmit = () => {
        const trimmed = textInput.trim();
        if (!trimmed) {
            setIsTyping(false);
            return;
        }

        // Try common date formats: MM/DD/YYYY, M/D/YYYY, MM-DD-YYYY, YYYY-MM-DD
        const formats = ['MM/dd/yyyy', 'M/d/yyyy', 'MM-dd-yyyy', 'yyyy-MM-dd'];
        for (const fmt of formats) {
            const parsed = parse(trimmed, fmt, new Date());
            if (isValid(parsed)) {
                const year = parsed.getFullYear();
                if (year >= 1900 && year <= 2100) {
                    onChange(format(parsed, 'yyyy-MM-dd'));
                    setIsTyping(false);
                    setTextInput('');
                    return;
                }
            }
        }
        // Invalid — keep input visible so user can fix
    };

    if (isTyping) {
        return (
            <Input
                autoFocus
                className="h-7 text-xs px-2"
                placeholder="MM/DD/YYYY"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTextSubmit();
                    if (e.key === 'Escape') { setIsTyping(false); setTextInput(''); }
                }}
                onBlur={handleTextSubmit}
            />
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        'h-7 w-full justify-start px-2 text-xs font-normal',
                        !value && 'text-muted-foreground',
                    )}
                    onDoubleClick={(e) => {
                        e.preventDefault();
                        setTextInput(value || '');
                        setIsTyping(true);
                        setOpen(false);
                    }}
                >
                    <CalendarIcon className="h-3 w-3 shrink-0 opacity-50 mr-1.5" />
                    <span className="truncate">{displayText || placeholder}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className="p-2 border-b">
                    <Input
                        className="h-7 text-xs"
                        placeholder="Type date: MM/DD/YYYY"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const val = (e.target as HTMLInputElement).value.trim();
                                if (!val) return;
                                const formats = ['MM/dd/yyyy', 'M/d/yyyy', 'MM-dd-yyyy', 'yyyy-MM-dd'];
                                for (const fmt of formats) {
                                    const parsed = parse(val, fmt, new Date());
                                    if (isValid(parsed) && parsed.getFullYear() >= 1900 && parsed.getFullYear() <= 2100) {
                                        onChange(format(parsed, 'yyyy-MM-dd'));
                                        setOpen(false);
                                        return;
                                    }
                                }
                            }
                        }}
                    />
                </div>
                <Calendar
                    mode="single"
                    captionLayout="dropdown"
                    startMonth={new Date(2000, 0)}
                    endMonth={new Date(2040, 11)}
                    selected={dateValue && isValid(dateValue) ? dateValue : undefined}
                    onSelect={(date) => {
                        if (date) {
                            onChange(format(date, 'yyyy-MM-dd'));
                        } else {
                            onChange('');
                        }
                        setOpen(false);
                    }}
                    defaultMonth={dateValue && isValid(dateValue) ? dateValue : new Date()}
                />
            </PopoverContent>
        </Popover>
    );
}

// --- Component ---------------------------------------------------------

export function BulkEntryModal({
    isOpen,
    onClose,
    programs,
    academicYears,
    rcNoteStatuses,
    heis,
    onSuccess,
}: BulkEntryModalProps) {
    const [rows, setRows] = useState<BulkEntryRow[]>([createEmptyRow()]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
    const [hasDraft, setHasDraft] = useState(false);

    const { auth } = usePage<SharedData>().props;
    const userId = auth.user.id;

    const heiMap = useMemo(() => {
        const map = new Map<string, HEIOption>();
        heis.forEach(hei => map.set(hei.uii.toLowerCase(), hei));
        return map;
    }, [heis]);

    // Load draft on open
    useEffect(() => {
        if (isOpen) {
            const draft = loadDraftFromStorage(userId);
            if (draft) {
                setRows(draft.rows.map(r => hydrateRow(r, heiMap)));
                setHasDraft(true);
                const saved = new Date(draft.savedAt);
                toast.info(`Draft restored (saved ${saved.toLocaleDateString()} ${saved.toLocaleTimeString()})`);
            } else {
                setRows([createEmptyRow()]);
                setHasDraft(false);
            }
            setRowErrors({});
        }
    }, [isOpen, heiMap, userId]);

    // Get due date days based on program: STUFAPS sub-programs = 30 days, others = 90 days
    const getProgramPrefix = (programId: string): string => {
        const program = programs.find(p => p.id === programId);
        return program ? `${program.code}-` : '';
    };

    const getDueDateDays = (programId: string): number => {
        const program = programs.find(p => p.id === programId);
        return program?.parent_id ? 30 : 90;
    };

    const updateRow = (index: number, field: keyof BulkEntryRow, value: string) => {
        setRows(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            if (field === 'uii') {
                const match = heiMap.get(value.trim().toLowerCase());
                updated[index].hei_name = match?.name || '';
            }
            // Reset control no suffix when program changes
            if (field === 'program_id') {
                updated[index].dv_control_no = '';
            }
            // Auto-compute due date based on program type
            const shouldRecomputeDueDate = field === 'date_fund_released' || field === 'program_id';
            const releaseDate = field === 'date_fund_released' ? value : updated[index].date_fund_released;
            if (shouldRecomputeDueDate && releaseDate) {
                const released = parse(releaseDate, 'yyyy-MM-dd', new Date());
                if (isValid(released)) {
                    const days = getDueDateDays(updated[index].program_id);
                    updated[index].due_date = format(addDays(released, days), 'yyyy-MM-dd');
                }
            }
            return updated;
        });
        if (rowErrors[index]) {
            setRowErrors(prev => { const u = { ...prev }; delete u[index]; return u; });
        }
    };

    const selectHei = (index: number, hei: HEIOption) => {
        setRows(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], uii: hei.uii, hei_name: hei.name };
            return updated;
        });
        if (rowErrors[index]) {
            setRowErrors(prev => { const u = { ...prev }; delete u[index]; return u; });
        }
    };

    const addRow = () => setRows(prev => [...prev, createEmptyRow()]);

    const duplicateRow = (index: number) => {
        setRows(prev => {
            const copy: BulkEntryRow = { ...prev[index], id: crypto.randomUUID() };
            const updated = [...prev];
            updated.splice(index + 1, 0, copy);
            return updated;
        });
    };

    const removeRow = (index: number) => {
        if (rows.length <= 1) return;
        setRows(prev => prev.filter((_, i) => i !== index));
        setRowErrors(prev => {
            const updated: Record<number, string> = {};
            Object.entries(prev).forEach(([key, val]) => {
                const k = parseInt(key);
                if (k < index) updated[k] = val;
                else if (k > index) updated[k - 1] = val;
            });
            return updated;
        });
    };

    // Draft actions
    const handleSaveDraft = () => {
        saveDraftToStorage(userId, rows);
        setHasDraft(true);
        toast.success('Draft saved.');
    };

    const handleDiscardDraft = () => {
        clearDraftFromStorage(userId);
        setRows([createEmptyRow()]);
        setRowErrors({});
        setHasDraft(false);
        toast.info('Draft discarded.');
    };

    // Close confirmation
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

    const hasUnsavedChanges = useCallback((): boolean => {
        if (rows.length > 1) return true;
        return rows[0] ? rowHasData(rows[0]) : false;
    }, [rows]);

    const handleClose = useCallback(() => {
        if (hasUnsavedChanges()) {
            setShowCloseConfirm(true);
        } else {
            onClose();
        }
    }, [hasUnsavedChanges, onClose]);

    const handleDeleteRow = (index: number) => {
        if (rows.length <= 1) return;
        if (rowHasData(rows[index])) {
            setDeleteConfirmIndex(index);
        } else {
            removeRow(index);
        }
    };

    // Validation — suffix format: YYYY-NNNN (e.g., 2026-0001)
    const SUFFIX_REGEX = /^\d{4}-\d{1,5}$/;

    const validateRows = (): boolean => {
        const errors: Record<number, string> = {};
        const seenControlNos = new Map<string, number>();

        rows.forEach((row, i) => {
            if (!row.program_id) errors[i] = 'Program is required.';
            else if (!row.uii.trim()) errors[i] = 'UII is required.';
            else if (!row.hei_name) errors[i] = `UII "${row.uii}" not found in system.`;
            else if (!row.date_fund_released) errors[i] = 'Date of Fund Released is required.';
            else if (!row.academic_year_id) errors[i] = 'Academic Year is required.';
            else if (!row.semester) errors[i] = 'Semester is required.';
            else if (!row.total_disbursements) errors[i] = 'Total Disbursements is required.';
            else if (row.dv_control_no.trim()) {
                // Validate format only when user provides a control number
                if (row.dv_control_no.trim() !== row.dv_control_no) errors[i] = 'Control No. has leading/trailing spaces.';
                else if (!SUFFIX_REGEX.test(row.dv_control_no)) errors[i] = 'Control No. format invalid. Use: YYYY-NNNN (e.g., 2026-0001).';
                else {
                    const fullControlNo = getProgramPrefix(row.program_id) + row.dv_control_no;
                    if (seenControlNos.has(fullControlNo)) {
                        errors[i] = `Control No. "${fullControlNo}" is duplicated with Row ${(seenControlNos.get(fullControlNo)!) + 1}.`;
                    } else {
                        seenControlNos.set(fullControlNo, i);
                    }
                }
            }
            // If control no is empty, it will be auto-generated server-side
        });
        setRowErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Submit
    const handleSubmit = async () => {
        if (!validateRows()) return;

        setIsSubmitting(true);
        setRowErrors({});

        const entries = rows.map(row => ({
            program_id: row.program_id,
            uii: row.uii.trim(),
            dv_control_no: row.dv_control_no.trim()
                ? getProgramPrefix(row.program_id) + row.dv_control_no.trim()
                : null,
            date_fund_released: row.date_fund_released,
            due_date: row.due_date || null,
            academic_year_id: row.academic_year_id,
            semester: row.semester,
            batch_no: row.batch_no || null,
            number_of_grantees: row.number_of_grantees ? parseInt(row.number_of_grantees) : null,
            total_disbursements: row.total_disbursements ? parseFloat(row.total_disbursements) : 0,
            total_amount_liquidated: row.total_amount_liquidated ? parseFloat(row.total_amount_liquidated) : 0,
            document_status: row.document_status || null,
            rc_notes: row.rc_notes || null,
        }));

        try {
            const response = await axios.post(route('liquidation.bulk-store'), { entries });

            if (response.data.success) {
                toast.success(response.data.message);

                if (response.data.errors?.length > 0) {
                    const backendErrors: Record<number, string> = {};
                    response.data.errors.forEach((err: { row: number; error: string }) => {
                        backendErrors[err.row - 1] = err.error;
                        toast.warning(`Row ${err.row}: ${err.error}`);
                    });
                    setRowErrors(backendErrors);
                    onSuccess();
                } else {
                    clearDraftFromStorage(userId);
                    onSuccess();
                    onClose();
                }
            }
        } catch (error: any) {
            if (error.response?.data?.errors && typeof error.response.data.errors === 'object') {
                const laravelErrors = error.response.data.errors;

                if (Array.isArray(laravelErrors)) {
                    const backendErrors: Record<number, string> = {};
                    laravelErrors.forEach((err: { row: number; error: string }) => {
                        backendErrors[err.row - 1] = err.error;
                    });
                    setRowErrors(backendErrors);
                    toast.error(error.response.data.message || 'Some entries failed.');
                } else {
                    const mappedErrors: Record<number, string> = {};
                    Object.entries(laravelErrors).forEach(([field, messages]: [string, any]) => {
                        const match = field.match(/^entries\.(\d+)\./);
                        if (match) {
                            const rowIndex = parseInt(match[1]);
                            mappedErrors[rowIndex] = Array.isArray(messages) ? messages[0] : messages;
                        }
                    });
                    if (Object.keys(mappedErrors).length > 0) setRowErrors(mappedErrors);
                    toast.error(error.response.data.message || 'Validation failed.');
                }
            } else {
                toast.error(error.response?.data?.message || 'Failed to create liquidations.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Drawer open={isOpen} onOpenChange={open => { if (!open) handleClose(); }} dismissible={false}>
            <DrawerContent className="max-h-[85vh] flex flex-col px-5 pb-5">
                <DrawerHeader className="shrink-0 px-0">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <DrawerTitle>Bulk Entry — Create Multiple Liquidations</DrawerTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Select an HEI from the UII dropdown and the name will auto-fill.
                                {' '}<span className="font-medium">{rows.length}</span> row{rows.length !== 1 && 's'}
                            </p>
                        </div>
                        {hasDraft && (
                            <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-md px-2.5 py-1 shrink-0">
                                <FileWarning className="h-3.5 w-3.5" />
                                Draft loaded
                            </span>
                        )}
                    </div>
                </DrawerHeader>

                {/* Table — scrollable both directions */}
                <div className="flex-1 overflow-auto border rounded-md min-h-0">
                    <table className="text-sm border-collapse min-w-[1500px] w-full">
                        <colgroup><col style={{ width: 36 }} /><col style={{ width: 80 }} /><col style={{ width: 140 }} /><col style={{ width: 200 }} /><col style={{ width: 140 }} /><col style={{ width: 140 }} /><col style={{ width: 110 }} /><col style={{ width: 120 }} /><col style={{ width: 60 }} /><col style={{ width: 150 }} /><col style={{ width: 80 }} /><col style={{ width: 120 }} /><col style={{ width: 120 }} /><col style={{ width: 130 }} /><col style={{ width: 130 }} /><col style={{ width: 56 }} /></colgroup>
                        <thead className="bg-muted/50 sticky top-0 z-10">
                            <tr>
                                <th className="px-1 py-1.5 text-center text-[11px] font-medium text-muted-foreground">#</th>
                                <th className="px-0.5 py-1.5 text-left text-[11px] font-medium">Program *</th>
                                <th className="px-0.5 py-1.5 text-left text-[11px] font-medium">UII *</th>
                                <th className="px-0.5 py-1.5 text-left text-[11px] font-medium">HEI Name</th>
                                <th className="px-0.5 py-1.5 text-left text-[11px] font-medium">Fund Released *</th>
                                <th className="px-0.5 py-1.5 text-left text-[11px] font-medium">Due Date</th>
                                <th className="px-0.5 py-1.5 text-left text-[11px] font-medium">Acad. Year *</th>
                                <th className="px-0.5 py-1.5 text-left text-[11px] font-medium">Semester *</th>
                                <th className="px-0.5 py-1.5 text-left text-[11px] font-medium">Batch</th>
                                <th className="px-0.5 py-1.5 text-left text-[11px] font-medium">Control No. *</th>
                                <th className="px-0.5 py-1.5 text-left text-[11px] font-medium">Grantees</th>
                                <th className="px-0.5 py-1.5 text-left text-[11px] font-medium">Disbursements *</th>
                                <th className="px-0.5 py-1.5 text-left text-[11px] font-medium">Amt Liquidated</th>
                                <th className="px-0.5 py-1.5 text-left text-[11px] font-medium">Doc Status</th>
                                <th className="px-0.5 py-1.5 text-left text-[11px] font-medium">RC Notes</th>
                                <th className="px-0.5 py-1.5 text-center text-[11px] font-medium"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, index) => {
                                const programLabel = programs.find(p => p.id === row.program_id)?.code || '';
                                const ayLabel = academicYears.find(ay => ay.id === row.academic_year_id)?.name || '';
                                const semLabel = SEMESTERS.find(s => s.value === row.semester)?.label || '';
                                const docLabel = DOCUMENT_STATUSES.find(s => s.value === row.document_status)?.label || '';
                                const rcLabel = rcNoteStatuses.find(o => o.name === row.rc_notes)?.name || '';
                                const fundDateLabel = row.date_fund_released ? format(parse(row.date_fund_released, 'yyyy-MM-dd', new Date()), 'MMM dd, yyyy') : '';
                                const dueDateLabel = row.due_date ? format(parse(row.due_date, 'yyyy-MM-dd', new Date()), 'MMM dd, yyyy') : '';

                                return (
                                <React.Fragment key={row.id}>
                                    <tr className={rowErrors[index] ? 'bg-red-50/60 dark:bg-red-950/20' : ''}>
                                        <td className="px-1 py-0.5 text-center text-xs text-muted-foreground">{index + 1}</td>
                                        <td className="px-0.5 py-0.5">
                                            <CellTooltip content={programLabel}>
                                                <Select value={row.program_id} onValueChange={v => updateRow(index, 'program_id', v)}>
                                                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="--" /></SelectTrigger>
                                                    <SelectContent>
                                                        <BulkProgramItems programs={programs} />
                                                    </SelectContent>
                                                </Select>
                                            </CellTooltip>
                                        </td>
                                        <td className="px-0.5 py-0.5">
                                            <CellTooltip content={row.uii ? `${row.uii} — ${row.hei_name}` : ''}>
                                                <div>
                                                    <HeiComboboxCell
                                                        heis={heis}
                                                        selectedUii={row.uii}
                                                        heiName={row.hei_name}
                                                        onSelect={hei => selectHei(index, hei)}
                                                    />
                                                </div>
                                            </CellTooltip>
                                        </td>
                                        <td className="px-0.5 py-0.5">
                                            <CellTooltip content={row.hei_name}>
                                                <span className="block">
                                                    <Input className="h-7 text-xs bg-muted truncate pointer-events-none" value={row.hei_name} disabled placeholder="Auto-filled" tabIndex={-1} />
                                                </span>
                                            </CellTooltip>
                                        </td>
                                        <td className="px-0.5 py-0.5">
                                            <CellTooltip content={fundDateLabel}>
                                                <div>
                                                    <DatePickerCell value={row.date_fund_released} onChange={v => updateRow(index, 'date_fund_released', v)} placeholder="Fund released" />
                                                </div>
                                            </CellTooltip>
                                        </td>
                                        <td className="px-0.5 py-0.5">
                                            <CellTooltip content={dueDateLabel}>
                                                <div>
                                                    <DatePickerCell value={row.due_date} onChange={v => updateRow(index, 'due_date', v)} placeholder="Due date" />
                                                </div>
                                            </CellTooltip>
                                        </td>
                                        <td className="px-0.5 py-0.5">
                                            <CellTooltip content={ayLabel}>
                                                <Select value={row.academic_year_id} onValueChange={v => updateRow(index, 'academic_year_id', v)}>
                                                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="--">{ayLabel.replace(/^Academic Year\s*/i, '')}</SelectValue></SelectTrigger>
                                                    <SelectContent>{academicYears.map(ay => <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </CellTooltip>
                                        </td>
                                        <td className="px-0.5 py-0.5">
                                            <CellTooltip content={semLabel}>
                                                <Select value={row.semester} onValueChange={v => updateRow(index, 'semester', v)}>
                                                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="--" /></SelectTrigger>
                                                    <SelectContent>{SEMESTERS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </CellTooltip>
                                        </td>
                                        <td className="px-0.5 py-0.5">
                                            <CellTooltip content={row.batch_no ? `Batch ${row.batch_no}` : ''}>
                                                <Input className="h-7 text-xs" type="number" min="0" value={row.batch_no} onChange={e => updateRow(index, 'batch_no', e.target.value)} placeholder="1" />
                                            </CellTooltip>
                                        </td>
                                        <td className="px-0.5 py-0.5">
                                            <CellTooltip content={row.dv_control_no ? `${getProgramPrefix(row.program_id)}${row.dv_control_no}` : ''}>
                                                <div className="flex items-center h-7 rounded-md border border-input bg-background text-xs font-mono">
                                                    {row.program_id && (
                                                        <span className="px-1 text-muted-foreground bg-muted border-r border-input rounded-l-md h-full flex items-center select-none text-[10px]">
                                                            {getProgramPrefix(row.program_id)}
                                                        </span>
                                                    )}
                                                    <Input
                                                        className="h-full border-0 shadow-none focus-visible:ring-0 text-xs font-mono px-1"
                                                        value={row.dv_control_no}
                                                        onChange={e => updateRow(index, 'dv_control_no', e.target.value.toUpperCase())}
                                                        placeholder={row.program_id ? 'Auto' : '--'}
                                                        disabled={!row.program_id}
                                                    />
                                                </div>
                                            </CellTooltip>
                                        </td>
                                        <td className="px-0.5 py-0.5">
                                            <CellTooltip content={row.number_of_grantees ? `${row.number_of_grantees} grantees` : ''}>
                                                <Input className="h-7 text-xs" type="number" min="0" value={row.number_of_grantees} onChange={e => updateRow(index, 'number_of_grantees', e.target.value)} placeholder="0" />
                                            </CellTooltip>
                                        </td>
                                        <td className="px-0.5 py-0.5">
                                            <CellTooltip content={row.total_disbursements ? `₱${parseFloat(row.total_disbursements).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}>
                                                <CurrencyInput className="h-7 text-xs" value={row.total_disbursements} onValueChange={v => updateRow(index, 'total_disbursements', v)} />
                                            </CellTooltip>
                                        </td>
                                        <td className="px-0.5 py-0.5">
                                            <CellTooltip content={row.total_amount_liquidated ? `₱${parseFloat(row.total_amount_liquidated).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}>
                                                <CurrencyInput className="h-7 text-xs" value={row.total_amount_liquidated} onValueChange={v => updateRow(index, 'total_amount_liquidated', v)} />
                                            </CellTooltip>
                                        </td>
                                        <td className="px-0.5 py-0.5">
                                            <CellTooltip content={docLabel}>
                                                <Select value={row.document_status} onValueChange={v => updateRow(index, 'document_status', v)}>
                                                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="--" /></SelectTrigger>
                                                    <SelectContent>{DOCUMENT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </CellTooltip>
                                        </td>
                                        <td className="px-0.5 py-0.5">
                                            <CellTooltip content={rcLabel}>
                                                <Select value={row.rc_notes} onValueChange={v => updateRow(index, 'rc_notes', v)}>
                                                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="--" /></SelectTrigger>
                                                    <SelectContent>{rcNoteStatuses.map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </CellTooltip>
                                        </td>
                                        <td className="px-0.5 py-0.5 text-center">
                                            <div className="flex items-center justify-center gap-0">
                                                <CellTooltip content="Duplicate row">
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-blue-600" onClick={() => duplicateRow(index)}>
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </CellTooltip>
                                                <Popover open={deleteConfirmIndex === index} onOpenChange={open => { if (!open) setDeleteConfirmIndex(null); }}>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600" onClick={() => handleDeleteRow(index)} disabled={rows.length <= 1}>
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-56 p-3" side="left" align="center">
                                                        <p className="text-sm font-medium mb-1">Remove this row?</p>
                                                        <p className="text-xs text-muted-foreground mb-3">This row has data that will be lost.</p>
                                                        <div className="flex justify-end gap-2">
                                                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setDeleteConfirmIndex(null)}>Keep</Button>
                                                            <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => { removeRow(index); setDeleteConfirmIndex(null); }}>Remove</Button>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </td>
                                    </tr>
                                    {rowErrors[index] && (
                                        <tr>
                                            <td colSpan={16} className="px-2 py-0.5 bg-red-50/80 dark:bg-red-950/30 border-b">
                                                <div className="flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400">
                                                    <AlertCircle className="h-3 w-3 shrink-0" />
                                                    Row {index + 1}: {rowErrors[index]}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center pt-2 shrink-0">
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={addRow}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add Row
                        </Button>
                        {hasDraft && (
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleDiscardDraft}>
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                Discard Draft
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleSaveDraft}>
                            <Save className="h-4 w-4 mr-1" />
                            Save Draft
                        </Button>
                        <Popover open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3" side="top" align="end">
                                <p className="text-sm font-medium mb-1">Unsaved changes</p>
                                <p className="text-xs text-muted-foreground mb-3">Save as draft before closing?</p>
                                <div className="flex flex-col gap-1.5">
                                    <Button variant="outline" size="sm" className="h-7 text-xs w-full justify-start" onClick={() => { handleSaveDraft(); setShowCloseConfirm(false); onClose(); }}>
                                        <Save className="h-3 w-3 mr-1.5" />
                                        Save Draft & Close
                                    </Button>
                                    <Button variant="destructive" size="sm" className="h-7 text-xs w-full justify-start" onClick={() => { setShowCloseConfirm(false); onClose(); }}>
                                        <Trash2 className="h-3 w-3 mr-1.5" />
                                        Discard & Close
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 text-xs w-full justify-start" onClick={() => setShowCloseConfirm(false)}>
                                        Keep editing
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Popover open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
                            <PopoverTrigger asChild>
                                <Button disabled={isSubmitting} onClick={() => { if (validateRows()) setShowSubmitConfirm(true); }}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Submit All ({rows.length})
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3" side="top" align="end">
                                <p className="text-sm font-medium mb-1">Confirm submission</p>
                                <p className="text-xs text-muted-foreground mb-3">
                                    You are about to create <span className="font-semibold">{rows.length}</span> liquidation{rows.length !== 1 && 's'}. This action cannot be undone.
                                </p>
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowSubmitConfirm(false)}>Cancel</Button>
                                    <Button size="sm" className="h-7 text-xs" onClick={() => { setShowSubmitConfirm(false); handleSubmit(); }}>
                                        Confirm
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </DrawerContent>

        </Drawer>
    );
}
