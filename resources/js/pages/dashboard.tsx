import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
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

export default function Dashboard({ isAdmin, summaryPerAY, summaryPerHEI, statusDistribution, totalStats: rawTotalStats, userStats: rawUserStats, recentLiquidations, userRole }: DashboardProps) {
    // Provide default values for totalStats to prevent undefined errors
    const totalStats: TotalStats = {
        total_liquidations: rawTotalStats?.total_liquidations ?? 0,
        total_disbursed: rawTotalStats?.total_disbursed ?? 0,
        total_liquidated: rawTotalStats?.total_liquidated ?? 0,
        total_unliquidated: rawTotalStats?.total_unliquidated ?? 0,
        pending_review: rawTotalStats?.pending_review ?? 0,
    };

    // Provide default values for userStats to prevent undefined errors
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

    const formatCurrency = (amount: number | null | undefined) => {
        const value = amount ?? 0;
        return `₱${parseFloat(value.toString()).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            // Draft - gray
            case 'draft':
            case 'Draft':
                return 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200';

            // For RC Review - black/dark gray
            case 'for_initial_review':
                return 'bg-gray-800 text-gray-100 hover:bg-gray-900 border-gray-800';

            // Endorsed to Accounting - purple/violet
            case 'endorsed_to_accounting':
                return 'bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200';

            // Endorsed to COA - green (success)
            case 'endorsed_to_coa':
            case 'Endorsed to COA':
                return 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200';

            // Returned to HEI or RC - red (destructive)
            case 'returned_to_hei':
            case 'returned_to_rc':
            case 'Returned':
                return 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200';

            // Old statuses for backward compatibility
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

    // Colors for pie chart
    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    // Colors for bar chart (matching Excel: green, blue, red/orange, yellow)
    const BAR_COLORS = {
        totalDisbursements: '#22c55e', // Green
        liquidatedAmount: '#3b82f6',   // Blue
        unliquidatedAmount: '#ef4444', // Red
        forCompliance: '#eab308',      // Yellow
    };

    // Get unique academic years for filter dropdown
    const academicYears = ['all', ...Array.from(new Set(summaryPerAY.map(item => item.academic_year)))];

    // Prepare data for pie chart
    const chartData = statusDistribution?.map(item => ({
        name: item.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: item.count
    })) || [];

    // Prepare data for bar chart (Liquidation Progress by Academic Year)
    // Apply chart filter
    const filteredChartData = chartAYFilter === 'all'
        ? summaryPerAY
        : summaryPerAY.filter(item => item.academic_year === chartAYFilter);

    const barChartData = filteredChartData
        .slice() // Create a copy to avoid mutating original
        .sort((a, b) => a.academic_year.localeCompare(b.academic_year)) // Sort by year ascending
        .map(item => ({
            name: item.academic_year,
            'Total Disbursements': item.total_disbursements,
            'Amount Liquidated': item.liquidated_amount,
            'Unliquidated Amount': item.unliquidated_amount,
            'For Compliance': item.for_compliance,
        }));

    // Filter Summary per Academic Year table
    const filteredSummaryPerAY = tableAYFilter === 'all'
        ? summaryPerAY
        : summaryPerAY.filter(item => item.academic_year === tableAYFilter);

    // Filter Summary per HEI table
    const filteredSummaryPerHEI = summaryPerHEI.filter(item => {
        if (!heiSearchQuery.trim()) return true;
        return item.hei?.name.toLowerCase().includes(heiSearchQuery.toLowerCase());
    });

    // Filter Recent Liquidations table
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

    // Format Y-axis with full numbers and commas
    const formatYAxis = (value: number) => {
        return value.toLocaleString('en-US');
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="py-8 w-full">
                <div className="w-full max-w-[100%] mx-auto space-y-6">

                    {/* Page Header */}
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                        <p className="text-muted-foreground mt-1">
                            Overview of liquidation data and analytics.
                        </p>
                    </div>

                    {/* Admin Stats Cards and Charts */}
                    {isAdmin && totalStats && (
                        <>
                            {/* Stats Cards */}
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

                            {/* Charts Row - Status Distribution (4 cols) and Liquidation Progress (8 cols) */}
                            <div className="grid gap-4 lg:grid-cols-12">
                                {/* Status Distribution Pie Chart - 4 columns */}
                                {chartData.length > 0 && (
                                    <Card className="shadow-sm border-border/50 lg:col-span-4">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-base">Status Distribution</CardTitle>
                                        </CardHeader>
                                        <CardContent>
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
                                                    <Legend
                                                        wrapperStyle={{ fontSize: '12px' }}
                                                        formatter={(value) => <span className="text-foreground text-xs">{value}</span>}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Liquidation Progress Bar Chart - 8 columns */}
                                {barChartData.length > 0 && (
                                    <Card className="shadow-sm border-border/50 lg:col-span-8">
                                        <CardHeader className="pb-2">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-base">Liquidation Progress per Academic Year</CardTitle>
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
                                            </div>
                                        </CardHeader>
                                        <CardContent>
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
                                                    <Legend
                                                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                                                        formatter={(value) => <span className="text-foreground text-xs">{value}</span>}
                                                    />
                                                    <Bar
                                                        dataKey="Total Disbursements"
                                                        fill={BAR_COLORS.totalDisbursements}
                                                        radius={[4, 4, 0, 0]}
                                                    />
                                                    <Bar
                                                        dataKey="Amount Liquidated"
                                                        fill={BAR_COLORS.liquidatedAmount}
                                                        radius={[4, 4, 0, 0]}
                                                    />
                                                    <Bar
                                                        dataKey="Unliquidated Amount"
                                                        fill={BAR_COLORS.unliquidatedAmount}
                                                        radius={[4, 4, 0, 0]}
                                                    />
                                                    <Bar
                                                        dataKey="For Compliance"
                                                        fill={BAR_COLORS.forCompliance}
                                                        radius={[4, 4, 0, 0]}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </>
                    )}

                    {/* Regional Coordinator Dashboard - Similar to Admin with Charts and Tables */}
                    {!isAdmin && userRole === 'Regional Coordinator' && totalStats && (
                        <>
                            {/* RC Stats Cards - 5 columns like admin */}
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

                            {/* RC Charts Row - Status Distribution (4 cols) and Liquidation Progress (8 cols) */}
                            <div className="grid gap-4 lg:grid-cols-12">
                                {/* Status Distribution Pie Chart - 4 columns */}
                                {chartData.length > 0 && (
                                    <Card className="shadow-sm border-border/50 lg:col-span-4">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-base">Status Distribution</CardTitle>
                                        </CardHeader>
                                        <CardContent>
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
                                                    <Legend
                                                        wrapperStyle={{ fontSize: '12px' }}
                                                        formatter={(value) => <span className="text-foreground text-xs">{value}</span>}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Liquidation Progress Bar Chart - 8 columns */}
                                {barChartData.length > 0 && (
                                    <Card className="shadow-sm border-border/50 lg:col-span-8">
                                        <CardHeader className="pb-2">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-base">Liquidation Progress per Academic Year</CardTitle>
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
                                            </div>
                                        </CardHeader>
                                        <CardContent>
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
                                                    <Legend
                                                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                                                        formatter={(value) => <span className="text-foreground text-xs">{value}</span>}
                                                    />
                                                    <Bar
                                                        dataKey="Total Disbursements"
                                                        fill={BAR_COLORS.totalDisbursements}
                                                        radius={[4, 4, 0, 0]}
                                                    />
                                                    <Bar
                                                        dataKey="Amount Liquidated"
                                                        fill={BAR_COLORS.liquidatedAmount}
                                                        radius={[4, 4, 0, 0]}
                                                    />
                                                    <Bar
                                                        dataKey="Unliquidated Amount"
                                                        fill={BAR_COLORS.unliquidatedAmount}
                                                        radius={[4, 4, 0, 0]}
                                                    />
                                                    <Bar
                                                        dataKey="For Compliance"
                                                        fill={BAR_COLORS.forCompliance}
                                                        radius={[4, 4, 0, 0]}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                            {/* RC Summary per Academic Year */}
                            <Card className="shadow-sm border-border/50">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle>Summary per Academic Year</CardTitle>
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
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
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
                                </CardContent>
                            </Card>

                            {/* RC Summary per HEI */}
                            <Card className="shadow-sm border-border/50">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle>Summary per HEI</CardTitle>
                                        <div className="flex items-center gap-2">
                                            <Search className="h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search HEI..."
                                                value={heiSearchQuery}
                                                onChange={(e) => setHeiSearchQuery(e.target.value)}
                                                className="w-[250px] h-9 text-xs"
                                            />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
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
                                </CardContent>
                            </Card>

                            {/* RC Recent Liquidations */}
                            {recentLiquidations && recentLiquidations.length > 0 && (
                                <Card className="shadow-sm border-border/50">
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle>Recent Liquidations</CardTitle>
                                            <div className="flex items-center gap-2">
                                                <Search className="h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Search liquidations..."
                                                    value={recentLiquidationsSearch}
                                                    onChange={(e) => setRecentLiquidationsSearch(e.target.value)}
                                                    className="w-[250px] h-9 text-xs"
                                                />
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
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
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}

                    {/* Accountant Dashboard - Similar to RC/Admin with Charts and Tables */}
                    {!isAdmin && userRole === 'Accountant' && totalStats && userStats && (
                        <>
                            {/* Accountant Stats Cards - 4 columns */}
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

                            {/* Accountant Charts Row - Status Distribution (4 cols) and Liquidation Progress (8 cols) */}
                            <div className="grid gap-4 lg:grid-cols-12">
                                {/* Status Distribution Pie Chart - 4 columns */}
                                {chartData.length > 0 && (
                                    <Card className="shadow-sm border-border/50 lg:col-span-4">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-base">Status Distribution</CardTitle>
                                        </CardHeader>
                                        <CardContent>
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
                                                    <Legend
                                                        wrapperStyle={{ fontSize: '12px' }}
                                                        formatter={(value) => <span className="text-foreground text-xs">{value}</span>}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Liquidation Progress Bar Chart - 8 columns */}
                                {barChartData.length > 0 && (
                                    <Card className="shadow-sm border-border/50 lg:col-span-8">
                                        <CardHeader className="pb-2">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-base">Liquidation Progress per Academic Year</CardTitle>
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
                                            </div>
                                        </CardHeader>
                                        <CardContent>
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
                                                    <Legend
                                                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                                                        formatter={(value) => <span className="text-foreground text-xs">{value}</span>}
                                                    />
                                                    <Bar
                                                        dataKey="Total Disbursements"
                                                        fill={BAR_COLORS.totalDisbursements}
                                                        radius={[4, 4, 0, 0]}
                                                    />
                                                    <Bar
                                                        dataKey="Amount Liquidated"
                                                        fill={BAR_COLORS.liquidatedAmount}
                                                        radius={[4, 4, 0, 0]}
                                                    />
                                                    <Bar
                                                        dataKey="Unliquidated Amount"
                                                        fill={BAR_COLORS.unliquidatedAmount}
                                                        radius={[4, 4, 0, 0]}
                                                    />
                                                    <Bar
                                                        dataKey="For Compliance"
                                                        fill={BAR_COLORS.forCompliance}
                                                        radius={[4, 4, 0, 0]}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                            {/* Accountant Summary per Academic Year */}
                            <Card className="shadow-sm border-border/50">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle>Summary per Academic Year</CardTitle>
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
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
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
                                </CardContent>
                            </Card>

                            {/* Accountant Summary per HEI */}
                            <Card className="shadow-sm border-border/50">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle>Summary per HEI</CardTitle>
                                        <div className="flex items-center gap-2">
                                            <Search className="h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search HEI..."
                                                value={heiSearchQuery}
                                                onChange={(e) => setHeiSearchQuery(e.target.value)}
                                                className="w-[250px] h-9 text-xs"
                                            />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
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
                                </CardContent>
                            </Card>

                            {/* Accountant Recent Liquidations */}
                            {recentLiquidations && recentLiquidations.length > 0 && (
                                <Card className="shadow-sm border-border/50">
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle>Recent Liquidations</CardTitle>
                                            <div className="flex items-center gap-2">
                                                <Search className="h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Search liquidations..."
                                                    value={recentLiquidationsSearch}
                                                    onChange={(e) => setRecentLiquidationsSearch(e.target.value)}
                                                    className="w-[250px] h-9 text-xs"
                                                />
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
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
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}

                    {/* HEI Dashboard */}
                    {!isAdmin && userStats && userRole === 'HEI' && (
                        <>
                            {/* User Stats Cards */}
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
                                {/* HEI-specific: Liquidated and Unliquidated amounts */}
                                {userRole === 'HEI' && userStats.total_liquidated !== undefined && (
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

                            {/* HEI Charts Row - Status Distribution (4 cols) and Liquidation Progress (8 cols) */}
                            {userRole === 'HEI' && (chartData.length > 0 || barChartData.length > 0) && (
                                <div className="grid gap-4 lg:grid-cols-12">
                                    {/* Status Distribution Pie Chart - 4 columns */}
                                    {chartData.length > 0 && (
                                        <Card className="shadow-sm border-border/50 lg:col-span-4">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-base">Status Distribution</CardTitle>
                                            </CardHeader>
                                            <CardContent>
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
                                                        <Legend
                                                            wrapperStyle={{ fontSize: '12px' }}
                                                            formatter={(value) => <span className="text-foreground text-xs">{value}</span>}
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* Liquidation Progress Bar Chart - 8 columns */}
                                    {barChartData.length > 0 && (
                                        <Card className="shadow-sm border-border/50 lg:col-span-8">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-base">Liquidation Progress per Academic Year</CardTitle>
                                            </CardHeader>
                                            <CardContent>
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
                                                        <Legend
                                                            wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                                                            formatter={(value) => <span className="text-foreground text-xs">{value}</span>}
                                                        />
                                                        <Bar
                                                            dataKey="Total Disbursements"
                                                            fill={BAR_COLORS.totalDisbursements}
                                                            radius={[4, 4, 0, 0]}
                                                        />
                                                        <Bar
                                                            dataKey="Amount Liquidated"
                                                            fill={BAR_COLORS.liquidatedAmount}
                                                            radius={[4, 4, 0, 0]}
                                                        />
                                                        <Bar
                                                            dataKey="Unliquidated Amount"
                                                            fill={BAR_COLORS.unliquidatedAmount}
                                                            radius={[4, 4, 0, 0]}
                                                        />
                                                        <Bar
                                                            dataKey="For Compliance"
                                                            fill={BAR_COLORS.forCompliance}
                                                            radius={[4, 4, 0, 0]}
                                                        />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            )}

                            {/* Recent Liquidations */}
                            {recentLiquidations && recentLiquidations.length > 0 && (
                                <Card className="shadow-sm border-border/50">
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle>Recent Liquidations</CardTitle>
                                            <div className="flex items-center gap-2">
                                                <Search className="h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Search liquidations..."
                                                    value={recentLiquidationsSearch}
                                                    onChange={(e) => setRecentLiquidationsSearch(e.target.value)}
                                                    className="w-[250px] h-9 text-xs"
                                                />
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
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
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}

                    {/* Summary Tables - Only for Admin */}
                    {isAdmin && (
                        <>
                            {/* Summary per Academic Year */}
                            <Card className="shadow-sm border-border/50">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle>Summary per Academic Year</CardTitle>
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
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
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
                                </CardContent>
                            </Card>

                            {/* Summary per HEI */}
                            <Card className="shadow-sm border-border/50">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle>Summary per HEI</CardTitle>
                                        <div className="flex items-center gap-2">
                                            <Search className="h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search HEI..."
                                                value={heiSearchQuery}
                                                onChange={(e) => setHeiSearchQuery(e.target.value)}
                                                className="w-[250px] h-9 text-xs"
                                            />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
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
                                </CardContent>
                            </Card>
                        </>
                    )}

                </div>
            </div>
        </AppLayout>
    );
}
