<?php

use App\Http\Controllers\Auth\InitialPasswordController;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

/**
 * A user with a real role, and optionally the permissions that role needs.
 * Mirrors guardTestUser() in UserDeletionGuardTest - RefreshDatabase seeds
 * nothing, so roles and permissions have to be made by hand.
 *
 * @param  list<string>  $permissions
 */
function initialPasswordUser(string $roleName, array $permissions = []): User
{
    $role = Role::firstOrCreate(
        ['name' => $roleName],
        ['description' => "{$roleName} test role"],
    );

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

test('a freshly provisioned user is asked to change their password', function () {
    $user = User::factory()->create();

    expect($user->hasNeverChangedPassword())->toBeTrue();

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('mustChangePassword', true));
});

test('the prompt stops once the user has chosen their own password', function () {
    $user = User::factory()->create();

    $user->changePassword('my-own-password');

    expect($user->fresh()->hasNeverChangedPassword())->toBeFalse();

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('mustChangePassword', false));
});

test('the prompt stores the new password and stamps when it changed', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->from(route('dashboard'))
        ->put(route('initial-password.update'), [
            'password' => 'Str0ng-New-Passw0rd',
            'password_confirmation' => 'Str0ng-New-Passw0rd',
        ]);

    $response->assertRedirect(route('dashboard'));
    $response->assertSessionHas('success');

    $user->refresh();

    expect(Hash::check('Str0ng-New-Passw0rd', $user->password))->toBeTrue()
        ->and($user->password_changed_at)->not->toBeNull();
});

test('the confirmation field must match', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('dashboard'))
        ->put(route('initial-password.update'), [
            'password' => 'Str0ng-New-Passw0rd',
            'password_confirmation' => 'something-else',
        ])
        ->assertSessionHasErrors('password');

    expect($user->fresh()->password_changed_at)->toBeNull();
});

test('a weak password is refused', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('dashboard'))
        ->put(route('initial-password.update'), [
            'password' => 'abc',
            'password_confirmation' => 'abc',
        ])
        ->assertSessionHasErrors('password');

    expect($user->fresh()->password_changed_at)->toBeNull();
});

test('skipping hides the prompt for the rest of the session only', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('dashboard'))
        ->post(route('initial-password.postpone'))
        ->assertRedirect(route('dashboard'));

    $this->assertTrue(session()->has(InitialPasswordController::POSTPONED_SESSION_KEY));

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('mustChangePassword', false));

    // Skipping is not a database change, so the password is still the original.
    expect($user->fresh()->password_changed_at)->toBeNull();

    // A new session - as after logging out and back in - asks again.
    session()->flush();

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('mustChangePassword', true));
});

test('changing the password from settings also stops the prompt', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('user-password.edit'))
        ->put(route('user-password.update'), [
            'current_password' => 'password',
            'password' => 'Str0ng-New-Passw0rd',
            'password_confirmation' => 'Str0ng-New-Passw0rd',
        ])
        ->assertSessionHasNoErrors();

    expect($user->fresh()->password_changed_at)->not->toBeNull();
});

test('an administrator setting a password puts the user back in front of the prompt', function () {
    $user = initialPasswordUser('Encoder');
    $user->changePassword('chosen-by-the-user');

    expect($user->fresh()->password_changed_at)->not->toBeNull();

    $admin = initialPasswordUser('Admin', ['edit_users']);

    $this->actingAs($admin)
        ->put(route('users.update', $user), [
            'name' => $user->name,
            'email' => $user->email,
            'password' => 'Admin-Set-Passw0rd',
            'password_confirmation' => 'Admin-Set-Passw0rd',
            'role_id' => $user->role_id,
            'status' => 'active',
        ])
        ->assertSessionHasNoErrors();

    expect($user->fresh()->password_changed_at)->toBeNull();
});
