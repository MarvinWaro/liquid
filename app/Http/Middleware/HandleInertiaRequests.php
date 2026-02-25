<?php

namespace App\Http\Middleware;

use App\Models\Notification;
use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        $user = $request->user();

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            'auth' => [
                'user' => $user ? $user->load('role.permissions') : null,
            ],

            // Navigation abilities - controls what menu items user can see
            'can' => $user ? $user->getNavigationAbilities() : [
                'canViewDashboard' => false,
                'canViewLiquidation' => false,
                'canViewRoles' => false,
                'canViewUsers' => false,
                'canViewHEI' => false,
                'canViewRegions' => false,
                'canViewPrograms' => false,
                'canViewSemesters' => false,
                'canViewAcademicYears' => false,
                'canViewDocumentRequirements' => false,
                'canViewActivityLogs' => false,
            ],

            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],

            'notifications_unread_count' => fn () => $user
                ? Notification::where('user_id', $user->id)->unread()->count()
                : 0,
            // ------------------
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
