import { memo, useMemo } from 'react';
import { Cell, Label, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

export interface ActionCount {
    action: string;
    count: number;
}

/** Theme tokens, so the donut stays readable in light and dark mode alike. */
const COLORS = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
];

const OTHER_COLOR = 'var(--muted-foreground)';

/** "created_liquidation" -> "Created liquidation" */
function humanize(action: string): string {
    const words = action.replace(/_/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

interface Props {
    data: ActionCount[] | undefined;
}

export const ActionsBreakdownChart = memo(function ActionsBreakdownChart({ data }: Props) {
    // Beyond five slices a donut stops being readable, so the tail is folded into
    // a single "Other" wedge. The total still matches the table.
    const { slices, total } = useMemo(() => {
        const rows = data ?? [];
        const sum = rows.reduce((s, r) => s + r.count, 0);

        if (rows.length <= 6) {
            return { slices: rows, total: sum };
        }

        const head = rows.slice(0, 5);
        const tail = rows.slice(5).reduce((s, r) => s + r.count, 0);

        return {
            slices: [...head, { action: 'Other', count: tail }],
            total: sum,
        };
    }, [data]);

    if (!data) {
        return (
            <div className="flex flex-col items-center gap-4">
                <Skeleton className="h-[160px] w-[160px] rounded-full" />
                <div className="grid w-full grid-cols-2 gap-x-4 gap-y-2 px-2">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-1.5">
                            <Skeleton className="h-2.5 w-2.5 shrink-0 rounded-sm" />
                            <Skeleton className="h-3 flex-1" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (slices.length === 0) {
        return (
            <div className="flex h-[200px] items-center justify-center">
                <p className="text-sm text-muted-foreground">No activity in this range</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-3">
            <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                    <Pie
                        data={slices}
                        dataKey="count"
                        nameKey="action"
                        innerRadius={48}
                        outerRadius={72}
                        strokeWidth={2}
                    >
                        {slices.map((slice, i) => (
                            <Cell
                                key={slice.action}
                                fill={slice.action === 'Other' ? OTHER_COLOR : COLORS[i % COLORS.length]}
                            />
                        ))}
                        <Label
                            content={({ viewBox }) => {
                                if (!viewBox || !('cx' in viewBox)) return null;
                                return (
                                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                                        <tspan
                                            x={viewBox.cx}
                                            y={viewBox.cy}
                                            className="fill-foreground text-lg font-semibold"
                                        >
                                            {total.toLocaleString()}
                                        </tspan>
                                        <tspan
                                            x={viewBox.cx}
                                            y={(viewBox.cy ?? 0) + 16}
                                            className="fill-muted-foreground text-[11px]"
                                        >
                                            total
                                        </tspan>
                                    </text>
                                );
                            }}
                        />
                    </Pie>
                    <Tooltip
                        content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const slice = payload[0];

                            return (
                                <div className="min-w-[140px] rounded-lg border border-border bg-background p-3 text-foreground shadow-xl">
                                    <p className="mb-1 text-sm font-semibold">
                                        {humanize(String(slice.name))}
                                    </p>
                                    <p className="text-sm">
                                        Count:{' '}
                                        <span className="font-mono font-medium">
                                            {Number(slice.value).toLocaleString()}
                                        </span>
                                    </p>
                                </div>
                            );
                        }}
                    />
                </PieChart>
            </ResponsiveContainer>

            <div className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5 px-1">
                {slices.map((slice, i) => (
                    <div key={slice.action} className="flex items-center gap-1.5 text-xs">
                        <span
                            className="h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{
                                background:
                                    slice.action === 'Other' ? OTHER_COLOR : COLORS[i % COLORS.length],
                            }}
                        />
                        <span className="truncate text-muted-foreground" title={humanize(slice.action)}>
                            {humanize(slice.action)}
                        </span>
                        <span className="ml-auto font-medium tabular-nums">{slice.count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
});
