<?php

namespace App\Http\Responses;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Laravel\Fortify\Contracts\RegisterResponse as RegisterResponseContract;
use Laravel\Fortify\Fortify;

class RegisterResponse implements RegisterResponseContract
{
    /**
     * Create an HTTP response that represents the object.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Symfony\Component\HttpFoundation\Response
     */
    public function toResponse($request): JsonResponse|RedirectResponse
    {
        $user = $request->user();

        // If user is inactive (pending approval), log them out and redirect to login
        if ($user && $user->status === 'inactive') {
            auth()->logout();

            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->route('login')->with('status', 'Your account has been created successfully! Please wait for admin approval before you can log in.');
        }

        // For active users, redirect to dashboard (default behavior)
        return $request->wantsJson()
            ? new JsonResponse('', 201)
            : redirect(Fortify::redirects('register', '/dashboard'));
    }
}
