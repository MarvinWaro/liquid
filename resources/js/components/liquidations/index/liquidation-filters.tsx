import React, { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { MultiSelectFilter, type FilterOption } from './multi-select-filter';
import type { Program, AcademicYearOption, RcNoteStatusOption } from './types';

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
                        placeholder="Search by reference number or HEI name..."
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
