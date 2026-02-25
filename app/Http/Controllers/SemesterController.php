<?php

namespace App\Http\Controllers;

use App\Models\Semester;
use App\Services\CacheService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SemesterController extends Controller
{
    public function __construct(private CacheService $cache) {}

    public function index(): Response
    {
        if (!auth()->user()->hasPermission('view_semesters')) {
            abort(403, 'Unauthorized action.');
        }

        $semesters = Semester::withCount('liquidations')
            ->ordered()
            ->get();

        return Inertia::render('semesters/index', [
            'semesters' => $semesters,
            'canCreate' => auth()->user()->hasPermission('create_semesters'),
            'canEdit'   => auth()->user()->hasPermission('edit_semesters'),
            'canDelete' => auth()->user()->hasPermission('delete_semesters'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        if (!auth()->user()->hasPermission('create_semesters')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'code'       => 'required|string|max:10|unique:semesters,code',
            'name'       => 'required|string|max:255|unique:semesters,name',
            'sort_order' => 'required|integer|min:0',
            'is_active'  => 'required|boolean',
        ]);

        $validated['code'] = strtoupper($validated['code']);

        Semester::create($validated);
        $this->cache->clearLookupCaches();

        return redirect()->back()->with('success', 'Semester created successfully.');
    }

    public function update(Request $request, Semester $semester): RedirectResponse
    {
        if (!auth()->user()->hasPermission('edit_semesters')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'code'       => ['required', 'string', 'max:10', Rule::unique('semesters')->ignore($semester->id)],
            'name'       => ['required', 'string', 'max:255', Rule::unique('semesters')->ignore($semester->id)],
            'sort_order' => 'required|integer|min:0',
            'is_active'  => 'required|boolean',
        ]);

        $validated['code'] = strtoupper($validated['code']);

        $semester->update($validated);
        $this->cache->clearLookupCaches();

        return redirect()->back()->with('success', 'Semester updated successfully.');
    }

    public function destroy(Semester $semester): RedirectResponse
    {
        if (!auth()->user()->hasPermission('delete_semesters')) {
            abort(403, 'Unauthorized action.');
        }

        if ($semester->liquidations()->exists()) {
            return redirect()->back()->with('error', 'Cannot delete semester: it has associated liquidation records.');
        }

        $semester->delete();
        $this->cache->clearLookupCaches();

        return redirect()->back()->with('success', 'Semester deleted successfully.');
    }
}
