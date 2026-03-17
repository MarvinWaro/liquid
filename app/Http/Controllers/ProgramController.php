<?php

namespace App\Http\Controllers;

use App\Models\Program;
use App\Services\CacheService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ProgramController extends Controller
{
    public function __construct(private CacheService $cache) {}

    public function index(): Response
    {
        if (!auth()->user()->hasPermission('view_programs')) {
            abort(403, 'Unauthorized action.');
        }

        // Load all programs with children counts and document requirement counts
        $programs = Program::withCount(['documentRequirements', 'children', 'liquidations'])
            ->with('parent:id,code,name')
            ->orderByRaw('COALESCE(parent_id, id), parent_id IS NOT NULL, name')
            ->get();

        // Possible parent programs for the modal dropdown
        // A parent is any top-level program (no parent_id) that has no liquidations directly attached
        $parentOptions = Program::active()
            ->topLevel()
            ->orderBy('name')
            ->get(['id', 'code', 'name']);

        return Inertia::render('programs/index', [
            'programs'      => $programs,
            'parentOptions' => $parentOptions,
            'canCreate'     => auth()->user()->hasPermission('create_programs'),
            'canEdit'       => auth()->user()->hasPermission('edit_programs'),
            'canDelete'     => auth()->user()->hasPermission('delete_programs'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        if (!auth()->user()->hasPermission('create_programs')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'parent_id'   => 'nullable|uuid|exists:programs,id',
            'code'        => 'required|string|max:50|unique:programs,code',
            'name'        => 'required|string|max:255|unique:programs,name',
            'description' => 'nullable|string|max:1000',
            'status'      => 'required|in:active,inactive',
        ]);

        $validated['code'] = strtoupper($validated['code']);

        Program::create($validated);
        $this->cache->clearLookupCaches();

        return redirect()->back()->with('success', 'Program created successfully.');
    }

    public function update(Request $request, Program $program): RedirectResponse
    {
        if (!auth()->user()->hasPermission('edit_programs')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'parent_id'   => ['nullable', 'uuid', 'exists:programs,id', Rule::notIn([$program->id])],
            'code'        => ['required', 'string', 'max:50', Rule::unique('programs')->ignore($program->id)],
            'name'        => ['required', 'string', 'max:255', Rule::unique('programs')->ignore($program->id)],
            'description' => 'nullable|string|max:1000',
            'status'      => 'required|in:active,inactive',
        ]);

        $validated['code'] = strtoupper($validated['code']);

        $program->update($validated);
        $this->cache->clearLookupCaches();

        return redirect()->back()->with('success', 'Program updated successfully.');
    }

    public function destroy(Program $program): RedirectResponse
    {
        if (!auth()->user()->hasPermission('delete_programs')) {
            abort(403, 'Unauthorized action.');
        }

        if ($program->liquidations()->exists()) {
            return redirect()->back()->with('error', 'Cannot delete program: it has associated liquidation records.');
        }

        if ($program->children()->exists()) {
            return redirect()->back()->with('error', 'Cannot delete program: it has sub-programs. Remove them first.');
        }

        $program->delete();
        $this->cache->clearLookupCaches();

        return redirect()->back()->with('success', 'Program deleted successfully.');
    }
}
