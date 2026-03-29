import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Deferred, Head } from '@inertiajs/react';
import { useCallback, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip as UITooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Label, Sector } from 'recharts';
import type { PieSectorDataItem } from 'recharts/types/polar/Pie';
import { DollarSign, FileText, CheckCircle, Clock, AlertCircle, Filter, Search, ChevronLeft, ChevronRight, Building2, Users, GraduationCap, Send, ShieldAlert } from 'lucide-react';
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
    for_endorsement: number;
    for_compliance: number;
    pending_review: number;
    pending_action?: number;
    completed?: number;
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

interface CalendarDueDate {
    id: string;
    control_no: string;
    due_date: string;
    amount_received: number;
    hei_name: string | null;
    program_code: string | null;
    academic_year: string | null;
    status: string;
    fund_source: 'unifast' | 'stufaps';
}

interface FundSourceStats {
    totalStats: TotalStats;
    summaryPerAY: AYSummary[];
    statusDistribution: StatusDistribution[];
}

interface ProgramStat {
    code: string;
    name: string;
    grantees: number;
    liquidation_count: number;
}

interface OverviewStats {
    total_heis: number;
    total_grantees: number;
    unifast: {
        grantees: number;
        programs: ProgramStat[];
    };
    stufaps: {
        grantees: number;
        programs: ProgramStat[];
    };
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
    calendarDueDates?: CalendarDueDate[];
    fundSourceData?: {
        unifast: FundSourceStats;
        stufaps: FundSourceStats;
    };
    overviewStats?: OverviewStats;
}

interface CardConfig {
    id: string;
    title: string;
    colSpan: number;
}

export default function Dashboard({ isAdmin, summaryPerAY, summaryPerHEI, statusDistribution, totalStats: rawTotalStats, userStats: rawUserStats, recentLiquidations, userRole, calendarDueDates = [], fundSourceData, overviewStats }: DashboardProps) {
    // Deferred props are undefined until loaded
    const chartsLoading = summaryPerAY === undefined;
    // Provide default values to prevent undefined errors
    const totalStats: TotalStats = {
        total_liquidations: rawTotalStats?.total_liquidations ?? 0,
        total_disbursed: rawTotalStats?.total_disbursed ?? 0,
        total_liquidated: rawTotalStats?.total_liquidated ?? 0,
        total_unliquidated: rawTotalStats?.total_unliquidated ?? 0,
        for_endorsement: rawTotalStats?.for_endorsement ?? 0,
        for_compliance: rawTotalStats?.for_compliance ?? 0,
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

    // State for interactive pie chart
    const [activePieIndex, setActivePieIndex] = useState(0);

    // State for filters
    const [fundSourceFilter, setFundSourceFilter] = useState<'all' | 'unifast' | 'stufaps'>('all');
    const handleFundSourceChange = useCallback((value: 'all' | 'unifast' | 'stufaps') => {
        setFundSourceFilter(value);
        setActivePieIndex(0);
        setChartAYFilter('all');
    }, []);
    const [chartAYFilter, setChartAYFilter] = useState<string>('all');
    const [recentLiquidationsSearch, setRecentLiquidationsSearch] = useState<string>('');

    // ---------- Fund source filtered data ----------

    const activeTotalStats = useMemo<TotalStats>(() => {
        if (fundSourceFilter !== 'all' && fundSourceData?.[fundSourceFilter]?.totalStats) {
            const fs = fundSourceData[fundSourceFilter].totalStats;
            return {
                total_liquidations: fs.total_liquidations ?? 0,
                total_disbursed: fs.total_disbursed ?? 0,
                total_liquidated: fs.total_liquidated ?? 0,
                total_unliquidated: fs.total_unliquidated ?? 0,
                for_endorsement: fs.for_endorsement ?? 0,
                for_compliance: fs.for_compliance ?? 0,
                pending_review: fs.pending_review ?? 0,
                pending_action: fs.pending_action,
                completed: fs.completed,
            };
        }
        return totalStats;
    }, [fundSourceFilter, fundSourceData, totalStats]);

    const activeSummaryPerAY = useMemo(() => {
        if (fundSourceFilter !== 'all' && fundSourceData?.[fundSourceFilter]?.summaryPerAY) {
            return fundSourceData[fundSourceFilter].summaryPerAY;
        }
        return summaryPerAY ?? [];
    }, [fundSourceFilter, fundSourceData, summaryPerAY]);

    const activeStatusDistribution = useMemo(() => {
        if (fundSourceFilter !== 'all' && fundSourceData?.[fundSourceFilter]?.statusDistribution) {
            return fundSourceData[fundSourceFilter].statusDistribution;
        }
        return statusDistribution ?? [];
    }, [fundSourceFilter, fundSourceData, statusDistribution]);

    const activeCalendarDueDates = useMemo(() => {
        if (fundSourceFilter === 'all') return calendarDueDates;
        return calendarDueDates.filter(d => d.fund_source === fundSourceFilter);
    }, [fundSourceFilter, calendarDueDates]);

    // Calendar state
    const [calendarDate, setCalendarDate] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });

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
                return 'bg-muted text-muted-foreground border-border';
            case 'for_initial_review':
                return 'bg-foreground text-background border-foreground';
            case 'endorsed_to_accounting':
                return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800/60';
            case 'endorsed_to_coa':
            case 'Endorsed to COA':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60';
            case 'returned_to_hei':
            case 'returned_to_rc':
            case 'Returned':
                return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60';
            case 'Submitted': return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/60';
            case 'Verified': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60';
            case 'Cleared': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60';
            default: return 'bg-muted text-muted-foreground border-border';
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

    const STATUS_COLORS: Record<string, string> = {
        draft: '#a1a1aa',
        for_initial_review: '#71717a',
        endorsed_to_accounting: '#8b5cf6',
        endorsed_to_coa: '#10b981',
        returned_to_hei: '#ef4444',
        returned_to_rc: '#f59e0b',
    };
    const COLORS = ['#71717a', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#a1a1aa'];

    const BAR_COLORS = {
        totalDisbursements: '#a1a1aa',
        liquidatedAmount: '#10b981',
        unliquidatedAmount: '#ef4444',
        forCompliance: '#f59e0b',
    };

    // ---------- Computed data ----------

    const academicYears = ['all', ...Array.from(new Set(activeSummaryPerAY.map(item => item.academic_year)))];

    const chartData = activeStatusDistribution?.map((item, index) => ({
        name: item.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: item.count,
        status: item.status,
        fill: STATUS_COLORS[item.status] || COLORS[index % COLORS.length],
    })) || [];

    const filteredChartData = chartAYFilter === 'all'
        ? activeSummaryPerAY
        : activeSummaryPerAY.filter(item => item.academic_year === chartAYFilter);

    const barChartData = filteredChartData
        .slice()
        .sort((a, b) => a.academic_year.localeCompare(b.academic_year))
        .map(item => ({
            name: item.academic_year,
            'Total Disbursements': item.total_disbursements,
            'Amount Liquidated': item.liquidated_amount,
            'Unliquidated Amount': item.total_disbursements - item.liquidated_amount,
            'For Compliance': item.for_compliance,
        }));

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

    // ---------- Stat card definitions per role ----------

    const statCardDefs = useMemo(() => {
        const defs: { id: string; title: string; value: React.ReactNode; subtitle: string; icon: React.ReactNode; valueClass?: string }[] = [];

        if (isAdmin || userRole === 'Regional Coordinator' || userRole === 'STUFAPS Focal') {
            defs.push(
                { id: 'stat-total-liquidations', title: 'Total Liquidations', value: activeTotalStats.total_liquidations, subtitle: 'All liquidation reports', icon: <FileText className="h-4 w-4 text-muted-foreground" /> },
                { id: 'stat-total-disbursed', title: 'Total Disbursed', value: formatCurrency(activeTotalStats.total_disbursed), subtitle: 'Amount received from CHED', icon: <DollarSign className="h-4 w-4 text-muted-foreground" /> },
                { id: 'stat-total-liquidated', title: 'Total Liquidated', value: formatCurrency(activeTotalStats.total_liquidated), subtitle: 'Amount disbursed to students', icon: <CheckCircle className="h-4 w-4 text-muted-foreground" />, valueClass: 'text-emerald-600 dark:text-emerald-400' },
                { id: 'stat-total-unliquidated', title: 'Total Unliquidated', value: formatCurrency(activeTotalStats.total_unliquidated), subtitle: 'Remaining from CHED funds', icon: <AlertCircle className="h-4 w-4 text-muted-foreground" />, valueClass: 'text-red-600 dark:text-red-400' },
                { id: 'stat-for-endorsement', title: 'For Endorsement', value: formatCurrency(activeTotalStats.for_endorsement), subtitle: 'Pending endorsement to Accounting', icon: <Send className="h-4 w-4 text-muted-foreground" />, valueClass: 'text-amber-600 dark:text-amber-400' },
                { id: 'stat-for-compliance', title: 'For Compliance', value: formatCurrency(activeTotalStats.for_compliance), subtitle: 'Returned for compliance', icon: <ShieldAlert className="h-4 w-4 text-muted-foreground" />, valueClass: 'text-violet-600 dark:text-violet-400' },
            );
        } else if (userRole === 'Accountant') {
            defs.push(
                { id: 'stat-my-liquidations', title: 'My Liquidations', value: userStats.my_liquidations, subtitle: 'Total reports in my queue', icon: <FileText className="h-4 w-4 text-muted-foreground" /> },
                { id: 'stat-pending-action', title: 'Pending Action', value: userStats.pending_action, subtitle: 'Requires your attention', icon: <Clock className="h-4 w-4 text-muted-foreground" /> },
                { id: 'stat-completed', title: 'Completed', value: userStats.completed, subtitle: 'Successfully processed', icon: <CheckCircle className="h-4 w-4 text-muted-foreground" /> },
                { id: 'stat-total-amount', title: 'Total Amount', value: formatCurrency(userStats.total_amount), subtitle: 'Received from CHED', icon: <DollarSign className="h-4 w-4 text-muted-foreground" /> },
            );
        } else {
            // When fund source filter is active, use filtered totalStats for numeric values
            const filtered = fundSourceFilter !== 'all';
            const myLiq = filtered ? activeTotalStats.total_liquidations : userStats.my_liquidations;
            const pendingAct = filtered ? (activeTotalStats.pending_action ?? activeTotalStats.pending_review) : userStats.pending_action;
            const completedVal = filtered ? (activeTotalStats.completed ?? 0) : userStats.completed;
            const totalAmt = filtered ? activeTotalStats.total_disbursed : userStats.total_amount;
            const totalLiq = filtered ? activeTotalStats.total_liquidated : userStats.total_liquidated;
            const totalUnliq = filtered ? activeTotalStats.total_unliquidated : (userStats.total_unliquidated || 0);

            defs.push(
                { id: 'stat-my-liquidations', title: 'My Liquidations', value: myLiq, subtitle: 'Total reports in my queue', icon: <FileText className="h-4 w-4 text-muted-foreground" /> },
                { id: 'stat-pending-action', title: 'Pending Action', value: pendingAct, subtitle: 'Requires your attention', icon: <Clock className="h-4 w-4 text-muted-foreground" /> },
                { id: 'stat-completed', title: 'Completed', value: completedVal, subtitle: 'Successfully processed', icon: <CheckCircle className="h-4 w-4 text-muted-foreground" /> },
                { id: 'stat-total-amount', title: 'Total Amount', value: formatCurrency(totalAmt), subtitle: 'Received from CHED', icon: <DollarSign className="h-4 w-4 text-muted-foreground" /> },
            );
            if (userStats.total_liquidated !== undefined || filtered) {
                defs.push(
                    { id: 'stat-total-liquidated', title: 'Total Liquidated', value: formatCurrency(totalLiq ?? 0), subtitle: 'Disbursed to students', icon: <CheckCircle className="h-4 w-4 text-muted-foreground" />, valueClass: 'text-emerald-600 dark:text-emerald-400' },
                    { id: 'stat-total-unliquidated', title: 'Total Unliquidated', value: formatCurrency(totalUnliq), subtitle: 'Remaining from CHED', icon: <AlertCircle className="h-4 w-4 text-muted-foreground" />, valueClass: 'text-red-600 dark:text-red-400' },
                );
            }
        }

        return defs;
    }, [isAdmin, userRole, activeTotalStats, userStats, fundSourceFilter]);

    // ---------- Card configuration (individual cards) ----------

    const cardConfigs = useMemo<CardConfig[]>(() => {
        const cards: CardConfig[] = [];

        // Individual stat cards — uniform colSpan so reordering via drag works cleanly
        const statColSpan = statCardDefs.length <= 4 ? Math.floor(12 / statCardDefs.length) : 4;
        for (const sc of statCardDefs) {
            cards.push({ id: sc.id, title: sc.title, colSpan: statColSpan });
        }

        // Overview stats (Admin/Super Admin only)
        if (overviewStats) {
            cards.push({ id: 'overview-stats', title: 'Overview', colSpan: 4 });
        }

        // Charts
        if (barChartData.length > 0) {
            cards.push({ id: 'liquidation-progress', title: 'Liquidation Progress per Academic Year', colSpan: 8 });
        }
        if (chartData.length > 0) {
            cards.push({ id: 'status-distribution', title: 'Status Distribution', colSpan: 4 });
        }

        // Recent liquidations
        if (!isAdmin && recentLiquidations && recentLiquidations.length > 0) {
            cards.push({ id: 'recent-liquidations', title: 'Recent Liquidations', colSpan: 12 });
        }

        return cards;
    }, [isAdmin, userRole, statCardDefs, chartData.length, barChartData.length, recentLiquidations]);

    const storageKey = `dashboard-layout-v3-${isAdmin ? 'admin' : userRole || 'default'}`;
    const { layout, updateOrder, toggleVisibility, cycleExpand, showCard, resetLayout, hiddenCardIds } = useDashboardLayout(
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

    const renderStatusDistribution = () => (
        <div className="flex flex-col gap-3">
            <div className="px-1">
                <Select
                    value={chartData[activePieIndex]?.status || ''}
                    onValueChange={(val) => {
                        const idx = chartData.findIndex((d) => d.status === val);
                        if (idx >= 0) setActivePieIndex(idx);
                    }}
                >
                    <SelectTrigger className="h-8 w-full text-xs">
                        <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                        {chartData.map((item) => (
                            <SelectItem key={item.status} value={item.status} className="text-xs">
                                <div className="flex items-center gap-2">
                                    <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.fill }} />
                                    {item.name}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        strokeWidth={2}
                        dataKey="value"
                        {...({ activeIndex: activePieIndex } as any)}
                        activeShape={({ outerRadius = 0, ...props }: PieSectorDataItem) => (
                            <g>
                                <Sector {...props} outerRadius={outerRadius + 10} />
                                <Sector
                                    {...props}
                                    outerRadius={outerRadius + 20}
                                    innerRadius={outerRadius + 12}
                                />
                            </g>
                        )}
                        onMouseEnter={(_, index) => setActivePieIndex(index)}
                    >
                        {chartData.map((entry) => (
                            <Cell key={entry.status} fill={entry.fill} stroke={entry.fill} />
                        ))}
                        <Label
                            content={({ viewBox }) => {
                                if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                                    const active = chartData[activePieIndex];
                                    return (
                                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 8} className="fill-foreground text-2xl font-bold">
                                                {active?.value.toLocaleString() ?? 0}
                                            </tspan>
                                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 12} className="fill-muted-foreground text-xs">
                                                {active?.name ?? 'Liquidations'}
                                            </tspan>
                                        </text>
                                    );
                                }
                                return null;
                            }}
                        />
                    </Pie>
                    {pieTooltip}
                </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-2 text-xs">
                {chartData.map((item, index) => (
                    <button
                        key={item.status}
                        className={`flex items-center gap-1.5 py-0.5 rounded transition-opacity text-left ${
                            activePieIndex === index ? 'opacity-100' : 'opacity-60 hover:opacity-80'
                        }`}
                        onClick={() => setActivePieIndex(index)}
                    >
                        <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.fill }} />
                        <span className="truncate text-muted-foreground">{item.name}</span>
                        <span className="ml-auto font-medium tabular-nums text-foreground">{item.value}</span>
                    </button>
                ))}
            </div>
        </div>
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
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis
                    tickFormatter={formatYAxis}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
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

    const renderRecentLiquidations = () => (
        <Table>
            <TableHeader>
                <TableRow className="border-b hover:bg-transparent">
                    <TableHead className="h-9 pl-6 text-xs font-medium tracking-wider text-muted-foreground uppercase">Control No.</TableHead>
                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">HEI</TableHead>
                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Academic Year</TableHead>
                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Total Disbursements</TableHead>
                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Status</TableHead>
                    <TableHead className="h-9 pr-6 text-xs font-medium tracking-wider text-muted-foreground uppercase">Date</TableHead>
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

    // ---------- Calendar helpers ----------

    const dueDatesByDay = useMemo(() => {
        const map: Record<string, CalendarDueDate[]> = {};
        for (const item of activeCalendarDueDates) {
            if (!map[item.due_date]) map[item.due_date] = [];
            map[item.due_date].push(item);
        }
        return map;
    }, [activeCalendarDueDates]);

    const calendarGrid = useMemo(() => {
        const { year, month } = calendarDate;
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days: (number | null)[] = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let d = 1; d <= daysInMonth; d++) days.push(d);
        return days;
    }, [calendarDate]);

    const navigateMonth = useCallback((dir: -1 | 1) => {
        setCalendarDate(prev => {
            let m = prev.month + dir;
            let y = prev.year;
            if (m < 0) { m = 11; y--; }
            if (m > 11) { m = 0; y++; }
            return { year: y, month: m };
        });
    }, []);

    const todayStr = useMemo(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }, []);

    const completedStatuses = ['fully liquidated', 'voided'];

    // Sorted due dates list: overdue first (nearest overdue at top), then upcoming (nearest first)
    const sortedDueDates = useMemo(() => {
        return [...activeCalendarDueDates]
            .filter(d => {
                const status = d.status.toLowerCase();
                return !completedStatuses.includes(status);
            })
            .sort((a, b) => {
                const aOverdue = a.due_date < todayStr;
                const bOverdue = b.due_date < todayStr;
                if (aOverdue && !bOverdue) return -1;
                if (!aOverdue && bOverdue) return 1;
                return a.due_date.localeCompare(b.due_date);
            });
    }, [activeCalendarDueDates, todayStr]);

    const renderCalendar = () => {
        const { year, month } = calendarDate;
        const monthName = new Date(year, month).toLocaleString('en-US', { month: 'long', year: 'numeric' });

        return (
            <div className="flex flex-col h-full">
                {/* Month navigation */}
                <div className="flex items-center justify-between mb-4">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-semibold tracking-tight">{monthName}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(1)}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">{d}</div>
                    ))}
                </div>

                {/* Day cells — larger, with red bg for due dates */}
                <div className="grid grid-cols-7 gap-1">
                    {calendarGrid.map((day, idx) => {
                        if (day === null) return <div key={`e-${idx}`} className="h-10" />;
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const dues = dueDatesByDay[dateStr];
                        const count = dues?.length || 0;
                        const isToday = dateStr === todayStr;
                        const hasDue = count > 0;
                        const isOverdue = hasDue && dateStr <= todayStr && dues!.some(d => !completedStatuses.includes(d.status.toLowerCase()));

                        return (
                            <TooltipProvider key={dateStr} delayDuration={200}>
                                <UITooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            className={`h-10 w-full flex items-center justify-center rounded-lg text-sm font-medium transition-all cursor-default
                                                ${isToday && !hasDue ? 'ring-2 ring-primary font-bold' : ''}
                                                ${hasDue
                                                    ? isOverdue
                                                        ? 'bg-red-500 text-white font-bold shadow-sm'
                                                        : 'bg-red-100 text-red-700 font-bold dark:bg-red-900/50 dark:text-red-300'
                                                    : 'text-foreground hover:bg-muted/50'
                                                }
                                                ${isToday && hasDue ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}
                                            `}
                                        >
                                            {day}
                                        </div>
                                    </TooltipTrigger>
                                    {count > 0 && (
                                        <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                                            <p className="font-semibold">{count} due date{count > 1 ? 's' : ''}</p>
                                            {dues!.slice(0, 3).map(d => (
                                                <p key={d.id} className="text-muted-foreground">{d.program_code} — {d.control_no}</p>
                                            ))}
                                            {count > 3 && <p className="text-muted-foreground">+{count - 3} more</p>}
                                        </TooltipContent>
                                    )}
                                </UITooltip>
                            </TooltipProvider>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-500" /> Overdue</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-100 dark:bg-red-900/50" /> Upcoming</span>
                </div>

                {/* Due dates list below calendar */}
                {sortedDueDates.length > 0 && (
                    <div className="mt-4 border-t pt-4">
                        <p className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Upcoming Due Dates</p>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {sortedDueDates.map(item => {
                                const isOverdue = item.due_date <= todayStr;
                                const dueDate = new Date(item.due_date + 'T00:00:00');
                                const diffDays = Math.ceil((dueDate.getTime() - new Date(todayStr + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));
                                const urgencyLabel = isOverdue
                                    ? `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`
                                    : diffDays === 0 ? 'Due today'
                                    : `${diffDays} day${diffDays !== 1 ? 's' : ''} left`;

                                return (
                                    <div key={item.id} className={`rounded-lg border p-2.5 text-xs transition-colors ${isOverdue ? 'border-red-200 bg-red-50/50 dark:border-red-800/40 dark:bg-red-950/20' : ''}`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-mono font-bold text-foreground">{item.control_no}</span>
                                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isOverdue ? 'bg-red-500 text-white' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'}`}>
                                                {urgencyLabel}
                                            </span>
                                        </div>
                                        <p className="text-muted-foreground truncate">{item.program_code} — {item.hei_name || 'N/A'}</p>
                                        <p className="text-muted-foreground/70 text-[10px]">
                                            Due: {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            {item.academic_year && ` • ${item.academic_year}`}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ---------- Overview stats card (Admin/Super Admin only) ----------

    const renderOverviewStats = () => {
        if (!overviewStats) return null;
        const { total_heis, total_grantees, unifast, stufaps } = overviewStats;

        return (
            <div className="space-y-4">
                {/* Top summary row */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
                        <Building2 className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-2xl font-bold">{total_heis.toLocaleString()}</p>
                        <p className="text-[11px] text-muted-foreground">HEIs</p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
                        <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-2xl font-bold">{total_grantees.toLocaleString()}</p>
                        <p className="text-[11px] text-muted-foreground">Total Grantees</p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
                        <FileText className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-2xl font-bold">{activeTotalStats.total_liquidations.toLocaleString()}</p>
                        <p className="text-[11px] text-muted-foreground">Liquidations</p>
                    </div>
                </div>

                {/* UniFAST section */}
                <div className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">UniFAST</h4>
                        <span className="text-sm font-bold">{unifast.grantees.toLocaleString()} grantees</span>
                    </div>
                    <div className="space-y-1.5">
                        {unifast.programs.map(p => (
                            <div key={p.code} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                    <span className="text-muted-foreground">{p.code}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                    <span className="text-muted-foreground">{p.liquidation_count} reports</span>
                                    <span className="font-semibold w-20 text-right">{p.grantees.toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                        {unifast.programs.length === 0 && (
                            <p className="text-xs text-muted-foreground italic">No data yet</p>
                        )}
                    </div>
                </div>

                {/* STuFAPs section */}
                <div className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">STuFAPs</h4>
                        <span className="text-sm font-bold">{stufaps.grantees.toLocaleString()} grantees</span>
                    </div>
                    <div className="space-y-1.5">
                        {stufaps.programs.map(p => (
                            <div key={p.code} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-violet-500" />
                                    <span className="text-muted-foreground">{p.code}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                    <span className="text-muted-foreground">{p.liquidation_count} reports</span>
                                    <span className="font-semibold w-20 text-right">{p.grantees.toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                        {stufaps.programs.length === 0 && (
                            <p className="text-xs text-muted-foreground italic">No data yet</p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // ---------- Card renderer & header actions maps ----------

    // Build card renderers including individual stat cards
    const cardRenderers: Record<string, () => React.ReactNode> = {
        'status-distribution': renderStatusDistribution,
        'liquidation-progress': renderLiquidationProgress,
        'recent-liquidations': renderRecentLiquidations,
        ...(overviewStats ? { 'overview-stats': renderOverviewStats } : {}),
    };

    // Add stat card renderers dynamically
    for (const sc of statCardDefs) {
        cardRenderers[sc.id] = () => (
            <>
                <div className={`text-2xl font-bold ${sc.valueClass || ''}`}>{sc.value}</div>
                <p className="text-xs text-muted-foreground">{sc.subtitle}</p>
            </>
        );
    }

    // Stat card icon lookup for header actions
    const statCardIconMap = useMemo(() => {
        const map: Record<string, React.ReactNode> = {};
        for (const sc of statCardDefs) {
            map[sc.id] = sc.icon;
        }
        return map;
    }, [statCardDefs]);

    const getHeaderActions = (id: string): React.ReactNode => {
        // Stat card icons
        if (statCardIconMap[id]) return statCardIconMap[id];

        switch (id) {
            case 'overview-stats':
                return <GraduationCap className="h-4 w-4 text-muted-foreground" />;
            case 'liquidation-progress':
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
                        <div className="flex items-center gap-2">
                            {fundSourceData && (
                                <Select value={fundSourceFilter} onValueChange={(v) => handleFundSourceChange(v as 'all' | 'unifast' | 'stufaps')}>
                                    <SelectTrigger className="w-[160px] h-8 text-xs">
                                        <SelectValue placeholder="Fund Source" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all" className="text-xs">All Programs</SelectItem>
                                        <SelectItem value="unifast" className="text-xs">UniFAST</SelectItem>
                                        <SelectItem value="stufaps" className="text-xs">STuFAPs</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                            <DashboardToolbar
                                hiddenCards={hiddenCardIds.map(id => ({
                                    id,
                                    title: cardConfigs.find(c => c.id === id)?.title || id,
                                }))}
                                onShowCard={showCard}
                                onResetLayout={resetLayout}
                            />
                        </div>
                    </div>

                    {/* Main layout: sortable grid + calendar sidebar */}
                    <div className="grid grid-cols-12 gap-4">
                        {/* Left: Sortable Dashboard Grid */}
                        <div className="col-span-12 lg:col-span-8 xl:col-span-9">
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
                                                expandLevel={cardState?.expandLevel ?? 0}
                                                onCycleExpand={config.colSpan < 12 ? () => cycleExpand(id) : undefined}
                                                onRemove={() => toggleVisibility(id)}
                                                headerActions={getHeaderActions(id)}
                                                noPadding={id === 'recent-liquidations'}
                                            >
                                                {cardRenderers[id]?.()}
                                            </DashboardCard>
                                        );
                                    })}
                            </SortableDashboard>

                            {/* Skeleton placeholders while deferred chart data loads */}
                            {chartsLoading && (
                                <div className="grid grid-cols-12 gap-4 mt-4">
                                    <div className="col-span-8">
                                        <div className="rounded-xl border bg-card p-6 space-y-4">
                                            <Skeleton className="h-4 w-48" />
                                            <Skeleton className="h-[200px] w-full rounded-lg" />
                                        </div>
                                    </div>
                                    <div className="col-span-4">
                                        <div className="rounded-xl border bg-card p-6 space-y-4">
                                            <Skeleton className="h-4 w-32" />
                                            <Skeleton className="h-[200px] w-full rounded-full mx-auto max-w-[200px]" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right: Calendar Sidebar */}
                        <div className="col-span-12 lg:col-span-4 xl:col-span-3">
                            <Card className="sticky top-4 border-border/50 shadow-sm">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Due Date Calendar</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {chartsLoading ? (
                                        <div className="space-y-3">
                                            <Skeleton className="h-[250px] w-full rounded-lg" />
                                            <Skeleton className="h-4 w-32" />
                                        </div>
                                    ) : renderCalendar()}
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                </div>
            </div>
        </AppLayout>
    );
}
