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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, BarChart3, TableIcon, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    ResponsiveContainer,
    ScatterChart,
    Scatter,
    ZAxis,
} from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Summary', href: '#' },
    { title: 'Per HEI', href: '/summary/hei' },
];

interface HEISummary {
    hei_id: string;
    hei: {
        id: string;
        name: string;
        uii?: string;
    };
    total_grantees: number;
    total_disbursements: number;
    total_amount_liquidated: number;
    for_endorsement: number;
    unliquidated_amount: number;
    for_compliance: number;
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
    summaryPerHEI: HEISummary[];
    programs: Program[];
    filters: { program: string };
    userRole?: string;
}

export default function SummaryPerHEI({ summaryPerHEI, programs = [], filters, userRole }: Props) {
    // STuFAPs formula: Liquidated / Disbursed
    // TES formula: (Liquidated + For Endorsement) / Disbursed
    const isStufapsFocal = userRole === 'STUFAPS Focal';
    const computePercentLiquidation = (row: HEISummary) => {
        const disbursements = Number(row.total_disbursements) || 0;
        if (!disbursements) return 0;
        const liquidated = Number(row.total_amount_liquidated) || 0;
        const endorsed = Number(row.for_endorsement) || 0;
        const numerator = isStufapsFocal ? liquidated : liquidated + endorsed;
        return (numerator / disbursements) * 100;
    };
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [showChart, setShowChart] = useState(false);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 25;

    type SortKey =
        | 'name' | 'grantees' | 'disbursements' | 'liquidated'
        | 'for_endorsement' | 'unliquidated_net'
        | 'for_compliance' | 'total_with_submission'
        | 'pct_liquidation' | 'pct_compliance' | 'pct_submission';
    const [sortKey, setSortKey] = useState<SortKey | null>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
        setPage(1);
    };

    const SortIcon = ({ col }: { col: SortKey }) => {
        if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />;
        return sortDir === 'asc'
            ? <ChevronUp className="h-3 w-3 ml-1 text-primary" />
            : <ChevronDown className="h-3 w-3 ml-1 text-primary" />;
    };

    const getSortValue = (row: HEISummary, key: SortKey): number | string => {
        switch (key) {
            case 'name': return row.hei?.name?.toLowerCase() ?? '';
            case 'grantees': return Number(row.total_grantees) || 0;
            case 'disbursements': return Number(row.total_disbursements) || 0;
            case 'liquidated': return Number(row.total_amount_liquidated) || 0;
            case 'for_endorsement': return Number(row.for_endorsement) || 0;
            case 'unliquidated_net': return Number(row.total_disbursements) - Number(row.total_amount_liquidated) - Number(row.for_endorsement);
            case 'for_compliance': return Number(row.for_compliance) || 0;
            case 'total_with_submission': return Number(row.total_with_submission) || 0;
            case 'pct_liquidation': return computePercentLiquidation(row);
            case 'pct_compliance': return Number(row.percentage_compliance) || 0;
            case 'pct_submission': return Number(row.percentage_submission) || 0;
        }
    };

    const filtered = summaryPerHEI.filter(item => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            item.hei?.name.toLowerCase().includes(q) ||
            (item.hei?.uii ?? '').toLowerCase().includes(q)
        );
    });

    const sorted = sortKey
        ? [...filtered].sort((a, b) => {
            const av = getSortValue(a, sortKey);
            const bv = getSortValue(b, sortKey);
            const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
            return sortDir === 'asc' ? cmp : -cmp;
        })
        : filtered;

    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const paginated = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const selectedProgram = programs.find(p => p.id === filters?.program);

    const handleProgramFilter = (value: string) => {
        router.get('/summary/hei', { program: value === 'all' ? undefined : value }, {
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
            <Head title="Summary per HEI" />
            <div className="py-8 w-full">
                <div className="w-full max-w-[100%] mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold tracking-tight">Summary per HEI</h2>
                            <p className="text-sm text-muted-foreground">
                                Overview of liquidation data grouped by Higher Education Institution.
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
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search HEI..."
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                                className="w-[200px] h-9 text-xs"
                            />
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

                    {showChart && sorted.length > 0 ? (() => {
                        // Top 15 HEIs by total disbursements for the stacked bar
                        const top15 = [...sorted]
                            .sort((a, b) => Number(b.total_disbursements) - Number(a.total_disbursements))
                            .slice(0, 15)
                            .map(r => ({
                                name: (r.hei?.name || 'N/A').substring(0, 25),
                                fullName: r.hei?.name || 'N/A',
                                'Liquidated': Number(r.total_amount_liquidated),
                                'For Endorsement': Number(r.for_endorsement),
                                'For Compliance': Number(r.for_compliance),
                                'Unliquidated': Math.max(0, Number(r.total_disbursements) - Number(r.total_amount_liquidated) - Number(r.for_endorsement) - Number(r.for_compliance)),
                            }));

                        // Scatter data — all HEIs: x = % Liquidation, y = % Submission, size = grantees
                        const scatterData = sorted.map(r => ({
                            name: r.hei?.name || 'N/A',
                            x: Number(computePercentLiquidation(r).toFixed(2)),
                            y: Number((Number(r.percentage_submission) || 0).toFixed(2)),
                            z: Number(r.total_grantees) || 1,
                        }));

                        const customTooltip = ({ active, payload, label }: any) => {
                            if (!active || !payload?.length) return null;
                            return (
                                <div className="bg-background border border-border rounded-lg shadow-xl p-3 min-w-[220px]">
                                    <p className="font-semibold text-sm mb-2 pb-2 border-b border-border">{label || payload[0]?.payload?.fullName || payload[0]?.payload?.name}</p>
                                    <div className="space-y-1.5">
                                        {payload.map((entry: any, i: number) => (
                                            <div key={i} className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: entry.color }} />
                                                    <span className="text-xs text-muted-foreground">{entry.name}</span>
                                                </div>
                                                <span className="font-mono text-xs font-medium">
                                                    {formatCurrency(entry.value)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        };

                        const scatterTooltip = ({ active, payload }: any) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload;
                            return (
                                <div className="bg-background border border-border rounded-lg shadow-xl p-3 min-w-[200px]">
                                    <p className="font-semibold text-sm mb-2 pb-2 border-b border-border">{d.name}</p>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">% Liquidation</span><span className="font-mono font-medium">{d.x}%</span></div>
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">% Submission</span><span className="font-mono font-medium">{d.y}%</span></div>
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Grantees</span><span className="font-mono font-medium">{d.z.toLocaleString()}</span></div>
                                    </div>
                                </div>
                            );
                        };

                        return (
                            <div className="space-y-6">
                                {/* Chart 1: Top 15 HEIs — horizontal stacked bar */}
                                <div className="rounded-lg border bg-card p-6">
                                    <h3 className="text-sm font-semibold mb-1">Top 15 HEIs by Disbursement</h3>
                                    <p className="text-xs text-muted-foreground mb-4">Fund utilization breakdown for the largest disbursements</p>
                                    <ResponsiveContainer width="100%" height={Math.max(400, top15.length * 36)}>
                                        <BarChart data={top15} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} horizontal={false} />
                                            <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₱${(v / 1_000_000).toFixed(0)}M`} />
                                            <YAxis dataKey="name" type="category" width={170} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                                            <RechartsTooltip content={customTooltip} />
                                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} formatter={(v) => <span className="text-foreground text-xs">{v}</span>} />
                                            <Bar dataKey="Liquidated" stackId="a" fill="#10b981" isAnimationActive={false} />
                                            <Bar dataKey="For Endorsement" stackId="a" fill="#f59e0b" isAnimationActive={false} />
                                            <Bar dataKey="For Compliance" stackId="a" fill="#8b5cf6" isAnimationActive={false} />
                                            <Bar dataKey="Unliquidated" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Chart 2: Scatter — % Liquidation vs % Submission */}
                                <div className="rounded-lg border bg-card p-6">
                                    <h3 className="text-sm font-semibold mb-1">Liquidation vs Submission Rates</h3>
                                    <p className="text-xs text-muted-foreground mb-4">Each dot is an HEI. Dot size = number of grantees. Top-right = best performance.</p>
                                    <ResponsiveContainer width="100%" height={400}>
                                        <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                                            <XAxis type="number" dataKey="x" name="% Liquidation" domain={[0, 110]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} label={{ value: '% Liquidation', position: 'insideBottom', offset: -5, fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                                            <YAxis type="number" dataKey="y" name="% Submission" domain={[0, 110]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} label={{ value: '% Submission', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                                            <ZAxis type="number" dataKey="z" range={[40, 400]} />
                                            <RechartsTooltip content={scatterTooltip} />
                                            <Scatter data={scatterData} fill="#10b981" fillOpacity={0.6} stroke="#10b981" strokeWidth={1} isAnimationActive={false} />
                                        </ScatterChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        );
                    })() : (
                        <div className="rounded-lg border bg-card overflow-hidden [&_td]:border-r [&_td]:border-border/40 [&_th]:border-r [&_th]:border-border/40 [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-b hover:bg-transparent">
                                        <TableHead className="h-9 pl-6 text-xs font-medium tracking-wider text-muted-foreground uppercase">No.</TableHead>
                                        {(
                                            [
                                                { col: 'name', label: 'Name of HEI', className: 'min-w-[200px]' },
                                                { col: 'grantees', label: 'Grantees', className: 'text-right' },
                                                { col: 'disbursements', label: 'Total Disbursements', className: '' },
                                                { col: 'liquidated', label: 'Total Amount Liquidated', className: '' },
                                                { col: 'for_endorsement', label: 'For Endorsement', className: '' },
                                                { col: 'unliquidated_net', label: 'Unliquidated (net of endorsement)', className: '' },
                                                { col: 'for_compliance', label: 'For Compliance', className: '' },
                                                { col: 'total_with_submission', label: 'Total Amount With Submission', className: '' },
                                                { col: 'pct_liquidation', label: '% Liquidation', className: '' },
                                                { col: 'pct_compliance', label: '% Compliance', className: '' },
                                                { col: 'pct_submission', label: '% Submission', className: 'pr-6' },
                                            ] as { col: SortKey; label: string; className: string }[]
                                        ).map(({ col, label, className }) => (
                                            <TableHead
                                                key={col}
                                                className={`h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase cursor-pointer select-none hover:text-foreground transition-colors ${className}`}
                                                onClick={() => handleSort(col)}
                                            >
                                                <span className="inline-flex items-center">
                                                    {label}
                                                    <SortIcon col={col} />
                                                </span>
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sorted.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                                                {searchQuery ? 'No matching HEIs found.' : 'No data available.'}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginated.map((row, index) => (
                                            <TableRow key={row.hei_id}>
                                                <TableCell className="pl-6 font-medium text-muted-foreground text-xs">
                                                    {(currentPage - 1) * PAGE_SIZE + index + 1}
                                                </TableCell>
                                                <TableCell className="max-w-[220px] py-2.5">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className="cursor-default">
                                                                    <div className="font-medium text-sm truncate">{row.hei?.name || 'N/A'}</div>
                                                                    {row.hei?.uii && (
                                                                        <div className="text-xs text-muted-foreground font-mono">{row.hei.uii}</div>
                                                                    )}
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="right" className="max-w-xs">
                                                                <p className="font-medium">{row.hei?.name || 'N/A'}</p>
                                                                {row.hei?.uii && <p className="text-xs text-muted-foreground font-mono">{row.hei.uii}</p>}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </TableCell>
                                                <TableCell className="font-mono text-right">{formatNumber(row.total_grantees)}</TableCell>
                                                <TableCell className="font-mono">{formatCurrency(row.total_disbursements)}</TableCell>
                                                <TableCell className="font-mono">{formatCurrency(row.total_amount_liquidated)}</TableCell>
                                                <TableCell className="font-mono">{formatCurrency(row.for_endorsement)}</TableCell>
                                                <TableCell className="font-mono text-red-500">{formatCurrency(Number(row.total_disbursements) - Number(row.total_amount_liquidated) - Number(row.for_endorsement))}</TableCell>
                                                <TableCell className="font-mono">{formatCurrency(row.for_compliance)}</TableCell>
                                                <TableCell className="font-mono">{formatCurrency(Number(row.total_with_submission))}</TableCell>
                                                <TableCell className={
                                                    computePercentLiquidation(row) >= 100 ? 'text-green-600 font-medium'
                                                    : computePercentLiquidation(row) >= 75 ? 'text-blue-600 font-medium'
                                                    : computePercentLiquidation(row) >= 50 ? 'text-orange-500 font-medium'
                                                    : 'text-red-500 font-medium'
                                                }>{formatPercentage(computePercentLiquidation(row))}</TableCell>
                                                <TableCell className={
                                                    (row.percentage_compliance ?? 0) >= 100 ? 'text-green-600 font-medium'
                                                    : (row.percentage_compliance ?? 0) >= 75 ? 'text-blue-600 font-medium'
                                                    : (row.percentage_compliance ?? 0) >= 50 ? 'text-orange-500 font-medium'
                                                    : 'text-red-500 font-medium'
                                                }>{formatPercentage(row.percentage_compliance)}</TableCell>
                                                <TableCell className={`pr-6 ${
                                                    (row.percentage_submission ?? 0) >= 100 ? 'text-green-600 font-medium'
                                                    : (row.percentage_submission ?? 0) >= 75 ? 'text-blue-600 font-medium'
                                                    : (row.percentage_submission ?? 0) >= 50 ? 'text-orange-500 font-medium'
                                                    : 'text-red-500 font-medium'
                                                }`}>{formatPercentage(row.percentage_submission)}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>

                            {/* Pagination footer */}
                            {sorted.length > PAGE_SIZE && (
                                <div className="flex items-center justify-between px-6 py-3 border-t text-sm text-muted-foreground">
                                    <span>
                                        Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sorted.length)} of {sorted.length} HEIs
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2.5 text-xs"
                                            disabled={currentPage === 1}
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                        >
                                            Previous
                                        </Button>
                                        <span className="px-2 text-xs">
                                            Page {currentPage} of {totalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2.5 text-xs"
                                            disabled={currentPage === totalPages}
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
