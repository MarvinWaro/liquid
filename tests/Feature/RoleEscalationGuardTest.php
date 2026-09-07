<?php

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * @param  list<string>  $permissions
 */
function escalationUser(string $roleName, array $permissions = []): User
{
    $role = escalationRole($roleName);

    foreach ($permissions as $permissionName) {
        $permission = Permission::firstOrCreate(
            ['name' => $permissionName],
            ['module' => 'Test', 'description' => "Test {$permissionName}"],
        );

        $role->permissions()->syncWithoutDetaching([$permission->id]);
    }

    return User::factory()->create([
        'role_id' => $role->id,
        'status' => 'active',
    ]);
}

function escalationRole(string $name): Role
{
    return Role::firstOrCreate(
        ['name' => $name],
        ['description' => "{$name} test role"],
    );
}

/**
 * The payload the Edit User modal submits, with anything the caller wants to
 * override. Keeps each test to the one field it is actually about.
 */
function escalationPayload(User $user, array $overrides = []): array
{
    return array_merge([
        'name' => $user->name,
        'email' => $user->email,
        'role_id' => $user->role_id,
        'status' => 'active',
    ], $overrides);
}

test('an admin cannot promote themselves to Super Admin', function () {
    $superAdminRole = escalationRole('Super Admin');
    $admin = escalationUser('Admin', ['edit_users']);
    $originalRoleId = $admin->role_id;

    $this->actingAs($admin)
        ->put(route('users.update', $admin), escalationPayload($admin, [
            'role_id' => $superAdminRole->id,
        ]))
        ->assertForbidden();

    expect($admin->fresh()->role_id)->toBe($originalRoleId)
        ->and($admin->fresh()->isSuperAdmin())->toBeFalse();
});

test('an admin cannot promote somebody else to Super Admin', function () {
    $superAdminRole = escalationRole('Super Admin');
    $admin = escalationUser('Admin', ['edit_users']);
    $encoder = escalationUser('Encoder');
    $originalRoleId = $encoder->role_id;

    $this->actingAs($admin)
        ->put(route('users.update', $encoder), escalationPayload($encoder, [
            'role_id' => $superAdminRole->id,
        ]))
        ->assertForbidden();

    expect($encoder->fresh()->role_id)->toBe($originalRoleId);
});

test('an admin cannot create a brand new Super Admin', function () {
    // The second door: blocking only the edit path still let an admin mint a
    // fresh Super Admin account and sign in as it.
    $superAdminRole = escalationRole('Super Admin');
    $admin = escalationUser('Admin', ['create_users']);

    $this->actingAs($admin)
        ->post(route('users.store'), [
            'name' => 'Backdoor Account',
            'email' => 'backdoor@example.test',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role_id' => $superAdminRole->id,
            'status' => 'active',
        ])
        ->assertForbidden();

    expect(User::where('email', 'backdoor@example.test')->exists())->toBeFalse();
});

test('a Super Admin can still assign the Super Admin role', function () {
    $superAdminRole = escalationRole('Super Admin');
    $superAdmin = escalationUser('Super Admin', ['edit_users', 'create_users']);
    $encoder = escalationUser('Encoder');

    $this->actingAs($superAdmin)
        ->put(route('users.update', $encoder), escalationPayload($encoder, [
            'role_id' => $superAdminRole->id,
        ]))
        ->assertSessionHas('success');

    expect($encoder->fresh()->role_id)->toBe($superAdminRole->id);

    $this->actingAs($superAdmin)
        ->post(route('users.store'), [
            'name' => 'Second Super Admin',
            'email' => 'second-sa@example.test',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role_id' => $superAdminRole->id,
            'status' => 'active',
        ])
        ->assertSessionHas('success');

    expect(User::where('email', 'second-sa@example.test')->exists())->toBeTrue();
});

test('ordinary user management is untouched for an admin', function () {
    $admin = escalationUser('Admin', ['edit_users', 'create_users']);
    $encoder = escalationUser('Encoder');
    $accountantRole = escalationRole('Accountant');

    $this->actingAs($admin)
        ->put(route('users.update', $encoder), escalationPayload($encoder, [
            'name' => 'Renamed Encoder',
            'role_id' => $accountantRole->id,
        ]))
        ->assertSessionHas('success');

    expect($encoder->fresh()->role_id)->toBe($accountantRole->id)
        ->and($encoder->fresh()->name)->toBe('Renamed Encoder');

    $this->actingAs($admin)
        ->post(route('users.store'), [
            'name' => 'New Encoder',
            'email' => 'new-encoder@example.test',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role_id' => $encoder->role_id,
            'status' => 'active',
        ])
        ->assertSessionHas('success');

    expect(User::where('email', 'new-encoder@example.test')->exists())->toBeTrue();
});

test('the users page only offers the Super Admin role to a Super Admin', function () {
    escalationRole('Super Admin');
    $admin = escalationUser('Admin', ['view_users']);
    $superAdmin = escalationUser('Super Admin', ['view_users']);

    $this->actingAs($admin)
        ->get(route('users.index'))
        ->assertInertia(fn ($page) => $page->where('canAssignSuperAdmin', false));

    $this->actingAs($superAdmin)
        ->get(route('users.index'))
        ->assertInertia(fn ($page) => $page->where('canAssignSuperAdmin', true));
});
