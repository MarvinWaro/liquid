<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Liquidation\StoreBulkEntryDraftRequest;
use App\Models\BulkEntryDraft;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Server-side persistence for the bulk-entry modal draft.
 *
 * The draft is a 1:1 per-user resource — there is at most one draft per user,
 * keyed by user_id. We never expose draft IDs externally; routes operate on
 * "the current user's draft" implicitly. This avoids any possibility of one
 * user accessing another user's draft and keeps the URL surface minimal.
 */
class BulkEntryDraftController extends Controller
{
    /** Return the current user's draft, or null when none exists. */
    public function show(Request $request): JsonResponse
    {
        $draft = BulkEntryDraft::where('user_id', $request->user()->id)->first();

        if (!$draft) {
            return response()->json(['draft' => null]);
        }

        return response()->json([
            'draft' => [
                'rows'        => $draft->rows,
                'saved_at'    => $draft->updated_at->toIso8601String(),
            ],
        ]);
    }

    /** Upsert the current user's draft. */
    public function update(StoreBulkEntryDraftRequest $request): JsonResponse
    {
        $draft = BulkEntryDraft::updateOrCreate(
            ['user_id' => $request->user()->id],
            ['rows'    => $request->validated('rows')],
        );

        return response()->json([
            'draft' => [
                'rows'     => $draft->rows,
                'saved_at' => $draft->updated_at->toIso8601String(),
            ],
        ]);
    }

    /** Delete the current user's draft. No-op if none exists. */
    public function destroy(Request $request): JsonResponse
    {
        BulkEntryDraft::where('user_id', $request->user()->id)->delete();

        return response()->json(['success' => true]);
    }
}
