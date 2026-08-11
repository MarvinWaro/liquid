import { memo, useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';

export interface ActivityTrendPoint {
    /** Philippine calendar day, "YYYY-MM-DD". Bucketed server-side. */
    date: string;
    count: number;
}

const chartConfig = {
    count: {
        label: 'Actions',
        // One series, so colour encodes nothing — using the same token as the
        // sidebar's active state makes the chart read as part of the UI rather
        // than a stock widget dropped into it.
        color: 'var(--primary)',
    },
} satisfies ChartConfig;

interface Props {
    data: ActivityTrendPoint[] | undefined;
    rangeLabel?: string;
}

export const ActivityTrendChart = memo(function ActivityTrendChart({ data, rangeLabel }: Props) {
    const total = useMemo(
        () => (data ?? []).reduce((sum, p) => sum + p.count, 0),
        [data],
    );

    // Dates arrive as plain "YYYY-MM-DD" strings already in Philippine time, so
    // they are split rather than passed through new Date() — parsing them would
    // re-introduce the timezone shift the server just removed.
    const formatDay = (value: string) => {
        const [, month, day] = value.split('-');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[Number(month) - 1]} ${Number(day)}`;
    };

    if (!data) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-[180px] w-full" />
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="flex h-[180px] flex-col items-center justify-center gap-1 text-center">
                <p className="text-sm font-medium text-muted-foreground">No activity in this range</p>
                <p className="text-xs text-muted-foreground/70">Try widening the date filter.</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium">
                    {total.toLocaleString()} action{total === 1 ? '' : 's'}
                </p>
                {rangeLabel && (
                    <p className="text-xs text-muted-foreground">{rangeLabel}</p>
                )}
            </div>

            <ChartContainer config={chartConfig} className="h-[180px] w-full">
                <AreaChart data={data} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        minTickGap={24}
                        tickFormatter={formatDay}
                    />
                    <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        width={32}
                        allowDecimals={false}
                    />
                    <ChartTooltip
                        content={
                            <ChartTooltipContent
                                labelFormatter={(value) => formatDay(String(value))}
                            />
                        }
                    />
                    <Area
                        dataKey="count"
                        type="monotone"
                        fill="var(--color-count)"
                        fillOpacity={0.2}
                        stroke="var(--color-count)"
                        strokeWidth={2}
                    />
                </AreaChart>
            </ChartContainer>
        </div>
    );
});
