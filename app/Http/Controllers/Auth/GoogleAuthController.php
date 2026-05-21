<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Laravel\Fortify\Contracts\LoginResponse;
use Laravel\Fortify\Events\TwoFactorAuthenticationChallenged;
use Laravel\Fortify\Fortify;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class GoogleAuthController extends Controller
{
    public function redirect(): RedirectResponse
    {
        return Socialite::driver('google')->redirect();
    }

    public function callback(Request $request): Response
    {
        try {
            $googleUser = Socialite::driver('google')->user();
        } catch (Throwable $exception) {
            Log::warning('Google sign-in callback failed.', [
                'message' => $exception->getMessage(),
            ]);

            return $this->redirectToLoginWithGoogleError('Google sign-in could not be verified. Please try again.');
        }

        $email = $googleUser->getEmail();

        if (! $email) {
            return $this->redirectToLoginWithGoogleError('Google did not provide an email address for this account.');
        }

        $user = User::where('email', $email)->first();

        if (! $user || ! $user->isActive()) {
            return $this->redirectToLoginWithGoogleError(
                'No active user account is linked to that Google email. Please contact your administrator.'
            );
        }

        if ($this->requiresTwoFactorChallenge($user)) {
            $request->session()->put([
                'login.id' => $user->getKey(),
                'login.remember' => false,
            ]);

            TwoFactorAuthenticationChallenged::dispatch($user);

            return redirect()->route('two-factor.login');
        }

        Auth::login($user);

        $request->session()->regenerate();

        return app(LoginResponse::class)->toResponse($request);
    }

    private function requiresTwoFactorChallenge(User $user): bool
    {
        $usesTwoFactor = in_array(TwoFactorAuthenticatable::class, class_uses_recursive($user), true);

        if (! $usesTwoFactor || ! $user->two_factor_secret) {
            return false;
        }

        if (Fortify::confirmsTwoFactorAuthentication()) {
            return ! is_null($user->two_factor_confirmed_at);
        }

        return true;
    }

    private function redirectToLoginWithGoogleError(string $message): RedirectResponse
    {
        return redirect()->route('login')
            ->with('google_auth_error', $message)
            ->withErrors(['email' => $message]);
    }
}
