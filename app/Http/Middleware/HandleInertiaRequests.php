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

            // What this server will actually accept for one uploaded file.
            //
            // The browser used to compare against a hardcoded 10MB while PHP was
            // configured at 2MB, so a 4MB PDF passed the check, got sent, and came
            // back as a bare 422 saying only "The file failed to upload." Reading
            // the real value means the two can never disagree again — including on
            // a server provisioned with different limits.
            //
            // Shared globally rather than per page: uploads appear on liquidations,
            // announcements, comments and settings alike.
            'maxUploadBytes' => $this->maxUploadBytes(),
            'auth' => [
                'user' => $user ? $user->load('role.permissions', 'permissions') : null,
            ],

            // Navigation abilities - controls what menu items user can see
            'can' => $user ? $user->getNavigationAbilities() : [
                'canViewDashboard' => false,
                'canViewLiquidation' => false,
                'canViewReports' => false,
                'canUseReportAssistant' => false,
                'canViewRoles' => false,
                'canViewUsers' => false,
                'canViewHEI' => false,
                'canViewRegions' => false,
                'canViewPrograms' => false,
                'canViewSemesters' => false,
                'canViewAcademicYears' => false,
                'canViewDocumentLocations' => false,
                'canViewDocumentRequirements' => false,
                'canViewTemplates' => false,
                'canViewActivityLogs' => false,
                'canAccessActivityLogs' => false,
                'canViewQueueHealth' => false,
                'canViewServerLogs' => false,
                'canViewServerMonitoring' => false,
                'canViewSummaryAY' => false,
                'canViewSummaryHEI' => false,
                'canCreateTicket' => false,
            ],

            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                // Neutral channel for outcomes that are neither a win nor a
                // failure, e.g. "nothing changed, so nothing was saved".
                'info' => fn () => $request->session()->get('info'),
            ],

            'notifications_unread_count' => fn () => $user
                ? Notification::where('user_id', $user->id)->unread()->count()
                : 0,
            // ------------------
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }

    /**
     * Largest single file this server will accept, in bytes.
     *
     * The smaller of the two PHP limits wins. post_max_size caps the whole
     * request body rather than the file alone, so a file just under it would
     * still be refused once the other form fields and multipart overhead are
     * added — and that failure is the nastier one, since PHP discards the entire
     * body and Laravel sees a request with no file and no fields at all.
     */
    private function maxUploadBytes(): int
    {
        $limits = array_filter([
            $this->iniBytes('upload_max_filesize'),
            $this->iniBytes('post_max_size'),
        ]);

        // Both directives can be 0, meaning "no limit". Fall back to the largest
        // value the app itself asks for (the 50MB bulk import) so the browser has
        // a number to compare against instead of unlimited.
        return $limits === [] ? 52 * 1024 * 1024 : (int) min($limits);
    }

    /**
     * Turn a php.ini shorthand size ("52M", "1G", "8192K") into bytes.
     *
     * ini_get() returns these verbatim, so they cannot be compared numerically
     * as they stand — "8M" would otherwise read as smaller than "512K".
     */
    private function iniBytes(string $directive): int
    {
        $value = trim((string) ini_get($directive));

        if ($value === '') {
            return 0;
        }

        $number = (int) $value;
        $unit = strtolower(substr($value, -1));

        return match ($unit) {
            'g' => $number * 1024 * 1024 * 1024,
            'm' => $number * 1024 * 1024,
            'k' => $number * 1024,
            default => $number,
        };
    }
}
