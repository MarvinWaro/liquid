import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { useCallback, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { DollarSign, FileText, CheckCircle, Clock, AlertCircle, GraduationCap, Send, ShieldAlert } from 'lucide-react';
import { useDashboardLayout } from '@/hooks/use-dashboard-layout';
import { SortableDashboard, DashboardCard, DashboardToolbar } from '@/components/sortable-dashboard';
import { DashboardCalendar } from '@/components/dashboard-calendar';
import { StatusDistributionChart, type StatusDistribution } from '@/components/dashboard/status-distribution-chart';
import { LiquidationProgressChart, type AYSummary } from '@/components/dashboard/liquidation-progress-chart';
import { RecentLiquidationsTable, type RecentLiquidation } from '@/components/dashboard/recent-liquidations-table';
import { OverviewStatsCard, type OverviewStats } from '@/components/dashboard/overview-stats-card';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
];

// ---------- Types ----------

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

interface CardConfig {
    id: string;
    title: string;
    colSpan: number;
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

// ---------- Helpers ----------

const formatCurrency = (amount: number | null | undefined) => {
    const value = amount ?? 0;
    return `₱${parseFloat(value.toString()).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

// ---------- Component ----------

export default function Dashboard({
    isAdmin,
    summaryPerAY,
    summaryPerHEI,
    statusDistribution,
    totalStats: rawTotalStats,
    userStats: rawUserStats,
    recentLiquidations,
    userRole,
    calendarDueDates = [],
    fundSourceData,
    overviewStats,
}: DashboardProps) {
    // Deferred props are undefined until loaded
    const chartsLoading = summaryPerAY === undefined;

    const totalStats: TotalStats = useMemo(() => ({
        total_liquidations: rawTotalStats?.total_liquidations ?? 0,
        total_disbursed: rawTotalStats?.total_disbursed ?? 0,
        total_liquidated: rawTotalStats?.total_liquidated ?? 0,
        total_unliquidated: rawTotalStats?.total_unliquidated ?? 0,
        for_endorsement: rawTotalStats?.for_endorsement ?? 0,
        for_compliance: rawTotalStats?.for_compliance ?? 0,
        pending_review: rawTotalStats?.pending_review ?? 0,
    }), [rawTotalStats]);

    const userStats: UserStats = useMemo(() => ({
        my_liquidations: rawUserStats?.my_liquidations ?? 0,
        pending_action: rawUserStats?.pending_action ?? 0,
        completed: rawUserStats?.completed ?? 0,
        total_amount: rawUserStats?.total_amount ?? 0,
        total_liquidated: rawUserStats?.total_liquidated ?? 0,
        total_unliquidated: rawUserStats?.total_unliquidated ?? 0,
    }), [rawUserStats]);

    // Fund source filter — only state that triggers full re-render (intentional)
    const [fundSourceFilter, setFundSourceFilter] = useState<'all' | 'unifast' | 'stufaps'>('all');
    const handleFundSourceChange = useCallback((value: 'all' | 'unifast' | 'stufaps') => {
        setFundSourceFilter(value);
    }, []);

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
            const filtered = fundSourceFilter !== 'all';
            const endorsed = filtered ? activeTotalStats.total_liquidations : userStats.my_liquidations;
            const totalAmt = filtered ? activeTotalStats.total_disbursed : userStats.total_amount;

            defs.push(
                { id: 'stat-my-liquidations', title: 'Endorsed to Accounting', value: endorsed, subtitle: 'Total endorsed by RC', icon: <FileText className="h-4 w-4 text-muted-foreground" /> },
                { id: 'stat-total-amount', title: 'Total Amount', value: formatCurrency(totalAmt), subtitle: 'Endorsed amount from CHED', icon: <DollarSign className="h-4 w-4 text-muted-foreground" /> },
            );
        } else if (userRole === 'COA') {
            const filtered = fundSourceFilter !== 'all';
            const endorsed = filtered ? activeTotalStats.total_liquidations : userStats.my_liquidations;
            const totalAmt = filtered ? activeTotalStats.total_disbursed : userStats.total_amount;

            defs.push(
                { id: 'stat-my-liquidations', title: 'Endorsed to COA', value: endorsed, subtitle: 'Total endorsed by Accountant', icon: <FileText className="h-4 w-4 text-muted-foreground" /> },
                { id: 'stat-total-amount', title: 'Total Amount', value: formatCurrency(totalAmt), subtitle: 'Endorsed amount', icon: <DollarSign className="h-4 w-4 text-muted-foreground" /> },
            );
        } else {
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

    // ---------- Card configuration ----------

    const showBarChart = chartsLoading || (activeSummaryPerAY && activeSummaryPerAY.length > 0);
    const showPieChart = chartsLoading || (activeStatusDistribution && activeStatusDistribution.length > 0);
    const showFilter = isAdmin || userRole === 'Regional Coordinator' || userRole === 'Accountant' || userRole === 'COA';

    const cardConfigs = useMemo<CardConfig[]>(() => {
        const cards: CardConfig[] = [];

        const statColSpan = statCardDefs.length <= 4 ? Math.floor(12 / statCardDefs.length) : 4;
        for (const sc of statCardDefs) {
            cards.push({ id: sc.id, title: sc.title, colSpan: statColSpan });
        }

        if (showBarChart) {
            cards.push({ id: 'liquidation-progress', title: 'Liquidation Progress per Academic Year', colSpan: 8 });
        }
        if (showPieChart) {
            cards.push({ id: 'status-distribution', title: 'Status Distribution', colSpan: 4 });
        }
        if (!isAdmin && (chartsLoading || (recentLiquidations && recentLiquidations.length > 0))) {
            cards.push({ id: 'recent-liquidations', title: 'Recent Liquidations', colSpan: 12 });
        }

        return cards;
    }, [statCardDefs, showBarChart, showPieChart, isAdmin, recentLiquidations, chartsLoading]);

    const storageKey = `dashboard-layout-v6-${isAdmin ? 'admin' : userRole || 'default'}`;
    const { layout, updateOrder, toggleVisibility, cycleExpand, showCard, resetLayout, hiddenCardIds } = useDashboardLayout(
        cardConfigs.map(c => c.id),
        storageKey,
    );

    // ---------- Stat card icon map ----------

    const statCardIconMap = useMemo(() => {
        const map: Record<string, React.ReactNode> = {};
        for (const sc of statCardDefs) {
            map[sc.id] = sc.icon;
        }
        return map;
    }, [statCardDefs]);

    // ---------- Stable header actions ----------

    const getHeaderActions = useCallback((id: string): React.ReactNode => {
        if (statCardIconMap[id]) return statCardIconMap[id];
        switch (id) {
            case 'overview-stats':
                return <GraduationCap className="h-4 w-4 text-muted-foreground" />;
            default:
                return null;
        }
    }, [statCardIconMap]);

    // ---------- Card content renderer ----------

    const renderCardContent = useCallback((id: string): React.ReactNode => {
        // Stat cards
        const statDef = statCardDefs.find(sc => sc.id === id);
        if (statDef) {
            if (chartsLoading) {
                return (
                    <div className="space-y-2 py-1">
                        <Skeleton className="h-7 w-28" />
                        <Skeleton className="h-3 w-40" />
                    </div>
                );
            }
            return (
                <>
                    <div className={`text-2xl font-bold ${statDef.valueClass || ''}`}>{statDef.value}</div>
                    <p className="text-xs text-muted-foreground">{statDef.subtitle}</p>
                </>
            );
        }

        switch (id) {
            case 'status-distribution':
                return <StatusDistributionChart data={chartsLoading ? undefined : activeStatusDistribution} />;
            case 'liquidation-progress':
                return <LiquidationProgressChart data={chartsLoading ? undefined : activeSummaryPerAY} showFilter={showFilter} />;
            case 'recent-liquidations':
                return <RecentLiquidationsTable data={chartsLoading ? undefined : recentLiquidations} />;
            case 'overview-stats':
                return <OverviewStatsCard data={chartsLoading ? undefined : overviewStats} totalLiquidations={activeTotalStats.total_liquidations} />;
            default:
                return null;
        }
    }, [statCardDefs, chartsLoading, activeStatusDistribution, activeSummaryPerAY, recentLiquidations, overviewStats, activeTotalStats.total_liquidations, showFilter]);

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
                                                {renderCardContent(id)}
                                            </DashboardCard>
                                        );
                                    })}
                            </SortableDashboard>
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
                                            <div className="flex items-center justify-between mb-4">
                                                <Skeleton className="h-8 w-8 rounded-md" />
                                                <Skeleton className="h-4 w-32" />
                                                <Skeleton className="h-8 w-8 rounded-md" />
                                            </div>
                                            <div className="grid grid-cols-7 gap-1 mb-1">
                                                {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-3 rounded" />)}
                                            </div>
                                            <div className="grid grid-cols-7 gap-1">
                                                {[...Array(35)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
                                            </div>
                                            <div className="flex items-center gap-4 mt-4">
                                                <Skeleton className="h-3 w-20" />
                                                <Skeleton className="h-3 w-20" />
                                            </div>
                                        </div>
                                    ) : (
                                        <DashboardCalendar dueDates={activeCalendarDueDates} />
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                </div>
            </div>
        </AppLayout>
    );
}
