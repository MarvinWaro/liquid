import { Deferred, Head, router, usePage } from '@inertiajs/react';
import {
    Cpu,
    Gauge as GaugeIcon,
    MonitorSmartphone,
    RefreshCw,
    Server,
    Timer,
} from 'lucide-react';
import {
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    Label as RechartsLabel,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { formatManilaTime } from '@/lib/date';
import { type BreadcrumbItem, type SharedData } from '@/types';

interface CpuUsage {
    user: number;
    system: number;
    idle: number;
}

interface MemoryUsage {
    totalBytes: number;
    usedBytes: number;
    reclaimableBytes: number;
    unusedBytes: number;
    availableBytes: number;
}

interface DiskUsage {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
}

interface SystemInfo {
    hostname: string | null;
    os: string | null;
    kernel: string | null;
    cpuModel: string | null;
    cpuCores: number | null;
    uptimeSeconds: number | null;
    loadAverage: [number, number, number] | null;
}

interface HistoryPoint {
    at: string;
    cpu: number | null;
    memory: number | null;
}

interface ServerMonitoringProps {
    available: boolean;
    system?: SystemInfo;
    cpu?: CpuUsage | null;
    memory?: MemoryUsage | null;
    disk?: DiskUsage | null;
    history?: HistoryPoint[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Server Monitoring', href: '/settings/server-monitoring' },
];

/**
 * The same neutral ramp the Activity Logs donut uses (see app.css). Greyscale
 * rather than a palette: every slice here is labelled, so colour only has to
 * separate the wedges and look like it belongs to the rest of the app. The ramp
 * inverts under .dark, so "strongest = the part you care about" holds in both
 * themes without a second set of values.
 */
const INK = 'var(--activity-1)'; // the figure being reported — used / in use
const INK_SOFT = 'var(--activity-3)'; // the secondary share — reclaimable / system
const INK_FAINT = 'var(--activity-5)'; // the remainder — idle / unused / free

/** Human-readable size up to GB, matching the precedent in server-logs.tsx. */
function formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    const power = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1,
    );
    const value = bytes / 1024 ** power;

    return `${value < 10 && power > 0 ? value.toFixed(1) : Math.round(value)} ${units[power]}`;
}

function formatUptime(seconds: number): string {
    const weeks = Math.floor(seconds / (7 * 86400));
    const days = Math.floor((seconds % (7 * 86400)) / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts: string[] = [];
    if (weeks > 0) parts.push(`${weeks}w`);
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    // Minutes only matter once nothing coarser applies — an uptime measured in
    // weeks does not need "and 12 minutes" tacked on.
    if (parts.length === 0 || (weeks === 0 && days === 0)) {
        parts.push(`${minutes}m`);
    }

    return `up ${parts.join(' ')}`;
}

interface Segment {
    name: string;
    value: number;
    color: string;
    display: string;
}

/**
 * One metric card: a donut with the headline percentage inside it, and the
 * breakdown listed underneath.
 *
 * The legend sits *below* the donut rather than beside it on purpose. Three of
 * these sit side by side, so a column layout leaves each row the full card width
 * — which is what stops a value like "492 MB" from breaking across two lines the
 * way it did when the legend was squeezed into a fixed 10rem column.
 */
function MetricCard({
    title,
    subtitle,
    badge,
    segments,
    centerValue,
    centerLabel,
    footnote,
}: {
    title: string;
    subtitle: string;
    badge?: string;
    segments: Segment[];
    centerValue: string;
    centerLabel: string;
    footnote?: string;
}) {
    return (
        <Card className="flex flex-col">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <CardTitle className="text-sm font-medium">
                            {title}
                        </CardTitle>
                        <p className="truncate text-xs text-muted-foreground">
                            {subtitle}
                        </p>
                    </div>
                    {badge && (
                        <Badge
                            variant="outline"
                            className="shrink-0 text-xs font-normal whitespace-nowrap"
                        >
                            {badge}
                        </Badge>
                    )}
                </div>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-3">
                <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                        <Pie
                            data={segments}
                            cx="50%"
                            cy="50%"
                            innerRadius={52}
                            outerRadius={72}
                            strokeWidth={2}
                            dataKey="value"
                            nameKey="name"
                            isAnimationActive={false}
                        >
                            {segments.map((segment) => (
                                <Cell
                                    key={segment.name}
                                    fill={segment.color}
                                    stroke={segment.color}
                                />
                            ))}
                            <RechartsLabel
                                content={({ viewBox }) => {
                                    if (
                                        !viewBox ||
                                        !('cx' in viewBox) ||
                                        !('cy' in viewBox)
                                    ) {
                                        return null;
                                    }

                                    return (
                                        <text
                                            x={viewBox.cx}
                                            y={viewBox.cy}
                                            textAnchor="middle"
                                        >
                                            <tspan
                                                x={viewBox.cx}
                                                y={viewBox.cy}
                                                className="fill-foreground text-xl font-semibold"
                                            >
                                                {centerValue}
                                            </tspan>
                                            <tspan
                                                x={viewBox.cx}
                                                y={(viewBox.cy ?? 0) + 16}
                                                className="fill-muted-foreground text-[11px]"
                                            >
                                                {centerLabel}
                                            </tspan>
                                        </text>
                                    );
                                }}
                            />
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>

                {/* Full card width, so the value never has to wrap. */}
                <div className="space-y-1.5">
                    {segments.map((segment) => (
                        <div
                            key={segment.name}
                            className="flex items-center gap-2 text-xs"
                        >
                            <span
                                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                                style={{ background: segment.color }}
                            />
                            <span
                                className="truncate text-muted-foreground"
                                title={segment.name}
                            >
                                {segment.name}
                            </span>
                            <span className="ml-auto shrink-0 font-medium whitespace-nowrap tabular-nums">
                                {segment.display}
                            </span>
                        </div>
                    ))}
                </div>

                {footnote && (
                    <p className="mt-auto text-[11px] leading-relaxed text-muted-foreground">
                        {footnote}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

function MetricCardSkeleton() {
    return (
        <Card>
            <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-1 h-3 w-16" />
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
                <Skeleton className="h-[140px] w-[140px] rounded-full" />
                <div className="w-full space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-full" />
                </div>
            </CardContent>
        </Card>
    );
}

/** Placeholder used when a reading is not available on this platform. */
function MetricUnavailable({ title, note }: { title: string; note: string }) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <p className="text-xs text-muted-foreground">
                    Current snapshot
                </p>
            </CardHeader>
            <CardContent>
                <p className="py-12 text-center text-sm text-muted-foreground">
                    {note}
                </p>
            </CardContent>
        </Card>
    );
}

function InfoCard({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof Server;
    label: string;
    value: string;
}) {
    return (
        <Card>
            <CardContent className="flex items-center gap-3 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="truncate text-sm font-medium" title={value}>
                        {value}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * The last hour of CPU and memory, one point a minute.
 *
 * The series is collected server-side by `server:sample-metrics`, not by polling
 * from here: a tab left open on a 1 vCPU droplet would otherwise cost a full
 * Laravel boot every few seconds, and would record nothing while nobody is
 * looking.
 */
function TrendChart({ history }: { history: HistoryPoint[] }) {
    // One point draws no line. Say so rather than showing an empty grid that
    // looks like a fault.
    if (history.length < 2) {
        return (
            <div className="flex flex-col items-center gap-1 py-12 text-center">
                <p className="text-sm font-medium">Collecting</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                    A sample is recorded every minute. The graph fills in over
                    the next hour.
                </p>
            </div>
        );
    }

    return (
        <>
            <ResponsiveContainer width="100%" height={220}>
                <LineChart
                    data={history}
                    margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                >
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                    />
                    <XAxis
                        dataKey="at"
                        tickFormatter={(value: string) =>
                            formatManilaTime(value, '')
                        }
                        tick={{ fontSize: 11 }}
                        stroke="var(--muted-foreground)"
                        tickLine={false}
                        axisLine={false}
                        minTickGap={32}
                    />
                    <YAxis
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        tickFormatter={(value: number) => `${value}%`}
                        tick={{ fontSize: 11 }}
                        stroke="var(--muted-foreground)"
                        tickLine={false}
                        axisLine={false}
                        width={52}
                    />
                    <Tooltip
                        content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;

                            return (
                                <div className="min-w-[150px] rounded-lg border border-border bg-background p-3 shadow-xl">
                                    <p className="mb-1.5 text-xs font-semibold">
                                        {formatManilaTime(String(label), '—')}
                                    </p>
                                    {payload.map((entry) => (
                                        <p
                                            key={String(entry.dataKey)}
                                            className="flex items-center gap-2 text-xs"
                                        >
                                            <span
                                                className="h-2 w-2 shrink-0 rounded-sm"
                                                style={{
                                                    background: entry.color,
                                                }}
                                            />
                                            <span className="text-muted-foreground">
                                                {entry.dataKey === 'cpu'
                                                    ? 'CPU'
                                                    : 'Memory'}
                                            </span>
                                            <span className="ml-auto font-medium tabular-nums">
                                                {entry.value === null
                                                    ? '—'
                                                    : `${entry.value}%`}
                                            </span>
                                        </p>
                                    ))}
                                </div>
                            );
                        }}
                    />
                    {/* connectNulls stays off: a gap means sampling stopped, and
                        bridging it would invent readings that never happened. */}
                    <Line
                        type="monotone"
                        dataKey="cpu"
                        stroke={INK}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="memory"
                        stroke={INK_SOFT}
                        strokeWidth={2}
                        strokeDasharray="4 3"
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>

            <div className="flex items-center justify-center gap-5 text-xs">
                <span className="flex items-center gap-1.5">
                    <span
                        className="h-0.5 w-4 rounded-full"
                        style={{ background: INK }}
                    />
                    <span className="text-muted-foreground">CPU in use</span>
                </span>
                <span className="flex items-center gap-1.5">
                    <span
                        className="h-0.5 w-4 rounded-full"
                        style={{ background: INK_SOFT }}
                    />
                    <span className="text-muted-foreground">Memory in use</span>
                </span>
            </div>
        </>
    );
}

export default function ServerMonitoring({
    available,
    system,
    cpu,
    memory,
    disk,
    history,
}: ServerMonitoringProps) {
    const { can } = usePage<SharedData>().props;

    // Belt and braces: the controller already refuses non-Super-Admins, but the
    // nav item is ability-gated too, so a direct visit should not render a shell.
    if (!can?.canViewServerMonitoring) {
        return null;
    }

    const cpuInUse = cpu ? Math.round((cpu.user + cpu.system) * 10) / 10 : 0;
    const memoryUsedPct =
        memory && memory.totalBytes > 0
            ? Math.round((memory.usedBytes / memory.totalBytes) * 100)
            : 0;
    const diskUsedPct =
        disk && disk.totalBytes > 0
            ? Math.round((disk.usedBytes / disk.totalBytes) * 100)
            : 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Server Monitoring" />

            <SettingsLayout wide>
                <div className="space-y-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <HeadingSmall
                            title="Server Monitoring"
                            description="Live CPU, memory and disk snapshot of the server this app runs on."
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() =>
                                router.reload({
                                    only: [
                                        'system',
                                        'cpu',
                                        'memory',
                                        'disk',
                                        'history',
                                    ],
                                })
                            }
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Refresh
                        </Button>
                    </div>

                    {!available && (
                        <Card>
                            <CardContent className="py-4 text-sm text-muted-foreground">
                                CPU, memory and uptime come from Linux's{' '}
                                <code className="font-mono">/proc</code>{' '}
                                filesystem and are not available on this
                                machine. They appear once this page is opened on
                                the production server.
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Deferred data="cpu" fallback={<MetricCardSkeleton />}>
                            {cpu ? (
                                <MetricCard
                                    title="CPU Usage"
                                    subtitle="Current snapshot"
                                    centerValue={`${cpuInUse}%`}
                                    centerLabel="in use"
                                    segments={[
                                        {
                                            name: 'User',
                                            value: cpu.user,
                                            color: INK,
                                            display: `${cpu.user}%`,
                                        },
                                        {
                                            name: 'System',
                                            value: cpu.system,
                                            color: INK_SOFT,
                                            display: `${cpu.system}%`,
                                        },
                                        {
                                            name: 'Idle',
                                            value: cpu.idle,
                                            color: INK_FAINT,
                                            display: `${cpu.idle}%`,
                                        },
                                    ]}
                                />
                            ) : (
                                <MetricUnavailable
                                    title="CPU Usage"
                                    note="CPU usage unavailable"
                                />
                            )}
                        </Deferred>

                        <Deferred
                            data="memory"
                            fallback={<MetricCardSkeleton />}
                        >
                            {memory ? (
                                <MetricCard
                                    title="Memory Usage"
                                    subtitle={`${formatBytes(memory.totalBytes)} total`}
                                    badge={`${formatBytes(memory.availableBytes)} available`}
                                    centerValue={`${memoryUsedPct}%`}
                                    centerLabel="in use"
                                    segments={[
                                        {
                                            name: 'Used',
                                            value: memory.usedBytes,
                                            color: INK,
                                            display: formatBytes(
                                                memory.usedBytes,
                                            ),
                                        },
                                        {
                                            name: 'Reclaimable',
                                            value: memory.reclaimableBytes,
                                            color: INK_SOFT,
                                            display: formatBytes(
                                                memory.reclaimableBytes,
                                            ),
                                        },
                                        {
                                            name: 'Unused',
                                            value: memory.unusedBytes,
                                            color: INK_FAINT,
                                            display: formatBytes(
                                                memory.unusedBytes,
                                            ),
                                        },
                                    ]}
                                    footnote="Available memory includes unused RAM and cache that Linux can reclaim when applications need it."
                                />
                            ) : (
                                <MetricUnavailable
                                    title="Memory Usage"
                                    note="Memory usage unavailable"
                                />
                            )}
                        </Deferred>

                        <Deferred data="disk" fallback={<MetricCardSkeleton />}>
                            {disk ? (
                                <MetricCard
                                    title="Disk Usage"
                                    subtitle={`${formatBytes(disk.totalBytes)} total — root volume`}
                                    centerValue={`${diskUsedPct}%`}
                                    centerLabel="in use"
                                    segments={[
                                        {
                                            name: 'Used',
                                            value: disk.usedBytes,
                                            color: INK,
                                            display: formatBytes(
                                                disk.usedBytes,
                                            ),
                                        },
                                        {
                                            name: 'Free',
                                            value: disk.freeBytes,
                                            color: INK_FAINT,
                                            display: formatBytes(
                                                disk.freeBytes,
                                            ),
                                        },
                                    ]}
                                />
                            ) : (
                                <MetricUnavailable
                                    title="Disk Usage"
                                    note="Disk usage unavailable"
                                />
                            )}
                        </Deferred>
                    </div>

                    {/* Trend */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">
                                Last hour
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                                CPU and memory in use, sampled once a minute.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Deferred
                                data="history"
                                fallback={
                                    <Skeleton className="h-[220px] w-full" />
                                }
                            >
                                <TrendChart history={history ?? []} />
                            </Deferred>
                        </CardContent>
                    </Card>

                    {/* System facts */}
                    <div className="space-y-3">
                        <HeadingSmall title="System Information" />

                        <Deferred
                            data="system"
                            fallback={
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {[0, 1, 2, 3, 4, 5].map((i) => (
                                        <Skeleton
                                            key={i}
                                            className="h-[68px] w-full rounded-lg"
                                        />
                                    ))}
                                </div>
                            }
                        >
                            {system ? (
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    <InfoCard
                                        icon={Server}
                                        label="Hostname"
                                        value={system.hostname ?? '—'}
                                    />
                                    <InfoCard
                                        icon={MonitorSmartphone}
                                        label="Operating System"
                                        value={system.os ?? '—'}
                                    />
                                    <InfoCard
                                        icon={Cpu}
                                        label="Kernel"
                                        value={system.kernel ?? '—'}
                                    />
                                    <InfoCard
                                        icon={Cpu}
                                        label="CPU"
                                        value={
                                            system.cpuCores
                                                ? `${system.cpuCores} core${system.cpuCores === 1 ? '' : 's'}${system.cpuModel ? ` — ${system.cpuModel}` : ''}`
                                                : (system.cpuModel ?? '—')
                                        }
                                    />
                                    <InfoCard
                                        icon={Timer}
                                        label="Uptime"
                                        value={
                                            system.uptimeSeconds !== null
                                                ? formatUptime(
                                                      system.uptimeSeconds,
                                                  )
                                                : '—'
                                        }
                                    />
                                    <InfoCard
                                        icon={GaugeIcon}
                                        label="Load Average (1m / 5m / 15m)"
                                        value={
                                            system.loadAverage
                                                ? system.loadAverage
                                                      .map((n) => n.toFixed(2))
                                                      .join('  /  ')
                                                : '—'
                                        }
                                    />
                                </div>
                            ) : null}
                        </Deferred>
                    </div>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
