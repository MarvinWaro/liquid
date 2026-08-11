<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class ActivityLogController extends Controller
{
    public function index(Request $request): InertiaResponse
    {
        $user = $request->user();

        // Two access levels:
        //  - view_activity_logs      → see ALL users' activity
        //  - view_own_activity_logs  → see ONLY your own activity (self-scoped)
        $canViewAll = $user->hasPermission('view_activity_logs');
        $scopedToOwn = ! $canViewAll && $user->hasPermission('view_own_activity_logs');

        if (! $canViewAll && ! $scopedToOwn) {
            abort(403, 'Unauthorized action.');
        }

        // IP addresses are sensitive — only Super Admins may see them. We gate this
        // server-side so the value never reaches a non-Super-Admin's browser.
        $canViewIp = $user->isSuperAdmin();

        $filters = $request->only(['search', 'user', 'action', 'module', 'date_from', 'date_to']);

        $query = $this->filteredQuery($filters, $user, $scopedToOwn)
            ->orderBy('created_at', 'desc');

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
            'ip_address' => $canViewIp ? $log->ip_address : null,
            'device' => $log->device,
            'old_values' => $log->old_values,
            'new_values' => $log->new_values,
            'created_at' => $log->created_at->timezone('Asia/Manila')->format('M d, Y H:i:s'),
        ]);

        // Get filter options. Self-scoped viewers don't get the user roster (nothing
        // to pick) and their action/module options reflect only their own activity.
        $users = $scopedToOwn ? [] : User::select('id', 'name')->orderBy('name')->get();

        $actionsQuery = ActivityLog::query();
        $modulesQuery = ActivityLog::query()->whereNotNull('module');
        if ($scopedToOwn) {
            $actionsQuery->where('user_id', $user->id);
            $modulesQuery->where('user_id', $user->id);
        }
        $actions = $actionsQuery->select('action')->distinct()->orderBy('action')->pluck('action');
        $modules = $modulesQuery->select('module')->distinct()->orderBy('module')->pluck('module');

        return Inertia::render('activity-logs/index', [
            'logs' => $logs,
            'users' => $users,
            'actions' => $actions,
            'modules' => $modules,
            'filters' => $filters,
            'scopedToOwn' => $scopedToOwn,

            // Deferred so the table paints immediately. activity_logs grows without
            // bound, so these aggregates must never sit in front of first paint.
            'insights' => Inertia::defer(fn () => [
                'trend' => $this->activityTrend($filters, $user, $scopedToOwn),
                'actions' => $this->actionsBreakdown($filters, $user, $scopedToOwn),
                // A one-bar chart of yourself is noise, so self-scoped viewers do
                // not get this computed at all — not merely hidden in the browser.
                'topUsers' => $scopedToOwn ? null : $this->topUsers($filters, $user, $scopedToOwn),
                'trendRangeLabel' => $this->trendRangeLabel($filters),
            ], 'insights'),
        ]);
    }

    /**
     * The one place the log feed is narrowed down.
     *
     * Both the paginated table and every chart start here, so a filter can never
     * apply to one and not the other — a chart reporting 500 events above a table
     * showing 12 would make the whole page untrustworthy.
     */
    private function filteredQuery(array $filters, User $user, bool $scopedToOwn): Builder
    {
        $query = ActivityLog::query();

        if (! empty($filters['search'])) {
            $query->search($filters['search']);
        }
        // Self-scoped viewers are locked to their own activity; any ?user= override
        // is ignored. Full-access viewers may filter by a chosen user.
        if ($scopedToOwn) {
            $query->byUser($user->id);
        } elseif (! empty($filters['user']) && $filters['user'] !== 'all') {
            $query->byUser($filters['user']);
        }
        if (! empty($filters['action']) && $filters['action'] !== 'all') {
            $query->byAction($filters['action']);
        }
        // Hide logout entries from the default feed to keep it compact, but still
        // surface them when the user explicitly filters by the Logout action.
        if (($filters['action'] ?? null) !== 'logout') {
            $query->where('action', '!=', 'logout');
        }
        if (! empty($filters['module']) && $filters['module'] !== 'all') {
            $query->byModule($filters['module']);
        }
        if (! empty($filters['date_from']) || ! empty($filters['date_to'])) {
            $query->byDateRange($filters['date_from'] ?? null, $filters['date_to'] ?? null);
        }

        return $query;
    }

    /**
     * Daily counts for the trend chart.
     *
     * When no date filter is set this looks back 30 days rather than over all of
     * history: an unbounded series would be unreadable and would grow slower every
     * month. The window is spelled out on the chart via trendRangeLabel().
     */
    private function activityTrend(array $filters, User $user, bool $scopedToOwn): array
    {
        $query = $this->filteredQuery($filters, $user, $scopedToOwn);

        if (empty($filters['date_from']) && empty($filters['date_to'])) {
            // ->utc() matters: Laravel formats a bound date in the instance's own
            // timezone, so a Manila-midnight Carbon would be written as its wall
            // clock and compared against a UTC column — opening the window 8 hours
            // late and dropping that morning's activity. The intent is unchanged:
            // 29 days back from midnight in Manila.
            $query->where('created_at', '>=', now('Asia/Manila')->subDays(29)->startOfDay()->utc());
        }

        $day = $this->manilaDayExpression();

        return $query->selectRaw("{$day} as date, COUNT(*) as count")
            ->groupByRaw($day)
            ->orderByRaw($day)
            ->get()
            ->map(fn ($row) => [
                'date' => (string) $row->date,
                'count' => (int) $row->count,
            ])
            ->all();
    }

    /**
     * Counts per action, biggest first.
     */
    private function actionsBreakdown(array $filters, User $user, bool $scopedToOwn): array
    {
        return $this->filteredQuery($filters, $user, $scopedToOwn)
            ->selectRaw('action, COUNT(*) as count')
            ->groupBy('action')
            ->orderByDesc('count')
            ->get()
            ->map(fn ($row) => [
                'action' => (string) $row->action,
                'count' => (int) $row->count,
            ])
            ->all();
    }

    /**
     * The eight busiest people in the current filter.
     */
    private function topUsers(array $filters, User $user, bool $scopedToOwn): array
    {
        return $this->filteredQuery($filters, $user, $scopedToOwn)
            ->selectRaw('user_name, COUNT(*) as count')
            ->whereNotNull('user_name')
            ->groupBy('user_name')
            ->orderByDesc('count')
            ->limit(8)
            ->get()
            ->map(fn ($row) => [
                'name' => (string) $row->user_name,
                'count' => (int) $row->count,
            ])
            ->all();
    }

    private function trendRangeLabel(array $filters): string
    {
        if (empty($filters['date_from']) && empty($filters['date_to'])) {
            return 'Last 30 days';
        }

        return 'Selected range';
    }

    /**
     * SQL that buckets created_at into a Philippine calendar day.
     *
     * Defined on ActivityLog so the date filter (scopeByDateRange) and these charts
     * cannot drift apart — a second copy here is what let the filter keep comparing
     * raw UTC after the charts were corrected.
     */
    private function manilaDayExpression(): string
    {
        return ActivityLog::manilaDayExpression();
    }
}
