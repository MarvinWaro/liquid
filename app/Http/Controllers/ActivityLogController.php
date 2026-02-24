<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class ActivityLogController extends Controller
{
    public function index(Request $request): InertiaResponse
    {
        if (! $request->user()->hasPermission('view_activity_logs')) {
            abort(403, 'Unauthorized action.');
        }

        $filters = $request->only(['search', 'user', 'action', 'module', 'date_from', 'date_to']);

        $query = ActivityLog::query()
            ->orderBy('created_at', 'desc');

        if (! empty($filters['search'])) {
            $query->search($filters['search']);
        }
        if (! empty($filters['user']) && $filters['user'] !== 'all') {
            $query->byUser($filters['user']);
        }
        if (! empty($filters['action']) && $filters['action'] !== 'all') {
            $query->byAction($filters['action']);
        }
        if (! empty($filters['module']) && $filters['module'] !== 'all') {
            $query->byModule($filters['module']);
        }
        if (! empty($filters['date_from']) || ! empty($filters['date_to'])) {
            $query->byDateRange($filters['date_from'] ?? null, $filters['date_to'] ?? null);
        }

        $logs = $query->with('user:id,name,avatar')->paginate(25)->through(fn ($log) => [
            'id' => $log->id,
            'user_name' => $log->user_name,
            'user_avatar_url' => $log->user?->avatar_url,
            'action' => $log->action,
            'description' => $log->description,
            'subject_type' => $log->subject_type ? class_basename($log->subject_type) : null,
            'subject_id' => $log->subject_id,
            'subject_label' => $log->subject_label,
            'module' => $log->module,
            'old_values' => $log->old_values,
            'new_values' => $log->new_values,
            'created_at' => $log->created_at->format('M d, Y H:i:s'),
        ]);

        // Get filter options from existing data
        $users = User::select('id', 'name')->orderBy('name')->get();
        $actions = ActivityLog::select('action')->distinct()->orderBy('action')->pluck('action');
        $modules = ActivityLog::select('module')->whereNotNull('module')->distinct()->orderBy('module')->pluck('module');

        return Inertia::render('activity-logs/index', [
            'logs' => $logs,
            'users' => $users,
            'actions' => $actions,
            'modules' => $modules,
            'filters' => $filters,
        ]);
    }
}
