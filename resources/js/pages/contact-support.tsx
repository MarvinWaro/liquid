import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    CreateSupportTicketDialog,
    type SupportTicketLiquidationOption,
    type SupportTicketOption,
} from '@/components/support/create-support-ticket-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useInitials } from '@/hooks/use-initials';
import AppLayout from '@/layouts/app-layout';
import { useLayoutPreference } from '@/hooks/use-layout-preference';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    CheckCircle2,
    CircleDot,
    Clock3,
    ExternalLink,
    Inbox,
    LifeBuoy,
    MessageSquare,
    Plus,
    Search,
    Send,
    Tag,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Contact & Support', href: '/contact-support' },
];

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginatedTickets {
    data: SupportTicketSummary[];
    current_page: number;
    last_page: number;
    links: PaginationLink[];
    total: number;
}

interface LinkedLiquidation {
    id: string;
    control_no: string;
    hei_name: string | null;
    program_code: string | null;
    document_status?: string | null;
    rc_note_status?: string | null;
    liquidation_status: string | null;
}

interface SupportTicketSummary {
    id: string;
    ticket_number: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    requester_name: string | null;
    requester_avatar_url: string | null;
    messages_count: number;
    liquidation: LinkedLiquidation | null;
    last_reply_at: string | null;
    created_at: string;
}

interface TicketMessage {
    id: string;
    body: string;
    user_name: string;
    user_avatar_url: string | null;
    is_staff: boolean;
    role: string | null;
    created_at: string;
    time_ago: string;
}

interface SupportTicketDetail extends SupportTicketSummary {
    description: string;
    can_manage: boolean;
    can_update_status: boolean;
    can_reply: boolean;
    assignee_name: string | null;
    resolved_by_name: string | null;
    resolved_at: string | null;
    resolution_remarks: string | null;
    messages: TicketMessage[];
}

interface Props {
    tickets: PaginatedTickets;
    selectedTicket: SupportTicketDetail | null;
    liquidationOptions: SupportTicketLiquidationOption[];
    filters: {
        status?: string;
        category?: string;
        search?: string;
    };
    stats: {
        all: number;
        active: number;
        resolved: number;
    };
    canManageTickets: boolean;
    categories: SupportTicketOption[];
    priorities: SupportTicketOption[];
    statuses: SupportTicketOption[];
}

const statusConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    open: {
        label: 'Open',
        className: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300',
        icon: CircleDot,
    },
    in_progress: {
        label: 'In Progress',
        className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
        icon: Clock3,
    },
    resolved: {
        label: 'Resolved',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
        icon: CheckCircle2,
    },
};

const priorityClass: Record<string, string> = {
    low: 'border-muted bg-muted/40 text-muted-foreground',
    normal: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300',
    high: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300',
    urgent: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
};

function cleanParams(params: Record<string, any>) {
    return Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    );
}

function formatLabel(value: string) {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function paginationLabel(label: string) {
    return label
        .replace('&laquo;', '')
        .replace('&raquo;', '')
        .trim();
}

export default function ContactSupport({
    tickets,
    selectedTicket,
    liquidationOptions,
    filters,
    stats,
    canManageTickets,
    categories,
    priorities,
}: Props) {
    const { can } = usePage<SharedData>().props;
    const { layout } = useLayoutPreference();
    const workspaceHeightClass = layout === 'sidebar' ? 'xl:h-[calc(100svh-7rem)]' : 'xl:h-[calc(100svh-9rem)]';
    const [createOpen, setCreateOpen] = useState(false);
    const [search, setSearch] = useState(filters.search ?? '');
    const getInitials = useInitials();

    const categoryLabels = useMemo(
        () => Object.fromEntries(categories.map((category) => [category.value, category.label])),
        [categories],
    );
    const priorityLabels = useMemo(
        () => Object.fromEntries(priorities.map((priority) => [priority.value, priority.label])),
        [priorities],
    );

    const navigate = (patch: Record<string, any>) => {
        router.get(
            route('contact-support'),
            cleanParams({
                status: filters.status ?? 'active',
                category: filters.category ?? 'all',
                search: filters.search ?? '',
                ticket: selectedTicket?.id,
                ...patch,
            }),
            { preserveState: true, preserveScroll: true },
        );
    };

    const handleSearch = (event: React.FormEvent) => {
        event.preventDefault();
        navigate({ search, ticket: selectedTicket?.id });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Contact & Support" />

            <CreateSupportTicketDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                liquidationOptions={liquidationOptions}
                categories={categories}
                priorities={priorities}
            />

            <div className={cn('w-full py-6 xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden', workspaceHeightClass)}>
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between xl:shrink-0">
                    <div>
                        <div className="flex items-center gap-2">
                            <LifeBuoy className="h-5 w-5 text-muted-foreground" />
                            <h1 className="text-xl font-semibold tracking-tight">Contact & Support</h1>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Track liquidation questions, upload concerns, status follow-ups, and resolved support cases.
                        </p>
                    </div>
                    {can.canCreateTicket && (
                        <Button onClick={() => setCreateOpen(true)} className="self-start">
                            <Plus className="mr-2 h-4 w-4" />
                            New Ticket
                        </Button>
                    )}
                </div>

                <div className="mb-4 grid gap-3 sm:grid-cols-3 xl:shrink-0">
                    <StatTile label="Active Tickets" value={stats.active} icon={Inbox} />
                    <StatTile label="Resolved Cases" value={stats.resolved} icon={CheckCircle2} />
                    <StatTile label="Total Tickets" value={stats.all} icon={MessageSquare} />
                </div>

                <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)] xl:min-h-0 xl:flex-1">
                    <section className="rounded-lg border bg-card xl:flex xl:flex-col xl:h-full xl:min-h-0 xl:overflow-hidden">
                        <div className="border-b p-3 xl:shrink-0">
                            <form onSubmit={handleSearch} className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Search ticket, requester, liquidation..."
                                        className="pl-9"
                                    />
                                </div>
                                <Button type="submit" variant="outline">Search</Button>
                            </form>

                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <Select value={filters.status ?? 'active'} onValueChange={(value) => navigate({ status: value, ticket: undefined })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="open">Open</SelectItem>
                                        <SelectItem value="in_progress">In Progress</SelectItem>
                                        <SelectItem value="resolved">Resolved</SelectItem>
                                        <SelectItem value="all">All Tickets</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select value={filters.category ?? 'all'} onValueChange={(value) => navigate({ category: value, ticket: undefined })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Categories</SelectItem>
                                        {categories.map((category) => (
                                            <SelectItem key={category.value} value={category.value}>
                                                {category.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="p-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                            {tickets.data.length === 0 ? (
                                <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
                                    <Inbox className="h-10 w-10 opacity-40" />
                                    <p className="text-sm font-medium">No tickets found</p>
                                    <p className="text-xs">Create a ticket or adjust the filters.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {tickets.data.map((ticket) => (
                                        <TicketListItem
                                            key={ticket.id}
                                            ticket={ticket}
                                            active={selectedTicket?.id === ticket.id}
                                            categoryLabel={categoryLabels[ticket.category] ?? formatLabel(ticket.category)}
                                            priorityLabel={priorityLabels[ticket.priority] ?? formatLabel(ticket.priority)}
                                            onSelect={() => navigate({ ticket: ticket.id })}
                                            initials={getInitials(ticket.requester_name ?? 'User')}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {tickets.last_page > 1 && (
                            <div className="flex flex-wrap items-center justify-center gap-1 border-t p-3 xl:shrink-0">
                                {tickets.links.map((link, index) => (
                                    <Button
                                        key={`${link.label}-${index}`}
                                        variant={link.active ? 'default' : 'outline'}
                                        size="sm"
                                        disabled={!link.url}
                                        onClick={() => link.url && router.visit(link.url, { preserveScroll: true })}
                                        className="h-8 min-w-8 px-2"
                                    >
                                        {paginationLabel(link.label)}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="min-w-0 rounded-lg border bg-card xl:flex xl:flex-col xl:h-full xl:min-h-0 xl:overflow-hidden">
                        {selectedTicket ? (
                            <TicketDetail
                                ticket={selectedTicket}
                                categoryLabel={categoryLabels[selectedTicket.category] ?? formatLabel(selectedTicket.category)}
                                priorityLabel={priorityLabels[selectedTicket.priority] ?? formatLabel(selectedTicket.priority)}
                                canManageTickets={canManageTickets}
                                currentFilter={filters.status ?? 'active'}
                            />
                        ) : (
                            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
                                <MessageSquare className="h-12 w-12 opacity-30" />
                                <div>
                                    <p className="font-medium text-foreground">Select a ticket</p>
                                    <p className="mt-1 text-sm">Ticket details and replies will appear here.</p>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </AppLayout>
    );
}

function StatTile({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
    return (
        <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
            </div>
        </div>
    );
}

function TicketListItem({
    ticket,
    active,
    categoryLabel,
    priorityLabel,
    onSelect,
    initials,
}: {
    ticket: SupportTicketSummary;
    active: boolean;
    categoryLabel: string;
    priorityLabel: string;
    onSelect: () => void;
    initials: string;
}) {
    const status = statusConfig[ticket.status] ?? statusConfig.open;
    const StatusIcon = status.icon;

    return (
        <button
            type="button"
            onClick={onSelect}
            className={cn(
                'w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/60',
                active ? 'border-blue-400 bg-blue-50/70 dark:bg-blue-950/20' : 'bg-background',
            )}
        >
            <div className="flex items-start gap-3">
                <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={ticket.requester_avatar_url ?? undefined} alt={ticket.requester_name ?? ''} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-muted-foreground">{ticket.ticket_number}</p>
                            <p className="line-clamp-2 text-sm font-semibold leading-snug">{ticket.subject}</p>
                        </div>
                        <Badge variant="outline" className={cn('shrink-0 gap-1 px-2 py-0.5 text-[10px]', status.className)}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                        </Badge>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="px-2 py-0.5 text-[10px]">
                            <Tag className="mr-1 h-3 w-3" />
                            {categoryLabel}
                        </Badge>
                        <Badge variant="outline" className={cn('px-2 py-0.5 text-[10px]', priorityClass[ticket.priority])}>
                            {priorityLabel}
                        </Badge>
                    </div>

                    {ticket.liquidation && (
                        <p className="mt-2 truncate text-xs text-muted-foreground">
                            {ticket.liquidation.control_no} - {ticket.liquidation.hei_name ?? 'No HEI'}
                        </p>
                    )}

                    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span className="truncate">by {ticket.requester_name ?? 'User'}</span>
                        <span className="shrink-0">{ticket.last_reply_at ?? ticket.created_at}</span>
                    </div>
                </div>
            </div>
        </button>
    );
}

function TicketDetail({
    ticket,
    categoryLabel,
    priorityLabel,
    canManageTickets,
    currentFilter,
}: {
    ticket: SupportTicketDetail;
    categoryLabel: string;
    priorityLabel: string;
    canManageTickets: boolean;
    currentFilter: string;
}) {
    const replyForm = useForm({ body: '' });
    const statusForm = useForm({
        status: '',
        filter_status: currentFilter,
        remarks: '',
    });
    const [statusAction, setStatusAction] = useState<'resolved' | 'open' | null>(null);
    const [confettiRun, setConfettiRun] = useState(0);
    const getInitials = useInitials();
    const { url } = usePage();
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
        const targetId = new URLSearchParams(query).get('message');
        if (!targetId) return;

        const timer = window.setTimeout(() => {
            const el = document.getElementById(`ticket-message-${targetId}`);
            if (!el) return;
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('rounded-md', 'ring-2', 'ring-primary', 'ring-offset-2');
            window.setTimeout(() => {
                el.classList.remove('rounded-md', 'ring-2', 'ring-primary', 'ring-offset-2');
            }, 2200);
        }, 80);

        return () => window.clearTimeout(timer);
    }, [url]);
    const status = statusConfig[ticket.status] ?? statusConfig.open;
    const StatusIcon = status.icon;

    const submitReplyBody = () => {
        if (replyForm.processing || !replyForm.data.body.trim()) return;

        replyForm.post(route('support-tickets.reply', ticket.id), {
            preserveScroll: true,
            onSuccess: () => {
                replyForm.reset();
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => {
                        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    }),
                );
            },
        });
    };

    const submitReply = (event: React.FormEvent) => {
        event.preventDefault();
        submitReplyBody();
    };

    const handleReplyKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;

        event.preventDefault();
        submitReplyBody();
    };

    const updateStatus = (nextStatus: string) => {
        router.patch(
            route('support-tickets.update-status', ticket.id),
            { status: nextStatus, filter_status: currentFilter },
            { preserveScroll: true },
        );
    };

    const openStatusDialog = (nextStatus: 'resolved' | 'open') => {
        statusForm.clearErrors();
        statusForm.setData({
            status: nextStatus,
            filter_status: currentFilter,
            remarks: '',
        });
        setStatusAction(nextStatus);
    };

    const submitStatusChange = (event: React.FormEvent) => {
        event.preventDefault();
        if (!statusAction) return;
        const resolving = statusAction === 'resolved';

        statusForm.patch(route('support-tickets.update-status', ticket.id), {
            preserveScroll: true,
            onSuccess: () => {
                statusForm.reset();
                setStatusAction(null);
                if (resolving) {
                    setConfettiRun((run) => run + 1);
                }
            },
        });
    };

    return (
        <div className="relative xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
            <div className="border-b bg-card p-5 xl:shrink-0">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-medium text-muted-foreground">{ticket.ticket_number}</span>
                            <Badge variant="outline" className={cn('gap-1 px-2 py-0.5 text-[10px]', status.className)}>
                                <StatusIcon className="h-3 w-3" />
                                {status.label}
                            </Badge>
                            <Badge variant="outline" className={cn('px-2 py-0.5 text-[10px]', priorityClass[ticket.priority])}>
                                {priorityLabel}
                            </Badge>
                        </div>
                        <h2 className="mt-2 break-words text-lg font-semibold leading-snug">{ticket.subject}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {categoryLabel} - opened by {ticket.requester_name ?? 'User'} on {ticket.created_at}
                        </p>
                    </div>

                    {ticket.can_update_status && (
                        <div className="flex flex-wrap gap-2">
                            {ticket.can_manage && ticket.status === 'open' && (
                                <Button variant="outline" size="sm" onClick={() => updateStatus('in_progress')}>
                                    <Clock3 className="mr-2 h-4 w-4" />
                                    Start
                                </Button>
                            )}
                            {ticket.status !== 'resolved' ? (
                                <Button size="sm" onClick={() => openStatusDialog('resolved')}>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Resolve
                                </Button>
                            ) : (
                                <Button variant="outline" size="sm" onClick={() => openStatusDialog('open')}>
                                    Reopen
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {ticket.liquidation && (
                    <div className="mt-4 rounded-md border bg-muted/30 p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Linked Liquidation</p>
                                <p className="mt-1 text-sm font-semibold">{ticket.liquidation.control_no}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {ticket.liquidation.program_code ?? 'Program'} - {ticket.liquidation.hei_name ?? 'No HEI'}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {ticket.liquidation.document_status && (
                                        <Badge variant="outline" className="text-[10px]">Docs: {ticket.liquidation.document_status}</Badge>
                                    )}
                                    {ticket.liquidation.rc_note_status && (
                                        <Badge variant="outline" className="text-[10px]">RC: {ticket.liquidation.rc_note_status}</Badge>
                                    )}
                                    {ticket.liquidation.liquidation_status && (
                                        <Badge variant="outline" className="text-[10px]">Status: {ticket.liquidation.liquidation_status}</Badge>
                                    )}
                                </div>
                            </div>
                            <Button asChild variant="outline" size="sm" className="shrink-0">
                                <Link href={`/liquidation/${ticket.liquidation.id}`}>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    View Entry
                                </Link>
                            </Button>
                        </div>
                    </div>
                )}

                {ticket.resolved_at && (
                    <div className="mt-3 min-w-0 rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
                        <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                            Resolved by {ticket.resolved_by_name ?? 'support'} on {ticket.resolved_at}.
                        </p>
                        {ticket.resolution_remarks && (
                            // break-words so one long unbroken string cannot stretch the panel.
                            <p className="mt-1.5 text-sm break-words whitespace-pre-wrap text-emerald-900 dark:text-emerald-100">
                                {ticket.resolution_remarks}
                            </p>
                        )}
                    </div>
                )}
            </div>

            <div className="p-5 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <div className="space-y-4">
                    {ticket.messages.map((message) => (
                        <div key={message.id} id={`ticket-message-${message.id}`} className="flex gap-3">
                            <Avatar className="h-9 w-9 shrink-0">
                                <AvatarImage src={message.user_avatar_url ?? undefined} alt={message.user_name} />
                                <AvatarFallback className="text-xs">{getInitials(message.user_name)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1 rounded-md border bg-background p-3">
                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold">{message.user_name}</span>
                                    {message.is_staff && message.role && (
                                        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                            {message.role}
                                        </Badge>
                                    )}
                                    <span className="text-xs text-muted-foreground">{message.time_ago}</span>
                                </div>
                                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div ref={bottomRef} aria-hidden className="h-6" />
            </div>

            {ticket.can_reply ? (
            <form onSubmit={submitReply} className="sticky bottom-0 z-20 border-t bg-card p-3 shadow-[0_-8px_20px_rgba(15,23,42,0.06)] xl:shrink-0">
                <div className="flex items-end gap-2">
                    <Label htmlFor="reply" className="sr-only">Reply</Label>
                    <Textarea
                        id="reply"
                        value={replyForm.data.body}
                        onChange={(event) => replyForm.setData('body', event.target.value)}
                        onKeyDown={handleReplyKeyDown}
                        rows={1}
                        placeholder={ticket.status === 'resolved' ? 'Replying will reopen this ticket...' : 'Type your reply...'}
                        className={cn('max-h-32 min-h-[2.5rem] flex-1 resize-none', replyForm.errors.body && 'border-red-500')}
                    />
                    <Button
                        type="submit"
                        size="icon"
                        className="h-10 w-10 shrink-0"
                        disabled={replyForm.processing || !replyForm.data.body.trim()}
                        aria-label="Send reply"
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
                {replyForm.errors.body && (
                    <p className="mt-1 text-sm text-red-500">{replyForm.errors.body}</p>
                )}
            </form>
            ) : (
                <div className="sticky bottom-0 z-20 border-t bg-card p-4 text-sm text-muted-foreground xl:shrink-0">
                    This ticket has been resolved and is closed for replies.
                </div>
            )}

            {canManageTickets && !ticket.can_manage && (
                <p className="border-t px-4 py-2 text-xs text-muted-foreground xl:shrink-0">
                    You can view this ticket as a support manager.
                </p>
            )}

            <StatusRemarksDialog
                open={statusAction !== null}
                action={statusAction}
                remarks={statusForm.data.remarks}
                processing={statusForm.processing}
                error={statusForm.errors.remarks}
                onRemarksChange={(remarks) => statusForm.setData('remarks', remarks)}
                onOpenChange={(open) => {
                    if (!open) setStatusAction(null);
                }}
                onSubmit={submitStatusChange}
            />

            {confettiRun > 0 && <LightConfetti key={confettiRun} />}
        </div>
    );
}

function LightConfetti() {
    const [visible, setVisible] = useState(true);
    const colors = ['#16a34a', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6'];
    const pieces = Array.from({ length: 24 }, (_, index) => ({
        id: index,
        color: colors[index % colors.length],
        left: `${34 + (index % 9) * 4}%`,
        size: 6 + (index % 3) * 2,
        delay: (index % 6) * 0.04,
        duration: 0.9 + (index % 5) * 0.1,
        x: `${(index % 2 === 0 ? -1 : 1) * (18 + (index % 5) * 10)}px`,
    }));

    useEffect(() => {
        const timeout = window.setTimeout(() => setVisible(false), 1400);
        return () => window.clearTimeout(timeout);
    }, []);

    if (!visible) return null;

    return (
        <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden="true">
            <style>
                {`
                    @keyframes support-confetti-fall {
                        0% { opacity: 0; transform: translate3d(0, -12px, 0) rotate(0deg); }
                        12% { opacity: 1; }
                        100% { opacity: 0; transform: translate3d(var(--confetti-x), 170px, 0) rotate(680deg); }
                    }
                `}
            </style>
            <div className="absolute inset-x-0 top-16 h-1">
                {pieces.map((piece) => (
                    <span
                        key={piece.id}
                        className="absolute rounded-sm"
                        style={{
                            '--confetti-x': piece.x,
                            left: piece.left,
                            height: `${piece.size}px`,
                            width: `${piece.size / 2}px`,
                            backgroundColor: piece.color,
                            animation: `support-confetti-fall ${piece.duration}s ease-out ${piece.delay}s forwards`,
                        } as React.CSSProperties}
                    />
                ))}
            </div>
        </div>
    );
}

function StatusRemarksDialog({
    open,
    action,
    remarks,
    processing,
    error,
    onRemarksChange,
    onOpenChange,
    onSubmit,
}: {
    open: boolean;
    action: 'resolved' | 'open' | null;
    remarks: string;
    processing: boolean;
    error?: string;
    onRemarksChange: (remarks: string) => void;
    onOpenChange: (open: boolean) => void;
    onSubmit: (event: React.FormEvent) => void;
}) {
    const isResolve = action === 'resolved';
    const title = isResolve ? 'Resolve Ticket' : 'Reopen Ticket';
    const submitLabel = isResolve ? 'Resolve' : 'Reopen';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Add optional remarks for the ticket thread.
                    </DialogDescription>
                </DialogHeader>
                {/* min-w-0 on the grid child: DialogContent is a grid, whose items
                    default to min-width:auto and so refuse to shrink below their
                    content. A long unbroken string in the textarea then pushed the
                    field out past the dialog instead of wrapping inside it. */}
                <form onSubmit={onSubmit} className="min-w-0 space-y-4">
                    <div className="min-w-0">
                        <Label htmlFor="ticket-status-remarks">Remarks</Label>
                        <Textarea
                            id="ticket-status-remarks"
                            value={remarks}
                            onChange={(event) => onRemarksChange(event.target.value)}
                            rows={4}
                            maxLength={2000}
                            placeholder={isResolve ? 'Optional resolution note...' : 'Optional reopen note...'}
                            className={cn('mt-1 w-full min-w-0 resize-none', error && 'border-red-500')}
                        />
                        {error ? (
                            <p className="mt-1 text-sm text-red-500">{error}</p>
                        ) : (
                            <p className="mt-1 text-xs text-muted-foreground">
                                Leave blank if no remarks are needed.
                            </p>
                        )}
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Saving...' : submitLabel}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
