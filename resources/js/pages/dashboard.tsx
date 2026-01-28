import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
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
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { DollarSign, FileText, CheckCircle, Clock } from 'lucide-react';

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
    pending_review: number;
}

interface UserStats {
    my_liquidations: number;
    pending_action: number;
    completed: number;
    total_amount: number;
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

export default function Dashboard({ isAdmin, summaryPerAY, summaryPerHEI, statusDistribution, totalStats, userStats, recentLiquidations, userRole }: DashboardProps) {
    const formatCurrency = (amount: number) => {
        return `₱${parseFloat(amount.toString()).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    };

    const formatPercentage = (percentage: number | null) => {
        if (percentage === null || isNaN(percentage)) return '0.00%';
        return `${parseFloat(percentage.toString()).toFixed(2)}%`;
    };

    // Colors for pie chart
    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    // Prepare data for pie chart
    const chartData = statusDistribution?.map(item => ({
        name: item.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: item.count
    })) || [];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="py-8 w-full">
                <div className="w-full max-w-[95%] mx-auto space-y-6">

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
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                                        <div className="text-2xl font-bold">{formatCurrency(totalStats.total_liquidated)}</div>
                                        <p className="text-xs text-muted-foreground">Amount disbursed to students</p>
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

                            {/* Status Distribution Chart */}
                            {chartData.length > 0 && (
                                <Card className="shadow-sm border-border/50">
                                    <CardHeader>
                                        <CardTitle>Status Distribution</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ResponsiveContainer width="100%" height={350}>
                                            <PieChart>
                                                <Pie
                                                    data={chartData}
                                                    cx="50%"
                                                    cy="50%"
                                                    labelLine={false}
                                                    label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                                                    outerRadius={100}
                                                    fill="#8884d8"
                                                    dataKey="value"
                                                >
                                                    {chartData.map((_, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}

                    {/* Non-Admin Dashboard */}
                    {!isAdmin && userStats && (
                        <>
                            {/* User Stats Cards */}
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
                                        <p className="text-xs text-muted-foreground">In {userRole || 'your'} queue</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Recent Liquidations */}
                            {recentLiquidations && recentLiquidations.length > 0 && (
                                <Card className="shadow-sm border-border/50">
                                    <CardHeader>
                                        <CardTitle>Recent Liquidations</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="pl-6">Control No.</TableHead>
                                                    <TableHead>HEI</TableHead>
                                                    <TableHead>Academic Year</TableHead>
                                                    <TableHead>Amount</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead className="pr-6">Date</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {recentLiquidations.map((liq) => (
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
                                                            <span className="text-sm capitalize">
                                                                {liq.status.replace(/_/g, ' ')}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="pr-6 text-sm text-muted-foreground">
                                                            {new Date(liq.created_at).toLocaleDateString()}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
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
                                    <CardTitle>Summary per Academic Year</CardTitle>
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
                                            {summaryPerAY.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                                                        No data available.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                summaryPerAY.map((row) => (
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
                                    <CardTitle>Summary per HEI</CardTitle>
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
                                            {summaryPerHEI.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                                                        No data available.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                summaryPerHEI.map((row, index) => (
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
