import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import type { AppNotification } from '@/types';
import { router } from '@inertiajs/react';
import axios from 'axios';
import {
    Check,
    Eye,
    MoreHorizontal,
    Trash2,
} from 'lucide-react';

interface NotificationItemProps {
    notification: AppNotification;
    onUpdate?: () => void;
}

const actionColors: Record<string, string> = {
    submitted: 'bg-yellow-500',
    endorsed_to_accounting: 'bg-purple-500',
    endorsed_to_coa: 'bg-indigo-500',
    returned_to_hei: 'bg-orange-500',
    returned_to_rc: 'bg-orange-500',
    uploaded_document: 'bg-cyan-500',
    added_gdrive_link: 'bg-cyan-500',
    deleted_document: 'bg-red-500',
    imported_beneficiaries: 'bg-teal-500',
    bulk_imported: 'bg-teal-500',
    toggled_status: 'bg-amber-500',
    updated_tracking: 'bg-blue-500',
    updated_running_data: 'bg-blue-500',
    created: 'bg-green-500',
    updated: 'bg-blue-500',
    deleted: 'bg-red-500',
};

function getModelBasename(subjectType: string): string {
    // Handle full model path like "App\Models\Liquidation" or just "Liquidation"
    const parts = subjectType.replace(/\\\\/g, '\\').split('\\');
    return parts[parts.length - 1];
}

function getSubjectUrl(subjectType: string | null, subjectId: string | null): string | null {
    if (!subjectType || !subjectId) return null;

    const model = getModelBasename(subjectType);

    switch (model) {
        case 'Liquidation':
            return `/liquidation/${subjectId}`;
        case 'LiquidationFinancial':
        case 'LiquidationDocument':
        case 'LiquidationBeneficiary':
        case 'LiquidationReview':
        case 'LiquidationTransmittal':
        case 'LiquidationCompliance':
            return '/liquidation';
        case 'User':
            return '/users';
        case 'HEI':
            return '/hei';
        case 'Program':
            return '/programs';
        case 'Role':
            return '/roles';
        case 'Region':
            return '/regions';
        default:
            return null;
    }
}

export function NotificationItem({ notification, onUpdate }: NotificationItemProps) {
    const getInitials = useInitials();
    const isUnread = !notification.read_at;
    const dotColor = actionColors[notification.action] || 'bg-gray-500';

    const handleClick = () => {
        if (isUnread) {
            axios.patch(`/notifications/${notification.id}/read`).then(() => onUpdate?.());
        }

        const url = getSubjectUrl(notification.subject_type, notification.subject_id);
        if (url) {
            router.visit(url);
        }
    };

    const handleMarkRead = () => {
        axios.patch(`/notifications/${notification.id}/read`).then(() => onUpdate?.());
    };

    const handleMarkUnread = () => {
        axios.patch(`/notifications/${notification.id}/unread`).then(() => onUpdate?.());
    };

    const handleDelete = () => {
        axios.delete(`/notifications/${notification.id}`).then(() => onUpdate?.());
    };

    return (
        <div
            onClick={handleClick}
            className={cn(
                'group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-accent/50',
                isUnread && 'bg-blue-50/60 dark:bg-blue-950/20',
            )}
        >
            {/* Avatar */}
            <div className="relative shrink-0">
                <Avatar className="size-10">
                    <AvatarImage src={notification.actor_avatar_url || undefined} alt={notification.actor_name} />
                    <AvatarFallback className="text-xs">
                        {getInitials(notification.actor_name)}
                    </AvatarFallback>
                </Avatar>
                <span
                    className={cn(
                        'absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-white dark:border-gray-900',
                        dotColor,
                    )}
                />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">
                    <span className="font-semibold">{notification.actor_name}</span>{' '}
                    <span className="text-muted-foreground">
                        {notification.description.replace(notification.actor_name, '').replace(/^\s+/, '')}
                    </span>
                </p>
                <p className={cn(
                    'mt-0.5 text-xs',
                    isUnread ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-muted-foreground',
                )}>
                    {notification.time_ago}
                </p>
            </div>

            {/* Actions + unread dot */}
            <div className="flex shrink-0 items-center gap-1">
                {isUnread && (
                    <span className="size-2.5 rounded-full bg-blue-600" />
                )}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <MoreHorizontal className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        {isUnread ? (
                            <DropdownMenuItem
                                onSelect={(e) => { e.preventDefault(); handleMarkRead(); }}
                                className="cursor-pointer"
                            >
                                <Check className="mr-2 size-4" />
                                Mark as read
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem
                                onSelect={(e) => { e.preventDefault(); handleMarkUnread(); }}
                                className="cursor-pointer"
                            >
                                <Eye className="mr-2 size-4" />
                                Mark as unread
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                            onSelect={(e) => { e.preventDefault(); handleDelete(); }}
                            className="cursor-pointer text-destructive"
                        >
                            <Trash2 className="mr-2 size-4" />
                            Delete notification
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
