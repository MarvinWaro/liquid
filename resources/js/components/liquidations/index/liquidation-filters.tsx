import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';
import type { Program, AcademicYearOption, RcNoteStatusOption } from './types';

interface LiquidationFiltersProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    onSearchSubmit: (e: React.FormEvent) => void;
    programFilter: string;
    onProgramFilter: (value: string) => void;
    programs: Program[];
    documentStatusFilter: string;
    onDocumentStatusFilter: (value: string) => void;
    liquidationStatusFilter: string;
    onLiquidationStatusFilter: (value: string) => void;
    academicYearFilter: string;
    onAcademicYearFilter: (value: string) => void;
    academicYears: AcademicYearOption[];
    rcNoteStatusFilter: string;
    onRcNoteStatusFilter: (value: string) => void;
    rcNoteStatuses: RcNoteStatusOption[];
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
}: LiquidationFiltersProps) {
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
                <ProgramFilterSelect value={programFilter} onChange={onProgramFilter} programs={programs} />
                <AcademicYearSelect value={academicYearFilter} onChange={onAcademicYearFilter} academicYears={academicYears} />
                <DocumentStatusSelect value={documentStatusFilter} onChange={onDocumentStatusFilter} />
                <LiquidationStatusSelect value={liquidationStatusFilter} onChange={onLiquidationStatusFilter} />
                <RcNoteStatusSelect value={rcNoteStatusFilter} onChange={onRcNoteStatusFilter} rcNoteStatuses={rcNoteStatuses} />
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

/* ── Program Filter ── */

const ProgramFilterSelect = React.memo(function ProgramFilterSelect({
    value,
    onChange,
    programs,
}: {
    value: string;
    onChange: (v: string) => void;
    programs: Program[];
}) {
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

    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Program" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                <SelectSeparator />
                <SelectGroup>
                    <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">UniFAST</SelectLabel>
                    <SelectItem value="unifast">All UniFAST</SelectItem>
                    {unifastPrograms.map(p => (
                        <SelectItem key={p.id} value={p.id} className="pl-6">{p.code}</SelectItem>
                    ))}
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                    <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">STuFAPs</SelectLabel>
                    <SelectItem value="stufaps">All STuFAPs</SelectItem>
                    {stufapsParents.map(parent => {
                        const children = childrenByParent.get(parent.id) || [];
                        if (children.length > 0) {
                            return (
                                <React.Fragment key={parent.id}>
                                    <SelectItem value={parent.id} className="pl-6 font-medium">{parent.code}</SelectItem>
                                    {children.map(child => (
                                        <SelectItem key={child.id} value={child.id} className="pl-10 text-xs">{child.code}</SelectItem>
                                    ))}
                                </React.Fragment>
                            );
                        }
                        return <SelectItem key={parent.id} value={parent.id} className="pl-6">{parent.code}</SelectItem>;
                    })}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
});

/* ── Academic Year Filter ── */

const AcademicYearSelect = React.memo(function AcademicYearSelect({
    value,
    onChange,
    academicYears,
}: {
    value: string;
    onChange: (v: string) => void;
    academicYears: AcademicYearOption[];
}) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Academic Year" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Academic Years</SelectItem>
                {academicYears.map(ay => (
                    <SelectItem key={ay.id} value={ay.id}>{ay.name || ay.code}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
});

/* ── Document Status Filter ── */

const DocumentStatusSelect = React.memo(function DocumentStatusSelect({
    value,
    onChange,
}: {
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Document Status" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Documents</SelectItem>
                <SelectItem value="NONE">
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 dark:bg-red-400" />
                        No Submission
                    </span>
                </SelectItem>
                <SelectItem value="PARTIAL">
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />
                        Partial Submission
                    </span>
                </SelectItem>
                <SelectItem value="COMPLETE">
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Complete Submission
                    </span>
                </SelectItem>
            </SelectContent>
        </Select>
    );
});

/* ── Liquidation Status Filter ── */

const LiquidationStatusSelect = React.memo(function LiquidationStatusSelect({
    value,
    onChange,
}: {
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Liquidation Status" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Liquidation</SelectItem>
                <SelectItem value="unliquidated">
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 dark:bg-red-400" />
                        Unliquidated
                    </span>
                </SelectItem>
                <SelectItem value="partially_liquidated">
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />
                        Partially Liquidated
                    </span>
                </SelectItem>
                <SelectItem value="fully_liquidated">
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Fully Liquidated
                    </span>
                </SelectItem>
                <SelectItem value="voided">
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500" />
                        Voided
                    </span>
                </SelectItem>
            </SelectContent>
        </Select>
    );
});

/* ── RC Note Status Filter ── */

const RcNoteStatusSelect = React.memo(function RcNoteStatusSelect({
    value,
    onChange,
    rcNoteStatuses,
}: {
    value: string;
    onChange: (v: string) => void;
    rcNoteStatuses: RcNoteStatusOption[];
}) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="RC Note" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All RC Notes</SelectItem>
                <SelectItem value="none">No RC Note</SelectItem>
                {rcNoteStatuses.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
});
