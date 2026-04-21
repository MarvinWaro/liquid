import { memo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector, Label } from 'recharts';
import type { PieSectorDataItem } from 'recharts/types/polar/Pie';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

export interface StatusDistribution {
    status: string;
    count: number;
}

const STATUS_COLORS: Record<string, string> = {
    draft: '#a1a1aa',
    for_initial_review: '#71717a',
    endorsed_to_accounting: '#8b5cf6',
    endorsed_to_coa: '#10b981',
    returned_to_hei: '#ef4444',
    returned_to_rc: '#f59e0b',
};
const COLORS = ['#71717a', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#a1a1aa'];

interface Props {
    data: StatusDistribution[] | undefined;
}

export const StatusDistributionChart = memo(function StatusDistributionChart({ data }: Props) {
    const [activePieIndex, setActivePieIndex] = useState(0);

    if (!data) {
        return (
            <div className="flex flex-col items-center gap-4">
                <Skeleton className="h-[180px] w-[180px] rounded-full" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 w-full px-2">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="flex items-center gap-1.5">
                            <Skeleton className="h-2.5 w-2.5 rounded-sm shrink-0" />
                            <Skeleton className="h-3 flex-1" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const chartData = data.map((item, index) => ({
        name: item.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: item.count,
        status: item.status,
        fill: STATUS_COLORS[item.status] || COLORS[index % COLORS.length],
    }));

    if (chartData.length === 0) return null;

    return (
        <div className="flex flex-col gap-3" style={{ contain: 'layout paint' }}>
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
            <ResponsiveContainer width="100%" height={260} debounce={200}>
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        strokeWidth={2}
                        dataKey="value"
                        isAnimationActive={false}
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
});
