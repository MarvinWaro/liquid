import { memo, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Cell, Label, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface ActionCount {
    action: string;
    count: number;
}

/**
 * A neutral ramp rather than five unrelated hues, so the donut belongs to the
 * same greyscale language as the rest of the app. Ordered darkest-first, which
 * means the shade also tells you the size — and it inverts under .dark, so the
 * biggest slice stays the strongest in both themes.
 */
const COLORS = [
    'var(--activity-1)',
    'var(--activity-2)',
    'var(--activity-3)',
    'var(--activity-4)',
    'var(--activity-5)',
];

const OTHER_COLOR = 'var(--muted-foreground)';

/** "created_liquidation" -> "Created liquidation" */
function humanize(action: string): string {
    const words = action.replace(/_/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The label used for the folded wedge. Not a real action name. */
const OTHER_KEY = 'Other';

/**
 * One line of the legend. A button when the chart can filter, plain text
 * otherwise, so the component still works read-only.
 */
function LegendRow({
    slice,
    color,
    onSelect,
    muted = false,
}: {
    slice: ActionCount;
    color: string;
    onSelect?: (action: string) => void;
    muted?: boolean;
}) {
    const label = humanize(slice.action);
    const shared = cn('flex items-center gap-1.5 text-xs', muted && 'opacity-80');

    const inner = (
        <>
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
            <span className="truncate text-muted-foreground" title={label}>
                {label}
            </span>
            <span className="ml-auto font-medium tabular-nums">{slice.count}</span>
        </>
    );

    if (!onSelect) {
        return <div className={shared}>{inner}</div>;
    }

    return (
        <button
            type="button"
            onClick={() => onSelect(slice.action)}
            title={`Show only: ${label}`}
            className={cn(
                shared,
                'rounded-sm transition-colors hover:text-foreground focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
            )}
        >
            {inner}
        </button>
    );
}

interface Props {
    data: ActionCount[] | undefined;
    /**
     * Called with a real action name when one is picked. Omit to keep the chart
     * read-only — rows then render as plain text rather than buttons.
     */
    onSelect?: (action: string) => void;
}

export const ActionsBreakdownChart = memo(function ActionsBreakdownChart({ data, onSelect }: Props) {
    const [expanded, setExpanded] = useState(false);

    // Beyond five slices a donut stops being readable, so the tail is folded into
    // a single "Other" wedge. The total still matches the table.
    //
    // `hidden` keeps those folded rows to hand: this is an audit log, and the tail
    // is where deletions and region transfers live, so "Other" cannot be a dead
    // end. The data is already in the page, so revealing it costs no request.
    const { slices, hidden, total } = useMemo(() => {
        const rows = data ?? [];
        const sum = rows.reduce((s, r) => s + r.count, 0);

        if (rows.length <= 6) {
            return { slices: rows, hidden: [] as ActionCount[], total: sum };
        }

        const head = rows.slice(0, 5);
        const rest = rows.slice(5);
        const tail = rest.reduce((s, r) => s + r.count, 0);

        return {
            slices: [...head, { action: OTHER_KEY, count: tail }],
            hidden: rest,
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
                                fill={slice.action === OTHER_KEY ? OTHER_COLOR : COLORS[i % COLORS.length]}
                                // Clicking Other opens the legend rather than
                                // filtering — it is a bucket, not an action.
                                onClick={
                                    slice.action === OTHER_KEY
                                        ? () => setExpanded((open) => !open)
                                        : onSelect
                                          ? () => onSelect(slice.action)
                                          : undefined
                                }
                                className={onSelect ? 'cursor-pointer' : undefined}
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
                {slices.map((slice, i) =>
                    slice.action === OTHER_KEY ? (
                        <button
                            key={slice.action}
                            type="button"
                            onClick={() => setExpanded((open) => !open)}
                            aria-expanded={expanded}
                            className="flex items-center gap-1.5 rounded-sm text-xs transition-colors hover:text-foreground focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                        >
                            <span
                                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                                style={{ background: OTHER_COLOR }}
                            />
                            <span className="truncate text-muted-foreground">
                                Other ({hidden.length})
                            </span>
                            <ChevronDown
                                className={cn(
                                    'h-3 w-3 shrink-0 text-muted-foreground transition-transform',
                                    expanded && 'rotate-180',
                                )}
                            />
                            <span className="ml-auto font-medium tabular-nums">{slice.count}</span>
                        </button>
                    ) : (
                        <LegendRow
                            key={slice.action}
                            slice={slice}
                            color={COLORS[i % COLORS.length]}
                            onSelect={onSelect}
                        />
                    ),
                )}
            </div>

            {/* The folded tail. Muted and indented so the top five stay primary. */}
            {expanded && hidden.length > 0 && (
                <div className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5 border-t px-1 pt-2">
                    {hidden.map((slice) => (
                        <LegendRow
                            key={slice.action}
                            slice={slice}
                            color={OTHER_COLOR}
                            onSelect={onSelect}
                            muted
                        />
                    ))}
                </div>
            )}
        </div>
    );
});
