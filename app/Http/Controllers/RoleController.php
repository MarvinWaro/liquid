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
    /**
     * Display a listing of roles.
     */
    public function index(): Response
    {
        // Check permission
        if (!auth()->user()->hasPermission('view_roles')) {
            abort(403, 'Unauthorized action.');
        }

        $roles = Role::withCount('users')
            ->with('permissions')
            ->orderBy('name')
            ->get();

        return Inertia::render('roles/index', [
            'roles' => $roles,
            'canCreate' => auth()->user()->hasPermission('create_roles'),
            'canEdit' => auth()->user()->hasPermission('edit_roles'),
            'canDelete' => auth()->user()->hasPermission('delete_roles'),
        ]);
    }

    /**
     * Show the form for creating a new role.
     */
    public function create(): Response
    {
        if (!auth()->user()->hasPermission('create_roles')) {
            abort(403, 'Unauthorized action.');
        }

        $permissions = Permission::getGroupedByModule();

        return Inertia::render('roles/create', [
            'permissions' => $permissions,
        ]);
    }

    /**
     * Store a newly created role.
     */
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

        return redirect()->route('roles.index')
            ->with('success', 'Role created successfully.');
    }

    /**
     * Show the form for editing the role.
     */
    public function edit(Role $role): Response
    {
        if (!auth()->user()->hasPermission('edit_roles')) {
            abort(403, 'Unauthorized action.');
        }

        $permissions = Permission::getGroupedByModule();
        $rolePermissions = $role->permissions->pluck('id')->toArray();

        return Inertia::render('roles/edit', [
            'role' => $role,
            'permissions' => $permissions,
            'rolePermissions' => $rolePermissions,
        ]);
    }

    /**
     * Update the specified role.
     */
    public function update(Request $request, Role $role): RedirectResponse
    {
        if (!auth()->user()->hasPermission('edit_roles')) {
            abort(403, 'Unauthorized action.');
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

        return redirect()->route('roles.index')
            ->with('success', 'Role updated successfully.');
    }

    /**
     * Remove the specified role.
     */
    public function destroy(Role $role): RedirectResponse
    {
        if (!auth()->user()->hasPermission('delete_roles')) {
            abort(403, 'Unauthorized action.');
        }

        // Prevent deleting Admin role
        if ($role->name === 'Admin') {
            return redirect()->route('roles.index')
                ->with('error', 'Cannot delete Admin role.');
        }

        // Check if role has users
        if ($role->users()->count() > 0) {
            return redirect()->route('roles.index')
                ->with('error', 'Cannot delete role with assigned users.');
        }

        $role->delete();

        return redirect()->route('roles.index')
            ->with('success', 'Role deleted successfully.');
    }
}
