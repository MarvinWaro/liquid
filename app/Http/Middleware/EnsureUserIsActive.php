<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Turns "Inactive" into a real off-switch.
 *
 * App\Http\Responses\LoginResponse already refuses an inactive account at the
 * ordinary password login, but that response only runs on that one path. It does
 * not cover a session that is already open when an administrator deactivates the
 * account, and it is not the response used after a two-factor challenge - that
 * path returns Fortify's own TwoFactorLoginResponse.
 *
 * Checking once per request covers every route without having to enumerate
 * them. User Management points admins here ("Deactivate the account instead of
 * deleting it"), so the switch has to actually hold.
 */
class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // Tests for an explicit 'inactive' rather than "not active", matching
        // App\Http\Responses\LoginResponse and RegisterResponse. The column is a
        // non-null enum, so those are the only two values a real row holds; an
        // absent status means an unhydrated model, which is a code artifact and
        // no reason to sign a legitimate user out.
        if ($user && $user->status === 'inactive') {
            Auth::logout();

            $request->session()->invalidate();
            $request->session()->regenerateToken();

            // 'status' rather than an error bag: the login page already renders
            // this channel, so no frontend change is needed.
            return redirect()->route('login')->with(
                'status',
                'Your account has been deactivated. Please contact your administrator.',
            );
        }

        return $next($request);
    }
}
