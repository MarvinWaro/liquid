import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useInitials } from '@/hooks/use-initials';
import { liquidationSectionHash, visitWithHash } from '@/lib/liquidation-section';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { AppNotification } from '@/types';
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
    created_liquidation: 'bg-green-500',
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
    support_ticket_created: 'bg-sky-500',
    support_ticket_replied: 'bg-violet-500',
    support_ticket_resolved: 'bg-emerald-500',
    support_ticket_reopened: 'bg-amber-500',
    mentioned_in_comment: 'bg-pink-500',
    replied_to_thread: 'bg-violet-500',
    commented_on_requirement: 'bg-sky-500',
    mentioned_in_announcement_comment: 'bg-pink-500',
    replied_to_announcement_thread: 'bg-violet-500',
    commented_on_announcement: 'bg-sky-500',
    reacted_to_comment: 'bg-rose-500',
    report_ready: 'bg-emerald-500',
    report_failed: 'bg-red-500',
    created: 'bg-green-500',
    updated: 'bg-blue-500',
    deleted: 'bg-red-500',
};

function getModelBasename(subjectType: string): string {
    // Handle full model path like "App\Models\Liquidation" or just "Liquidation"
    const parts = subjectType.replace(/\\\\/g, '\\').split('\\');
    return parts[parts.length - 1];
}

function getSubjectUrl(subjectType: string | null, subjectId: string | null, action?: string, metadata?: Record<string, string> | null): string | null {
    if (!subjectType || !subjectId) return null;

    const model = getModelBasename(subjectType);
    switch (model) {
        case 'Liquidation':
            // Section shared with the activity log's View button — see
            // lib/liquidation-section.ts.
            return `/liquidation/${subjectId}${liquidationSectionHash(
                action,
                metadata?.document_requirement_id,
            )}`;
        case 'LiquidationFinancial':
        case 'LiquidationDocument':
        case 'LiquidationBeneficiary':
        case 'LiquidationReview':
        case 'LiquidationTransmittal':
        case 'LiquidationCompliance':
            return '/liquidation';
        case 'Announcement':
            if (metadata?.slug) {
                return `/announcement/${metadata.slug}#discussion`;
            }
            return '/announcement';
        case 'SupportTicket':
            return metadata?.url ?? `/contact-support?ticket=${subjectId}`;
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

const BOLD_PHRASES = [
    'document tracking',
    'running data',
    'document requirement',
    'beneficiaries',
];

function renderDescription(text: string) {
    const regex = new RegExp(`(${BOLD_PHRASES.join('|')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) => {
        if (BOLD_PHRASES.some((p) => p.toLowerCase() === part.toLowerCase())) {
            return (
                <span key={i} className="font-semibold text-foreground">
                    {part}
                </span>
            );
        }
        return part;
    });
}

export function NotificationItem({ notification, onUpdate }: NotificationItemProps) {
    const getInitials = useInitials();
    const isUnread = !notification.read_at;
    const dotColor = actionColors[notification.action] || 'bg-gray-500';

    const handleClick = async () => {
        // Open completed reports synchronously from the user's click. Waiting
        // for the read-state request first can make browsers block the new tab.
        if (notification.action === 'report_ready') {
            if (notification.metadata?.file_path) {
                const reportWindow = window.open(`/reports/download/${notification.id}`, '_blank');
                if (reportWindow) {
                    reportWindow.opener = null;
                } else {
                    toast.error('The report was blocked. Please allow pop-ups and try again.');
                }
            } else {
                toast.error('This report is no longer available. Please generate a new one.');
            }

            if (isUnread) {
                await axios.patch(`/notifications/${notification.id}/read`);
                onUpdate?.();
            }
            return;
        }

        if (isUnread) {
            await axios.patch(`/notifications/${notification.id}/read`);
            onUpdate?.();
        }

        if (notification.action === 'report_failed') {
            return; // No destination; user just sees the failure description.
        }

        const url = getSubjectUrl(notification.subject_type, notification.subject_id, notification.action, notification.metadata);
        if (url) {
            visitWithHash(url);
        }
    };

    const handleMarkRead = async () => {
        await axios.patch(`/notifications/${notification.id}/read`);
        onUpdate?.();
    };

    const handleMarkUnread = async () => {
        await axios.patch(`/notifications/${notification.id}/unread`);
        onUpdate?.();
    };

    const handleDelete = async () => {
        await axios.delete(`/notifications/${notification.id}`);
        onUpdate?.();
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
                <p className="text-sm leading-snug break-words [overflow-wrap:anywhere]">
                    <span className="font-semibold">{notification.actor_name}</span>{' '}
                    <span className="text-muted-foreground">
                        {renderDescription(notification.description.replace(notification.actor_name, '').replace(/^\s+/, ''))}
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
