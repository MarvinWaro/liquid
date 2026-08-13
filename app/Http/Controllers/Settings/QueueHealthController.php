<?php

declare(strict_types=1);

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Laravel\Horizon\Horizon;

/**
 * Queue health for Super Admins.
 *
 * Bulk imports and report exports run on the queue, so "did that job actually
 * run?" used to be unanswerable without SSH access. This surfaces the answer in
 * the app itself.
 *
 * Deliberately reads through Laravel's own queue abstraction rather than a
 * specific driver: Queue::size() and the queue.failer binding behave the same on
 * database, redis and sqs. That keeps this page working when the queue driver
 * changes — the same reasoning DashboardCache uses to avoid cache tags.
 *
 * Horizon owns the deep dive and this page links out to it, but nothing here is
 * built on it: Horizon hard-requires ext-pcntl and a Redis queue, neither of
 * which exists on a Windows dev machine. Reading Laravel's own queue API instead
 * means this summary works everywhere, with or without Horizon running.
 */
class QueueHealthController extends Controller
{
    /** Failures newer than this are treated as "needs attention now". */
    private const RECENT_FAILURE_HOURS = 24;

    private const RECENT_FAILURE_LIMIT = 20;

    public function index(Request $request): InertiaResponse
    {
        $this->authorizeSuperAdmin($request);

        return Inertia::render('settings/queue-health', [
            'connection' => config('queue.default'),
            'driver' => config('queue.connections.'.config('queue.default').'.driver'),

            // Horizon is the deep-dive tool; this page is the at-a-glance summary.
            // It only works on a Redis queue, and only where ext-pcntl exists — so
            // the link is hidden rather than shown broken when either is missing.
            'horizon' => [
                'installed' => class_exists(Horizon::class),
                'usable' => class_exists(Horizon::class)
                    && config('queue.default') === 'redis'
                    && extension_loaded('pcntl'),
                'url' => url(config('horizon.path', 'horizon')),
            ],

            // Deferred so the page paints immediately. These hit Redis/MySQL and
            // the counts matter less than the page being responsive.
            'stats' => Inertia::defer(fn () => $this->stats()),
            'recentFailures' => Inertia::defer(fn () => $this->recentFailures()),
        ]);
    }

    /**
     * Retry a single failed job, putting it back on its original queue.
     */
    public function retry(Request $request, string $uuid): RedirectResponse
    {
        $this->authorizeSuperAdmin($request);

        Artisan::call('queue:retry', ['id' => [$uuid]]);

        return back()->with('success', 'Job queued for retry.');
    }

    /**
     * Forget a single failed job. Used once a failure has been understood and
     * is not worth retrying — keeps the list meaningful instead of a graveyard.
     */
    public function forget(Request $request, string $uuid): RedirectResponse
    {
        $this->authorizeSuperAdmin($request);

        Artisan::call('queue:forget', ['id' => $uuid]);

        return back()->with('success', 'Failed job removed.');
    }

    /**
     * @return array<string, mixed>
     */
    private function stats(): array
    {
        $failer = app('queue.failer');
        $allFailed = collect($failer->all());

        $cutoff = now()->subHours(self::RECENT_FAILURE_HOURS);
        $recentFailed = $allFailed->filter(
            fn ($job) => isset($job->failed_at) && $cutoff->lt($job->failed_at)
        );

        return [
            // Driver-agnostic: works on database, redis, sqs alike.
            'pending' => $this->pendingCount(),
            'failedTotal' => $allFailed->count(),
            'failedRecent' => $recentFailed->count(),
            'oldestFailureAt' => optional($allFailed->last())->failed_at,
            'batches' => $this->batchStats(),
        ];
    }

    /**
     * Jobs waiting to be picked up. Returns null rather than 0 when the driver
     * cannot report a size, so the UI can say "unavailable" instead of implying
     * an empty queue.
     */
    private function pendingCount(): ?int
    {
        try {
            return Queue::size();
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Bulk imports run as batches, so an in-flight import shows up here.
     *
     * @return array<string, mixed>|null
     */
    private function batchStats(): ?array
    {
        try {
            $running = DB::table('job_batches')
                ->whereNull('finished_at')
                ->whereNull('cancelled_at')
                ->orderByDesc('created_at')
                ->limit(5)
                ->get(['id', 'name', 'total_jobs', 'pending_jobs', 'failed_jobs', 'created_at']);

            return [
                'running' => $running->map(fn ($b) => [
                    'id' => $b->id,
                    'name' => $b->name,
                    'total' => (int) $b->total_jobs,
                    'pending' => (int) $b->pending_jobs,
                    'failed' => (int) $b->failed_jobs,
                    'created_at' => $b->created_at
                        ? Carbon::createFromTimestamp($b->created_at)
                            ->setTimezone('Asia/Manila')
                            ->toIso8601String()
                        : null,
                ])->all(),
            ];
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * The newest failures, trimmed to what a person can actually act on.
     *
     * @return array<int, array<string, mixed>>
     */
    private function recentFailures(): array
    {
        $failer = app('queue.failer');

        return collect($failer->all())
            ->take(self::RECENT_FAILURE_LIMIT)
            ->map(fn ($job) => [
                'uuid' => $job->uuid ?? (string) $job->id,
                'queue' => $job->queue ?? 'default',
                // The class name is what a reader recognises; the rest of the
                // payload is noise on a summary screen.
                'job' => $this->jobName($job->payload ?? ''),
                'failedAt' => isset($job->failed_at)
                    ? Carbon::parse($job->failed_at)->setTimezone('Asia/Manila')->toIso8601String()
                    : null,
                'exception' => $this->firstLine($job->exception ?? ''),
            ])
            ->values()
            ->all();
    }

    private function jobName(string $payload): string
    {
        $decoded = json_decode($payload, true);

        return $decoded['displayName'] ?? 'Unknown job';
    }

    /**
     * Exceptions arrive as a full stack trace. Only the message is useful at a
     * glance — the trace stays in the log where it belongs.
     */
    private function firstLine(string $exception): string
    {
        $line = strtok($exception, "\n") ?: $exception;

        return mb_strimwidth(trim($line), 0, 240, '…');
    }

    private function authorizeSuperAdmin(Request $request): void
    {
        abort_unless($request->user()?->isSuperAdmin(), 403, 'Unauthorized action.');
    }
}
