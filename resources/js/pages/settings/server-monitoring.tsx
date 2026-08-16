import { Deferred, Head, router, usePage } from '@inertiajs/react';
import {
    Cpu,
    Gauge as GaugeIcon,
    HardDrive,
    MonitorSmartphone,
    RefreshCw,
    Server,
    Timer,
} from 'lucide-react';
import {
    Cell,
    Pie,
    PieChart,
    Label as RechartsLabel,
    ResponsiveContainer,
} from 'recharts';

import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
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

interface ServerMonitoringProps {
    available: boolean;
    system?: SystemInfo;
    cpu?: CpuUsage | null;
    memory?: MemoryUsage | null;
    disk?: DiskUsage | null;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Server Monitoring', href: '/settings/server-monitoring' },
];

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
    if (weeks > 0) parts.push(`${weeks} week${weeks === 1 ? '' : 's'}`);
    if (days > 0) parts.push(`${days} day${days === 1 ? '' : 's'}`);
    if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
    // Minutes only matter once nothing coarser applies — an uptime measured in
    // weeks does not need "and 12 minutes" tacked on.
    if (parts.length === 0 || (weeks === 0 && days === 0)) {
        parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
    }

    return parts.length > 0 ? `up ${parts.join(', ')}` : 'just started';
}

/** One donut with a value centred inside it. Static — no hover/select needed here. */
function UsageDonut({
    segments,
    centerValue,
    centerLabel,
}: {
    segments: { name: string; value: number; color: string }[];
    centerValue: string;
    centerLabel: string;
}) {
    return (
        <ResponsiveContainer width="100%" height={180}>
            <PieChart>
                <Pie
                    data={segments}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={82}
                    strokeWidth={2}
                    dataKey="value"
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
                            if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                                return (
                                    <text
                                        x={viewBox.cx}
                                        y={viewBox.cy}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                    >
                                        <tspan
                                            x={viewBox.cx}
                                            y={(viewBox.cy || 0) - 6}
                                            className="fill-foreground text-2xl font-bold"
                                        >
                                            {centerValue}
                                        </tspan>
                                        <tspan
                                            x={viewBox.cx}
                                            y={(viewBox.cy || 0) + 14}
                                            className="fill-muted-foreground text-xs"
                                        >
                                            {centerLabel}
                                        </tspan>
                                    </text>
                                );
                            }
                            return null;
                        }}
                    />
                </Pie>
            </PieChart>
        </ResponsiveContainer>
    );
}

function LegendRow({
    color,
    label,
    value,
}: {
    color: string;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-center gap-2 text-sm">
            <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
            />
            <span className="text-muted-foreground">{label}</span>
            <span className="ml-auto font-medium tabular-nums">{value}</span>
        </div>
    );
}

function ChartSkeleton() {
    return (
        <div className="flex flex-col items-center gap-4 py-2">
            <Skeleton className="h-[150px] w-[150px] rounded-full" />
            <div className="w-full space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
            </div>
        </div>
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
                    <p className="truncate text-sm font-medium">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}

export default function ServerMonitoring({
    available,
    system,
    cpu,
    memory,
    disk,
}: ServerMonitoringProps) {
    const { can } = usePage<SharedData>().props;

    // Belt and braces: the controller already refuses non-Super-Admins, but the
    // nav item is ability-gated too, so a direct visit should not render a shell.
    if (!can?.canViewServerMonitoring) {
        return null;
    }

    const cpuInUse = cpu ? Math.round((cpu.user + cpu.system) * 10) / 10 : null;
    const memoryUsedPct =
        memory && memory.totalBytes > 0
            ? Math.round((memory.usedBytes / memory.totalBytes) * 100)
            : null;
    const diskUsedPct =
        disk && disk.totalBytes > 0
            ? Math.round((disk.usedBytes / disk.totalBytes) * 100)
            : null;

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
                                    only: ['system', 'cpu', 'memory', 'disk'],
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
                                These readings come from Linux's{' '}
                                <code className="font-mono">/proc</code>{' '}
                                filesystem and are not available on this
                                machine. They will show up once this page is
                                opened on the production server.
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">
                                    CPU Usage
                                </CardTitle>
                                <p className="text-xs text-muted-foreground">
                                    Current snapshot
                                </p>
                            </CardHeader>
                            <CardContent>
                                <Deferred
                                    data="cpu"
                                    fallback={<ChartSkeleton />}
                                >
                                    {cpu ? (
                                        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
                                            <UsageDonut
                                                segments={[
                                                    {
                                                        name: 'User',
                                                        value: cpu.user,
                                                        color: '#3b82f6',
                                                    },
                                                    {
                                                        name: 'System',
                                                        value: cpu.system,
                                                        color: '#8b5cf6',
                                                    },
                                                    {
                                                        name: 'Idle',
                                                        value: cpu.idle,
                                                        color: '#e4e4e7',
                                                    },
                                                ]}
                                                centerValue={`${cpuInUse}%`}
                                                centerLabel="in use"
                                            />
                                            <div className="w-full space-y-2 sm:w-40">
                                                <LegendRow
                                                    color="#3b82f6"
                                                    label="User"
                                                    value={`${cpu.user}%`}
                                                />
                                                <LegendRow
                                                    color="#8b5cf6"
                                                    label="System"
                                                    value={`${cpu.system}%`}
                                                />
                                                <LegendRow
                                                    color="#e4e4e7"
                                                    label="Idle"
                                                    value={`${cpu.idle}%`}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="py-8 text-center text-sm text-muted-foreground">
                                            CPU usage unavailable
                                        </p>
                                    )}
                                </Deferred>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <CardTitle className="text-sm font-medium">
                                            Memory Usage
                                        </CardTitle>
                                        <p className="text-xs text-muted-foreground">
                                            {memory
                                                ? `${formatBytes(memory.totalBytes)} total`
                                                : 'Current snapshot'}
                                        </p>
                                    </div>
                                    {memory && (
                                        <Badge
                                            variant="outline"
                                            className="shrink-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                        >
                                            Available{' '}
                                            {formatBytes(memory.availableBytes)}
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Deferred
                                    data="memory"
                                    fallback={<ChartSkeleton />}
                                >
                                    {memory ? (
                                        <>
                                            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
                                                <UsageDonut
                                                    segments={[
                                                        {
                                                            name: 'Used',
                                                            value: memory.usedBytes,
                                                            color: '#3b82f6',
                                                        },
                                                        {
                                                            name: 'Reclaimable',
                                                            value: memory.reclaimableBytes,
                                                            color: '#8b5cf6',
                                                        },
                                                        {
                                                            name: 'Unused',
                                                            value: memory.unusedBytes,
                                                            color: '#e4e4e7',
                                                        },
                                                    ]}
                                                    centerValue={`${memoryUsedPct}%`}
                                                    centerLabel="in use"
                                                />
                                                <div className="w-full space-y-2 sm:w-40">
                                                    <LegendRow
                                                        color="#3b82f6"
                                                        label="Used"
                                                        value={formatBytes(
                                                            memory.usedBytes,
                                                        )}
                                                    />
                                                    <LegendRow
                                                        color="#8b5cf6"
                                                        label="Reclaimable"
                                                        value={formatBytes(
                                                            memory.reclaimableBytes,
                                                        )}
                                                    />
                                                    <LegendRow
                                                        color="#e4e4e7"
                                                        label="Unused"
                                                        value={formatBytes(
                                                            memory.unusedBytes,
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Available memory includes unused
                                                RAM and cache that Linux can
                                                reclaim when applications need
                                                it.
                                            </p>
                                        </>
                                    ) : (
                                        <p className="py-8 text-center text-sm text-muted-foreground">
                                            Memory usage unavailable
                                        </p>
                                    )}
                                </Deferred>
                            </CardContent>
                        </Card>
                    </div>

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
                                        icon={HardDrive}
                                        label="Disk (root)"
                                        value={
                                            disk
                                                ? `${formatBytes(disk.usedBytes)} of ${formatBytes(disk.totalBytes)} (${diskUsedPct}% used)`
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
                                                      .join(' / ')
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
