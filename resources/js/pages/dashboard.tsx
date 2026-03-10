import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { DollarSign, FileText, CheckCircle, Clock, AlertCircle, Filter, Search } from 'lucide-react';
import { useDashboardLayout } from '@/hooks/use-dashboard-layout';
import { SortableDashboard, DashboardCard, DashboardToolbar } from '@/components/sortable-dashboard';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
];

interface AYSummary {
    academic_year: string;
    total_disbursements: number;
    liquidated_amount: number;
    unliquidated_amount: number;
    for_endorsement: number;
    for_compliance: number;
    percentage_liquidation: number;
    percentage_compliance: number;
    percentage_submission: number;
}

interface HEISummary {
    hei_id: string;
    hei: {
        id: string;
        name: string;
    };
    total_disbursements: number;
    total_amount_liquidated: number;
    for_endorsement: number;
    unliquidated_amount: number;
    for_compliance: number;
    percentage_liquidation: number;
    percentage_submission: number;
}

interface StatusDistribution {
    status: string;
    count: number;
}

interface TotalStats {
    total_liquidations: number;
    total_disbursed: number;
    total_liquidated: number;
    total_unliquidated: number;
    pending_review: number;
}

interface UserStats {
    my_liquidations: number;
    pending_action: number;
    completed: number;
    total_amount: number;
    total_liquidated?: number;
    total_unliquidated?: number;
}

interface RecentLiquidation {
    id: number;
    control_no: string;
    hei?: {
        id: number;
        name: string;
    };
    academic_year: string;
    semester: string;
    amount_received: number;
    status: string;
    created_at: string;
}

interface DashboardProps {
    isAdmin?: boolean;
    summaryPerAY: AYSummary[];
    summaryPerHEI: HEISummary[];
    statusDistribution?: StatusDistribution[];
    totalStats?: TotalStats;
    userStats?: UserStats;
    recentLiquidations?: RecentLiquidation[];
    userRole?: string;
}

interface CardConfig {
    id: string;
    title: string;
    colSpan: number;
}

export default function Dashboard({ isAdmin, summaryPerAY, summaryPerHEI, statusDistribution, totalStats: rawTotalStats, userStats: rawUserStats, recentLiquidations, userRole }: DashboardProps) {
    // Provide default values to prevent undefined errors
    const totalStats: TotalStats = {
        total_liquidations: rawTotalStats?.total_liquidations ?? 0,
        total_disbursed: rawTotalStats?.total_disbursed ?? 0,
        total_liquidated: rawTotalStats?.total_liquidated ?? 0,
        total_unliquidated: rawTotalStats?.total_unliquidated ?? 0,
        pending_review: rawTotalStats?.pending_review ?? 0,
    };

    const userStats: UserStats = {
        my_liquidations: rawUserStats?.my_liquidations ?? 0,
        pending_action: rawUserStats?.pending_action ?? 0,
        completed: rawUserStats?.completed ?? 0,
        total_amount: rawUserStats?.total_amount ?? 0,
        total_liquidated: rawUserStats?.total_liquidated ?? 0,
        total_unliquidated: rawUserStats?.total_unliquidated ?? 0,
    };

    // State for filters
    const [chartAYFilter, setChartAYFilter] = useState<string>('all');
    const [tableAYFilter, setTableAYFilter] = useState<string>('all');
    const [heiSearchQuery, setHeiSearchQuery] = useState<string>('');
    const [recentLiquidationsSearch, setRecentLiquidationsSearch] = useState<string>('');

    // ---------- Utility functions ----------

    const formatCurrency = (amount: number | null | undefined) => {
        const value = amount ?? 0;
        return `₱${parseFloat(value.toString()).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft':
            case 'Draft':
                return 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200';
            case 'for_initial_review':
                return 'bg-gray-800 text-gray-100 hover:bg-gray-900 border-gray-800';
            case 'endorsed_to_accounting':
                return 'bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200';
            case 'endorsed_to_coa':
            case 'Endorsed to COA':
                return 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200';
            case 'returned_to_hei':
            case 'returned_to_rc':
            case 'Returned':
                return 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200';
            case 'Submitted': return 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200';
            case 'Verified': return 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200';
            case 'Cleared': return 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200';
            default: return 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200';
        }
    };

    const formatPercentage = (percentage: number | null) => {
        if (percentage === null || isNaN(percentage)) return '0.00%';
        return `${parseFloat(percentage.toString()).toFixed(2)}%`;
    };

    const formatYAxis = (value: number) => {
        return value.toLocaleString('en-US');
    };

    // ---------- Chart constants ----------

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    const BAR_COLORS = {
        totalDisbursements: '#22c55e',
        liquidatedAmount: '#3b82f6',
        unliquidatedAmount: '#ef4444',
        forCompliance: '#eab308',
    };

    // ---------- Computed data ----------

    const academicYears = ['all', ...Array.from(new Set(summaryPerAY.map(item => item.academic_year)))];

    const chartData = statusDistribution?.map(item => ({
        name: item.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: item.count
    })) || [];

    const filteredChartData = chartAYFilter === 'all'
        ? summaryPerAY
        : summaryPerAY.filter(item => item.academic_year === chartAYFilter);

    const barChartData = filteredChartData
        .slice()
        .sort((a, b) => a.academic_year.localeCompare(b.academic_year))
        .map(item => ({
            name: item.academic_year,
            'Total Disbursements': item.total_disbursements,
            'Amount Liquidated': item.liquidated_amount,
            'Unliquidated Amount': item.unliquidated_amount,
            'For Compliance': item.for_compliance,
        }));

    const filteredSummaryPerAY = tableAYFilter === 'all'
        ? summaryPerAY
        : summaryPerAY.filter(item => item.academic_year === tableAYFilter);

    const filteredSummaryPerHEI = summaryPerHEI.filter(item => {
        if (!heiSearchQuery.trim()) return true;
        return item.hei?.name.toLowerCase().includes(heiSearchQuery.toLowerCase());
    });

    const filteredRecentLiquidations = (recentLiquidations || []).filter(item => {
        if (!recentLiquidationsSearch.trim()) return true;
        const searchLower = recentLiquidationsSearch.toLowerCase();
        return (
            item.control_no.toLowerCase().includes(searchLower) ||
            item.hei?.name.toLowerCase().includes(searchLower) ||
            item.academic_year.toLowerCase().includes(searchLower) ||
            item.semester.toLowerCase().includes(searchLower) ||
            item.status.toLowerCase().includes(searchLower)
        );
    });

    // ---------- Card configuration per role ----------

    const cardConfigs = useMemo<CardConfig[]>(() => {
        const cards: CardConfig[] = [];

        cards.push({ id: 'stats', title: 'Statistics Overview', colSpan: 12 });

        if (chartData.length > 0) {
            cards.push({ id: 'status-distribution', title: 'Status Distribution', colSpan: 4 });
        }
        if (barChartData.length > 0) {
            cards.push({ id: 'liquidation-progress', title: 'Liquidation Progress per Academic Year', colSpan: 8 });
        }

        if (isAdmin || userRole === 'Regional Coordinator' || userRole === 'Accountant') {
            cards.push({ id: 'summary-ay', title: 'Summary per Academic Year', colSpan: 12 });
            cards.push({ id: 'summary-hei', title: 'Summary per HEI', colSpan: 12 });
        }

        if (!isAdmin && recentLiquidations && recentLiquidations.length > 0) {
            cards.push({ id: 'recent-liquidations', title: 'Recent Liquidations', colSpan: 12 });
        }

        return cards;
    }, [isAdmin, userRole, chartData.length, barChartData.length, recentLiquidations]);

    const storageKey = `dashboard-layout-${isAdmin ? 'admin' : userRole || 'default'}`;
    const { layout, updateOrder, toggleVisibility, toggleExpanded, showCard, resetLayout, hiddenCardIds } = useDashboardLayout(
        cardConfigs.map(c => c.id),
        storageKey,
    );

    // ---------- Shared chart tooltip ----------

    const pieTooltip = (
        <Tooltip
            content={({ active, payload }) => {
                if (active && payload && payload.length) {
                    return (
                        <div className="bg-background text-foreground border border-border rounded-lg shadow-xl p-3 min-w-[150px]">
                            <p className="font-semibold text-sm mb-1">{payload[0].name}</p>
                            <p className="text-sm">
                                Count: <span className="font-mono font-medium">{payload[0].value}</span>
                            </p>
                        </div>
                    );
                }
                return null;
            }}
        />
    );

    const barTooltip = (
        <Tooltip
            content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                    return (
                        <div className="bg-background text-foreground border border-border rounded-lg shadow-xl p-3 min-w-[220px]">
                            <p className="font-semibold text-sm mb-2 pb-2 border-b border-border">{label}</p>
                            <div className="space-y-1.5">
                                {payload.map((entry, index) => {
                                    const value = typeof entry.value === 'number' ? entry.value : Number(entry.value) || 0;
                                    return (
                                        <div key={index} className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-sm flex-shrink-0"
                                                    style={{ backgroundColor: entry.color }}
                                                />
                                                <span className="text-xs text-muted-foreground">{entry.name}:</span>
                                            </div>
                                            <span className="font-mono text-xs font-medium text-foreground">
                                                ₱{value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                }
                return null;
            }}
        />
    );

    // ---------- Card render functions ----------

    const renderStats = () => {
        if (isAdmin || userRole === 'Regional Coordinator') {
            return (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Liquidations</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalStats.total_liquidations}</div>
                            <p className="text-xs text-muted-foreground">All liquidation reports</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Disbursed</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(totalStats.total_disbursed)}</div>
                            <p className="text-xs text-muted-foreground">Amount received from CHED</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Liquidated</CardTitle>
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalStats.total_liquidated)}</div>
                            <p className="text-xs text-muted-foreground">Amount disbursed to students</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Unliquidated</CardTitle>
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalStats.total_unliquidated)}</div>
                            <p className="text-xs text-muted-foreground">Remaining from CHED funds</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalStats.pending_review}</div>
                            <p className="text-xs text-muted-foreground">Awaiting review</p>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        if (userRole === 'Accountant') {
            return (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">My Liquidations</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{userStats.my_liquidations}</div>
                            <p className="text-xs text-muted-foreground">Total reports in my queue</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Action</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{userStats.pending_action}</div>
                            <p className="text-xs text-muted-foreground">Requires your attention</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Completed</CardTitle>
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{userStats.completed}</div>
                            <p className="text-xs text-muted-foreground">Successfully processed</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(userStats.total_amount)}</div>
                            <p className="text-xs text-muted-foreground">Received from CHED</p>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        // HEI and other roles
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">My Liquidations</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{userStats.my_liquidations}</div>
                        <p className="text-xs text-muted-foreground">Total reports in my queue</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Action</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{userStats.pending_action}</div>
                        <p className="text-xs text-muted-foreground">Requires your attention</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completed</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{userStats.completed}</div>
                        <p className="text-xs text-muted-foreground">Successfully processed</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(userStats.total_amount)}</div>
                        <p className="text-xs text-muted-foreground">Received from CHED</p>
                    </CardContent>
                </Card>
                {userStats.total_liquidated !== undefined && (
                    <>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Liquidated</CardTitle>
                                <CheckCircle className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">{formatCurrency(userStats.total_liquidated)}</div>
                                <p className="text-xs text-muted-foreground">Disbursed to students</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Unliquidated</CardTitle>
                                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-orange-600">{formatCurrency(userStats.total_unliquidated || 0)}</div>
                                <p className="text-xs text-muted-foreground">Remaining from CHED</p>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        );
    };

    const renderStatusDistribution = () => (
        <ResponsiveContainer width="100%" height={300}>
            <PieChart>
                <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                >
                    {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                {pieTooltip}
                <Legend
                    wrapperStyle={{ fontSize: '12px' }}
                    formatter={(value) => <span className="text-foreground text-xs">{value}</span>}
                />
            </PieChart>
        </ResponsiveContainer>
    );

    const renderLiquidationProgress = () => (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart
                data={barChartData}
                margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis
                    tickFormatter={formatYAxis}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                    width={50}
                />
                {barTooltip}
                <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    formatter={(value) => <span className="text-foreground text-xs">{value}</span>}
                />
                <Bar dataKey="Total Disbursements" fill={BAR_COLORS.totalDisbursements} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Amount Liquidated" fill={BAR_COLORS.liquidatedAmount} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Unliquidated Amount" fill={BAR_COLORS.unliquidatedAmount} radius={[4, 4, 0, 0]} />
                <Bar dataKey="For Compliance" fill={BAR_COLORS.forCompliance} radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );

    const renderSummaryPerAY = () => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="pl-6">Academic Year</TableHead>
                    <TableHead>Total Disbursements</TableHead>
                    <TableHead>Liquidated Amount</TableHead>
                    <TableHead>Unliquidated Amount</TableHead>
                    <TableHead>For Endorsement</TableHead>
                    <TableHead>For Compliance</TableHead>
                    <TableHead>% Age of Liquidation</TableHead>
                    <TableHead>% Age for Compliance</TableHead>
                    <TableHead className="pr-6">% Age of Submission</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {filteredSummaryPerAY.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                            No data available.
                        </TableCell>
                    </TableRow>
                ) : (
                    filteredSummaryPerAY.map((row) => (
                        <TableRow key={row.academic_year}>
                            <TableCell className="pl-6 font-medium">{row.academic_year}</TableCell>
                            <TableCell className="font-mono">{formatCurrency(row.total_disbursements)}</TableCell>
                            <TableCell className="font-mono">{formatCurrency(row.liquidated_amount)}</TableCell>
                            <TableCell className="font-mono">{formatCurrency(row.unliquidated_amount)}</TableCell>
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
    );

    const renderSummaryPerHEI = () => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="pl-6">No.</TableHead>
                    <TableHead>Name of HEI</TableHead>
                    <TableHead>Total Disbursements</TableHead>
                    <TableHead>Total Amount Liquidated</TableHead>
                    <TableHead>For Endorsement</TableHead>
                    <TableHead>Unliquidated Amount</TableHead>
                    <TableHead>For Compliance</TableHead>
                    <TableHead>% Age of Liquidation</TableHead>
                    <TableHead className="pr-6">% Age of Submission</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {filteredSummaryPerHEI.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                            {heiSearchQuery ? 'No matching HEIs found.' : 'No data available.'}
                        </TableCell>
                    </TableRow>
                ) : (
                    filteredSummaryPerHEI.map((row, index) => (
                        <TableRow key={row.hei_id}>
                            <TableCell className="pl-6 font-medium">{index + 1}</TableCell>
                            <TableCell className="font-medium">{row.hei?.name || 'N/A'}</TableCell>
                            <TableCell className="font-mono">{formatCurrency(row.total_disbursements)}</TableCell>
                            <TableCell className="font-mono">{formatCurrency(row.total_amount_liquidated)}</TableCell>
                            <TableCell className="font-mono">{formatCurrency(row.for_endorsement)}</TableCell>
                            <TableCell className="font-mono">{formatCurrency(row.unliquidated_amount)}</TableCell>
                            <TableCell className="font-mono">{formatCurrency(row.for_compliance)}</TableCell>
                            <TableCell>{formatPercentage(row.percentage_liquidation)}</TableCell>
                            <TableCell className="pr-6">{formatPercentage(row.percentage_submission)}</TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    );

    const renderRecentLiquidations = () => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="pl-6">Control No.</TableHead>
                    <TableHead>HEI</TableHead>
                    <TableHead>Academic Year</TableHead>
                    <TableHead>Total Disbursements</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-6">Date</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {filteredRecentLiquidations.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                            {recentLiquidationsSearch ? 'No matching liquidations found.' : 'No data available.'}
                        </TableCell>
                    </TableRow>
                ) : (
                    filteredRecentLiquidations.map((liq) => (
                        <TableRow key={liq.id}>
                            <TableCell className="pl-6 font-medium font-mono text-sm">
                                {liq.control_no}
                            </TableCell>
                            <TableCell>{liq.hei?.name || 'N/A'}</TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="text-sm">{liq.academic_year}</span>
                                    <span className="text-xs text-muted-foreground">{liq.semester}</span>
                                </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                                {formatCurrency(liq.amount_received)}
                            </TableCell>
                            <TableCell>
                                <Badge className={`${getStatusColor(liq.status)} shadow-none border font-normal text-xs`}>
                                    {liq.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="pr-6 text-sm text-muted-foreground">
                                {new Date(liq.created_at).toLocaleDateString()}
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    );

    // ---------- Card renderer & header actions maps ----------

    const cardRenderers: Record<string, () => React.ReactNode> = {
        'stats': renderStats,
        'status-distribution': renderStatusDistribution,
        'liquidation-progress': renderLiquidationProgress,
        'summary-ay': renderSummaryPerAY,
        'summary-hei': renderSummaryPerHEI,
        'recent-liquidations': renderRecentLiquidations,
    };

    const getHeaderActions = (id: string): React.ReactNode => {
        switch (id) {
            case 'liquidation-progress':
                // Only admin/RC/accountant get the chart AY filter
                if (isAdmin || userRole === 'Regional Coordinator' || userRole === 'Accountant') {
                    return (
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <Select value={chartAYFilter} onValueChange={setChartAYFilter}>
                                <SelectTrigger className="w-[180px] h-8 text-xs">
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
                        </div>
                    );
                }
                return null;
            case 'summary-ay':
                return (
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <Select value={tableAYFilter} onValueChange={setTableAYFilter}>
                            <SelectTrigger className="w-[180px] h-9 text-xs">
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
                    </div>
                );
            case 'summary-hei':
                return (
                    <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search HEI..."
                            value={heiSearchQuery}
                            onChange={(e) => setHeiSearchQuery(e.target.value)}
                            className="w-[250px] h-9 text-xs"
                        />
                    </div>
                );
            case 'recent-liquidations':
                return (
                    <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search liquidations..."
                            value={recentLiquidationsSearch}
                            onChange={(e) => setRecentLiquidationsSearch(e.target.value)}
                            className="w-[250px] h-9 text-xs"
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    // ---------- Render ----------

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="py-8 w-full">
                <div className="w-full max-w-[100%] mx-auto space-y-6">

                    {/* Page Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold tracking-tight">Dashboard</h2>
                            <p className="text-sm text-muted-foreground">
                                Overview of liquidation data and analytics.
                            </p>
                        </div>
                        <DashboardToolbar
                            hiddenCards={hiddenCardIds.map(id => ({
                                id,
                                title: cardConfigs.find(c => c.id === id)?.title || id,
                            }))}
                            onShowCard={showCard}
                            onResetLayout={resetLayout}
                        />
                    </div>

                    {/* Sortable Dashboard Grid */}
                    <SortableDashboard onOrderChange={updateOrder}>
                        {layout.order
                            .filter(id => layout.cards[id]?.visible && cardConfigs.some(c => c.id === id))
                            .map(id => {
                                const config = cardConfigs.find(c => c.id === id);
                                if (!config) return null;
                                const cardState = layout.cards[id];
                                return (
                                    <DashboardCard
                                        key={id}
                                        id={id}
                                        title={config.title}
                                        colSpan={config.colSpan}
                                        expanded={cardState?.expanded}
                                        onToggleExpand={config.colSpan < 12 ? () => toggleExpanded(id) : undefined}
                                        onRemove={() => toggleVisibility(id)}
                                        headerActions={getHeaderActions(id)}
                                        variant={id === 'stats' ? 'transparent' : 'card'}
                                        noPadding={['summary-ay', 'summary-hei', 'recent-liquidations'].includes(id)}
                                    >
                                        {cardRenderers[id]?.()}
                                    </DashboardCard>
                                );
                            })}
                    </SortableDashboard>

                </div>
            </div>
        </AppLayout>
    );
}
