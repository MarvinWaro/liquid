<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Jobs\GenerateLiquidationReportJob;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Async report pipeline:
 *   POST /reports/queue                    enqueue a Print/Excel/CSV job
 *   GET  /reports/download/{notification}  download the generated file
 *
 * Backed by the existing notification system — when the job finishes it inserts
 * a `report_ready` notification with the file path in its metadata.
 */
class ReportJobController extends Controller
{
    /** Roles allowed to filter by region (mirrors LiquidationController guard). */
    private const REGION_FILTER_ROLES = ['Super Admin', 'Admin'];

    /** Filter keys accepted by the queue endpoint — matches LiquidationController::LISTING_FILTER_KEYS. */
    private const LISTING_FILTER_KEYS = [
        'search',
        'program',
        'document_status',
        'liquidation_status',
        'academic_year',
        'rc_note_status',
        'region',
        'hei',
    ];

    public function queue(Request $request): RedirectResponse
    {
        $user = $request->user();

        if (!$user->hasPermission('view_liquidation')) {
            abort(403, 'Unauthorized action.');
        }

        $request->validate([
            'format' => ['required', 'in:print,excel,csv'],
            'search' => ['nullable', 'string', 'max:255'],
            'program' => ['nullable', 'array'],
            'program.*' => ['string', 'max:64'],
            'document_status' => ['nullable', 'array'],
            'document_status.*' => ['string', 'max:64'],
            'liquidation_status' => ['nullable', 'array'],
            'liquidation_status.*' => ['string', 'max:64'],
            'academic_year' => ['nullable', 'array'],
            'academic_year.*' => ['string', 'max:64'],
            'rc_note_status' => ['nullable', 'array'],
            'rc_note_status.*' => ['string', 'max:64'],
            'region' => ['nullable', 'array'],
            'region.*' => ['string', 'max:64'],
            'hei' => ['nullable', 'array'],
            'hei.*' => ['string', 'max:64'],
        ]);

        $filters = $request->only(self::LISTING_FILTER_KEYS);

        // Strip region for non-Admin/Super Admin to prevent privilege escalation.
        if (!in_array($user->role->name, self::REGION_FILTER_ROLES)) {
            unset($filters['region']);
        }

        GenerateLiquidationReportJob::dispatch(
            (string) $user->id,
            $request->input('format'),
            $filters,
        );

        return back()->with('success', "Your report is being generated. We'll notify you when it's ready.");
    }

    /**
     * Stream a generated report to the requesting user. Auth-scoped to the
     * notification owner; 410 when the file has been cleaned up.
     */
    public function download(Notification $notification): StreamedResponse
    {
        $user = auth()->user();

        abort_if($notification->user_id !== $user->id, 403);
        abort_if($notification->action !== 'report_ready', 404);

        $meta = $notification->metadata ?? [];
        $path = $meta['file_path'] ?? null;
        $filename = $meta['file_name'] ?? 'report.bin';
        $kind = $meta['kind'] ?? 'excel';

        $disk = Storage::disk(config('filesystems.default'));

        abort_if(!$path || !$disk->exists($path), 410, 'This report has expired or is no longer available.');

        // Print HTML opens inline so the embedded auto-print script can fire.
        if ($kind === 'print') {
            return $disk->response($path, $filename, [
                'Content-Type' => 'text/html; charset=UTF-8',
                'Content-Disposition' => 'inline; filename="' . $filename . '"',
                'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
            ]);
        }

        return $disk->download($path, $filename);
    }

    /**
     * Atomically claim the right to auto-deliver a `report_ready` notification.
     *
     * The frontend hook polls /notifications/recent; when it spots a fresh
     * `report_ready` it calls this endpoint before opening the file. A row-level
     * lock + transaction ensures only one browser tab succeeds when the same
     * user has multiple tabs polling — the loser receives 409 and stops.
     */
    public function claimDelivery(Notification $notification): JsonResponse
    {
        abort_if($notification->user_id !== auth()->id(), 403);
        abort_if($notification->action !== 'report_ready', 404);

        return DB::transaction(function () use ($notification) {
            $fresh = Notification::lockForUpdate()->find($notification->id);
            $meta = $fresh->metadata ?? [];

            if (!empty($meta['auto_delivered'])) {
                return response()->json(['claimed' => false], 409);
            }

            $fresh->update([
                'metadata' => array_merge($meta, ['auto_delivered' => true]),
            ]);

            return response()->json(['claimed' => true], 200);
        });
    }
}
