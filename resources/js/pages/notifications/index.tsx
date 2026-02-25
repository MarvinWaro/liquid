import { NotificationItem } from '@/components/notification-item';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type AppNotification, type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import axios from 'axios';
import { Bell, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    unread_count: number;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Notifications', href: '/notifications' },
];

export default function NotificationsIndex({ notifications, filter, unread_count }: Props) {
    const handleFilterChange = (newFilter: string) => {
        router.get('/notifications', { filter: newFilter }, {
            preserveState: true,
            preserveScroll: true,
        });
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
                        <h1 className="text-2xl font-bold">Notifications</h1>
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

                {/* Notification List */}
                <div className="overflow-hidden rounded-lg border bg-card">
                    {notifications.data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                            <Bell className="mb-3 size-12 opacity-30" />
                            <p className="text-lg font-medium">No notifications</p>
                            <p className="mt-1 text-sm">
                                {filter === 'unread' ? "You're all caught up!" : "You don't have any notifications yet."}
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
