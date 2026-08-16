<?php

declare(strict_types=1);

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Services\ServerMetrics;
use App\Services\ServerMetricsHistory;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * Live CPU / memory / disk snapshot for Super Admins, read-only.
 *
 * Same motivation as Queue Health and Server Logs: "how loaded is the box right
 * now" previously needed an SSH session. The readings themselves come from
 * ServerMetrics, and the trend line from ServerMetricsHistory, so this class
 * only decides who may look and what gets sent.
 *
 * Linux-only, because /proc does not exist elsewhere. On the Windows dev machine
 * the readings come back null and the page says "unavailable" rather than
 * showing invented numbers — the same honesty Queue Health uses when Horizon
 * cannot run locally.
 */
class ServerMonitoringController extends Controller
{
    public function index(
        Request $request,
        ServerMetrics $metrics,
        ServerMetricsHistory $history,
    ): InertiaResponse {
        abort_unless($request->user()?->isSuperAdmin(), 403, 'Unauthorized action.');

        return Inertia::render('settings/server-monitoring', [
            'available' => $metrics->isAvailable(),

            // Deferred so the page paints immediately. They share the default
            // group, so all five resolve in one follow-up request rather than
            // five — the same reasoning as Queue Health's stats/recentFailures.
            //
            // cpu() in particular blocks for 200ms by design (two /proc/stat
            // reads), which is exactly the kind of wait that should never sit in
            // front of the first paint.
            'system' => Inertia::defer(fn () => $metrics->system()),
            'cpu' => Inertia::defer(fn () => $metrics->cpu()),
            'memory' => Inertia::defer(fn () => $metrics->memory()),
            'disk' => Inertia::defer(fn () => $metrics->disk()),
            'history' => Inertia::defer(fn () => $history->all()),
        ]);
    }
}
