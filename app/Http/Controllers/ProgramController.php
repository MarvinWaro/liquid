<?php

namespace App\Http\Controllers;

use App\Models\AcademicYear;
use App\Models\Program;
use App\Models\ProgramDueDateRule;
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
            ->with(['parent:id,code,name', 'dueDateRules.academicYear:id,code,name'])
            ->orderByRaw('COALESCE(parent_id, id), parent_id IS NOT NULL, name')
            ->get();

        // Possible parent programs for the modal dropdown
        $parentOptions = Program::active()
            ->topLevel()
            ->orderBy('name')
            ->get(['id', 'code', 'name']);

        $academicYears = AcademicYear::active()->ordered()->get(['id', 'code', 'name']);

        return Inertia::render('programs/index', [
            'programs'       => $programs,
            'parentOptions'  => $parentOptions,
            'academicYears'  => $academicYears,
            'canCreate'      => auth()->user()->hasPermission('create_programs'),
            'canEdit'        => auth()->user()->hasPermission('edit_programs'),
            'canDelete'      => auth()->user()->hasPermission('delete_programs'),
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

    // ── Due Date Rules ──────────────────────────────────────────────

    public function storeDueDateRule(Request $request, Program $program): RedirectResponse
    {
        if (!auth()->user()->hasPermission('edit_programs')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'academic_year_ids'   => 'nullable|array',
            'academic_year_ids.*' => 'uuid|exists:academic_years,id',
            'is_default'          => 'nullable|boolean',
            'due_date_days'       => 'required|integer|min:1|max:365',
        ]);

        $days      = $validated['due_date_days'];
        $isDefault = !empty($validated['is_default']);
        $ayIds     = $validated['academic_year_ids'] ?? [];
        $created   = 0;
        $skipped   = 0;

        if ($isDefault) {
            $exists = ProgramDueDateRule::where('program_id', $program->id)
                ->whereNull('academic_year_id')
                ->exists();
            if ($exists) {
                $skipped++;
            } else {
                $program->dueDateRules()->create(['academic_year_id' => null, 'due_date_days' => $days]);
                $created++;
            }
        }

        foreach ($ayIds as $ayId) {
            $exists = ProgramDueDateRule::where('program_id', $program->id)
                ->where('academic_year_id', $ayId)
                ->exists();
            if ($exists) {
                $skipped++;
                continue;
            }
            $program->dueDateRules()->create(['academic_year_id' => $ayId, 'due_date_days' => $days]);
            $created++;
        }

        $msg = "Added {$created} due date rule" . ($created !== 1 ? 's' : '') . '.';
        if ($skipped > 0) {
            $msg .= " Skipped {$skipped} (already existed).";
        }

        return redirect()->back()->with('success', $msg);
    }

    public function updateDueDateRule(Request $request, Program $program, ProgramDueDateRule $rule): RedirectResponse
    {
        if (!auth()->user()->hasPermission('edit_programs')) {
            abort(403, 'Unauthorized action.');
        }

        if ($rule->program_id !== $program->id) {
            abort(404);
        }

        $validated = $request->validate([
            'academic_year_id' => 'nullable|uuid|exists:academic_years,id',
            'due_date_days'    => 'required|integer|min:1|max:365',
        ]);

        // Check for duplicate (excluding self)
        $exists = ProgramDueDateRule::where('program_id', $program->id)
            ->where('id', '!=', $rule->id)
            ->where(function ($q) use ($validated) {
                if ($validated['academic_year_id'] ?? null) {
                    $q->where('academic_year_id', $validated['academic_year_id']);
                } else {
                    $q->whereNull('academic_year_id');
                }
            })
            ->exists();

        if ($exists) {
            return redirect()->back()->with('error', 'A due date rule for that academic year already exists.');
        }

        $rule->update($validated);

        return redirect()->back()->with('success', 'Due date rule updated.');
    }

    public function destroyDueDateRule(Program $program, ProgramDueDateRule $rule): RedirectResponse
    {
        if (!auth()->user()->hasPermission('edit_programs')) {
            abort(403, 'Unauthorized action.');
        }

        if ($rule->program_id !== $program->id) {
            abort(404);
        }

        $rule->delete();

        return redirect()->back()->with('success', 'Due date rule removed.');
    }
}
