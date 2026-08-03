<?php

namespace App\Http\Controllers;

use App\Models\HEI;
use App\Models\Region;
use App\Models\User;
use App\Services\HEIRegionTransferService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class HEIController extends Controller
{
    public function __construct(private readonly HEIRegionTransferService $regionTransferService) {}

    public function index(): Response
    {
        $user = auth()->user();

        if (! $user->hasPermission('view_hei')) {
            abort(403, 'Unauthorized action.');
        }

        $relationships = [
            'region',
            'users' => fn ($q) => $q->whereNotNull('avatar')->select('id', 'hei_id', 'avatar')->limit(1),
        ];

        // Transfer context is internal-only even if an HEI account is granted
        // a direct management permission later.
        if ($user->role?->name !== 'HEI' && $user->hasPermission('edit_hei')) {
            $relationships = array_merge($relationships, [
                'regionTransfers.fromRegion:id,code,name',
                'regionTransfers.toRegion:id,code,name',
                'regionTransfers.transferredBy:id,name',
            ]);
        }

        $heis = HEI::with($relationships)
            ->orderBy('name')
            ->get()
            ->each(function ($hei) {
                $hei->user_avatar = $hei->users->first()?->avatar_url;
                unset($hei->users);
            });
        $regions = Region::where('status', 'active')->orderBy('name')->get(['id', 'code', 'name']);

        return Inertia::render('hei/index', [
            'heis' => $heis,
            'regions' => $regions,
            'canCreate' => $user->hasPermission('create_hei'),
            'canEdit' => $user->hasPermission('edit_hei'),
            'canTransfer' => $this->canTransferRegion($user),
            'canDelete' => $user->hasPermission('delete_hei'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        if (! auth()->user()->hasPermission('create_hei')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'uii' => 'required|string|max:50|unique:heis,uii',
            'name' => 'required|string|max:255',
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
        if (! auth()->user()->hasPermission('edit_hei')) {
            abort(403, 'Unauthorized action.');
        }

        $requestedRegionId = $request->exists('region_id')
            ? ($request->input('region_id') ?: null)
            : $hei->region_id;
        $regionChanged = $hei->region_id !== $requestedRegionId;

        // Ordinary HEI edits that omit region_id preserve the current owner.
        $request->merge(['region_id' => $requestedRegionId]);

        if ($regionChanged && ! $this->canTransferRegion($request->user())) {
            abort(403, 'You are not allowed to transfer an HEI to another region.');
        }

        $regionExists = Rule::exists('regions', 'id');
        if ($regionChanged) {
            $regionExists->where(fn ($query) => $query->where('status', 'active'));
        }

        $todayInManila = now('Asia/Manila')->toDateString();

        $validated = $request->validate([
            'uii' => ['required', 'string', 'max:50', Rule::unique('heis')->ignore($hei->id)],
            'name' => 'required|string|max:255',
            'type' => 'required|in:Private,SUC,LUC',
            'region_id' => [Rule::requiredIf($regionChanged), 'nullable', $regionExists],
            'status' => 'required|in:active,inactive',
            'transfer_effective_date' => [Rule::requiredIf($regionChanged), 'nullable', 'date', "before_or_equal:{$todayInManila}"],
            'transfer_reason' => [Rule::requiredIf($regionChanged), 'nullable', 'string', 'max:2000'],
            'transfer_memo_reference' => ['nullable', 'string', 'max:255'],
        ]);

        $validated['name'] = strtoupper($validated['name']);

        $attributes = collect($validated)->only([
            'uii', 'name', 'type', 'region_id', 'status',
        ])->all();
        $attributes['region_id'] = $attributes['region_id'] ?: null;

        $transferData = $regionChanged ? [
            'effective_date' => $validated['transfer_effective_date'],
            'reason' => $validated['transfer_reason'],
            'memo_reference' => $validated['transfer_memo_reference'] ?? null,
        ] : null;

        $this->regionTransferService->update($hei, $attributes, $request->user(), $transferData);

        return redirect()->back()->with(
            'success',
            $regionChanged ? 'HEI region transferred successfully.' : 'HEI updated successfully.'
        );
    }

    public function destroy(HEI $hei): RedirectResponse
    {
        if (! auth()->user()->hasPermission('delete_hei')) {
            abort(403, 'Unauthorized action.');
        }

        if ($hei->regionTransfers()->exists()) {
            return redirect()->back()->with(
                'error',
                'Cannot delete an HEI with immutable region transfer history.'
            );
        }

        $hei->delete();

        return redirect()->back()->with('success', 'HEI deleted successfully.');
    }

    private function canTransferRegion(User $user): bool
    {
        return $user->hasPermission('transfer_hei_region')
            && ($user->isSuperAdmin() || $user->role?->name === 'Admin');
    }
}
