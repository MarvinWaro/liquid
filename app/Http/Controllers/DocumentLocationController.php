<?php

namespace App\Http\Controllers;

use App\Models\DocumentLocation;
use App\Models\LiquidationTransmittal;
use App\Services\CacheService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Shelf locations for filing liquidation documents.
 *
 * Structured like SemesterController — same per-method permission gate, inline
 * validation, no pagination — with two departures the data forces:
 *
 *  - Deleting is refused while records point at a location, because the schema
 *    would silently blank transmittals and destroy tracking rows. Archiving
 *    retires a shelf instead.
 *  - Renaming rewrites the location names stored in transmittal history JSON,
 *    which would otherwise be left naming a shelf that no longer exists.
 */
class DocumentLocationController extends Controller
{
    public function __construct(private CacheService $cache) {}

    public function index(): Response
    {
        if (! auth()->user()->hasPermission('view_document_locations')) {
            abort(403, 'Unauthorized action.');
        }

        // Counted rather than loaded: the page only needs to know whether a
        // location is in use, to decide if deleting is offered.
        $locations = DocumentLocation::withCount(['transmittals', 'trackingEntries'])
            ->ordered()
            ->get();

        return Inertia::render('document-locations/index', [
            'locations' => $locations,
            'canCreate' => auth()->user()->hasPermission('create_document_locations'),
            'canEdit' => auth()->user()->hasPermission('edit_document_locations'),
            'canDelete' => auth()->user()->hasPermission('delete_document_locations'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        if (! auth()->user()->hasPermission('create_document_locations')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:document_locations,name',
            'sort_order' => 'required|integer|min:0',
            'is_active' => 'required|boolean',
        ]);

        DocumentLocation::create($validated);
        $this->cache->clearLookupCaches();

        return redirect()->back()->with('success', 'Location created successfully.');
    }

    public function update(Request $request, DocumentLocation $documentLocation): RedirectResponse
    {
        if (! auth()->user()->hasPermission('edit_document_locations')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('document_locations')->ignore($documentLocation->id),
            ],
            'sort_order' => 'required|integer|min:0',
            'is_active' => 'required|boolean',
        ]);

        $previousName = $documentLocation->name;
        $renamed = $previousName !== $validated['name'];

        // One transaction: the row and the history that quotes it must never
        // disagree, and a failure part-way through would leave exactly that.
        DB::transaction(function () use ($documentLocation, $validated, $renamed, $previousName) {
            $documentLocation->update($validated);

            if ($renamed) {
                $this->renameInTransmittalHistory($previousName, $validated['name']);
            }
        });

        $this->cache->clearLookupCaches();

        return redirect()->back()->with('success', 'Location updated successfully.');
    }

    public function destroy(DocumentLocation $documentLocation): RedirectResponse
    {
        if (! auth()->user()->hasPermission('delete_document_locations')) {
            abort(403, 'Unauthorized action.');
        }

        // The database would not stop this: the transmittal foreign key is
        // ON DELETE SET NULL and the tracking pivot is ON DELETE CASCADE, so a
        // delete here silently loses filing records. Archiving is the answer.
        if ($documentLocation->isInUse()) {
            return redirect()->back()->with(
                'error',
                'Cannot delete this location: liquidation records are filed here. Archive it instead to retire it from the picker.'
            );
        }

        $documentLocation->delete();
        $this->cache->clearLookupCaches();

        return redirect()->back()->with('success', 'Location deleted successfully.');
    }

    /**
     * Carry a rename into the transmittal history JSON.
     *
     * LiquidationTransmittal::addLocationHistory() stores the location *name*
     * into `location_history`, in both `location` and `previous_location`, and
     * getLatestLocationFromHistory() reads it straight back out for display.
     * The foreign key is resolved at write time so it stays correct on its own,
     * but without this the history would keep quoting a shelf that no longer
     * exists.
     */
    private function renameInTransmittalHistory(string $previousName, string $newName): void
    {
        LiquidationTransmittal::query()
            ->whereNotNull('location_history')
            ->chunkById(200, function ($transmittals) use ($previousName, $newName) {
                foreach ($transmittals as $transmittal) {
                    $history = $transmittal->location_history;

                    if (! is_array($history)) {
                        continue;
                    }

                    $touched = false;

                    foreach ($history as &$entry) {
                        foreach (['location', 'previous_location'] as $key) {
                            if (($entry[$key] ?? null) === $previousName) {
                                $entry[$key] = $newName;
                                $touched = true;
                            }
                        }
                    }
                    unset($entry);

                    // Quietly: renaming a shelf is not someone editing that
                    // liquidation, and a rename can touch thousands of rows —
                    // logging each would bury the activity log.
                    if ($touched) {
                        $transmittal->updateQuietly(['location_history' => $history]);
                    }
                }
            });
    }
}
