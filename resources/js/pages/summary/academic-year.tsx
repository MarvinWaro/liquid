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
    Line,
    ComposedChart,
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
}

export default function SummaryPerAcademicYear({ summaryPerAY, programs = [], filters }: Props) {
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

    const formatNumber = (value: number | null | undefined) => {
        return (value ?? 0).toLocaleString();
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

                    {showChart && filtered.length > 0 ? (
                        <div className="space-y-6">
                            {/* Financial Breakdown Chart */}
                            <div className="rounded-lg border bg-card p-6">
                                <h3 className="text-sm font-semibold mb-4">Financial Breakdown</h3>
                                <ResponsiveContainer width="100%" height={350}>
                                    <BarChart data={filtered} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="academic_year" className="text-xs" tick={{ fontSize: 11 }} />
                                        <YAxis className="text-xs" tick={{ fontSize: 11 }} tickFormatter={(v) => `₱${(v / 1_000_000).toFixed(1)}M`} />
                                        <RechartsTooltip
                                            formatter={(value: number, name: string) => [formatCurrency(value), name]}
                                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                        <Bar dataKey="total_disbursements" name="Total Disbursements" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="liquidated_amount" name="Liquidated" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="unliquidated_amount" name="Unliquidated" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="for_endorsement" name="For Endorsement" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="for_compliance" name="For Compliance" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Percentage & Grantees Chart */}
                            <div className="rounded-lg border bg-card p-6">
                                <h3 className="text-sm font-semibold mb-4">Rates & Grantees</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <ComposedChart data={filtered} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="academic_year" className="text-xs" tick={{ fontSize: 11 }} />
                                        <YAxis yAxisId="left" className="text-xs" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                                        <YAxis yAxisId="right" orientation="right" className="text-xs" tick={{ fontSize: 11 }} tickFormatter={(v) => v.toLocaleString()} />
                                        <RechartsTooltip
                                            formatter={(value: number, name: string) =>
                                                name === 'Grantees' ? [value.toLocaleString(), name] : [`${Number(value).toFixed(2)}%`, name]
                                            }
                                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                        <Bar yAxisId="right" dataKey="total_grantees" name="Grantees" fill="#0ea5e9" radius={[4, 4, 0, 0]} opacity={0.4} />
                                        <Line yAxisId="left" type="monotone" dataKey="percentage_liquidation" name="% Liquidation" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                                        <Line yAxisId="left" type="monotone" dataKey="percentage_compliance" name="% Compliance" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
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
                                        <TableHead className="h-9 pl-6 text-xs font-medium tracking-wider text-muted-foreground uppercase">Academic Year</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase text-right">Grantees</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Total Disbursements</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Liquidated Amount</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Unliquidated Amount</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">For Endorsement</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">For Compliance</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">% Liquidation</TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">% Compliance</TableHead>
                                        <TableHead className="h-9 pr-6 text-xs font-medium tracking-wider text-muted-foreground uppercase">% Submission</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
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
                                                <TableCell className="font-mono text-red-500">{formatCurrency(row.unliquidated_amount)}</TableCell>
                                                <TableCell className="font-mono">{formatCurrency(row.for_endorsement)}</TableCell>
                                                <TableCell className="font-mono">{formatCurrency(row.for_compliance)}</TableCell>
                                                <TableCell>{formatPercentage(row.percentage_liquidation)}</TableCell>
                                                <TableCell>{formatPercentage(row.percentage_compliance)}</TableCell>
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
