<?php

namespace App\Http\Controllers;

use App\Models\Region;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\Rule;

class RegionController extends Controller
{
    public function index(): Response
    {
        if (!auth()->user()->hasPermission('view_regions')) {
            abort(403, 'Unauthorized action.');
        }

        $regions = Region::orderBy('name')->get();

        return Inertia::render('regions/index', [
            'regions' => $regions,
            'canCreate' => auth()->user()->hasPermission('create_regions'),
            'canEdit' => auth()->user()->hasPermission('edit_regions'),
            'canDelete' => auth()->user()->hasPermission('delete_regions'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        if (!auth()->user()->hasPermission('create_regions')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'code' => 'required|string|max:50|unique:regions,code',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:500',
            'status' => 'required|in:active,inactive',
        ]);

        Region::create($validated);

        return redirect()->back()->with('success', 'Region created successfully.');
    }

    public function update(Request $request, Region $region): RedirectResponse
    {
        if (!auth()->user()->hasPermission('edit_regions')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'code' => ['required', 'string', 'max:50', Rule::unique('regions', 'code')->ignore($region->id)],
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:500',
            'status' => 'required|in:active,inactive',
        ]);

        $region->update($validated);

        return redirect()->back()->with('success', 'Region updated successfully.');
    }

    public function destroy(Region $region): RedirectResponse
    {
        if (!auth()->user()->hasPermission('delete_regions')) {
            abort(403, 'Unauthorized action.');
        }

        // Check if region has users
        if ($region->users()->count() > 0) {
            return redirect()->back()->with('error', 'Cannot delete region with assigned users.');
        }

        $region->delete();

        return redirect()->back()->with('success', 'Region deleted successfully.');
    }
}
