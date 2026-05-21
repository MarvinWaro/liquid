<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Fortify\Features;

uses(RefreshDatabase::class);

beforeEach(function () {
    config()->set('services.turnstile.enabled', false);
});

test('login screen can be rendered', function () {
    $response = $this->get(route('login'));

    $response->assertStatus(200);
});

test('login screen includes turnstile settings when enabled', function () {
    config()->set('services.turnstile.enabled', true);
    config()->set('services.turnstile.site_key', 'site-key');
    config()->set('services.turnstile.secret_key', 'secret-key');

    $this->get(route('login'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/login')
            ->where('turnstile.enabled', true)
            ->where('turnstile.siteKey', 'site-key')
        );
});

test('users can authenticate using the login screen', function () {
    $user = User::factory()->create();

    $response = $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $this->assertAuthenticated();
    $response->assertRedirect(route('dashboard', absolute: false));
});

test('turnstile token is required when enabled', function () {
    config()->set('services.turnstile.enabled', true);
    config()->set('services.turnstile.site_key', 'site-key');
    config()->set('services.turnstile.secret_key', 'secret-key');

    Http::fake();

    $user = User::factory()->create();

    $response = $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $this->assertGuest();
    $response->assertSessionHasErrors('cf-turnstile-response');
    Http::assertNothingSent();
});

test('users can authenticate when turnstile verification passes', function () {
    config()->set('services.turnstile.enabled', true);
    config()->set('services.turnstile.site_key', 'site-key');
    config()->set('services.turnstile.secret_key', 'secret-key');
    config()->set('services.turnstile.verify_url', 'https://turnstile.test/siteverify');

    Http::fake([
        'https://turnstile.test/siteverify' => Http::response(['success' => true]),
    ]);

    $user = User::factory()->create();

    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
        'cf-turnstile-response' => 'valid-token',
    ]);

    $this->assertAuthenticated();
    Http::assertSentCount(1);
});

test('users can not authenticate when turnstile verification fails', function () {
    config()->set('services.turnstile.enabled', true);
    config()->set('services.turnstile.site_key', 'site-key');
    config()->set('services.turnstile.secret_key', 'secret-key');
    config()->set('services.turnstile.verify_url', 'https://turnstile.test/siteverify');

    Http::fake([
        'https://turnstile.test/siteverify' => Http::response([
            'success' => false,
            'error-codes' => ['invalid-input-response'],
        ]),
    ]);

    $user = User::factory()->create();

    $response = $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
        'cf-turnstile-response' => 'invalid-token',
    ]);

    $this->assertGuest();
    $response->assertSessionHasErrors('cf-turnstile-response');
});

test('users with two factor enabled are redirected to two factor challenge', function () {
    if (! Features::canManageTwoFactorAuthentication()) {
        $this->markTestSkipped('Two-factor authentication is not enabled.');
    }

    Features::twoFactorAuthentication([
        'confirm' => true,
        'confirmPassword' => true,
    ]);

    $user = User::factory()->create();

    $user->forceFill([
        'two_factor_secret' => encrypt('test-secret'),
        'two_factor_recovery_codes' => encrypt(json_encode(['code1', 'code2'])),
        'two_factor_confirmed_at' => now(),
    ])->save();

    $response = $this->post(route('login'), [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $response->assertRedirect(route('two-factor.login'));
    $response->assertSessionHas('login.id', $user->id);
    $this->assertGuest();
});

test('users can not authenticate with invalid password', function () {
    $user = User::factory()->create();

    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'wrong-password',
    ]);

    $this->assertGuest();
});

test('users can logout', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('logout'));

    $this->assertGuest();
    $response->assertRedirect(route('home'));
});

test('users are rate limited', function () {
    $user = User::factory()->create();

    RateLimiter::increment(md5('login'.implode('|', [$user->email, '127.0.0.1'])), amount: 5);

    $response = $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'wrong-password',
    ]);

    $response->assertTooManyRequests();
});
