import { formatCompactNumber } from '@/lib/number';
import { memo, useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
    ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
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

interface Props {
    data: GranteesTrendPoint[] | undefined;
}

export const GranteesTrendChart = memo(function GranteesTrendChart({ data }: Props) {
    const totalGrantees = useMemo(
        () => (data ?? []).reduce((sum, p) => sum + p.tes + p.tdp + p.stufaps, 0),
        [data],
    );

    if (!data) {
        return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-7 w-32" />
                </div>
                <Skeleton className="h-[250px] w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-4" style={{ contain: 'layout paint' }}>
            <div>
                <p className="text-xs text-muted-foreground">Total Grantees</p>
                <p className="text-2xl font-semibold tabular-nums">
                    {totalGrantees.toLocaleString('en-US')}
                </p>
            </div>

            {data.length === 0 ? (
                <div className="flex h-[250px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                    No grantee data available.
                </div>
            ) : (
                <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
                    <AreaChart data={data}>
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
                        {/* Compact, and no peso sign — these are grantees, not
                            money. "1,012,112" overflowed the old 40px width and
                            rendered as "0,000". */}
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            width={48}
                            tickFormatter={formatCompactNumber}
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
                        {/* Render largest typical series first (back) so smaller
                            ones remain visible on top. Non-stacked so each starts
                            at zero — otherwise tiny series disappear under TES. */}
                        <Area
                            dataKey="tes"
                            type="natural"
                            fill="url(#fillTes)"
                            stroke="var(--color-tes)"
                            strokeWidth={2}
                            fillOpacity={0.35}
                            animationDuration={900}
                            animationEasing="ease-out"
                        />
                        <Area
                            dataKey="tdp"
                            type="natural"
                            fill="url(#fillTdp)"
                            stroke="var(--color-tdp)"
                            strokeWidth={2}
                            fillOpacity={0.45}
                            animationDuration={900}
                            animationEasing="ease-out"
                            animationBegin={120}
                        />
                        <Area
                            dataKey="stufaps"
                            type="natural"
                            fill="url(#fillStufaps)"
                            stroke="var(--color-stufaps)"
                            strokeWidth={2}
                            fillOpacity={0.5}
                            animationDuration={900}
                            animationEasing="ease-out"
                            animationBegin={240}
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                    </AreaChart>
                </ChartContainer>
            )}
        </div>
    );
});
