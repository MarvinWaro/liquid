import { memo, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Filter } from 'lucide-react';

export interface AYSummary {
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

const BAR_COLORS = {
    totalDisbursements: '#a1a1aa',
    liquidatedAmount: '#10b981',
    unliquidatedAmount: '#ef4444',
    forCompliance: '#f59e0b',
};

interface Props {
    data: AYSummary[] | undefined;
    showFilter?: boolean;
}

export const LiquidationProgressChart = memo(function LiquidationProgressChart({ data, showFilter = false }: Props) {
    const [chartAYFilter, setChartAYFilter] = useState<string>('all');

    if (!data) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-22" />
                </div>
                <div className="flex items-end gap-2 h-[240px]">
                    {[0.55, 0.75, 0.45, 0.65, 0.85, 0.5, 0.7].map((h, i) => (
                        <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${h * 100}%` }} />
                    ))}
                </div>
                <div className="flex justify-center gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="flex items-center gap-1.5">
                            <Skeleton className="h-2.5 w-2.5 rounded-sm" />
                            <Skeleton className="h-3 w-20" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const academicYears = useMemo(
        () => ['all', ...Array.from(new Set(data.map(item => item.academic_year)))],
        [data],
    );

    const barChartData = useMemo(() => {
        const filtered = chartAYFilter === 'all'
            ? data
            : data.filter(item => item.academic_year === chartAYFilter);

        return filtered
            .slice()
            .sort((a, b) => a.academic_year.localeCompare(b.academic_year))
            .map(item => ({
                name: item.academic_year,
                'Total Disbursements': item.total_disbursements,
                'Amount Liquidated': item.liquidated_amount,
                'Unliquidated Amount': item.total_disbursements - item.liquidated_amount,
                'For Compliance': item.for_compliance,
            }));
    }, [data, chartAYFilter]);

    if (barChartData.length === 0) return null;

    return (
        <div className="space-y-3">
            {showFilter && (
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
            )}
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
                        tickFormatter={(v: number) => v.toLocaleString('en-US')}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
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
                        content={() => (
                            <div className="flex items-center justify-center gap-4 pt-2.5">
                                {[
                                    { label: 'Total Disbursements', color: BAR_COLORS.totalDisbursements },
                                    { label: 'Amount Liquidated', color: BAR_COLORS.liquidatedAmount },
                                    { label: 'Unliquidated Amount', color: BAR_COLORS.unliquidatedAmount },
                                    { label: 'For Compliance', color: BAR_COLORS.forCompliance },
                                ].map(({ label, color }) => (
                                    <div key={label} className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                                        <span className="text-foreground text-xs">{label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    />
                    <Bar dataKey="Total Disbursements" fill={BAR_COLORS.totalDisbursements} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="Amount Liquidated" fill={BAR_COLORS.liquidatedAmount} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="Unliquidated Amount" fill={BAR_COLORS.unliquidatedAmount} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="For Compliance" fill={BAR_COLORS.forCompliance} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
});
