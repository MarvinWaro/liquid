<?php

namespace App\Http\Controllers;

use App\Models\DocumentRequirement;
use App\Models\Program;
use App\Services\CacheService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class DocumentRequirementController extends Controller
{
    public function __construct(private CacheService $cache) {}

    public function index(): Response
    {
        if (!auth()->user()->hasPermission('view_document_requirements')) {
            abort(403, 'Unauthorized action.');
        }

        $programs = Program::where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        $requirements = DocumentRequirement::with('program:id,name,code')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return Inertia::render('document-requirements/index', [
            'requirements' => $requirements,
            'programs'     => $programs,
            'canCreate'    => auth()->user()->hasPermission('create_document_requirements'),
            'canEdit'      => auth()->user()->hasPermission('edit_document_requirements'),
            'canDelete'    => auth()->user()->hasPermission('delete_document_requirements'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        if (!auth()->user()->hasPermission('create_document_requirements')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'program_id'  => 'required|exists:programs,id',
            'code'        => [
                'required', 'string', 'max:50',
                Rule::unique('document_requirements')->where('program_id', $request->program_id),
            ],
            'name'        => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'sort_order'  => 'required|integer|min:0',
            'is_required' => 'required|boolean',
            'is_active'   => 'required|boolean',
        ]);

        $validated['code'] = strtoupper($validated['code']);
        $validated['description'] = $validated['description'] ?: null;

        DocumentRequirement::create($validated);
        $this->clearRequirementCache($validated['program_id']);

        return redirect()->back()->with('success', 'Document requirement created successfully.');
    }

    public function update(Request $request, DocumentRequirement $requirement): RedirectResponse
    {
        if (!auth()->user()->hasPermission('edit_document_requirements')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'program_id'  => 'required|exists:programs,id',
            'code'        => [
                'required', 'string', 'max:50',
                Rule::unique('document_requirements')
                    ->where('program_id', $request->program_id)
                    ->ignore($requirement->id),
            ],
            'name'        => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'sort_order'  => 'required|integer|min:0',
            'is_required' => 'required|boolean',
            'is_active'   => 'required|boolean',
        ]);

        $validated['code'] = strtoupper($validated['code']);
        $validated['description'] = $validated['description'] ?: null;

        $oldProgramId = $requirement->program_id;
        $requirement->update($validated);

        // Clear cache for both old and new program (in case program changed)
        $this->clearRequirementCache($oldProgramId);
        if ($oldProgramId !== $validated['program_id']) {
            $this->clearRequirementCache($validated['program_id']);
        }

        return redirect()->back()->with('success', 'Document requirement updated successfully.');
    }

    public function destroy(DocumentRequirement $requirement): RedirectResponse
    {
        if (!auth()->user()->hasPermission('delete_document_requirements')) {
            abort(403, 'Unauthorized action.');
        }

        $programId = $requirement->program_id;
        $requirement->delete();
        $this->clearRequirementCache($programId);

        return redirect()->back()->with('success', 'Document requirement deleted successfully.');
    }

    private function clearRequirementCache(string $programId): void
    {
        Cache::forget("lookup:document_requirements:{$programId}");
    }
}
