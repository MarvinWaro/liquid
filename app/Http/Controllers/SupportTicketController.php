<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Support\ReplySupportTicketRequest;
use App\Http\Requests\Support\StoreSupportTicketRequest;
use App\Http\Requests\Support\UpdateSupportTicketStatusRequest;
use App\Models\ActivityLog;
use App\Models\Liquidation;
use App\Models\Notification;
use App\Models\SupportTicket;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class SupportTicketController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $filters = [
            'status' => $request->input('status', 'active'),
            'category' => $request->input('category', 'all'),
            'search' => $request->input('search', ''),
        ];

        $baseQuery = $this->visibleTicketsQuery($user);
        $stats = [
            'all' => (clone $baseQuery)->count(),
            'active' => (clone $baseQuery)->whereIn('status', [
                SupportTicket::STATUS_OPEN,
                SupportTicket::STATUS_IN_PROGRESS,
            ])->count(),
            'resolved' => (clone $baseQuery)->where('status', SupportTicket::STATUS_RESOLVED)->count(),
        ];

        $query = $this->visibleTicketsQuery($user)
            ->with([
                'requester:id,name,avatar',
                'liquidation:id,control_no,hei_id,program_id,liquidation_status_id,document_status_id,rc_note_status_id',
                'liquidation.hei:id,name',
                'liquidation.program:id,code,name',
                'liquidation.liquidationStatus:id,name,code',
            ])
            ->withCount('messages')
            ->orderByRaw('CASE WHEN status = ? THEN 1 ELSE 0 END ASC', [SupportTicket::STATUS_RESOLVED])
            ->orderByDesc('last_reply_at')
            ->orderByDesc('created_at');

        $this->applyTicketFilters($query, $filters);

        $paginator = $query->paginate(12)->withQueryString();
        $fallbackTicket = $paginator->getCollection()->first();
        $selectedTicket = $this->selectedTicket($request, $user, $fallbackTicket);

        return Inertia::render('contact-support', [
            'tickets' => $paginator->through(fn (SupportTicket $ticket) => $this->ticketSummary($ticket)),
            'selectedTicket' => $selectedTicket ? $this->ticketDetail($selectedTicket, $user) : null,
            'liquidationOptions' => $this->liquidationOptions($user),
            'filters' => $filters,
            'stats' => $stats,
            'canManageTickets' => $this->isSupportManager($user),
            'categories' => $this->categoryOptions(),
            'priorities' => $this->priorityOptions(),
            'statuses' => $this->statusOptions(),
        ]);
    }

    public function store(StoreSupportTicketRequest $request): RedirectResponse
    {
        $user = $request->user();
        $validated = $request->validated();

        $liquidation = null;
        if (!empty($validated['liquidation_id'])) {
            $liquidation = Liquidation::find($validated['liquidation_id']);
            if (!$liquidation || !$this->canAccessLiquidation($user, $liquidation)) {
                throw ValidationException::withMessages([
                    'liquidation_id' => 'The selected liquidation is not available to your account.',
                ]);
            }
        }

        $ticket = DB::transaction(function () use ($validated, $user, $liquidation): SupportTicket {
            $ticket = SupportTicket::create([
                'ticket_number' => $this->generateTicketNumber(),
                'requester_id' => $user->id,
                'liquidation_id' => $liquidation?->id,
                'category' => $validated['category'],
                'priority' => $validated['priority'],
                'status' => SupportTicket::STATUS_OPEN,
                'subject' => $validated['subject'],
                'description' => $validated['description'],
                'last_reply_at' => now(),
            ]);

            $ticket->messages()->create([
                'user_id' => $user->id,
                'body' => $validated['description'],
            ]);

            ActivityLog::log(
                'created_support_ticket',
                "Created support ticket {$ticket->ticket_number}: {$ticket->subject}",
                $ticket,
                'Contact & Support',
            );

            return $ticket;
        });

        $ticket->load(['requester', 'liquidation.hei', 'liquidation.program']);
        $this->notifyTicketCreated($ticket, $user);

        return redirect()
            ->route('contact-support', ['ticket' => $ticket->id])
            ->with('success', "Support ticket {$ticket->ticket_number} created.");
    }

    public function reply(ReplySupportTicketRequest $request, SupportTicket $supportTicket): RedirectResponse
    {
        $user = $request->user();
        if (!$this->canViewTicket($user, $supportTicket)) {
            abort(403, 'You cannot reply to this ticket.');
        }

        if ($supportTicket->status === SupportTicket::STATUS_RESOLVED
            && !$this->canManageTicket($user, $supportTicket)) {
            abort(403, 'This ticket has been resolved and is closed for replies.');
        }

        $validated = $request->validated();

        DB::transaction(function () use ($supportTicket, $user, $validated): void {
            $supportTicket->messages()->create([
                'user_id' => $user->id,
                'body' => $validated['body'],
            ]);

            $updates = ['last_reply_at' => now()];
            if ($supportTicket->status === SupportTicket::STATUS_RESOLVED) {
                $updates['status'] = SupportTicket::STATUS_OPEN;
                $updates['resolved_at'] = null;
                $updates['resolved_by'] = null;
            } elseif ($supportTicket->status === SupportTicket::STATUS_OPEN && $this->canManageTicket($user, $supportTicket)) {
                $updates['status'] = SupportTicket::STATUS_IN_PROGRESS;
            }

            $supportTicket->update($updates);
        });

        $supportTicket->refresh()->load(['requester', 'messages.user', 'liquidation.hei', 'liquidation.program']);
        $this->notifyTicketReplied($supportTicket, $user);

        return redirect()
            ->route('contact-support', ['ticket' => $supportTicket->id])
            ->with('success', 'Reply added.');
    }

    public function updateStatus(UpdateSupportTicketStatusRequest $request, SupportTicket $supportTicket): RedirectResponse
    {
        $user = $request->user();
        if (!$this->canViewTicket($user, $supportTicket)) {
            abort(403, 'You cannot update this ticket.');
        }

        $validated = $request->validated();
        $remarks = trim((string) ($validated['remarks'] ?? ''));

        if (!$this->canManageTicket($user, $supportTicket)) {
            abort(403, 'Only support staff can update this ticket\'s status.');
        }

        $oldStatus = $supportTicket->status;
        $updates = ['status' => $validated['status']];
        if ($validated['status'] === SupportTicket::STATUS_RESOLVED) {
            $updates['resolved_at'] = now();
            $updates['resolved_by'] = $user->id;
        } else {
            $updates['resolved_at'] = null;
            $updates['resolved_by'] = null;
        }
        if ($remarks !== '') {
            $updates['last_reply_at'] = now();
        }

        $action = $validated['status'] === SupportTicket::STATUS_RESOLVED
            ? 'resolved_support_ticket'
            : 'updated_support_ticket_status';

        DB::transaction(function () use ($supportTicket, $updates, $action, $oldStatus, $validated, $remarks, $user): void {
            $supportTicket->update($updates);

            if ($remarks !== '') {
                $supportTicket->messages()->create([
                    'user_id' => $user->id,
                    'body' => $this->statusRemarksBody($validated['status'], $remarks),
                ]);
            }

            ActivityLog::log(
                $action,
                "Changed support ticket {$supportTicket->ticket_number} from {$oldStatus} to {$validated['status']}",
                $supportTicket,
                'Contact & Support',
            );
        });

        $supportTicket->refresh()->load(['requester', 'messages.user', 'liquidation.hei', 'liquidation.program']);
        $this->notifyTicketStatusChanged($supportTicket, $user, $oldStatus);

        return redirect()
            ->route('contact-support', ['ticket' => $supportTicket->id, 'status' => $request->input('filter_status')])
            ->with('success', 'Ticket status updated.');
    }

    private function statusRemarksBody(string $status, string $remarks): string
    {
        return match ($status) {
            SupportTicket::STATUS_RESOLVED => "Resolution note: {$remarks}",
            SupportTicket::STATUS_OPEN => "Reopen note: {$remarks}",
            default => "Status note: {$remarks}",
        };
    }

    private function selectedTicket(Request $request, User $user, ?SupportTicket $fallbackTicket): ?SupportTicket
    {
        $ticketId = $request->input('ticket');
        $query = $this->visibleTicketsQuery($user)
            ->with([
                'requester:id,name,avatar',
                'assignee:id,name',
                'resolver:id,name',
                'liquidation:id,control_no,hei_id,program_id,liquidation_status_id,document_status_id,rc_note_status_id',
                'liquidation.hei:id,name',
                'liquidation.program:id,code,name',
                'liquidation.documentStatus:id,name,code',
                'liquidation.rcNoteStatus:id,name,code',
                'liquidation.liquidationStatus:id,name,code',
                'messages.user:id,name,avatar,role_id,region_id,hei_id,program_id',
                'messages.user.role:id,name',
            ]);

        if ($ticketId) {
            return (clone $query)->where('id', $ticketId)->first();
        }

        return $fallbackTicket ? (clone $query)->where('id', $fallbackTicket->id)->first() : null;
    }

    private function visibleTicketsQuery(User $user): Builder
    {
        $query = SupportTicket::query();
        if ($this->isSupportManager($user)) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($user) {
            $q->where('requester_id', $user->id)
                ->orWhere('assigned_to', $user->id);

            // HEI users share visibility with their institution peers:
            // any ticket opened by a user of the same HEI is visible to all.
            if ($user->role?->name === 'HEI' && $user->hei_id) {
                $q->orWhereHas('requester', function (Builder $requesterQuery) use ($user) {
                    $requesterQuery->where('hei_id', $user->hei_id);
                });
            }

            if ($this->canHandleScopedLiquidationTickets($user)) {
                $q->orWhereHas('liquidation', function (Builder $liquidationQuery) use ($user) {
                    $this->scopeLiquidationsForUser($liquidationQuery, $user);
                });
            }
        });
    }

    private function applyTicketFilters(Builder $query, array $filters): void
    {
        $status = $filters['status'] ?? 'active';
        if ($status === 'active') {
            $query->whereIn('status', [SupportTicket::STATUS_OPEN, SupportTicket::STATUS_IN_PROGRESS]);
        } elseif ($status !== 'all' && in_array($status, SupportTicket::statuses(), true)) {
            $query->where('status', $status);
        }

        if (!empty($filters['category']) && $filters['category'] !== 'all') {
            $query->where('category', $filters['category']);
        }

        if (!empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->where(function (Builder $q) use ($search) {
                $q->where('ticket_number', 'like', "%{$search}%")
                    ->orWhere('subject', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhereHas('requester', fn (Builder $userQuery) => $userQuery->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('liquidation', fn (Builder $liqQuery) => $liqQuery->where('control_no', 'like', "%{$search}%"));
            });
        }
    }

    private function canViewTicket(User $user, SupportTicket $ticket): bool
    {
        return $this->visibleTicketsQuery($user)->where('id', $ticket->id)->exists();
    }

    private function canManageTicket(User $user, SupportTicket $ticket): bool
    {
        if ($this->isSupportManager($user) || $ticket->assigned_to === $user->id) {
            return true;
        }

        return $ticket->liquidation_id
            && $this->canHandleScopedLiquidationTickets($user)
            && $this->canAccessLiquidation($user, $ticket->liquidation);
    }

    private function isSupportManager(User $user): bool
    {
        return $user->isSuperAdmin() || $user->role?->name === 'Admin';
    }

    private function canHandleScopedLiquidationTickets(User $user): bool
    {
        return in_array($user->role?->name, ['Regional Coordinator', 'STUFAPS Focal'], true);
    }

    private function canAccessLiquidation(User $user, ?Liquidation $liquidation): bool
    {
        if (!$liquidation) {
            return false;
        }

        $query = Liquidation::query()->where('id', $liquidation->id);
        $this->scopeLiquidationsForUser($query, $user);

        return $query->exists();
    }

    private function scopeLiquidationsForUser(Builder $query, User $user): void
    {
        $roleName = $user->role?->name;

        if ($this->isSupportManager($user)) {
            return;
        }

        if ($roleName === 'HEI' && $user->hei_id) {
            $query->where('hei_id', $user->hei_id);
        } elseif ($roleName === 'Regional Coordinator' && $user->region_id) {
            $query->whereHas('hei', fn (Builder $q) => $q->where('region_id', $user->region_id))
                ->whereDoesntHave('program', fn (Builder $q) => $q->whereNotNull('parent_id'));
        } elseif ($roleName === 'STUFAPS Focal') {
            $scopedProgramIds = $user->getParentScopedProgramIds();
            $scopedProgramIds
                ? $query->whereIn('program_id', $scopedProgramIds)
                : $query->whereRaw('1 = 0');
        } elseif ($roleName === 'Accountant') {
            $query->whereNotNull('reviewed_at');
        } elseif ($roleName === 'COA') {
            $query->whereNotNull('coa_endorsed_at');
        } else {
            $query->where('created_by', $user->id);
        }
    }

    private function liquidationOptions(User $user): array
    {
        $query = Liquidation::query()
            ->with([
                'hei:id,name',
                'program:id,code,name',
                'documentStatus:id,name',
                'liquidationStatus:id,name',
            ])
            ->select('id', 'control_no', 'hei_id', 'program_id', 'document_status_id', 'liquidation_status_id', 'updated_at')
            ->orderByDesc('updated_at')
            ->limit(250);

        $this->scopeLiquidationsForUser($query, $user);

        return $query->get()->map(fn (Liquidation $liquidation) => [
            'id' => $liquidation->id,
            'control_no' => $liquidation->control_no,
            'hei_name' => $liquidation->hei?->name,
            'program_code' => $liquidation->program?->code,
            'document_status' => $liquidation->documentStatus?->name,
            'liquidation_status' => $liquidation->liquidationStatus?->name,
        ])->all();
    }

    private function ticketSummary(SupportTicket $ticket): array
    {
        return [
            'id' => $ticket->id,
            'ticket_number' => $ticket->ticket_number,
            'subject' => $ticket->subject,
            'category' => $ticket->category,
            'priority' => $ticket->priority,
            'status' => $ticket->status,
            'requester_name' => $ticket->requester?->name,
            'requester_avatar_url' => $ticket->requester?->avatar_url,
            'messages_count' => $ticket->messages_count ?? 0,
            'liquidation' => $ticket->liquidation ? [
                'id' => $ticket->liquidation->id,
                'control_no' => $ticket->liquidation->control_no,
                'hei_name' => $ticket->liquidation->hei?->name,
                'program_code' => $ticket->liquidation->program?->code,
                'liquidation_status' => $ticket->liquidation->liquidationStatus?->name,
            ] : null,
            'last_reply_at' => $ticket->last_reply_at?->diffForHumans(),
            'created_at' => $ticket->created_at->timezone('Asia/Manila')->format('M d, Y H:i'),
        ];
    }

    private function ticketDetail(SupportTicket $ticket, User $viewer): array
    {
        $viewerCanManage = $this->canManageTicket($viewer, $ticket);
        $messageStaffByUserId = $this->messageStaffByUserId($ticket);

        return [
            ...$this->ticketSummary($ticket),
            'description' => $ticket->description,
            'can_manage' => $viewerCanManage,
            'can_update_status' => $viewerCanManage,
            'can_reply' => $viewerCanManage || $ticket->status !== SupportTicket::STATUS_RESOLVED,
            'assignee_name' => $ticket->assignee?->name,
            'resolved_by_name' => $ticket->resolver?->name,
            'resolved_at' => $ticket->resolved_at?->timezone('Asia/Manila')->format('M d, Y H:i'),
            'liquidation' => $ticket->liquidation ? [
                'id' => $ticket->liquidation->id,
                'control_no' => $ticket->liquidation->control_no,
                'hei_name' => $ticket->liquidation->hei?->name,
                'program_code' => $ticket->liquidation->program?->code,
                'document_status' => $ticket->liquidation->documentStatus?->name,
                'rc_note_status' => $ticket->liquidation->rcNoteStatus?->name,
                'liquidation_status' => $ticket->liquidation->liquidationStatus?->name,
            ] : null,
            'messages' => $ticket->messages->map(fn ($message) => [
                'id' => $message->id,
                'body' => $message->body,
                'user_name' => $message->user?->name ?? 'System',
                'user_avatar_url' => $message->user?->avatar_url,
                'is_staff' => $message->user_id
                    ? ($messageStaffByUserId[$message->user_id] ?? false)
                    : true,
                'role' => $message->user?->role?->name,
                'created_at' => $message->created_at->timezone('Asia/Manila')->format('M d, Y H:i'),
                'time_ago' => $message->created_at->diffForHumans(),
            ])->all(),
        ];
    }

    private function messageStaffByUserId(SupportTicket $ticket): array
    {
        return $ticket->messages
            ->pluck('user')
            ->filter()
            ->unique('id')
            ->mapWithKeys(fn (User $user) => [
                $user->id => $this->messageAuthorIsStaff($user, $ticket),
            ])
            ->all();
    }

    private function messageAuthorIsStaff(User $user, SupportTicket $ticket): bool
    {
        if ($this->isSupportManager($user) || $ticket->assigned_to === $user->id) {
            return true;
        }

        if ($ticket->requester_id === $user->id) {
            return false;
        }

        return $ticket->liquidation_id
            && $this->canHandleScopedLiquidationTickets($user)
            && $this->canAccessLiquidation($user, $ticket->liquidation);
    }

    /**
     * Active HEI teammates that share the requester's institution.
     * Mirrors the institution-peer visibility rule so the whole team
     * is kept in sync on ticket activity.
     */
    private function heiPeersForTicket(SupportTicket $ticket): Collection
    {
        $ticket->loadMissing('requester.role');
        $requester = $ticket->requester;

        if (!$requester || $requester->role?->name !== 'HEI' || !$requester->hei_id) {
            return collect();
        }

        return User::where('hei_id', $requester->hei_id)
            ->where('status', 'active')
            ->whereHas('role', fn (Builder $q) => $q->where('name', 'HEI'))
            ->get();
    }

    private function supportRecipientsForTicket(SupportTicket $ticket): Collection
    {
        $recipients = User::whereHas('role', fn (Builder $q) => $q->whereIn('name', ['Admin', 'Super Admin']))
            ->where('status', 'active')
            ->get()
            ->merge($this->heiPeersForTicket($ticket));

        $ticket->loadMissing(['liquidation.hei', 'liquidation.program']);
        $liquidation = $ticket->liquidation;
        if (!$liquidation) {
            return $recipients;
        }

        if ($liquidation->program?->parent_id) {
            $focals = User::whereHas('role', fn (Builder $q) => $q->where('name', 'STUFAPS Focal'))
                ->whereHas('programs', fn (Builder $q) => $q->where('programs.id', $liquidation->program_id))
                ->where('status', 'active')
                ->get();

            return $recipients->merge($focals)->unique('id')->values();
        }

        if ($liquidation->hei?->region_id) {
            $rcs = User::whereHas('role', fn (Builder $q) => $q->where('name', 'Regional Coordinator'))
                ->where('region_id', $liquidation->hei->region_id)
                ->where('status', 'active')
                ->get();

            return $recipients->merge($rcs)->unique('id')->values();
        }

        return $recipients;
    }

    private function notifyTicketCreated(SupportTicket $ticket, User $actor): void
    {
        $this->notifyUsers(
            $this->supportRecipientsForTicket($ticket),
            $actor,
            'support_ticket_created',
            "created support ticket {$ticket->ticket_number}: {$ticket->subject}",
            $ticket,
        );
    }

    private function notifyTicketReplied(SupportTicket $ticket, User $actor): void
    {
        $participants = User::whereIn(
            'id',
            $ticket->messages()->whereNotNull('user_id')->pluck('user_id')->all(),
        )->get();

        $recipients = $this->supportRecipientsForTicket($ticket)
            ->merge($participants)
            ->push($ticket->requester)
            ->filter()
            ->unique('id')
            ->values();

        $this->notifyUsers(
            $recipients,
            $actor,
            'support_ticket_replied',
            "replied to support ticket {$ticket->ticket_number}: {$ticket->subject}",
            $ticket,
        );
    }

    private function notifyTicketStatusChanged(SupportTicket $ticket, User $actor, string $oldStatus): void
    {
        $recipients = $this->supportRecipientsForTicket($ticket)
            ->push($ticket->requester)
            ->filter()
            ->unique('id')
            ->values();

        $action = $ticket->status === SupportTicket::STATUS_RESOLVED
            ? 'support_ticket_resolved'
            : 'support_ticket_reopened';

        $this->notifyUsers(
            $recipients,
            $actor,
            $action,
            "changed support ticket {$ticket->ticket_number} from {$oldStatus} to {$ticket->status}",
            $ticket,
        );
    }

    private function notifyUsers(Collection $users, User $actor, string $action, string $description, SupportTicket $ticket): void
    {
        $latestMessageId = $ticket->messages()->reorder()->latest()->value('id');
        $metadata = json_encode([
            'url' => route('contact-support', array_filter([
                'ticket' => $ticket->id,
                'message' => $latestMessageId,
            ]), false),
        ], JSON_THROW_ON_ERROR);

        $rows = $users
            ->filter(fn (User $user) => $user->id !== $actor->id)
            ->unique('id')
            ->map(fn (User $user) => [
                'id' => Str::uuid()->toString(),
                'user_id' => $user->id,
                'actor_id' => $actor->id,
                'actor_name' => $actor->name,
                'action' => $action,
                'description' => Str::limit($description, 240, ''),
                'subject_type' => SupportTicket::class,
                'subject_id' => $ticket->id,
                'subject_label' => $ticket->ticket_number,
                'module' => 'Contact & Support',
                'metadata' => $metadata,
                'created_at' => now(),
                'updated_at' => now(),
            ])
            ->values()
            ->all();

        if ($rows !== []) {
            Notification::insert($rows);
        }
    }

    private function generateTicketNumber(): string
    {
        do {
            $number = 'TKT-'.now()->format('Ymd').'-'.Str::upper(Str::random(6));
        } while (SupportTicket::where('ticket_number', $number)->exists());

        return $number;
    }

    private function categoryOptions(): array
    {
        return [
            ['value' => SupportTicket::CATEGORY_LIQUIDATION_RECORD, 'label' => 'Liquidation Entry'],
            ['value' => SupportTicket::CATEGORY_STATUS_FOLLOW_UP, 'label' => 'Status Follow-up'],
            ['value' => SupportTicket::CATEGORY_DOCUMENT_UPLOAD, 'label' => 'Document Upload'],
            ['value' => SupportTicket::CATEGORY_ACCOUNT_ACCESS, 'label' => 'Account Access'],
            ['value' => SupportTicket::CATEGORY_TECHNICAL_ISSUE, 'label' => 'Technical Issue'],
            ['value' => SupportTicket::CATEGORY_OTHER, 'label' => 'Other Concern'],
        ];
    }

    private function priorityOptions(): array
    {
        return [
            ['value' => SupportTicket::PRIORITY_LOW, 'label' => 'Low'],
            ['value' => SupportTicket::PRIORITY_NORMAL, 'label' => 'Normal'],
            ['value' => SupportTicket::PRIORITY_HIGH, 'label' => 'High'],
            ['value' => SupportTicket::PRIORITY_URGENT, 'label' => 'Urgent'],
        ];
    }

    private function statusOptions(): array
    {
        return [
            ['value' => SupportTicket::STATUS_OPEN, 'label' => 'Open'],
            ['value' => SupportTicket::STATUS_IN_PROGRESS, 'label' => 'In Progress'],
            ['value' => SupportTicket::STATUS_RESOLVED, 'label' => 'Resolved'],
        ];
    }
}
