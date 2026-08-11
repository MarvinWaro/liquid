<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NotificationController extends Controller
{
    /**
     * Full page view of all notifications.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $filter = $request->get('filter', 'all');
        $filters = $request->only(['search', 'action', 'module']);

        $query = Notification::where('user_id', $user->id)
            ->with('actor')
            ->orderBy('created_at', 'desc');

        if ($filter === 'unread') {
            $query->unread();
        }

        // These narrow the list further rather than replacing the All/Unread tab,
        // so the two combine — filtering by type while on Unread shows unread
        // notifications of that type.
        if (! empty($filters['search'])) {
            $query->where('description', 'like', '%'.$filters['search'].'%');
        }
        if (! empty($filters['action']) && $filters['action'] !== 'all') {
            $query->where('action', $filters['action']);
        }
        if (! empty($filters['module']) && $filters['module'] !== 'all') {
            $query->where('module', $filters['module']);
        }

        $notifications = $query->paginate(20)->withQueryString()->through(fn (Notification $n) => [
            'id' => $n->id,
            'actor_name' => $n->actor_name,
            'actor_avatar_url' => $n->actor?->avatar_url,
            'action' => $n->action,
            'description' => $n->description,
            'subject_type' => $n->subject_type,
            'subject_id' => $n->subject_id,
            'subject_label' => $n->subject_label,
            'module' => $n->module,
            'metadata' => $n->metadata,
            'read_at' => $n->read_at?->toISOString(),
            'created_at' => $n->created_at->toISOString(),
            'time_ago' => $n->created_at->diffForHumans(),
        ]);

        // Dropdown options come from this user's own notifications, so nobody is
        // offered a type they could never have received.
        $ownNotifications = fn () => Notification::where('user_id', $user->id);

        return Inertia::render('notifications/index', [
            'notifications' => $notifications,
            'filter' => $filter,
            'filters' => $filters,
            'actions' => $ownNotifications()->select('action')->distinct()->orderBy('action')->pluck('action'),
            'modules' => $ownNotifications()->whereNotNull('module')->select('module')->distinct()->orderBy('module')->pluck('module'),
            'unread_count' => Notification::where('user_id', $user->id)->unread()->count(),
        ]);
    }

    /**
     * Get recent notifications for the dropdown (JSON).
     */
    public function recent(Request $request): JsonResponse
    {
        $user = $request->user();
        $perPage = 10;

        $query = Notification::where('user_id', $user->id)
            ->with('actor')
            ->orderBy('created_at', 'desc');

        // Cursor-based pagination: fetch items older than the given cursor
        if ($cursor = $request->get('cursor')) {
            $cursorNotification = Notification::find($cursor);
            if ($cursorNotification) {
                $query->where('created_at', '<=', $cursorNotification->created_at)
                    ->where('id', '!=', $cursorNotification->id);
            }
        }

        $notifications = $query->limit($perPage + 1)->get();
        $hasMore = $notifications->count() > $perPage;
        $notifications = $notifications->take($perPage);

        $mapped = $notifications->map(fn (Notification $n) => [
            'id' => $n->id,
            'actor_name' => $n->actor_name,
            'actor_avatar_url' => $n->actor?->avatar_url,
            'action' => $n->action,
            'description' => $n->description,
            'subject_type' => $n->subject_type,
            'subject_id' => $n->subject_id,
            'subject_label' => $n->subject_label,
            'module' => $n->module,
            'metadata' => $n->metadata,
            'read_at' => $n->read_at?->toISOString(),
            'created_at' => $n->created_at->toISOString(),
            'time_ago' => $n->created_at->diffForHumans(),
        ]);

        return response()->json([
            'notifications' => $mapped,
            'has_more' => $hasMore,
            'next_cursor' => $hasMore ? $notifications->last()?->id : null,
            'unread_count' => Notification::where('user_id', $user->id)->unread()->count(),
        ]);
    }

    /**
     * Mark a single notification as read.
     */
    public function markAsRead(Request $request, Notification $notification): JsonResponse
    {
        if ($notification->user_id !== $request->user()->id) {
            abort(403);
        }

        $notification->markAsRead();

        return response()->json(['success' => true]);
    }

    /**
     * Mark a single notification as unread.
     */
    public function markAsUnread(Request $request, Notification $notification): JsonResponse
    {
        if ($notification->user_id !== $request->user()->id) {
            abort(403);
        }

        $notification->markAsUnread();

        return response()->json(['success' => true]);
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        Notification::where('user_id', $request->user()->id)
            ->unread()
            ->update(['read_at' => now()]);

        return response()->json(['success' => true]);
    }

    /**
     * Delete a single notification.
     */
    public function destroy(Request $request, Notification $notification): JsonResponse
    {
        if ($notification->user_id !== $request->user()->id) {
            abort(403);
        }

        $notification->delete();

        return response()->json(['success' => true]);
    }
}
