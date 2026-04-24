import { memo, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
    ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

export interface GranteesTrendPoint {
    date: string;
    tes: number;
    tdp: number;
    stufaps: number;
}

const chartConfig = {
    grantees: {
        label: 'Grantees',
    },
    tes: {
        label: 'TES',
        color: 'var(--chart-1)',
    },
    tdp: {
        label: 'TDP',
        color: 'var(--chart-2)',
    },
    stufaps: {
        label: 'STuFAPs',
        color: 'var(--chart-3)',
    },
} satisfies ChartConfig;

type TimeRange = '1y' | '3y' | 'all';

const RANGE_LABELS: Record<TimeRange, string> = {
    '1y': 'Last 12 months',
    '3y': 'Last 3 years',
    'all': 'All time',
};

const RANGE_MONTHS: Record<TimeRange, number | null> = {
    '1y': 12,
    '3y': 36,
    'all': null,
};

interface Props {
    data: GranteesTrendPoint[] | undefined;
}

export const GranteesTrendChart = memo(function GranteesTrendChart({ data }: Props) {
    const [timeRange, setTimeRange] = useState<TimeRange>('all');

    const filteredData = useMemo(() => {
        if (!data) return [];
        const months = RANGE_MONTHS[timeRange];
        if (months === null) return data;
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - months);
        const cutoffMs = cutoff.getTime();
        return data.filter(point => {
            const t = new Date(point.date).getTime();
            return !Number.isNaN(t) && t >= cutoffMs;
        });
    }, [data, timeRange]);

    const totalGrantees = useMemo(
        () => filteredData.reduce((sum, p) => sum + p.tes + p.tdp + p.stufaps, 0),
        [filteredData],
    );

    if (!data) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-56" />
                    </div>
                    <Skeleton className="h-8 w-[160px]" />
                </div>
                <Skeleton className="h-[250px] w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-4" style={{ contain: 'layout paint' }}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-xs text-muted-foreground">Total Grantees ({RANGE_LABELS[timeRange]})</p>
                    <p className="text-2xl font-semibold tabular-nums">
                        {totalGrantees.toLocaleString('en-US')}
                    </p>
                </div>
                <Select value={timeRange} onValueChange={(v: TimeRange) => setTimeRange(v)}>
                    <SelectTrigger className="w-[160px] h-8 text-xs" aria-label="Select time range">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all" className="text-xs">All time</SelectItem>
                        <SelectItem value="3y" className="text-xs">Last 3 years</SelectItem>
                        <SelectItem value="1y" className="text-xs">Last 12 months</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {filteredData.length === 0 ? (
                <div className="flex h-[250px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                    No grantee data in this range.
                </div>
            ) : (
                <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
                    <AreaChart data={filteredData}>
                        <defs>
                            <linearGradient id="fillTes" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-tes)" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="var(--color-tes)" stopOpacity={0.1} />
                            </linearGradient>
                            <linearGradient id="fillTdp" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-tdp)" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="var(--color-tdp)" stopOpacity={0.1} />
                            </linearGradient>
                            <linearGradient id="fillStufaps" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-stufaps)" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="var(--color-stufaps)" stopOpacity={0.1} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                            tickFormatter={(value: string) => {
                                const d = new Date(value);
                                return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                            }}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            width={40}
                            tickFormatter={(v: number) => v.toLocaleString('en-US')}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={
                                <ChartTooltipContent
                                    labelFormatter={(value) => {
                                        const d = new Date(value as string);
                                        return d.toLocaleDateString('en-US', {
                                            month: 'long',
                                            year: 'numeric',
                                        });
                                    }}
                                    indicator="dot"
                                />
                            }
                        />
                        <Area
                            dataKey="stufaps"
                            type="natural"
                            fill="url(#fillStufaps)"
                            stroke="var(--color-stufaps)"
                            stackId="a"
                            isAnimationActive={false}
                        />
                        <Area
                            dataKey="tdp"
                            type="natural"
                            fill="url(#fillTdp)"
                            stroke="var(--color-tdp)"
                            stackId="a"
                            isAnimationActive={false}
                        />
                        <Area
                            dataKey="tes"
                            type="natural"
                            fill="url(#fillTes)"
                            stroke="var(--color-tes)"
                            stackId="a"
                            isAnimationActive={false}
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                    </AreaChart>
                </ChartContainer>
            )}
        </div>
    );
});
