<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\Permission;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\RedirectResponse;

class RoleController extends Controller
{
    public function index(): Response
    {
        if (!auth()->user()->hasPermission('view_roles')) {
            abort(403, 'Unauthorized action.');
        }

        $roles = Role::withCount('users')
            ->with('permissions')
            // ✅ FIX: Force Super Admin to the top, then sort others alphabetically
            ->orderByRaw("CASE WHEN name = 'Super Admin' THEN 0 ELSE 1 END")
            ->orderBy('name', 'asc')
            ->get();

        $permissions = Permission::getGroupedByModule();

        return Inertia::render('roles/index', [
            'roles' => $roles,
            'permissions' => $permissions,
            'canCreate' => auth()->user()->hasPermission('create_roles'),
            'canEdit' => auth()->user()->hasPermission('edit_roles'),
            'canDelete' => auth()->user()->hasPermission('delete_roles'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        if (!auth()->user()->hasPermission('create_roles')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:roles,name',
            'description' => 'nullable|string',
            'permissions' => 'array',
            'permissions.*' => 'exists:permissions,id',
        ]);

        $role = Role::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
        ]);

        if (isset($validated['permissions'])) {
            $role->permissions()->attach($validated['permissions']);
        }

        return redirect()->back()->with('success', 'Role created successfully.');
    }

    public function update(Request $request, Role $role): RedirectResponse
    {
        if (!auth()->user()->hasPermission('edit_roles')) {
            abort(403, 'Unauthorized action.');
        }

        if ($role->name === 'Super Admin' && !auth()->user()->isSuperAdmin()) {
            abort(403, 'Only Super Admin can modify Super Admin role.');
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:roles,name,' . $role->id,
            'description' => 'nullable|string',
            'permissions' => 'array',
            'permissions.*' => 'exists:permissions,id',
        ]);

        $role->update([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
        ]);

        $role->permissions()->sync($validated['permissions'] ?? []);

        return redirect()->back()->with('success', 'Role updated successfully.');
    }

    public function destroy(Role $role): RedirectResponse
    {
        if (!auth()->user()->hasPermission('delete_roles')) {
            abort(403, 'Unauthorized action.');
        }

        if ($role->name === 'Super Admin') {
            return redirect()->back()->with('error', 'Cannot delete Super Admin role.');
        }

        if ($role->users()->count() > 0) {
            return redirect()->back()->with('error', 'Cannot delete role with assigned users.');
        }

        $role->delete();

        return redirect()->back()->with('success', 'Role deleted successfully.');
    }
}
