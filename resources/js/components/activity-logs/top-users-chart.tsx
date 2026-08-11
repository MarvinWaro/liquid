import { memo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export interface TopUser {
    name: string;
    count: number;
}

interface Props {
    data: TopUser[] | undefined;
}

/**
 * Ranked bars, drawn with plain divs rather than Recharts.
 *
 * A horizontal bar chart here would spend most of its width on axis furniture for
 * at most eight rows, and long names get clipped. Div bars stay readable, wrap
 * properly on narrow screens, and cost nothing to render.
 */
export const TopUsersChart = memo(function TopUsersChart({ data }: Props) {
    if (!data) {
        return (
            <div className="space-y-2.5">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="space-y-1">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-2 w-full" />
                    </div>
                ))}
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="flex h-[200px] items-center justify-center">
                <p className="text-sm text-muted-foreground">No activity in this range</p>
            </div>
        );
    }

    // Bars are scaled against the busiest person, not the total, so the smaller
    // rows stay visible when one user dominates.
    const max = Math.max(...data.map((u) => u.count), 1);

    return (
        <div className="space-y-2.5">
            {data.map((user) => (
                <div key={user.name} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="truncate font-medium" title={user.name}>
                            {user.name}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                            {user.count.toLocaleString()}
                        </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full rounded-full transition-all"
                            style={{
                                width: `${Math.max((user.count / max) * 100, 2)}%`,
                                // Single series again: match the app's own
                                // foreground rather than a chart palette hue.
                                background: 'var(--primary)',
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
});
