<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\AcademicYear;
use App\Models\AcademicYearDocumentRequirement;
use App\Models\DocumentRequirement;
use App\Models\Program;
use App\Services\CacheService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class AcademicYearRequirementController extends Controller
{
    public function __construct(private CacheService $cache) {}

    /**
     * Show the requirements configuration page for an academic year.
     */
    public function index(AcademicYear $academicYear): Response
    {
        if (!auth()->user()->hasPermission('edit_academic_years')) {
            abort(403, 'Unauthorized action.');
        }

        // Load all active programs with their active requirements
        $programs = Program::where('status', 'active')
            ->orderBy('name')
            ->with(['documentRequirements' => function ($q) {
                $q->where('is_active', true)->orderBy('sort_order');
            }])
            ->get(['id', 'name', 'code']);

        // Load existing AY-specific configs keyed by document_requirement_id
        $existingConfigs = AcademicYearDocumentRequirement::where('academic_year_id', $academicYear->id)
            ->get()
            ->keyBy('document_requirement_id');

        // Build the grouped requirements with AY override data merged in
        $groupedRequirements = $programs->map(function ($program) use ($existingConfigs) {
            $requirements = $program->documentRequirements->map(function ($req) use ($existingConfigs) {
                $config = $existingConfigs->get($req->id);
                return [
                    'id'          => $req->id,
                    'code'        => $req->code,
                    'name'        => $req->name,
                    'description' => $req->description,
                    // AY-specific overrides, falling back to global defaults
                    'is_required' => $config ? $config->is_required : $req->is_required,
                    'is_active'   => $config ? $config->is_active  : $req->is_active,
                    'sort_order'  => $config ? $config->sort_order  : $req->sort_order,
                    'has_override' => $config !== null,
                ];
            });

            return [
                'id'           => $program->id,
                'name'         => $program->name,
                'code'         => $program->code,
                'requirements' => $requirements,
            ];
        })->filter(fn ($p) => $p['requirements']->isNotEmpty())->values();

        // Other academic years for "copy from" feature
        $otherYears = AcademicYear::where('id', '!=', $academicYear->id)
            ->ordered()
            ->get(['id', 'code', 'name']);

        return Inertia::render('academic-years/requirements', [
            'academicYear'        => $academicYear->only('id', 'code', 'name'),
            'groupedRequirements' => $groupedRequirements,
            'otherYears'          => $otherYears,
            'hasCustomConfig'     => $existingConfigs->isNotEmpty(),
        ]);
    }

    /**
     * Sync (upsert) AY-specific requirement configs.
     *
     * Payload: { requirements: [{ document_requirement_id, is_required, is_active, sort_order }] }
     */
    public function sync(Request $request, AcademicYear $academicYear): RedirectResponse
    {
        if (!auth()->user()->hasPermission('edit_academic_years')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'requirements'                              => 'required|array',
            'requirements.*.document_requirement_id'   => 'required|uuid|exists:document_requirements,id',
            'requirements.*.is_required'               => 'required|boolean',
            'requirements.*.is_active'                 => 'required|boolean',
            'requirements.*.sort_order'                => 'required|integer|min:0',
        ]);

        DB::transaction(function () use ($validated, $academicYear) {
            // Load global defaults to compare against
            $globals = DocumentRequirement::whereIn(
                'id',
                array_column($validated['requirements'], 'document_requirement_id')
            )->get()->keyBy('id');

            foreach ($validated['requirements'] as $item) {
                $reqId = $item['document_requirement_id'];
                $global = $globals->get($reqId);

                $isChanged = !$global
                    || (bool) $item['is_required'] !== (bool) $global->is_required
                    || (bool) $item['is_active'] !== (bool) $global->is_active
                    || (int) $item['sort_order'] !== (int) $global->sort_order;

                if ($isChanged) {
                    AcademicYearDocumentRequirement::updateOrCreate(
                        [
                            'academic_year_id'         => $academicYear->id,
                            'document_requirement_id'  => $reqId,
                        ],
                        [
                            'is_required' => $item['is_required'],
                            'is_active'   => $item['is_active'],
                            'sort_order'  => $item['sort_order'],
                        ]
                    );
                } else {
                    // Remove override if it matches global defaults
                    AcademicYearDocumentRequirement::where('academic_year_id', $academicYear->id)
                        ->where('document_requirement_id', $reqId)
                        ->delete();
                }
            }
        });

        // Invalidate AY-scoped requirement caches for all programs
        $this->cache->clearAYRequirementCache($academicYear->id);

        return redirect()->back()->with('success', 'Requirements configuration saved.');
    }

    /**
     * Copy requirement config from another academic year.
     *
     * Payload: { source_academic_year_id }
     */
    public function copyFromYear(Request $request, AcademicYear $academicYear): RedirectResponse
    {
        if (!auth()->user()->hasPermission('edit_academic_years')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'source_academic_year_id' => 'required|uuid|exists:academic_years,id|different:' . $academicYear->id,
        ]);

        $sourceId = $validated['source_academic_year_id'];

        $sourceConfigs = AcademicYearDocumentRequirement::where('academic_year_id', $sourceId)->get();

        if ($sourceConfigs->isEmpty()) {
            return redirect()->back()->with('error', 'The selected academic year has no custom configuration to copy.');
        }

        DB::transaction(function () use ($sourceConfigs, $academicYear) {
            foreach ($sourceConfigs as $config) {
                AcademicYearDocumentRequirement::updateOrCreate(
                    [
                        'academic_year_id'        => $academicYear->id,
                        'document_requirement_id' => $config->document_requirement_id,
                    ],
                    [
                        'is_required' => $config->is_required,
                        'is_active'   => $config->is_active,
                        'sort_order'  => $config->sort_order,
                    ]
                );
            }
        });

        $this->cache->clearAYRequirementCache($academicYear->id);

        return redirect()->back()->with('success', 'Configuration copied successfully.');
    }

    /**
     * Reset AY requirements to global defaults (removes all overrides).
     */
    public function reset(AcademicYear $academicYear): RedirectResponse
    {
        if (!auth()->user()->hasPermission('edit_academic_years')) {
            abort(403, 'Unauthorized action.');
        }

        AcademicYearDocumentRequirement::where('academic_year_id', $academicYear->id)->delete();

        $this->cache->clearAYRequirementCache($academicYear->id);

        return redirect()->back()->with('success', 'Requirements reset to global defaults.');
    }

    /**
     * Reset AY requirements for a specific program to global defaults.
     */
    public function resetProgram(Request $request, AcademicYear $academicYear): RedirectResponse
    {
        if (!auth()->user()->hasPermission('edit_academic_years')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'program_id' => 'required|uuid|exists:programs,id',
        ]);

        // Get requirement IDs for this program
        $requirementIds = DocumentRequirement::where('program_id', $validated['program_id'])
            ->pluck('id');

        AcademicYearDocumentRequirement::where('academic_year_id', $academicYear->id)
            ->whereIn('document_requirement_id', $requirementIds)
            ->delete();

        $this->cache->clearAYRequirementCache($academicYear->id);

        $program = Program::find($validated['program_id']);

        return redirect()->back()->with('success', "{$program->code} requirements reset to global defaults.");
    }
}
