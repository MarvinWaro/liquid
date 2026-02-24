import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useInitials } from '@/hooks/use-initials';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { format } from 'date-fns';
import {
    CalendarIcon,
    ChevronDown,
    ChevronRight,
    ExternalLink,
    History,
    Search,
} from 'lucide-react';
import { useState } from 'react';
import { type DateRange } from 'react-day-picker';

interface ActivityLog {
    id: string;
    user_name: string | null;
    user_avatar_url: string | null;
    action: string;
    description: string;
    subject_type: string | null;
    subject_id: string | null;
    subject_label: string | null;
    module: string | null;
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
    created_at: string;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginatedData {
    data: ActivityLog[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: PaginationLink[];
}

interface Props {
    logs: PaginatedData;
    users: { id: string; name: string }[];
    actions: string[];
    modules: string[];
    filters: Record<string, string>;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Settings', href: '/settings/profile' },
    { title: 'Activity Logs', href: '/activity-logs' },
];

const actionColors: Record<string, string> = {
    created: 'border-green-200 bg-green-50 text-green-700',
    updated: 'border-blue-200 bg-blue-50 text-blue-700',
    deleted: 'border-red-200 bg-red-50 text-red-700',
    submitted: 'border-yellow-200 bg-yellow-50 text-yellow-700',
    endorsed_to_accounting: 'border-purple-200 bg-purple-50 text-purple-700',
    endorsed_to_coa: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    returned_to_hei: 'border-orange-200 bg-orange-50 text-orange-700',
    returned_to_rc: 'border-orange-200 bg-orange-50 text-orange-700',
    uploaded_document: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    added_gdrive_link: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    deleted_document: 'border-red-200 bg-red-50 text-red-700',
    bulk_imported: 'border-teal-200 bg-teal-50 text-teal-700',
    imported_beneficiaries: 'border-teal-200 bg-teal-50 text-teal-700',
    toggled_status: 'border-amber-200 bg-amber-50 text-amber-700',
    synced_permissions: 'border-violet-200 bg-violet-50 text-violet-700',
};

// Maps subject_type to URL. For Liquidation, we can link directly by ID.
// For child models (LiquidationFinancial, etc.), the subject_id is the child record,
// so we link to the liquidation index instead.
const subjectRouteMap: Record<string, (id: string) => string | null> = {
    Liquidation: (id) => `/liquidation/${id}`,
    LiquidationFinancial: () => `/liquidation`,
    LiquidationBeneficiary: () => `/liquidation`,
    LiquidationDocument: () => `/liquidation`,
    LiquidationReview: () => `/liquidation`,
    LiquidationTransmittal: () => `/liquidation`,
    LiquidationCompliance: () => `/liquidation`,
    LiquidationRunningData: () => `/liquidation`,
    LiquidationTrackingEntry: () => `/liquidation`,
    User: () => `/users`,
    Role: () => `/roles`,
    HEI: () => `/hei`,
    Program: () => `/programs`,
    Region: () => `/regions`,
    DocumentRequirement: () => `/document-requirements`,
};

function getViewUrl(log: ActivityLog): string | null {
    if (!log.subject_type || !log.subject_id) return null;
    if (log.action === 'deleted') return null;

    // For liquidation-related models, the subject_id on the log may be the
    // child record's ID, not the liquidation ID. We can still link to the
    // module index page for non-Liquidation subjects.
    const routeFn = subjectRouteMap[log.subject_type];
    if (!routeFn) return null;

    return routeFn(log.subject_id);
}

function formatAction(action: string): string {
    return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderDescription(description: string, subjectLabel: string | null) {
    if (!subjectLabel || !description.includes(subjectLabel)) {
        return <>{description}</>;
    }

    const index = description.indexOf(subjectLabel);
    const before = description.slice(0, index);
    const after = description.slice(index + subjectLabel.length);

    return (
        <>
            {before}
            <span className="font-semibold text-foreground">{subjectLabel}</span>
            {after}
        </>
    );
}

function ChangeDiff({
    oldValues,
    newValues,
}: {
    oldValues: Record<string, unknown>;
    newValues: Record<string, unknown>;
}) {
    const keys = [
        ...new Set([...Object.keys(oldValues), ...Object.keys(newValues)]),
    ];

    return (
        <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-xs">
            <table className="w-full">
                <thead>
                    <tr className="border-b">
                        <th className="pb-1 pr-4 text-left font-medium text-muted-foreground">
                            Field
                        </th>
                        <th className="pb-1 pr-4 text-left font-medium text-red-600">
                            Old Value
                        </th>
                        <th className="pb-1 text-left font-medium text-green-600">
                            New Value
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {keys.map((key) => (
                        <tr key={key} className="border-b last:border-0">
                            <td className="py-1 pr-4 font-medium">{key}</td>
                            <td className="py-1 pr-4 text-red-600">
                                {String(oldValues[key] ?? '—')}
                            </td>
                            <td className="py-1 text-green-600">
                                {String(newValues[key] ?? '—')}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function Index({
    logs,
    users,
    actions,
    modules,
    filters,
}: Props) {
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const getInitials = useInitials();

    const initialRange: DateRange | undefined =
        filters.date_from || filters.date_to
            ? {
                  from: filters.date_from
                      ? new Date(filters.date_from + 'T00:00:00')
                      : undefined,
                  to: filters.date_to
                      ? new Date(filters.date_to + 'T00:00:00')
                      : undefined,
              }
            : undefined;

    const [dateRange, setDateRange] = useState<DateRange | undefined>(
        initialRange,
    );

    const toggleRow = (id: string) => {
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const applyFilter = (key: string, value: string) => {
        const newFilters = { ...filters, [key]: value };
        Object.keys(newFilters).forEach((k) => {
            if (!newFilters[k] || newFilters[k] === 'all') {
                delete newFilters[k];
            }
        });
        router.get('/activity-logs', newFilters, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const applyDateRange = (range: DateRange | undefined) => {
        setDateRange(range);
        const newFilters = { ...filters };
        if (range?.from) {
            newFilters.date_from = format(range.from, 'yyyy-MM-dd');
        } else {
            delete newFilters.date_from;
        }
        if (range?.to) {
            newFilters.date_to = format(range.to, 'yyyy-MM-dd');
        } else {
            delete newFilters.date_to;
        }
        Object.keys(newFilters).forEach((k) => {
            if (!newFilters[k] || newFilters[k] === 'all') {
                delete newFilters[k];
            }
        });
        router.get('/activity-logs', newFilters, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const clearFilters = () => {
        setDateRange(undefined);
        router.get(
            '/activity-logs',
            {},
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    const hasActiveFilters = Object.values(filters).some(
        (v) => v && v !== 'all',
    );

    const dateLabel = dateRange?.from
        ? dateRange.to
            ? `${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}`
            : format(dateRange.from, 'MMM d, yyyy')
        : 'Pick a date range';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Activity Logs" />

            <SettingsLayout wide>
                <div className="w-full py-8">
                    <div className="mx-auto w-full max-w-[95%]">
                        {/* Header */}
                        <div className="mb-6">
                            <h2 className="text-xl font-semibold tracking-tight">
                                Activity Logs
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Monitor all system transactions and user
                                activities.
                            </p>
                        </div>

                        {/* Filters */}
                        <div className="mb-6 rounded-lg border bg-card p-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative min-w-[200px] flex-1">
                                    <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        placeholder="Search logs..."
                                        defaultValue={filters.search || ''}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                applyFilter(
                                                    'search',
                                                    (
                                                        e.target as HTMLInputElement
                                                    ).value,
                                                );
                                            }
                                        }}
                                        className="pl-8"
                                    />
                                </div>
                                <Select
                                    value={filters.user || 'all'}
                                    onValueChange={(v) =>
                                        applyFilter('user', v)
                                    }
                                >
                                    <SelectTrigger className="w-[160px]">
                                        <SelectValue placeholder="All Users" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            All Users
                                        </SelectItem>
                                        {users.map((user) => (
                                            <SelectItem
                                                key={user.id}
                                                value={user.id}
                                            >
                                                {user.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={filters.action || 'all'}
                                    onValueChange={(v) =>
                                        applyFilter('action', v)
                                    }
                                >
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="All Actions" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            All Actions
                                        </SelectItem>
                                        {actions.map((action) => (
                                            <SelectItem
                                                key={action}
                                                value={action}
                                            >
                                                {formatAction(action)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={filters.module || 'all'}
                                    onValueChange={(v) =>
                                        applyFilter('module', v)
                                    }
                                >
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="All Modules" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            All Modules
                                        </SelectItem>
                                        {modules.map((mod) => (
                                            <SelectItem key={mod} value={mod}>
                                                {mod}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-[260px] justify-start text-left font-normal"
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                                            <span
                                                className={
                                                    !dateRange?.from
                                                        ? 'text-muted-foreground'
                                                        : ''
                                                }
                                            >
                                                {dateLabel}
                                            </span>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className="w-auto p-0"
                                        align="start"
                                    >
                                        <Calendar
                                            mode="range"
                                            selected={dateRange}
                                            onSelect={applyDateRange}
                                            numberOfMonths={2}
                                            captionLayout="dropdown"
                                        />
                                    </PopoverContent>
                                </Popover>
                                {hasActiveFilters && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearFilters}
                                        className="text-muted-foreground"
                                    >
                                        Clear
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Timeline Feed */}
                        {logs.data.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 rounded-lg border bg-card py-16 text-muted-foreground">
                                <History className="h-10 w-10 text-muted-foreground/40" />
                                <p className="text-sm">
                                    No activity logs found.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-0">
                                {logs.data.map((log, index) => {
                                    const hasChanges =
                                        log.old_values && log.new_values;
                                    const isExpanded = expandedRows.has(
                                        log.id,
                                    );
                                    const userName =
                                        log.user_name || 'System';
                                    const viewUrl = getViewUrl(log);
                                    const isLast =
                                        index === logs.data.length - 1;

                                    return (
                                        <div
                                            key={log.id}
                                            className="relative flex gap-3 pb-6 last:pb-0"
                                        >
                                            {/* Timeline line */}
                                            {!isLast && (
                                                <div className="absolute top-10 bottom-0 left-[18px] w-px bg-border" />
                                            )}

                                            {/* Avatar */}
                                            <Avatar className="h-9 w-9 shrink-0 ring-2 ring-background">
                                                <AvatarImage
                                                    src={
                                                        log.user_avatar_url ||
                                                        undefined
                                                    }
                                                    alt={userName}
                                                />
                                                <AvatarFallback className="bg-muted text-xs font-medium">
                                                    {getInitials(userName)}
                                                </AvatarFallback>
                                            </Avatar>

                                            {/* Content */}
                                            <div className="min-w-0 flex-1 rounded-lg border bg-card p-3">
                                                {/* Header row */}
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                        <span className="text-sm font-semibold">
                                                            {userName}
                                                        </span>
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-[10px] px-1.5 py-0 ${actionColors[log.action] || 'border-gray-200 bg-gray-50 text-gray-700'}`}
                                                        >
                                                            {formatAction(
                                                                log.action,
                                                            )}
                                                        </Badge>
                                                        {log.module && (
                                                            <span className="text-xs text-muted-foreground">
                                                                in{' '}
                                                                {log.module}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* View button */}
                                                    {viewUrl && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                                                            onClick={() =>
                                                                router.visit(
                                                                    viewUrl,
                                                                )
                                                            }
                                                        >
                                                            <ExternalLink className="h-3 w-3" />
                                                            View
                                                        </Button>
                                                    )}
                                                </div>

                                                {/* Description */}
                                                <p className="mt-1 text-sm text-foreground/80">
                                                    {renderDescription(log.description, log.subject_label)}
                                                </p>

                                                {/* Timestamp */}
                                                <p className="mt-1.5 text-xs text-muted-foreground">
                                                    {log.created_at}
                                                </p>

                                                {/* Expandable changes */}
                                                {hasChanges && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            toggleRow(log.id)
                                                        }
                                                        className="mt-2 flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronDown className="h-3.5 w-3.5" />
                                                        ) : (
                                                            <ChevronRight className="h-3.5 w-3.5" />
                                                        )}
                                                        {isExpanded
                                                            ? 'Hide changes'
                                                            : 'View changes'}
                                                    </button>
                                                )}

                                                {isExpanded && hasChanges && (
                                                    <ChangeDiff
                                                        oldValues={
                                                            log.old_values!
                                                        }
                                                        newValues={
                                                            log.new_values!
                                                        }
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Pagination */}
                        {logs.last_page > 1 && (
                            <div className="mt-6 flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">
                                    Showing{' '}
                                    {(logs.current_page - 1) * logs.per_page +
                                        1}{' '}
                                    -{' '}
                                    {Math.min(
                                        logs.current_page * logs.per_page,
                                        logs.total,
                                    )}{' '}
                                    of {logs.total} records
                                </span>
                                <div className="flex items-center gap-1">
                                    {logs.links.map((link, index) => (
                                        <Button
                                            key={index}
                                            variant={
                                                link.active
                                                    ? 'default'
                                                    : 'outline'
                                            }
                                            size="sm"
                                            disabled={!link.url}
                                            onClick={() =>
                                                link.url &&
                                                router.get(
                                                    link.url,
                                                    {},
                                                    { preserveState: true },
                                                )
                                            }
                                            className="h-8 min-w-[32px]"
                                            dangerouslySetInnerHTML={{
                                                __html: link.label,
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
