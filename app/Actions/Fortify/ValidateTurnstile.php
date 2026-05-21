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
            $response = Http::asForm()
                ->timeout(5)
                ->post(config('services.turnstile.verify_url'), [
                    'secret' => $secretKey,
                    'response' => $request->input('cf-turnstile-response'),
                    'remoteip' => $request->ip(),
                ]);
        } catch (Throwable $exception) {
            Log::warning('Turnstile validation request failed.', [
                'message' => $exception->getMessage(),
            ]);

            throw ValidationException::withMessages([
                'cf-turnstile-response' => 'We could not verify the security check. Please try again.',
            ]);
        }

        if (! $response->ok() || ! (bool) data_get($response->json(), 'success')) {
            Log::info('Turnstile validation failed.', [
                'status' => $response->status(),
                'error_codes' => data_get($response->json(), 'error-codes', []),
            ]);

            throw ValidationException::withMessages([
                'cf-turnstile-response' => 'Security check failed. Please try again.',
            ]);
        }

        return $next($request);
    }
}
