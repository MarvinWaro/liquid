import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { BarChart3, Filter, TableIcon } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Summary', href: '#' },
    { title: 'Per Academic Year', href: '/summary/academic-year' },
];

interface AYSummary {
    academic_year: string;
    total_grantees: number;
    total_disbursements: number;
    liquidated_amount: number;
    unliquidated_amount: number;
    for_endorsement: number;
    for_compliance: number;
    unliquidated_with_submission: number;
    total_with_submission: number;
    percentage_liquidation: number;
    percentage_compliance: number;
    percentage_submission: number;
}

interface Program {
    id: string;
    code: string;
    name: string;
}

interface Props {
    summaryPerAY: AYSummary[];
    programs: Program[];
    filters: { program: string };
    userRole?: string;
}

export default function SummaryPerAcademicYear({ summaryPerAY, programs = [], filters, userRole }: Props) {
    // STuFAPs formula: Liquidated / Disbursed
    // TES formula: (Liquidated + For Endorsement) / Disbursed
    const isStufapsFocal = userRole === 'STUFAPS Focal';
    const computePercentLiquidation = (row: AYSummary) => {
        const disbursements = Number(row.total_disbursements) || 0;
        if (!disbursements) return 0;
        const liquidated = Number(row.liquidated_amount) || 0;
        const endorsed = Number(row.for_endorsement) || 0;
        const numerator = isStufapsFocal ? liquidated : liquidated + endorsed;
        return (numerator / disbursements) * 100;
    };
    const [ayFilter, setAYFilter] = useState<string>('all');
    const [showChart, setShowChart] = useState(false);

    const academicYears = ['all', ...Array.from(new Set(summaryPerAY.map(item => item.academic_year)))];

    const filtered = ayFilter === 'all'
        ? summaryPerAY
        : summaryPerAY.filter(item => item.academic_year === ayFilter);

    const selectedProgram = programs.find(p => p.id === filters?.program);

    const handleProgramFilter = (value: string) => {
        router.get('/summary/academic-year', { program: value === 'all' ? undefined : value }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const formatCurrency = (amount: number | null | undefined) => {
        const value = amount ?? 0;
        return `₱${parseFloat(value.toString()).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    const formatPercentage = (percentage: number | null) => {
        if (percentage === null || isNaN(percentage)) return '0.00%';
        return `${parseFloat(percentage.toString()).toFixed(2)}%`;
    };

    const formatNumber = (value: number | string | null | undefined) => {
        const num = parseFloat(String(value ?? 0));
        if (isNaN(num)) return '0';
        return Math.round(num).toLocaleString('en-US');
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Summary per Academic Year" />
            <div className="py-8 w-full">
                <div className="w-full max-w-[100%] mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold tracking-tight">Summary per Academic Year</h2>
                            <p className="text-sm text-muted-foreground">
                                Overview of liquidation data grouped by academic year.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {programs.length > 0 && (
                                <>
                                    <Filter className="h-4 w-4 text-muted-foreground" />
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div>
                                                    <Select value={filters?.program || 'all'} onValueChange={handleProgramFilter}>
                                                        <SelectTrigger className="w-[160px] h-9 text-xs">
                                                            <span className="truncate">
                                                                {selectedProgram ? selectedProgram.code : 'All Programs'}
                                                            </span>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="all" className="text-xs">All Programs</SelectItem>
                                                            {programs.map(p => (
                                                                <SelectItem key={p.id} value={p.id} className="text-xs">
                                                                    {p.code} — {p.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </TooltipTrigger>
                                            {selectedProgram && (
                                                <TooltipContent>
                                                    <p>{selectedProgram.code} — {selectedProgram.name}</p>
                                                </TooltipContent>
                                            )}
                                        </Tooltip>
                                    </TooltipProvider>
                                </>
                            )}
                            <Select value={ayFilter} onValueChange={setAYFilter}>
                                <SelectTrigger className="w-[140px] h-9 text-xs">
                                    <SelectValue placeholder="Filter by year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {academicYears.map(year => (
                                        <SelectItem key={year} value={year} className="text-xs">
                                            {year === 'all' ? 'All Years' : year}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                variant={showChart ? 'default' : 'outline'}
                                size="sm"
                                className="h-9 gap-1.5 text-xs"
                                onClick={() => setShowChart(!showChart)}
                            >
                                {showChart ? <TableIcon className="h-3.5 w-3.5" /> : <BarChart3 className="h-3.5 w-3.5" />}
                                {showChart ? 'Table' : 'Charts'}
                            </Button>
                        </div>
                    </div>

                    {showChart && filtered.length > 0 ? (() => {
                        const chartData = filtered
                            .slice()
                            .sort((a, b) => a.academic_year.localeCompare(b.academic_year))
                            .map(r => ({
                                name: r.academic_year,
                                'Liquidated': Number(r.liquidated_amount),
                                'For Endorsement': Number(r.for_endorsement),
                                'For Compliance': Number(r.for_compliance),
                                'Unliquidated': Math.max(0, Number(r.total_disbursements) - Number(r.liquidated_amount) - Number(r.for_endorsement) - Number(r.for_compliance)),
                                '% Liquidation': Number(computePercentLiquidation(r).toFixed(2)),
                                '% Compliance': Number((Number(r.percentage_compliance) || 0).toFixed(2)),
                                '% Submission': Number((Number(r.percentage_submission) || 0).toFixed(2)),
                                'Grantees': Number(r.total_grantees),
                            }));

                        const customTooltip = ({ active, payload, label }: any) => {
                            if (!active || !payload?.length) return null;
                            return (
                                <div className="bg-background border border-border rounded-lg shadow-xl p-3 min-w-[220px]">
                                    <p className="font-semibold text-sm mb-2 pb-2 border-b border-border">{label}</p>
                                    <div className="space-y-1.5">
                                        {payload.map((entry: any, i: number) => (
                                            <div key={i} className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: entry.color }} />
                                                    <span className="text-xs text-muted-foreground">{entry.name}</span>
                                                </div>
                                                <span className="font-mono text-xs font-medium">
                                                    {typeof entry.value === 'number' && entry.name?.startsWith('%')
                                                        ? `${entry.value.toFixed(2)}%`
                                                        : typeof entry.value === 'number' && entry.name === 'Grantees'
                                                            ? entry.value.toLocaleString()
                                                            : formatCurrency(entry.value)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        };

                        return (
                            <div className="space-y-6">
                                {/* Chart 1: Stacked bar — Disbursed = Liquidated + Endorsed + Compliance + Remaining */}
                                <div className="rounded-lg border bg-card p-6">
                                    <h3 className="text-sm font-semibold mb-1">Disbursement Breakdown</h3>
                                    <p className="text-xs text-muted-foreground mb-4">How funds are distributed across liquidation categories per academic year</p>
                                    <ResponsiveContainer width="100%" height={350}>
                                        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                                            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₱${(v / 1_000_000).toFixed(0)}M`} />
                                            <RechartsTooltip content={customTooltip} />
                                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} formatter={(v) => <span className="text-foreground text-xs">{v}</span>} />
                                            <Bar dataKey="Liquidated" stackId="a" fill="#10b981" isAnimationActive={false} />
                                            <Bar dataKey="For Endorsement" stackId="a" fill="#f59e0b" isAnimationActive={false} />
                                            <Bar dataKey="For Compliance" stackId="a" fill="#8b5cf6" isAnimationActive={false} />
                                            <Bar dataKey="Unliquidated" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Chart 2: Grouped percentage bars */}
                                <div className="rounded-lg border bg-card p-6">
                                    <h3 className="text-sm font-semibold mb-1">Liquidation Rates</h3>
                                    <p className="text-xs text-muted-foreground mb-4">Percentage comparison across academic years</p>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                                            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                            <RechartsTooltip content={customTooltip} />
                                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} formatter={(v) => <span className="text-foreground text-xs">{v}</span>} />
                                            <Bar dataKey="% Liquidation" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                                            <Bar dataKey="% Compliance" fill="#8b5cf6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                                            <Bar dataKey="% Submission" fill="#f59e0b" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        );
                    })() : (
                        <div className="rounded-lg border bg-card overflow-hidden [&_td]:border-r [&_td]:border-border/40 [&_th]:border-r [&_th]:border-border/40 [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-b hover:bg-transparent">
                                        <TableHead className="h-9 pl-6 text-xs font-medium tracking-wider text-muted-foreground uppercase">Academic Year</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase text-right">Grantees</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Total Disbursements</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Liquidated Amount</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Unliquidated Amount</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">For Endorsement</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">For Compliance</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">% Liquidation</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">% Compliance</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Total Amount With Submission</TableHead>
                                        <TableHead className="h-9 pr-6 text-xs font-medium tracking-wider text-muted-foreground uppercase">% Submission</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                                                No data available.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filtered.map((row) => (
                                            <TableRow key={row.academic_year}>
                                                <TableCell className="pl-6 font-medium">{row.academic_year}</TableCell>
                                                <TableCell className="font-mono text-right">{formatNumber(row.total_grantees)}</TableCell>
                                                <TableCell className="font-mono">{formatCurrency(row.total_disbursements)}</TableCell>
                                                <TableCell className="font-mono">{formatCurrency(row.liquidated_amount)}</TableCell>
                                                <TableCell className="font-mono text-red-500">{formatCurrency(Number(row.total_disbursements) - Number(row.liquidated_amount))}</TableCell>
                                                <TableCell className="font-mono">{formatCurrency(row.for_endorsement)}</TableCell>
                                                <TableCell className="font-mono">{formatCurrency(row.for_compliance)}</TableCell>
                                                <TableCell className={
                                                    computePercentLiquidation(row) >= 100 ? 'text-green-600 font-medium'
                                                    : computePercentLiquidation(row) >= 75 ? 'text-blue-600 font-medium'
                                                    : computePercentLiquidation(row) >= 50 ? 'text-orange-500 font-medium'
                                                    : 'text-red-500 font-medium'
                                                }>{formatPercentage(computePercentLiquidation(row))}</TableCell>
                                                <TableCell className={
                                                    (Number(row.percentage_compliance) || 0) >= 100 ? 'text-green-600 font-medium'
                                                    : (Number(row.percentage_compliance) || 0) >= 75 ? 'text-blue-600 font-medium'
                                                    : (Number(row.percentage_compliance) || 0) >= 50 ? 'text-orange-500 font-medium'
                                                    : 'text-red-500 font-medium'
                                                }>{formatPercentage(row.percentage_compliance)}</TableCell>
                                                <TableCell className="font-mono">{formatCurrency(Number(row.total_with_submission))}</TableCell>
                                                <TableCell className={`pr-6 ${
                                                    (Number(row.percentage_submission) || 0) >= 100 ? 'text-green-600 font-medium'
                                                    : (Number(row.percentage_submission) || 0) >= 75 ? 'text-blue-600 font-medium'
                                                    : (Number(row.percentage_submission) || 0) >= 50 ? 'text-orange-500 font-medium'
                                                    : 'text-red-500 font-medium'
                                                }`}>{formatPercentage(row.percentage_submission)}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
