<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\AcademicYear;
use App\Services\CacheService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AcademicYearController extends Controller
{
    public function __construct(private CacheService $cache) {}

    public function index(): Response
    {
        if (!auth()->user()->hasPermission('view_academic_years')) {
            abort(403, 'Unauthorized action.');
        }

        $academicYears = AcademicYear::withCount('liquidations')
            ->ordered()
            ->get();

        return Inertia::render('academic-years/index', [
            'academicYears' => $academicYears,
            'canCreate' => auth()->user()->hasPermission('create_academic_years'),
            'canEdit'   => auth()->user()->hasPermission('edit_academic_years'),
            'canDelete' => auth()->user()->hasPermission('delete_academic_years'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        if (!auth()->user()->hasPermission('create_academic_years')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'start_year'  => 'required|integer|min:2000|max:2100',
            'start_date'  => 'nullable|date',
            'end_date'    => 'nullable|date|after_or_equal:start_date',
            'sort_order'  => 'required|integer|min:0',
            'is_active'   => 'required|boolean',
        ]);

        $code = $validated['start_year'] . '-' . ($validated['start_year'] + 1);

        // Check uniqueness
        if (AcademicYear::where('code', $code)->exists()) {
            return redirect()->back()->withErrors(['start_year' => "Academic year {$code} already exists."]);
        }

        AcademicYear::create([
            'code'       => $code,
            'name'       => $code,
            'start_date' => $validated['start_date'] ?? null,
            'end_date'   => $validated['end_date'] ?? null,
            'sort_order' => $validated['sort_order'],
            'is_active'  => $validated['is_active'],
        ]);

        $this->cache->clearLookupCaches();

        return redirect()->back()->with('success', 'Academic year created successfully.');
    }

    public function update(Request $request, AcademicYear $academicYear): RedirectResponse
    {
        if (!auth()->user()->hasPermission('edit_academic_years')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'start_year'  => 'required|integer|min:2000|max:2100',
            'start_date'  => 'nullable|date',
            'end_date'    => 'nullable|date|after_or_equal:start_date',
            'sort_order'  => 'required|integer|min:0',
            'is_active'   => 'required|boolean',
        ]);

        $code = $validated['start_year'] . '-' . ($validated['start_year'] + 1);

        // Check uniqueness excluding self
        if (AcademicYear::where('code', $code)->where('id', '!=', $academicYear->id)->exists()) {
            return redirect()->back()->withErrors(['start_year' => "Academic year {$code} already exists."]);
        }

        $academicYear->update([
            'code'       => $code,
            'name'       => $code,
            'start_date' => $validated['start_date'] ?? null,
            'end_date'   => $validated['end_date'] ?? null,
            'sort_order' => $validated['sort_order'],
            'is_active'  => $validated['is_active'],
        ]);

        $this->cache->clearLookupCaches();

        return redirect()->back()->with('success', 'Academic year updated successfully.');
    }

    public function destroy(AcademicYear $academicYear): RedirectResponse
    {
        if (!auth()->user()->hasPermission('delete_academic_years')) {
            abort(403, 'Unauthorized action.');
        }

        if ($academicYear->liquidations()->exists()) {
            return redirect()->back()->with('error', 'Cannot delete academic year: it has associated liquidation records.');
        }

        $academicYear->delete();
        $this->cache->clearLookupCaches();

        return redirect()->back()->with('success', 'Academic year deleted successfully.');
    }
}
