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
import { Search, Filter, BarChart3, TableIcon } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    ResponsiveContainer,
    Line,
    ComposedChart,
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
    };
    total_grantees: number;
    total_disbursements: number;
    total_amount_liquidated: number;
    for_endorsement: number;
    unliquidated_amount: number;
    for_compliance: number;
    percentage_liquidation: number;
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
}

export default function SummaryPerHEI({ summaryPerHEI, programs = [], filters }: Props) {
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [showChart, setShowChart] = useState(false);

    const filtered = summaryPerHEI.filter(item => {
        if (!searchQuery.trim()) return true;
        return item.hei?.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

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

    const formatNumber = (value: number | null | undefined) => {
        return (value ?? 0).toLocaleString();
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
                                onChange={(e) => setSearchQuery(e.target.value)}
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

                    {showChart && filtered.length > 0 ? (
                        <div className="space-y-6">
                            {/* Financial Breakdown Chart */}
                            <div className="rounded-lg border bg-card p-6">
                                <h3 className="text-sm font-semibold mb-4">Financial Breakdown by HEI</h3>
                                <ResponsiveContainer width="100%" height={Math.max(350, filtered.length * 40)}>
                                    <BarChart
                                        data={filtered.map(r => ({ ...r, name: r.hei?.name || 'N/A' }))}
                                        layout="vertical"
                                        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₱${(v / 1_000_000).toFixed(1)}M`} />
                                        <YAxis dataKey="name" type="category" width={180} tick={{ fontSize: 10 }} />
                                        <RechartsTooltip
                                            formatter={(value: number, name: string) => [formatCurrency(value), name]}
                                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                        <Bar dataKey="total_disbursements" name="Total Disbursements" fill="#6366f1" radius={[0, 4, 4, 0]} />
                                        <Bar dataKey="total_amount_liquidated" name="Liquidated" fill="#22c55e" radius={[0, 4, 4, 0]} />
                                        <Bar dataKey="unliquidated_amount" name="Unliquidated" fill="#ef4444" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Percentage & Grantees Chart */}
                            <div className="rounded-lg border bg-card p-6">
                                <h3 className="text-sm font-semibold mb-4">Liquidation Rates & Grantees</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <ComposedChart
                                        data={filtered.map(r => ({ ...r, name: r.hei?.name?.substring(0, 30) || 'N/A' }))}
                                        margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="name" tick={{ fontSize: 9, angle: -45, textAnchor: 'end' }} interval={0} height={80} />
                                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => v.toLocaleString()} />
                                        <RechartsTooltip
                                            formatter={(value: number, name: string) =>
                                                name === 'Grantees' ? [value.toLocaleString(), name] : [`${Number(value).toFixed(2)}%`, name]
                                            }
                                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                        <Bar yAxisId="right" dataKey="total_grantees" name="Grantees" fill="#0ea5e9" radius={[4, 4, 0, 0]} opacity={0.4} />
                                        <Line yAxisId="left" type="monotone" dataKey="percentage_liquidation" name="% Liquidation" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                                        <Line yAxisId="left" type="monotone" dataKey="percentage_submission" name="% Submission" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-lg border bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-b hover:bg-transparent">
                                        <TableHead className="h-9 pl-6 text-xs font-medium tracking-wider text-muted-foreground uppercase">No.</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Name of HEI</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase text-right">Grantees</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Total Disbursements</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Total Amount Liquidated</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">For Endorsement</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Unliquidated Amount</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">For Compliance</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">% Liquidation</TableHead>
                                        <TableHead className="h-9 pr-6 text-xs font-medium tracking-wider text-muted-foreground uppercase">% Submission</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                                                {searchQuery ? 'No matching HEIs found.' : 'No data available.'}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filtered.map((row, index) => (
                                            <TableRow key={row.hei_id}>
                                                <TableCell className="pl-6 font-medium">{index + 1}</TableCell>
                                                <TableCell className="font-medium">{row.hei?.name || 'N/A'}</TableCell>
                                                <TableCell className="font-mono text-right">{formatNumber(row.total_grantees)}</TableCell>
                                                <TableCell className="font-mono">{formatCurrency(row.total_disbursements)}</TableCell>
                                                <TableCell className="font-mono">{formatCurrency(row.total_amount_liquidated)}</TableCell>
                                                <TableCell className="font-mono">{formatCurrency(row.for_endorsement)}</TableCell>
                                                <TableCell className="font-mono text-red-500">{formatCurrency(row.unliquidated_amount)}</TableCell>
                                                <TableCell className="font-mono">{formatCurrency(row.for_compliance)}</TableCell>
                                                <TableCell>{formatPercentage(row.percentage_liquidation)}</TableCell>
                                                <TableCell className="pr-6">{formatPercentage(row.percentage_submission)}</TableCell>
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
