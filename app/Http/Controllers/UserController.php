<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\HEI;
use App\Models\Permission;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    /** Presence thresholds (minutes) for the user-management online indicator. */
    private const PRESENCE_ONLINE_MINUTES = 2;

    private const PRESENCE_RECENT_MINUTES = 15;

    /**
     * Lightweight polling endpoint for online status of all users.
     * Returns one row per user with a derived status bucket so the client
     * does not need to know the threshold rules.
     */
    public function onlineStatus(): JsonResponse
    {
        if (! auth()->user()->hasPermission('view_users')) {
            abort(403, 'Unauthorized action.');
        }

        $now = now();
        $onlineCutoff = $now->copy()->subMinutes(self::PRESENCE_ONLINE_MINUTES);
        $recentCutoff = $now->copy()->subMinutes(self::PRESENCE_RECENT_MINUTES);

        $rows = User::query()
            ->select('id', 'last_active_at')
            ->get()
            ->map(function (User $user) use ($onlineCutoff, $recentCutoff): array {
                $status = 'offline';
                if ($user->last_active_at) {
                    if ($user->last_active_at->gte($onlineCutoff)) {
                        $status = 'online';
                    } elseif ($user->last_active_at->gte($recentCutoff)) {
                        $status = 'recently_active';
                    }
                }

                return [
                    'id' => $user->id,
                    'status' => $status,
                    'last_active_at' => optional($user->last_active_at)->toIso8601String(),
                ];
            })
            ->values();

        return response()->json(['users' => $rows]);
    }

    public function index(): Response
    {
        if (! auth()->user()->hasPermission('view_users')) {
            abort(403, 'Unauthorized action.');
        }

        // Only Super Admin may grant direct per-user permissions.
        $canAssignPermissions = auth()->user()->isSuperAdmin();

        $users = User::with(['role', 'hei.region', 'region', 'programs', 'permissions:id'])
            ->join('roles', 'users.role_id', '=', 'roles.id')
            ->select('users.*')
            ->orderByRaw("CASE WHEN roles.name = 'Super Admin' THEN 0 ELSE 1 END")
            ->orderBy('users.name', 'asc')
            ->get();

        $roles = Role::select('id', 'name')->orderBy('name')->get();

        // Permission picker for the Edit User modal (Super Admin only).
        $permissions = $canAssignPermissions ? Permission::getGroupedByModule() : [];
        $regions = Region::where('status', 'active')->orderBy('name')->get(['id', 'code', 'name']);
        // Active institutions, plus any institution an existing account is already
        // attached to. Without the second half, deactivating an HEI made the
        // Institution field of its users render blank in the edit modal - the
        // selector resolves the current value out of this same list.
        $heis = HEI::with('region:id,code,name')
            ->where(fn ($q) => $q->where('status', 'active')
                ->orWhereIn('id', User::query()->whereNotNull('hei_id')->select('hei_id')))
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'region_id', 'status']);

        // All active programs with parent info for STUFAPS Focal assignment
        $programs = Program::active()
            ->with('parent:id,code,name')
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'parent_id']);

        return Inertia::render('users/index', [
            'users' => $users,
            'roles' => $roles,
            'regions' => $regions,
            'heis' => $heis,
            'programs' => $programs,
            'permissions' => $permissions,
            'canAssignPermissions' => $canAssignPermissions,
            'canCreate' => auth()->user()->hasPermission('create_users'),
            'canEdit' => auth()->user()->hasPermission('edit_users'),
            'canDelete' => auth()->user()->hasPermission('delete_users'),
            'canChangeStatus' => auth()->user()->hasPermission('change_user_status'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        if (! auth()->user()->hasPermission('create_users')) {
            abort(403, 'Unauthorized action.');
        }

        $role = Role::find($request->role_id);
        $isRegionalCoordinator = $role && $role->name === 'Regional Coordinator';
        $isHEIRole = $role && $role->name === 'HEI';
        $isProgramScoped = $role && $role->name === 'STUFAPS Focal';

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'role_id' => 'required|exists:roles,id',
            'region_id' => $isRegionalCoordinator ? 'required|exists:regions,id' : 'nullable|exists:regions,id',
            'hei_id' => $isHEIRole ? 'required|exists:heis,id' : 'nullable|exists:heis,id',
            'program_ids' => $isProgramScoped ? 'required|array|min:1' : 'nullable|array',
            'program_ids.*' => 'exists:programs,id',
            'permission_ids' => 'nullable|array',
            'permission_ids.*' => 'exists:permissions,id',
            'status' => 'required|in:active,inactive',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role_id' => $validated['role_id'],
            'region_id' => $isRegionalCoordinator || $isHEIRole ? ($validated['region_id'] ?? null) : null,
            'hei_id' => $isHEIRole ? ($validated['hei_id'] ?? null) : null,
            'status' => $validated['status'],
        ]);

        // Sync program assignments for STUFAPS Focal
        if ($isProgramScoped && ! empty($validated['program_ids'])) {
            $user->programs()->sync($validated['program_ids']);
        }

        // Direct per-user permission grants — Super Admin only (server-side guard
        // against privilege escalation, regardless of who can edit users).
        if (auth()->user()->isSuperAdmin()) {
            $permissionIds = $validated['permission_ids'] ?? [];
            $user->permissions()->sync($permissionIds);
            if (! empty($permissionIds)) {
                ActivityLog::log('updated_permissions', "Set direct permissions for {$user->name}", $user, 'User Management');
            }
        }

        // Backfill notifications for HEI users so they see liquidations created before their account
        if ($isHEIRole && $user->hei_id) {
            NotificationService::backfillForNewHEIUser($user);
        }

        return redirect()->back()->with('success', 'User created successfully.');
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        if (! auth()->user()->hasPermission('edit_users')) {
            abort(403, 'Unauthorized action.');
        }

        if ($user->isSuperAdmin() && ! auth()->user()->isSuperAdmin()) {
            abort(403, 'You cannot modify the Super Admin.');
        }

        $role = Role::find($request->role_id);
        $isRegionalCoordinator = $role && $role->name === 'Regional Coordinator';
        $isHEIRole = $role && $role->name === 'HEI';
        $isProgramScoped = $role && $role->name === 'STUFAPS Focal';

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'email', Rule::unique('users')->ignore($user->id)],
            'password' => 'nullable|string|min:8|confirmed',
            'role_id' => 'required|exists:roles,id',
            'region_id' => $isRegionalCoordinator ? 'required|exists:regions,id' : 'nullable|exists:regions,id',
            'hei_id' => $isHEIRole ? 'required|exists:heis,id' : 'nullable|exists:heis,id',
            'program_ids' => $isProgramScoped ? 'required|array|min:1' : 'nullable|array',
            'program_ids.*' => 'exists:programs,id',
            'permission_ids' => 'nullable|array',
            'permission_ids.*' => 'exists:permissions,id',
            'status' => 'required|in:active,inactive',
        ]);

        // Captured before the write so we can tell whether this account has just
        // become an HEI account, or moved to a different institution.
        $originalHeiId = $user->hei_id;
        $originalRoleName = $user->role?->name;

        $updateData = [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'role_id' => $validated['role_id'],
            // Scoped fields follow the role, mirroring what programs() does below.
            // A request posted straight to this endpoint cannot leave an hei_id on
            // an Admin, and moving someone off the HEI role clears their old one.
            'region_id' => $isRegionalCoordinator || $isHEIRole ? ($validated['region_id'] ?? null) : null,
            'hei_id' => $isHEIRole ? ($validated['hei_id'] ?? null) : null,
            'status' => $validated['status'],
        ];

        if (! empty($validated['password'])) {
            $updateData['password'] = Hash::make($validated['password']);

            // A password an administrator typed is not one the user chose, so
            // put them back in front of the first-login prompt. forceFill because
            // password_changed_at is not fillable; the update() below saves it
            // along with everything else in the same write.
            $user->forceFill(['password_changed_at' => null]);
        }

        $user->update($updateData);

        // Same backfill store() runs: an account that just became an HEI account,
        // or moved to another institution, still needs the notifications for that
        // institution's existing liquidations. The service skips anything the user
        // already has, so saving twice does not duplicate them.
        if ($isHEIRole && $user->hei_id
            && ($user->hei_id !== $originalHeiId || $originalRoleName !== 'HEI')) {
            NotificationService::backfillForNewHEIUser($user);
        }

        // Sync program assignments (clear if not STUFAPS Focal)
        if ($isProgramScoped && ! empty($validated['program_ids'])) {
            $user->programs()->sync($validated['program_ids']);
        } else {
            $user->programs()->detach();
        }

        // Direct per-user permission grants — Super Admin only. Audit-log when the
        // granted set actually changes.
        if (auth()->user()->isSuperAdmin()) {
            $before = $user->permissions()->pluck('permissions.id')->sort()->values();
            $after = collect($validated['permission_ids'] ?? [])->sort()->values();

            if ($before->toArray() !== $after->toArray()) {
                $user->permissions()->sync($after->all());
                ActivityLog::log('updated_permissions', "Updated direct permissions for {$user->name}", $user, 'User Management');
            }
        }

        return redirect()->back()->with('success', 'User updated successfully.');
    }

    public function toggleStatus(User $user): RedirectResponse
    {
        if (! auth()->user()->hasPermission('change_user_status')) {
            abort(403, 'Unauthorized action.');
        }

        if ($user->id === auth()->id()) {
            return redirect()->back()->with('error', 'Cannot change your own status.');
        }

        $newStatus = $user->status === 'active' ? 'inactive' : 'active';

        $user->update([
            'status' => $newStatus,
        ]);

        ActivityLog::log('toggled_status', "Toggled user {$user->name} status to {$newStatus}", $user, 'User Management');

        return redirect()->back()->with('success', 'User status updated successfully.');
    }

    public function destroy(User $user): RedirectResponse
    {
        if (! auth()->user()->hasPermission('delete_users')) {
            abort(403, 'Unauthorized action.');
        }

        if ($user->id === auth()->id()) {
            return redirect()->back()->with('error', 'Cannot delete your own account.');
        }

        // An account that authored liquidations, uploads, reviews or transmittals
        // is never removed - deleting it would strip that history of its author.
        // Deactivating blocks sign-in and keeps every record intact.
        if ($blockers = $user->describeDeletionBlockers()) {
            return redirect()->back()->with(
                'error',
                "Cannot delete {$user->name} - this account is attached to {$blockers}. Deactivate the account instead to keep its records."
            );
        }

        $user->delete();

        return redirect()->back()->with('success', 'User deleted successfully.');
    }
}
