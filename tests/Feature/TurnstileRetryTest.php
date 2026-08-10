<?php

use App\Actions\Fortify\ValidateTurnstile;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    config()->set('services.turnstile.enabled', true);
    config()->set('services.turnstile.secret_key', 'test-secret');
    config()->set('services.turnstile.verify_url', 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
});

function turnstileRequest(): Request
{
    return Request::create('/login', 'POST', ['cf-turnstile-response' => 'token-abc']);
}

it('recovers when the first attempt to Cloudflare is reset mid-handshake', function () {
    // The exact failure in the production logs: cURL error 35, then it works.
    $attempts = 0;

    Http::fake(function () use (&$attempts) {
        $attempts++;

        if ($attempts === 1) {
            throw new ConnectionException('cURL error 35: Recv failure: Connection was reset');
        }

        return Http::response(['success' => true], 200);
    });

    $reached = false;

    (new ValidateTurnstile)->handle(turnstileRequest(), function () use (&$reached) {
        $reached = true;

        return 'ok';
    });

    // Before the retry this surfaced as "we could not verify" and the user had
    // to refresh the page, even with a correct password.
    expect($reached)->toBeTrue()
        ->and($attempts)->toBe(2);
});

it('survives two consecutive connection resets', function () {
    $attempts = 0;

    Http::fake(function () use (&$attempts) {
        $attempts++;

        if ($attempts < 3) {
            throw new ConnectionException('cURL error 35: Recv failure: Connection was reset');
        }

        return Http::response(['success' => true], 200);
    });

    $reached = false;

    (new ValidateTurnstile)->handle(turnstileRequest(), function () use (&$reached) {
        $reached = true;

        return 'ok';
    });

    expect($reached)->toBeTrue()
        ->and($attempts)->toBe(3);
});

it('gives up after three attempts and tells the user what to do', function () {
    $attempts = 0;

    Http::fake(function () use (&$attempts) {
        $attempts++;

        throw new ConnectionException('cURL error 35: Recv failure: Connection was reset');
    });

    $caught = null;

    try {
        (new ValidateTurnstile)->handle(turnstileRequest(), fn () => 'ok');
    } catch (ValidationException $e) {
        $caught = $e;
    }

    expect($caught)->not->toBeNull()
        ->and($attempts)->toBe(3)
        ->and($caught->errors()['cf-turnstile-response'][0])
        ->toContain('press Log in again');
});

it('still rejects a genuinely bad token without retrying it away', function () {
    // A rejected token is a real answer from Cloudflare, not a transport
    // problem. Retrying would only delay the same result.
    Http::fake([
        '*' => Http::response(['success' => false, 'error-codes' => ['timeout-or-duplicate']], 200),
    ]);

    $caught = null;

    try {
        (new ValidateTurnstile)->handle(turnstileRequest(), fn () => 'ok');
    } catch (ValidationException $e) {
        $caught = $e;
    }

    expect($caught)->not->toBeNull()
        ->and($caught->errors()['cf-turnstile-response'][0])
        ->toContain('refreshed below');
});

it('lets everything through when Turnstile is switched off', function () {
    config()->set('services.turnstile.enabled', false);

    Http::fake();

    $reached = false;

    (new ValidateTurnstile)->handle(turnstileRequest(), function () use (&$reached) {
        $reached = true;

        return 'ok';
    });

    expect($reached)->toBeTrue();
    Http::assertNothingSent();
});
