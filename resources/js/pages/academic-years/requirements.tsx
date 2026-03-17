import { Badge } from '@/components/ui/badge';
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
import { Head, router, useForm } from '@inertiajs/react';
import { ArrowLeft, BookOpen, Check, Copy, RefreshCcw, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

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

export default function Requirements({ academicYear, groupedRequirements, otherYears, hasCustomConfig }: Props) {
    // Build row state from props — recomputes when Inertia refreshes props
    const buildRows = useCallback((groups: ProgramGroup[]) => {
        const init: Record<string, Omit<Requirement, 'id' | 'code' | 'name' | 'description'>> = {};
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

    // Re-sync local state when props refresh (after save/copy/reset)
    useEffect(() => {
        setRows(buildRows(groupedRequirements));
    }, [groupedRequirements, buildRows]);

    const [isSaving, setIsSaving] = useState(false);
    const [copySourceId, setCopySourceId] = useState('');
    const [isCopying, setIsCopying] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const updateRow = useCallback((reqId: string, field: 'is_required' | 'is_active' | 'sort_order', value: boolean | number) => {
        setRows((prev) => ({
            ...prev,
            [reqId]: { ...prev[reqId], [field]: value },
        }));
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
        if (!confirm(`Reset all requirements for ${academicYear.name} to global defaults? This cannot be undone.`)) return;
        setIsResetting(true);
        router.delete(
            route('academic-years.requirements.reset', academicYear.id),
            {
                onFinish: () => setIsResetting(false),
                preserveScroll: false,
            },
        );
    };

    const totalRequirements = groupedRequirements.reduce((sum, g) => sum + g.requirements.length, 0);

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
                                        {totalRequirements} requirement{totalRequirements !== 1 ? 's' : ''} across {groupedRequirements.length} program{groupedRequirements.length !== 1 ? 's' : ''}.
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
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleReset}
                                        disabled={isResetting}
                                        className="h-9 border-destructive/50 text-destructive hover:bg-destructive/10"
                                    >
                                        <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                                        {isResetting ? 'Resetting…' : 'Reset to Defaults'}
                                    </Button>
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
                        {groupedRequirements.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 py-20 text-center">
                                <BookOpen className="h-10 w-10 text-muted-foreground/40" />
                                <p className="text-sm text-muted-foreground">No document requirements found. Add requirements in the Document Requirements settings.</p>
                            </div>
                        ) : (
                            groupedRequirements.map((group) => (
                                <div key={group.id} className="overflow-hidden rounded-lg border">
                                    {/* Program header */}
                                    <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2.5">
                                        <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                            {group.code}
                                        </span>
                                        <span className="text-sm font-semibold text-foreground">{group.name}</span>
                                        <Badge variant="outline" className="ml-auto border-border bg-muted text-foreground text-xs">
                                            {group.requirements.length} requirement{group.requirements.length !== 1 ? 's' : ''}
                                        </Badge>
                                    </div>

                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-b hover:bg-transparent">
                                                <TableHead className="h-9 w-24 pl-4 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                                    Code
                                                </TableHead>
                                                <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                                    Requirement
                                                </TableHead>
                                                <TableHead className="h-9 w-28 text-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                                    Required
                                                </TableHead>
                                                <TableHead className="h-9 w-28 text-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                                    Active
                                                </TableHead>
                                                <TableHead className="h-9 w-28 pr-4 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                                    Sort Order
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {group.requirements.map((req) => {
                                                const row = rows[req.id];
                                                if (!row) return null;
                                                return (
                                                    <TableRow key={req.id} className="transition-colors hover:bg-muted/50">
                                                        <TableCell className="py-2 pl-4">
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
                                                        <TableCell className="py-2 text-center">
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
                                                        <TableCell className="py-2 pr-4">
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                value={row.sort_order}
                                                                onChange={(e) => updateRow(req.id, 'sort_order', Number(e.target.value))}
                                                                className="h-7 w-20 text-center text-sm"
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            ))
                        )}

                        {/* Bottom save */}
                        {groupedRequirements.length > 0 && (
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
