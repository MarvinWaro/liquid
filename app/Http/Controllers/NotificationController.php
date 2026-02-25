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

        $query = Notification::where('user_id', $user->id)
            ->with('actor')
            ->orderBy('created_at', 'desc');

        if ($filter === 'unread') {
            $query->unread();
        }

        $notifications = $query->paginate(20)->through(fn (Notification $n) => [
            'id' => $n->id,
            'actor_name' => $n->actor_name,
            'actor_avatar_url' => $n->actor?->avatar_url,
            'action' => $n->action,
            'description' => $n->description,
            'subject_type' => $n->subject_type,
            'subject_id' => $n->subject_id,
            'subject_label' => $n->subject_label,
            'module' => $n->module,
            'read_at' => $n->read_at?->toISOString(),
            'created_at' => $n->created_at->toISOString(),
            'time_ago' => $n->created_at->diffForHumans(),
        ]);

        return Inertia::render('notifications/index', [
            'notifications' => $notifications,
            'filter' => $filter,
            'unread_count' => Notification::where('user_id', $user->id)->unread()->count(),
        ]);
    }

    /**
     * Get recent notifications for the dropdown (JSON).
     */
    public function recent(Request $request): JsonResponse
    {
        $user = $request->user();

        $notifications = Notification::where('user_id', $user->id)
            ->with('actor')
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get()
            ->map(fn (Notification $n) => [
                'id' => $n->id,
                'actor_name' => $n->actor_name,
                'actor_avatar_url' => $n->actor?->avatar_url,
                'action' => $n->action,
                'description' => $n->description,
                'subject_type' => $n->subject_type,
                'subject_id' => $n->subject_id,
                'subject_label' => $n->subject_label,
                'module' => $n->module,
                'read_at' => $n->read_at?->toISOString(),
                'created_at' => $n->created_at->toISOString(),
                'time_ago' => $n->created_at->diffForHumans(),
            ]);

        return response()->json([
            'notifications' => $notifications,
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
