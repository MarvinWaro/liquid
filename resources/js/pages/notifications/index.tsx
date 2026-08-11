import { NotificationItem } from '@/components/notification-item';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type AppNotification, type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import { Bell, CheckCheck, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginatedData {
    data: AppNotification[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: PaginationLink[];
}

interface Props {
    notifications: PaginatedData;
    filter: string;
    filters: Record<string, string>;
    actions: string[];
    modules: string[];
    unread_count: number;
}

/** "uploaded_document" -> "Uploaded document" */
function formatAction(action: string): string {
    const words = action.replace(/_/g, ' ');

    return words.charAt(0).toUpperCase() + words.slice(1);
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Notifications', href: '/notifications' },
];

export default function NotificationsIndex({ notifications, filter, filters, actions, modules, unread_count }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');

    // Every control sends the whole set, so the All/Unread tab and the dropdowns
    // narrow the list together instead of cancelling each other out.
    const applyFilters = (changes: Record<string, string>) => {
        const next = { filter, ...filters, search, ...changes };
        const cleaned = Object.fromEntries(
            Object.entries(next).filter(([, value]) => value && value !== 'all'),
        );

        router.get('/notifications', cleaned, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const hasActiveFilters = Boolean(filters.search || filters.action || filters.module);

    const clearFilters = () => {
        setSearch('');
        router.get('/notifications', filter === 'all' ? {} : { filter }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleFilterChange = (newFilter: string) => {
        applyFilters({ filter: newFilter });
    };

    const handleMarkAllRead = () => {
        axios.post('/notifications/mark-all-read').then(() => {
            router.reload();
        });
    };

    const handleRefresh = () => {
        router.reload();
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Notifications" />

            <div className="mx-auto w-full max-w-3xl px-4 py-6">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold">Notifications</h1>
                        {unread_count > 0 && (
                            <p className="mt-1 text-sm text-muted-foreground">
                                You have {unread_count} unread notification{unread_count !== 1 ? 's' : ''}
                            </p>
                        )}
                    </div>
                    {unread_count > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleMarkAllRead}
                        >
                            <CheckCheck className="mr-2 size-4" />
                            Mark all as read
                        </Button>
                    )}
                </div>

                {/* Filter Tabs */}
                <div className="mb-4 flex items-center gap-1 border-b">
                    <button
                        onClick={() => handleFilterChange('all')}
                        className={cn(
                            'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                            filter === 'all'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-muted-foreground hover:text-foreground',
                        )}
                    >
                        All
                    </button>
                    <button
                        onClick={() => handleFilterChange('unread')}
                        className={cn(
                            'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                            filter === 'unread'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-muted-foreground hover:text-foreground',
                        )}
                    >
                        Unread
                        {unread_count > 0 && (
                            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
                                {unread_count}
                            </span>
                        )}
                    </button>
                </div>

                {/* Filters — narrow the list further; they combine with the tab above */}
                <div className="mb-4 rounded-lg border bg-card p-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative min-w-[200px] flex-1">
                            <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search notifications..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') applyFilters({});
                                }}
                                onBlur={() => {
                                    if ((filters.search ?? '') !== search) applyFilters({});
                                }}
                                className="pl-8"
                            />
                        </div>

                        <Select
                            value={filters.action || 'all'}
                            onValueChange={(value) => applyFilters({ action: value })}
                        >
                            <SelectTrigger className="w-[190px]">
                                <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                {actions.map((action) => (
                                    <SelectItem key={action} value={action}>
                                        {formatAction(action)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={filters.module || 'all'}
                            onValueChange={(value) => applyFilters({ module: value })}
                        >
                            <SelectTrigger className="w-[170px]">
                                <SelectValue placeholder="All Modules" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Modules</SelectItem>
                                {modules.map((module) => (
                                    <SelectItem key={module} value={module}>
                                        {module}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={clearFilters}>
                                <X className="mr-1 size-4" />
                                Clear
                            </Button>
                        )}
                    </div>
                </div>

                {/* Notification List */}
                <div className="overflow-hidden rounded-lg border bg-card">
                    {notifications.data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                            <Bell className="mb-3 size-12 opacity-30" />
                            <p className="text-lg font-medium">No notifications</p>
                            <p className="mt-1 text-sm">
                                {/* An empty filtered list is not an empty inbox — saying
                                    "you have none yet" would be untrue and confusing. */}
                                {hasActiveFilters
                                    ? 'No notifications match these filters.'
                                    : filter === 'unread'
                                      ? "You're all caught up!"
                                      : "You don't have any notifications yet."}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.data.map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onUpdate={handleRefresh}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {notifications.last_page > 1 && (
                    <div className="mt-4 flex items-center justify-center gap-1">
                        {notifications.links.map((link, index) => (
                            <Button
                                key={index}
                                variant={link.active ? 'default' : 'outline'}
                                size="sm"
                                disabled={!link.url}
                                onClick={() => {
                                    if (link.url) {
                                        router.get(link.url, {}, {
                                            preserveState: true,
                                            preserveScroll: true,
                                        });
                                    }
                                }}
                                className="h-8 min-w-8 px-2"
                            >
                                <span dangerouslySetInnerHTML={{ __html: link.label }} />
                            </Button>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
