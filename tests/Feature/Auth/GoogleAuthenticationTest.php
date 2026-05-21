<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;

uses(RefreshDatabase::class);

function fakeGoogleUser(?string $email): SocialiteUser
{
    return (new SocialiteUser)->map([
        'id' => 'google-user-id',
        'name' => 'Google User',
        'email' => $email,
        'avatar' => null,
    ]);
}

test('google sign in redirects to google authorization', function () {
    Socialite::fake('google', fakeGoogleUser('user@example.com'));

    $this->get(route('auth.google.redirect'))
        ->assertRedirect('https://socialite.fake/google/authorize');
});

test('google callback authenticates an existing active user', function () {
    $user = User::factory()->create([
        'email' => 'user@example.com',
        'status' => 'active',
    ]);

    Socialite::fake('google', fakeGoogleUser($user->email));

    $response = $this->get(route('auth.google.callback'));

    $response->assertRedirect();
    $this->assertAuthenticatedAs($user);
});

test('google callback rejects unknown users', function () {
    Socialite::fake('google', fakeGoogleUser('unknown@example.com'));

    $response = $this->get(route('auth.google.callback'));

    $response->assertRedirect(route('login'));
    $response->assertSessionHas('google_auth_error');
    $response->assertSessionHasErrors('email');
    $this->assertGuest();
});

test('google callback rejects inactive users', function () {
    $user = User::factory()->create([
        'email' => 'inactive@example.com',
        'status' => 'inactive',
    ]);

    Socialite::fake('google', fakeGoogleUser($user->email));

    $response = $this->get(route('auth.google.callback'));

    $response->assertRedirect(route('login'));
    $response->assertSessionHas('google_auth_error');
    $response->assertSessionHasErrors('email');
    $this->assertGuest();
});
