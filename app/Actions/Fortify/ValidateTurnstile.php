<?php

namespace App\Actions\Fortify;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Throwable;

class ValidateTurnstile
{
    /**
     * Validate Cloudflare Turnstile before Fortify attempts authentication.
     */
    public function handle(Request $request, callable $next): mixed
    {
        if (! (bool) config('services.turnstile.enabled')) {
            return $next($request);
        }

        $secretKey = config('services.turnstile.secret_key');

        if (! filled($secretKey)) {
            Log::error('Turnstile is enabled, but TURNSTILE_SECRET_KEY is missing.');

            throw ValidationException::withMessages([
                'cf-turnstile-response' => 'Human verification is not configured. Please contact the administrator.',
            ]);
        }

        $request->validate([
            'cf-turnstile-response' => ['required', 'string', 'max:2048'],
        ], [
            'cf-turnstile-response.required' => 'Please complete the security check.',
        ]);

        try {
            // The call to Cloudflare drops intermittently from here — the logs
            // show repeated "cURL error 35: Connection was reset" during a TLS
            // handshake that succeeds seconds later. That is a transport hiccup,
            // not a bad token, so retrying is the correct response; surfacing it
            // turned a working password into "we could not verify" and left the
            // user refreshing the page to get in.
            //
            // Three attempts roughly 300ms apart. Worst case adds well under a
            // second to a login, and only on a connection that was going to fail
            // outright before.
            $response = Http::asForm()
                ->connectTimeout(5)
                ->timeout(10)
                ->retry(3, 300)
                ->post(config('services.turnstile.verify_url'), [
                    'secret' => $secretKey,
                    'response' => $request->input('cf-turnstile-response'),
                    'remoteip' => $request->ip(),
                ]);
        } catch (Throwable $exception) {
            Log::warning('Turnstile validation request failed after retries.', [
                'message' => $exception->getMessage(),
            ]);

            throw ValidationException::withMessages([
                'cf-turnstile-response' => 'Could not reach the security check just now. The box below has refreshed — please press Log in again.',
            ]);
        }

        if (! $response->ok() || ! (bool) data_get($response->json(), 'success')) {
            Log::info('Turnstile validation failed.', [
                'status' => $response->status(),
                'error_codes' => data_get($response->json(), 'error-codes', []),
            ]);

            // Usually an expired or already-used token: each one is valid for a
            // single check and for a few minutes only. The widget resets itself
            // on this error, so the wording points at the one thing that works
            // rather than leaving the user to guess.
            throw ValidationException::withMessages([
                'cf-turnstile-response' => 'The security check expired. It has refreshed below — please press Log in again.',
            ]);
        }

        return $next($request);
    }
}
