import { NotificationItem } from '@/components/notification-item';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AppNotification, SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import axios from 'axios';
import { Bell, CheckCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export function NotificationDropdown() {
    const { notifications_unread_count } = usePage<SharedData>().props;
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(notifications_unread_count || 0);
    const [loading, setLoading] = useState(false);

    // Sync with Inertia shared props when page navigates
    useEffect(() => {
        setUnreadCount(notifications_unread_count || 0);
    }, [notifications_unread_count]);

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get('/notifications/recent');
            setNotifications(data.notifications);
            setUnreadCount(data.unread_count);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch when dropdown opens
    useEffect(() => {
        if (open) {
            fetchNotifications();
        }
    }, [open, fetchNotifications]);

    const handleMarkAllRead = async () => {
        await axios.post('/notifications/mark-all-read');
        fetchNotifications();
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-9 w-9 text-white/80 hover:bg-white/10 hover:text-white"
                >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                className="w-[380px] p-0"
                sideOffset={8}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <h3 className="text-base font-semibold">Notifications</h3>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto px-2 py-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            onClick={handleMarkAllRead}
                        >
                            <CheckCheck className="mr-1 size-3.5" />
                            Mark all as read
                        </Button>
                    )}
                </div>

                {/* Notification List */}
                <ScrollArea className="max-h-[400px]">
                    {loading && notifications.length === 0 ? (
                        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                            Loading...
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
                            <Bell className="mb-2 size-8 opacity-40" />
                            No notifications yet
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onUpdate={fetchNotifications}
                                />
                            ))}
                        </div>
                    )}
                </ScrollArea>

                {/* Footer */}
                <div className="border-t">
                    <Link
                        href="/notifications"
                        className="flex items-center justify-center py-2.5 text-sm font-medium text-blue-600 hover:bg-accent/50 dark:text-blue-400"
                        onClick={() => setOpen(false)}
                    >
                        View all notifications
                    </Link>
                </div>
            </PopoverContent>
        </Popover>
    );
}
