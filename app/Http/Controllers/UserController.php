<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Role;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(): Response
    {
        if (!auth()->user()->hasPermission('view_users')) {
            abort(403, 'Unauthorized action.');
        }

        // ✅ FIX: Join roles table to sort by Role Name, then User Name
        $users = User::with('role')
            ->join('roles', 'users.role_id', '=', 'roles.id')
            ->select('users.*') // Important: Keep user columns, avoid overwriting ID with role ID
            ->orderByRaw("CASE WHEN roles.name = 'Super Admin' THEN 0 ELSE 1 END")
            ->orderBy('users.name', 'asc')
            ->get();

        $roles = Role::select('id', 'name')->orderBy('name')->get();

        return Inertia::render('users/index', [
            'users' => $users,
            'roles' => $roles,
            'canCreate' => auth()->user()->hasPermission('create_users'),
            'canEdit' => auth()->user()->hasPermission('edit_users'),
            'canDelete' => auth()->user()->hasPermission('delete_users'),
            'canChangeStatus' => auth()->user()->hasPermission('change_user_status'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        if (!auth()->user()->hasPermission('create_users')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'role_id' => 'required|exists:roles,id',
            'status' => 'required|in:active,inactive',
        ]);

        User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role_id' => $validated['role_id'],
            'status' => $validated['status'],
        ]);

        return redirect()->back()->with('success', 'User created successfully.');
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        if (!auth()->user()->hasPermission('edit_users')) {
            abort(403, 'Unauthorized action.');
        }

        if ($user->isSuperAdmin() && !auth()->user()->isSuperAdmin()) {
            abort(403, 'You cannot modify the Super Admin.');
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'email', Rule::unique('users')->ignore($user->id)],
            'password' => 'nullable|string|min:8|confirmed',
            'role_id' => 'required|exists:roles,id',
            'status' => 'required|in:active,inactive',
        ]);

        $updateData = [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'role_id' => $validated['role_id'],
            'status' => $validated['status'],
        ];

        if (!empty($validated['password'])) {
            $updateData['password'] = Hash::make($validated['password']);
        }

        $user->update($updateData);

        return redirect()->back()->with('success', 'User updated successfully.');
    }

    public function toggleStatus(User $user): RedirectResponse
    {
        if (!auth()->user()->hasPermission('change_user_status')) {
            abort(403, 'Unauthorized action.');
        }

        if ($user->id === auth()->id()) {
            return redirect()->back()->with('error', 'Cannot change your own status.');
        }

        $user->update([
            'status' => $user->status === 'active' ? 'inactive' : 'active',
        ]);

        return redirect()->back()->with('success', 'User status updated successfully.');
    }

    public function destroy(User $user): RedirectResponse
    {
        if (!auth()->user()->hasPermission('delete_users')) {
            abort(403, 'Unauthorized action.');
        }

        if ($user->id === auth()->id()) {
            return redirect()->back()->with('error', 'Cannot delete your own account.');
        }

        $user->delete();

        return redirect()->back()->with('success', 'User deleted successfully.');
    }
}
