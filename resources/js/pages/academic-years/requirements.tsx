import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { ArrowLeft, BookOpen, Check, Copy, GrabIcon, RefreshCcw, Save } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Sortable from 'sortablejs';

interface AcademicYear {
    id: string;
    code: string;
    name: string;
}

interface Requirement {
    id: string;
    code: string;
    name: string;
    description: string | null;
    is_required: boolean;
    is_active: boolean;
    sort_order: number;
    has_override: boolean;
}

interface ProgramGroup {
    id: string;
    name: string;
    code: string;
    requirements: Requirement[];
}

interface Props {
    academicYear: AcademicYear;
    groupedRequirements: ProgramGroup[];
    otherYears: AcademicYear[];
    hasCustomConfig: boolean;
}

const breadcrumbs = (ayCode: string): BreadcrumbItem[] => [
    { title: 'Settings', href: '/settings/profile' },
    { title: 'Academic Years', href: '/academic-years' },
    { title: `${ayCode} — Requirements`, href: '#' },
];

interface RowState {
    is_required: boolean;
    is_active: boolean;
    sort_order: number;
    has_override: boolean;
}

function ResetPopover({
    label,
    description,
    onConfirm,
    triggerLabel,
    triggerClassName,
    variant = 'ghost',
}: {
    label: string;
    description: string;
    onConfirm: () => void;
    triggerLabel: string;
    triggerClassName?: string;
    variant?: 'ghost' | 'outline';
}) {
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant={variant} size="sm" className={triggerClassName}>
                    <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                    {triggerLabel}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
                <div className="space-y-3">
                    <div className="space-y-1">
                        <h4 className="text-sm font-semibold">{label}</h4>
                        <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => { onConfirm(); setOpen(false); }}
                        >
                            Reset
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

function SortableRequirementsTable({
    group,
    rows,
    updateRow,
    reorderGroup,
    onResetProgram,
}: {
    group: ProgramGroup;
    rows: Record<string, RowState>;
    updateRow: (reqId: string, field: 'is_required' | 'is_active', value: boolean) => void;
    reorderGroup: (groupId: string, orderedIds: string[]) => void;
    onResetProgram: (programId: string, programCode: string) => void;
}) {
    const tbodyRef = useRef<HTMLTableSectionElement>(null);

    useEffect(() => {
        if (!tbodyRef.current) return;

        const sortable = Sortable.create(tbodyRef.current, {
            animation: 200,
            handle: '.drag-handle',
            ghostClass: 'opacity-30',
            chosenClass: 'bg-muted/80',
            onEnd: (evt) => {
                if (evt.oldIndex === undefined || evt.newIndex === undefined) return;
                if (evt.oldIndex === evt.newIndex) return;

                // Read the new order from the DOM data-id attributes
                const tbody = tbodyRef.current;
                if (!tbody) return;
                const orderedIds = Array.from(tbody.querySelectorAll('tr[data-id]')).map(
                    (el) => (el as HTMLElement).dataset.id!,
                );
                reorderGroup(group.id, orderedIds);
            },
        });

        return () => sortable.destroy();
    }, [group.id, reorderGroup]);

    const hasOverrides = group.requirements.some((req) => rows[req.id]?.has_override);

    return (
        <div className="overflow-hidden rounded-lg border">
            {/* Program header */}
            <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2.5">
                <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    {group.code}
                </span>
                <span className="text-sm font-semibold text-foreground">{group.name}</span>
                <div className="ml-auto flex items-center gap-2">
                    {hasOverrides && (
                        <ResetPopover
                            label={`Reset ${group.code} to defaults?`}
                            description={`This will remove all overrides for ${group.code} and revert to global defaults.`}
                            onConfirm={() => onResetProgram(group.id, group.code)}
                            triggerLabel="Reset"
                            triggerClassName="h-7 text-xs text-muted-foreground hover:text-destructive"
                        />
                    )}
                    <Badge variant="outline" className="border-border bg-muted text-foreground text-xs">
                        {group.requirements.length} requirement{group.requirements.length !== 1 ? 's' : ''}
                    </Badge>
                </div>
            </div>

            <Table>
                <TableHeader>
                    <TableRow className="border-b hover:bg-transparent">
                        <TableHead className="h-9 w-10 pl-3 text-xs font-medium tracking-wider text-muted-foreground uppercase" />
                        <TableHead className="h-9 w-16 text-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
                            Order
                        </TableHead>
                        <TableHead className="h-9 w-24 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                            Code
                        </TableHead>
                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                            Requirement
                        </TableHead>
                        <TableHead className="h-9 w-28 text-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
                            Required
                        </TableHead>
                        <TableHead className="h-9 w-28 pr-4 text-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
                            Active
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody ref={tbodyRef}>
                    {group.requirements.map((req) => {
                        const row = rows[req.id];
                        if (!row) return null;
                        return (
                            <TableRow key={req.id} data-id={req.id} className="transition-colors hover:bg-muted/50">
                                <TableCell className="py-2 pl-3 w-10">
                                    <GrabIcon className="drag-handle h-4 w-4 cursor-grab text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing" />
                                </TableCell>
                                <TableCell className="py-2 text-center">
                                    <span className="font-mono text-xs text-muted-foreground">
                                        {row.sort_order}
                                    </span>
                                </TableCell>
                                <TableCell className="py-2">
                                    <span className="font-mono text-xs font-semibold text-muted-foreground">
                                        {req.code}
                                    </span>
                                </TableCell>
                                <TableCell className="py-2">
                                    <div>
                                        <span className="text-sm font-medium text-foreground">{req.name}</span>
                                        {req.description && (
                                            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{req.description}</p>
                                        )}
                                    </div>
                                    {row.has_override && (
                                        <Badge className="mt-1 bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800/60 shadow-none text-[10px] px-1.5 py-0">
                                            overridden
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="py-2 text-center">
                                    <button
                                        type="button"
                                        onClick={() => updateRow(req.id, 'is_required', !row.is_required)}
                                        className={`inline-flex h-6 w-6 items-center justify-center rounded border transition-colors ${
                                            row.is_required
                                                ? 'border-foreground bg-foreground text-background'
                                                : 'border-border bg-background text-transparent hover:border-foreground/50'
                                        }`}
                                        aria-label="Toggle required"
                                    >
                                        <Check className="h-3.5 w-3.5" />
                                    </button>
                                </TableCell>
                                <TableCell className="py-2 pr-4 text-center">
                                    <button
                                        type="button"
                                        onClick={() => updateRow(req.id, 'is_active', !row.is_active)}
                                        className={`inline-flex h-6 w-6 items-center justify-center rounded border transition-colors ${
                                            row.is_active
                                                ? 'border-emerald-500 bg-emerald-500 text-white dark:border-emerald-400 dark:bg-emerald-400'
                                                : 'border-border bg-background text-transparent hover:border-foreground/50'
                                        }`}
                                        aria-label="Toggle active"
                                    >
                                        <Check className="h-3.5 w-3.5" />
                                    </button>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}

export default function Requirements({ academicYear, groupedRequirements, otherYears, hasCustomConfig }: Props) {
    const buildRows = useCallback((groups: ProgramGroup[]) => {
        const init: Record<string, RowState> = {};
        groups.forEach((group) => {
            group.requirements.forEach((req) => {
                init[req.id] = {
                    is_required: req.is_required,
                    is_active: req.is_active,
                    sort_order: req.sort_order,
                    has_override: req.has_override,
                };
            });
        });
        return init;
    }, []);

    const [rows, setRows] = useState(() => buildRows(groupedRequirements));
    const [groups, setGroups] = useState(groupedRequirements);

    // Re-sync local state when props refresh (after save/copy/reset)
    useEffect(() => {
        setRows(buildRows(groupedRequirements));
        setGroups(groupedRequirements);
    }, [groupedRequirements, buildRows]);

    const [isSaving, setIsSaving] = useState(false);
    const [copySourceId, setCopySourceId] = useState('');
    const [isCopying, setIsCopying] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const updateRow = useCallback((reqId: string, field: 'is_required' | 'is_active', value: boolean) => {
        setRows((prev) => ({
            ...prev,
            [reqId]: { ...prev[reqId], [field]: value },
        }));
    }, []);

    const reorderGroup = useCallback((groupId: string, orderedIds: string[]) => {
        // Update sort_order in rows state
        setRows((prev) => {
            const updated = { ...prev };
            orderedIds.forEach((id, index) => {
                if (updated[id]) {
                    updated[id] = { ...updated[id], sort_order: index + 1 };
                }
            });
            return updated;
        });

        // Update group requirements order
        setGroups((prev) =>
            prev.map((g) => {
                if (g.id !== groupId) return g;
                const reqMap = new Map(g.requirements.map((r) => [r.id, r]));
                const reordered = orderedIds
                    .map((id) => reqMap.get(id))
                    .filter((r): r is Requirement => r !== undefined)
                    .map((r, i) => ({ ...r, sort_order: i + 1 }));
                return { ...g, requirements: reordered };
            }),
        );
    }, []);

    const handleSave = () => {
        setIsSaving(true);
        const requirements = Object.entries(rows).map(([document_requirement_id, data]) => ({
            document_requirement_id,
            is_required: data.is_required,
            is_active: data.is_active,
            sort_order: data.sort_order,
        }));

        router.post(
            route('academic-years.requirements.sync', academicYear.id),
            { requirements },
            {
                onFinish: () => setIsSaving(false),
                preserveScroll: true,
            },
        );
    };

    const handleCopy = () => {
        if (!copySourceId) return;
        setIsCopying(true);
        router.post(
            route('academic-years.requirements.copy', academicYear.id),
            { source_academic_year_id: copySourceId },
            {
                onFinish: () => setIsCopying(false),
                preserveScroll: false,
            },
        );
    };

    const handleReset = () => {
        setIsResetting(true);
        router.delete(
            route('academic-years.requirements.reset', academicYear.id),
            {
                onFinish: () => setIsResetting(false),
                preserveScroll: false,
            },
        );
    };

    const handleResetProgram = useCallback((programId: string, _programCode: string) => {
        router.post(
            route('academic-years.requirements.reset-program', academicYear.id),
            { program_id: programId },
            { preserveScroll: true },
        );
    }, [academicYear]);

    const totalRequirements = groups.reduce((sum, g) => sum + g.requirements.length, 0);

    return (
        <AppLayout breadcrumbs={breadcrumbs(academicYear.code)}>
            <Head title={`${academicYear.code} — Requirements`} />

            <SettingsLayout wide>
                <div className="w-full py-8">
                    <div className="mx-auto w-full max-w-[95%] space-y-6">

                        {/* Header */}
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-3">
                                <button
                                    onClick={() => router.visit(route('academic-years.index'))}
                                    className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </button>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl font-semibold tracking-tight">
                                            Document Requirements
                                        </h2>
                                        <Badge
                                            className={
                                                hasCustomConfig
                                                    ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800/60 shadow-none'
                                                    : 'bg-muted text-muted-foreground border-border shadow-none'
                                            }
                                        >
                                            {hasCustomConfig ? 'Custom Config' : 'Global Defaults'}
                                        </Badge>
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Configure which requirements apply for{' '}
                                        <span className="font-medium text-foreground">{academicYear.name}</span>.{' '}
                                        {totalRequirements} requirement{totalRequirements !== 1 ? 's' : ''} across {groups.length} program{groups.length !== 1 ? 's' : ''}.
                                        <span className="ml-1 text-xs text-muted-foreground/70">
                                            Drag rows to reorder.
                                        </span>
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {/* Copy from year */}
                                {otherYears.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <Select value={copySourceId} onValueChange={setCopySourceId}>
                                            <SelectTrigger className="h-9 w-44 text-sm">
                                                <SelectValue placeholder="Copy from year…" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {otherYears.map((y) => (
                                                    <SelectItem key={y.id} value={y.id}>
                                                        {y.code}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleCopy}
                                            disabled={!copySourceId || isCopying}
                                            className="h-9"
                                        >
                                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                                            {isCopying ? 'Copying…' : 'Copy'}
                                        </Button>
                                    </div>
                                )}

                                {hasCustomConfig && (
                                    <ResetPopover
                                        label={`Reset all for ${academicYear.name}?`}
                                        description="This will remove all overrides and revert every program to global defaults. This cannot be undone."
                                        onConfirm={handleReset}
                                        triggerLabel={isResetting ? 'Resetting…' : 'Reset to Defaults'}
                                        triggerClassName="h-9 border-destructive/50 text-destructive hover:bg-destructive/10"
                                        variant="outline"
                                    />
                                )}

                                <Button
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="h-9 bg-foreground text-background shadow-sm hover:bg-foreground/90"
                                >
                                    <Save className="mr-1.5 h-3.5 w-3.5" />
                                    {isSaving ? 'Saving…' : 'Save Changes'}
                                </Button>
                            </div>
                        </div>

                        {/* Info banner */}
                        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                            Changes here override the <span className="font-medium text-foreground">global</span> document requirement settings for this academic year only.
                            Requirements not listed here will use global defaults when HEIs upload documents.
                        </div>

                        {/* Program groups */}
                        {groups.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 py-20 text-center">
                                <BookOpen className="h-10 w-10 text-muted-foreground/40" />
                                <p className="text-sm text-muted-foreground">No document requirements found. Add requirements in the Document Requirements settings.</p>
                            </div>
                        ) : (
                            groups.map((group) => (
                                <SortableRequirementsTable
                                    key={group.id}
                                    group={group}
                                    rows={rows}
                                    updateRow={updateRow}
                                    reorderGroup={reorderGroup}
                                    onResetProgram={handleResetProgram}
                                />
                            ))
                        )}

                        {/* Bottom save */}
                        {groups.length > 0 && (
                            <div className="flex justify-end">
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="bg-foreground text-background shadow-sm hover:bg-foreground/90"
                                >
                                    <Save className="mr-2 h-4 w-4" />
                                    {isSaving ? 'Saving…' : 'Save Changes'}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
