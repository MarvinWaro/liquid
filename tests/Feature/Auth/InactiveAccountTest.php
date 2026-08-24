<?php

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    config()->set('services.turnstile.enabled', false);
});

function inactiveTestUser(string $status): User
{
    $role = Role::firstOrCreate(
        ['name' => 'HEI'],
        ['description' => 'HEI test role'],
    );

    return User::factory()->create([
        'role_id' => $role->id,
        'status' => $status,
    ]);
}

test('an inactive account cannot sign in with a password', function () {
    $user = inactiveTestUser('inactive');

    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ])->assertRedirect(route('login'));

    $this->assertGuest();
});

test('an active account can still sign in', function () {
    $user = inactiveTestUser('active');

    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ])->assertRedirect('/announcement');

    $this->assertAuthenticatedAs($user);
});

test('a wrong password still fails for an active account', function () {
    $user = inactiveTestUser('active');

    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'not-the-password',
    ])->assertSessionHasErrors('email');

    $this->assertGuest();
});

test('an account deactivated mid-session is signed out on its next request', function () {
    $user = inactiveTestUser('active');

    $this->actingAs($user)->get(route('dashboard'))->assertSuccessful();

    // An administrator switches the account off while it is still signed in.
    $user->forceFill(['status' => 'inactive'])->save();

    $this->get(route('dashboard'))->assertRedirect(route('login'));

    $this->assertGuest();
});

test('a delete by a deactivated account redirects with 303, not 302', function () {
    // Guards the middleware's position in the stack. Inertia rewrites a 302 into
    // a 303 for PUT/PATCH/DELETE so the browser re-requests with GET; if the
    // check ever moves outside Inertia's middleware, this DELETE would be
    // replayed against /login and blow up with a 405.
    $user = inactiveTestUser('inactive');

    $this->actingAs($user)
        ->delete(route('users.destroy', $user->id), [], ['X-Inertia' => 'true'])
        ->assertStatus(303);

    $this->assertGuest();
});

test('a session created outside the normal login path is still rejected', function () {
    // App\Http\Responses\LoginResponse catches the ordinary password login, but
    // it is not the response used after a two-factor challenge - that path
    // returns Fortify's own TwoFactorLoginResponse. Anything that establishes a
    // session without passing through LoginResponse has to be caught per
    // request instead, which is what this asserts.
    $user = inactiveTestUser('inactive');

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertRedirect(route('login'));

    $this->assertGuest();
});
