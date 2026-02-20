<?php

namespace App\Http\Controllers;

use App\Models\HEI;
use App\Models\Region;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\Rule;

class HEIController extends Controller
{
    public function index(): Response
    {
        if (!auth()->user()->hasPermission('view_hei')) {
            abort(403, 'Unauthorized action.');
        }

        $heis = HEI::with('region')->orderBy('name', 'asc')->get();
        $regions = Region::where('status', 'active')->orderBy('name')->get(['id', 'code', 'name']);

        return Inertia::render('hei/index', [
            'heis' => $heis,
            'regions' => $regions,
            'canCreate' => auth()->user()->hasPermission('create_hei'),
            'canEdit' => auth()->user()->hasPermission('edit_hei'),
            'canDelete' => auth()->user()->hasPermission('delete_hei'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        if (!auth()->user()->hasPermission('create_hei')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'uii' => 'required|string|max:50|unique:heis,uii',
            'name' => 'required|string|max:255|unique:heis,name',
            'type' => 'required|in:Private,SUC,LUC',
            'region_id' => 'nullable|exists:regions,id',
            'status' => 'required|in:active,inactive',
        ]);

        $validated['name'] = strtoupper($validated['name']);

        HEI::create($validated);

        return redirect()->back()->with('success', 'HEI created successfully.');
    }

    public function update(Request $request, HEI $hei): RedirectResponse
    {
        if (!auth()->user()->hasPermission('edit_hei')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'uii' => ['required', 'string', 'max:50', Rule::unique('heis')->ignore($hei->id)],
            'name' => ['required', 'string', 'max:255', Rule::unique('heis')->ignore($hei->id)],
            'type' => 'required|in:Private,SUC,LUC',
            'region_id' => 'nullable|exists:regions,id',
            'status' => 'required|in:active,inactive',
        ]);

        $validated['name'] = strtoupper($validated['name']);

        $hei->update($validated);

        return redirect()->back()->with('success', 'HEI updated successfully.');
    }

    public function destroy(HEI $hei): RedirectResponse
    {
        if (!auth()->user()->hasPermission('delete_hei')) {
            abort(403, 'Unauthorized action.');
        }

        $hei->delete();

        return redirect()->back()->with('success', 'HEI deleted successfully.');
    }
}
