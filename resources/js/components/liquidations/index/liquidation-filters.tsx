import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarDays, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MultiSelectFilter, type FilterOption } from './multi-select-filter';
import type { Program, AcademicYearOption, RcNoteStatusOption } from './types';

export interface DateFilters {
    date_from: string;
    date_to: string;
    due_from: string;
    due_to: string;
}

export const EMPTY_DATE_FILTERS: DateFilters = { date_from: '', date_to: '', due_from: '', due_to: '' };

interface RegionOption {
    id: string;
    code: string;
    name: string;
}

interface LiquidationFiltersProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    onSearchSubmit: (e: React.FormEvent) => void;
    programFilter: string[];
    onProgramFilter: (value: string[]) => void;
    programs: Program[];
    documentStatusFilter: string[];
    onDocumentStatusFilter: (value: string[]) => void;
    liquidationStatusFilter: string[];
    onLiquidationStatusFilter: (value: string[]) => void;
    academicYearFilter: string[];
    onAcademicYearFilter: (value: string[]) => void;
    academicYears: AcademicYearOption[];
    rcNoteStatusFilter: string[];
    onRcNoteStatusFilter: (value: string[]) => void;
    rcNoteStatuses: RcNoteStatusOption[];
    regions?: RegionOption[];
    regionFilter?: string[];
    onRegionFilter?: (value: string[]) => void;
    dateFilters: DateFilters;
    onDateFilters: (value: DateFilters) => void;
}

export const LiquidationFilters = React.memo(function LiquidationFilters({
    searchQuery,
    onSearchChange,
    onSearchSubmit,
    programFilter,
    onProgramFilter,
    programs,
    documentStatusFilter,
    onDocumentStatusFilter,
    liquidationStatusFilter,
    onLiquidationStatusFilter,
    academicYearFilter,
    onAcademicYearFilter,
    academicYears,
    rcNoteStatusFilter,
    onRcNoteStatusFilter,
    rcNoteStatuses,
    regions,
    regionFilter,
    onRegionFilter,
    dateFilters,
    onDateFilters,
}: LiquidationFiltersProps) {
    const programOptions = useMemo(() => buildProgramOptions(programs), [programs]);
    const academicYearOptions = useMemo(() =>
        academicYears.map(ay => ({ value: ay.id, label: ay.name || ay.code })),
    [academicYears]);
    const rcNoteOptions = useMemo(() => [
        { value: 'none', label: 'No RC Note' },
        ...rcNoteStatuses.map(s => ({ value: s.id, label: s.name })),
    ], [rcNoteStatuses]);
    const regionOptions = useMemo(() =>
        (regions ?? []).map(r => ({ value: r.id, label: r.code })),
    [regions]);
    const showRegionFilter = !!regions && regions.length > 0 && !!onRegionFilter;

    return (
        <form onSubmit={onSearchSubmit} className="mb-4">
            <div className="flex gap-2 flex-wrap items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search control no, HEI name, or UII — combine terms, e.g. 2023-001 antonio"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="pl-8"
                    />
                </div>
                {showRegionFilter && (
                    <MultiSelectFilter
                        label="Region"
                        options={regionOptions}
                        selected={regionFilter ?? []}
                        onChange={onRegionFilter!}
                        width="w-[140px]"
                    />
                )}
                <MultiSelectFilter
                    label="Program"
                    options={programOptions}
                    selected={programFilter}
                    onChange={onProgramFilter}
                />
                <MultiSelectFilter
                    label="Academic Year"
                    options={academicYearOptions}
                    selected={academicYearFilter}
                    onChange={onAcademicYearFilter}
                    width="w-[160px]"
                />
                <MultiSelectFilter
                    label="Document Status"
                    options={DOCUMENT_STATUS_OPTIONS}
                    selected={documentStatusFilter}
                    onChange={onDocumentStatusFilter}
                />
                <MultiSelectFilter
                    label="Liquidation Status"
                    options={LIQUIDATION_STATUS_OPTIONS}
                    selected={liquidationStatusFilter}
                    onChange={onLiquidationStatusFilter}
                />
                <MultiSelectFilter
                    label="RC Note"
                    options={rcNoteOptions}
                    selected={rcNoteStatusFilter}
                    onChange={onRcNoteStatusFilter}
                    width="w-[170px]"
                />
                <DateRangeFilter value={dateFilters} onChange={onDateFilters} />
                <Button type="submit" className="bg-foreground text-background hover:bg-foreground/90">Search</Button>
            </div>
            <div className="flex items-center gap-4 my-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 dark:bg-red-400" />
                    Needs Attention
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />
                    In Progress
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />
                    Partial
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Complete
                </span>
            </div>
        </form>
    );
});

/* ── Date range filter ── */

const hasActiveDates = (v: DateFilters) => !!(v.date_from || v.date_to || v.due_from || v.due_to);

function DateRangeFilter({ value, onChange }: { value: DateFilters; onChange: (value: DateFilters) => void }) {
    const [open, setOpen] = useState(false);
    const active = hasActiveDates(value);

    const set = (key: keyof DateFilters) => (e: React.ChangeEvent<HTMLInputElement>) =>
        onChange({ ...value, [key]: e.target.value });

    const clear = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        onChange({ ...EMPTY_DATE_FILTERS });
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className={cn('justify-between font-normal min-w-[110px]', active && 'border-foreground/40')}>
                    <span className="flex items-center gap-1.5 text-sm whitespace-nowrap">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        Dates
                    </span>
                    <div className="flex items-center gap-1 ml-1 shrink-0">
                        {active && (
                            <span
                                role="button"
                                tabIndex={-1}
                                onClick={clear}
                                className="rounded-full hover:bg-muted p-0.5"
                                aria-label="Clear date filters"
                            >
                                <X className="h-3 w-3 text-muted-foreground" />
                            </span>
                        )}
                        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                    </div>
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[400px] p-0">
                <div className="px-5 py-4 space-y-5">
                    <div className="space-y-2.5">
                        <p className="text-xs font-semibold text-foreground">
                            Date of Fund Released
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="date-from" className="text-xs font-normal text-muted-foreground">From</Label>
                                <Input id="date-from" type="date" value={value.date_from} onChange={set('date_from')} className="h-9 w-full" />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="date-to" className="text-xs font-normal text-muted-foreground">To</Label>
                                <Input id="date-to" type="date" value={value.date_to} onChange={set('date_to')} min={value.date_from || undefined} className="h-9 w-full" />
                            </div>
                        </div>
                    </div>
                    <div className="border-t" />
                    <div className="space-y-2.5">
                        <p className="text-xs font-semibold text-foreground">
                            Due Date
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="due-from" className="text-xs font-normal text-muted-foreground">From</Label>
                                <Input id="due-from" type="date" value={value.due_from} onChange={set('due_from')} className="h-9 w-full" />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="due-to" className="text-xs font-normal text-muted-foreground">To</Label>
                                <Input id="due-to" type="date" value={value.due_to} onChange={set('due_to')} min={value.due_from || undefined} className="h-9 w-full" />
                            </div>
                        </div>
                    </div>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                        Leave a side empty for an open-ended range — e.g. only "From" shows everything since that date.
                    </p>
                </div>
                <div className="flex items-center justify-between gap-2 border-t bg-muted/40 px-5 py-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground"
                        onClick={() => clear()}
                        disabled={!active}
                    >
                        Clear dates
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setOpen(false)}
                    >
                        Done
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

/* ── Static option lists ── */

const DOCUMENT_STATUS_OPTIONS: FilterOption[] = [
    { value: 'NONE', label: 'No Submission', dot: 'bg-red-500 dark:bg-red-400' },
    { value: 'PARTIAL', label: 'Partial Submission', dot: 'bg-amber-500 dark:bg-amber-400' },
    { value: 'COMPLETE', label: 'Complete Submission', dot: 'bg-emerald-500' },
];

const LIQUIDATION_STATUS_OPTIONS: FilterOption[] = [
    { value: 'unliquidated', label: 'Unliquidated', dot: 'bg-red-500 dark:bg-red-400' },
    { value: 'partially_liquidated', label: 'Partially Liquidated', dot: 'bg-amber-500 dark:bg-amber-400' },
    { value: 'fully_liquidated', label: 'Fully Liquidated', dot: 'bg-emerald-500' },
    { value: 'voided', label: 'Voided', dot: 'bg-gray-400 dark:bg-gray-500' },
];

/* ── Program options builder ── */

function buildProgramOptions(programs: Program[]): FilterOption[] {
    const unifastCodes = ['TES', 'TDP'];
    const unifastPrograms = programs.filter(p => !p.parent_id && unifastCodes.includes(p.code?.toUpperCase()));
    const stufapsParents = programs.filter(p => !p.parent_id && !unifastCodes.includes(p.code?.toUpperCase()));
    const childPrograms = programs.filter(p => p.parent_id);
    const childrenByParent = new Map<string, Program[]>();
    childPrograms.forEach(p => {
        const list = childrenByParent.get(p.parent_id!) || [];
        list.push(p);
        childrenByParent.set(p.parent_id!, list);
    });

    const options: FilterOption[] = [];

    // UniFAST group
    unifastPrograms.forEach(p => {
        options.push({ value: p.id, label: p.code, group: 'UniFAST' });
    });

    // STuFAPs group
    stufapsParents.forEach(parent => {
        const children = childrenByParent.get(parent.id) || [];
        options.push({ value: parent.id, label: parent.code, group: 'STuFAPs' });
        children.forEach(child => {
            options.push({ value: child.id, label: child.code, group: 'STuFAPs', indent: true });
        });
    });

    return options;
}
