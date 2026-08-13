import { Deferred, Head, router, usePage } from '@inertiajs/react';
import { Activity, AlertTriangle, CheckCircle2, Clock, ExternalLink, Layers, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';

import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { formatManilaDateTime } from '@/lib/date';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem, type SharedData } from '@/types';

interface RunningBatch {
    id: string;
    name: string;
    total: number;
    pending: number;
    failed: number;
    created_at: string | null;
}

interface QueueStats {
    pending: number | null;
    failedTotal: number;
    failedRecent: number;
    oldestFailureAt: string | null;
    batches: { running: RunningBatch[] } | null;
}

interface FailedJob {
    uuid: string;
    queue: string;
    job: string;
    failedAt: string | null;
    exception: string;
}

interface HorizonInfo {
    installed: boolean;
    usable: boolean;
    url: string;
}

interface QueueHealthProps {
    connection: string;
    driver: string;
    horizon: HorizonInfo;
    stats?: QueueStats;
    recentFailures?: FailedJob[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Queue Health', href: '/settings/queue-health' },
];

/** One headline number, with the tone carrying the meaning. */
function StatCard({
    label,
    value,
    hint,
    icon: Icon,
    tone = 'neutral',
}: {
    label: string;
    value: string | number;
    hint: string;
    icon: typeof Activity;
    tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
    const toneRing = {
        neutral: 'text-muted-foreground',
        good: 'text-emerald-600 dark:text-emerald-400',
        warn: 'text-amber-600 dark:text-amber-400',
        bad: 'text-red-600 dark:text-red-400',
    }[tone];

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className={cn('h-4 w-4', toneRing)} />
            </CardHeader>
            <CardContent>
                <div className={cn('text-2xl font-semibold tabular-nums', toneRing)}>{value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            </CardContent>
        </Card>
    );
}

function StatsSkeleton() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
                <Card key={i}>
                    <CardHeader className="pb-2">
                        <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Skeleton className="h-7 w-16" />
                        <Skeleton className="h-3 w-32" />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

export default function QueueHealth({ connection, driver, horizon, stats, recentFailures }: QueueHealthProps) {
    const { can } = usePage<SharedData>().props;
    const [busyUuid, setBusyUuid] = useState<string | null>(null);

    // Belt and braces: the controller already refuses non-Super-Admins, but the
    // nav item is ability-gated too, so a direct visit should not render a shell.
    if (!can?.canViewQueueHealth) {
        return null;
    }

    const act = (uuid: string, kind: 'retry' | 'forget') => {
        setBusyUuid(uuid);
        const done = {
            onSuccess: () => toast.success(kind === 'retry' ? 'Job queued for retry' : 'Failed job removed'),
            onError: () => toast.error('Could not complete that action'),
            onFinish: () => setBusyUuid(null),
            preserveScroll: true,
        };

        if (kind === 'retry') {
            router.post(`/settings/queue-health/${uuid}/retry`, {}, done);
        } else {
            router.delete(`/settings/queue-health/${uuid}`, done);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Queue Health" />

            <SettingsLayout wide>
                <div className="space-y-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <HeadingSmall
                            title="Queue Health"
                            description="Background jobs such as bulk imports and report exports run here."
                        />
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                                {connection === driver ? connection : `${connection} · ${driver}`}
                            </Badge>

                            {/* Deep dive lives in Horizon, which owns its own UI. Only
                                offered when it can actually serve a dashboard. */}
                            {horizon.usable && (
                                <Button variant="outline" size="sm" className="gap-2" asChild>
                                    <a href={horizon.url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        Open Horizon
                                    </a>
                                </Button>
                            )}

                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => router.reload({ only: ['stats', 'recentFailures'] })}
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Headline numbers */}
                    <Deferred data="stats" fallback={<StatsSkeleton />}>
                        {stats ? (
                            <div className="space-y-6">
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    <StatCard
                                        label="Waiting"
                                        value={stats.pending ?? '—'}
                                        hint={
                                            stats.pending === null
                                                ? 'This driver cannot report a queue size'
                                                : 'Jobs queued and not yet started'
                                        }
                                        icon={Clock}
                                        tone={stats.pending && stats.pending > 50 ? 'warn' : 'neutral'}
                                    />
                                    <StatCard
                                        label="Failed (last 24h)"
                                        value={stats.failedRecent}
                                        hint="Needs attention now"
                                        icon={stats.failedRecent > 0 ? AlertTriangle : CheckCircle2}
                                        tone={stats.failedRecent > 0 ? 'bad' : 'good'}
                                    />
                                    <StatCard
                                        label="Failed (all time)"
                                        value={stats.failedTotal}
                                        hint={
                                            stats.oldestFailureAt
                                                ? `Oldest ${formatManilaDateTime(stats.oldestFailureAt)}`
                                                : 'No failures recorded'
                                        }
                                        icon={Layers}
                                        tone={stats.failedTotal > 0 ? 'warn' : 'good'}
                                    />
                                </div>

                                {/* In-flight batches — this is what a running bulk import looks like */}
                                {stats.batches && stats.batches.running.length > 0 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-sm">Running now</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            {stats.batches.running.map((b) => {
                                                const doneCount = b.total - b.pending;
                                                const pct = b.total > 0 ? Math.round((doneCount / b.total) * 100) : 0;

                                                return (
                                                    <div key={b.id} className="space-y-1.5">
                                                        <div className="flex items-center justify-between gap-3 text-sm">
                                                            <span className="truncate font-medium">
                                                                {b.name || 'Batch'}
                                                            </span>
                                                            <span className="shrink-0 tabular-nums text-muted-foreground">
                                                                {doneCount} / {b.total}
                                                                {b.failed > 0 && (
                                                                    <span className="ml-2 text-red-600 dark:text-red-400">
                                                                        {b.failed} failed
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </div>
                                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                                            <div
                                                                className="h-full rounded-full bg-emerald-500 transition-all"
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        ) : null}
                    </Deferred>

                    {/* Failures */}
                    <div className="space-y-3">
                        <HeadingSmall
                            title="Recent failures"
                            description="Retry puts the job back on its queue. Dismiss removes it from this list."
                        />

                        <Deferred
                            data="recentFailures"
                            fallback={
                                <div className="space-y-2">
                                    <Skeleton className="h-16 w-full" />
                                    <Skeleton className="h-16 w-full" />
                                </div>
                            }
                        >
                            {!recentFailures || recentFailures.length === 0 ? (
                                <Card>
                                    <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                                        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                                        <p className="text-sm font-medium">No failed jobs</p>
                                        <p className="max-w-sm text-xs text-muted-foreground">
                                            Bulk imports and report exports are completing normally.
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="overflow-x-auto rounded-md border">
                                    <table className="w-full min-w-[720px] text-sm">
                                        <thead className="border-b bg-muted/40">
                                            <tr className="text-left text-xs text-muted-foreground">
                                                <th className="px-3 py-2 font-medium">Job</th>
                                                <th className="px-3 py-2 font-medium">Failed</th>
                                                <th className="px-3 py-2 font-medium">Reason</th>
                                                <th className="px-3 py-2 text-right font-medium">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentFailures.map((f) => (
                                                <tr key={f.uuid} className="border-b last:border-0 align-top">
                                                    <td className="px-3 py-2">
                                                        <p className="font-medium">{f.job}</p>
                                                        <p className="text-xs text-muted-foreground">{f.queue}</p>
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                                                        {f.failedAt ? formatManilaDateTime(f.failedAt) : '—'}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <p className="max-w-md break-words text-xs text-red-600 dark:text-red-400">
                                                            {f.exception}
                                                        </p>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <div className="flex justify-end gap-1">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-7 gap-1.5 text-xs"
                                                                disabled={busyUuid === f.uuid}
                                                                onClick={() => act(f.uuid, 'retry')}
                                                            >
                                                                <RefreshCw className="h-3 w-3" />
                                                                Retry
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 gap-1.5 text-xs text-muted-foreground"
                                                                disabled={busyUuid === f.uuid}
                                                                onClick={() => act(f.uuid, 'forget')}
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                                Dismiss
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Deferred>
                    </div>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
