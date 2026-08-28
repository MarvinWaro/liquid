<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Fortify\PasswordValidationRules;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * The first-login password prompt.
 *
 * Administrators provision every account by hand, so a new user signs in on a
 * password somebody else chose and still knows. This asks them to replace it the
 * first time they arrive.
 *
 * No current_password field, unlike Settings\PasswordController: the user typed
 * that password seconds ago to get here, and it is the very value we are trying
 * to retire, so re-typing it proves nothing and only adds friction to a step they
 * did not choose to start.
 */
class InitialPasswordController extends Controller
{
    use PasswordValidationRules;

    /**
     * Session flag set by "Skip for now". Session-scoped on purpose - it dies
     * with the session, so the prompt returns at the user's next login rather
     * than being dismissed permanently.
     */
    public const POSTPONED_SESSION_KEY = 'initial_password_postponed';

    /**
     * Store a password the user has chosen for themselves.
     */
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'password' => $this->passwordRules(),
        ]);

        $request->user()->changePassword($validated['password']);

        // Nothing left to postpone.
        $request->session()->forget(self::POSTPONED_SESSION_KEY);

        return back()->with('success', 'Password updated.');
    }

    /**
     * Dismiss the prompt for the rest of this session.
     */
    public function postpone(Request $request): RedirectResponse
    {
        $request->session()->put(self::POSTPONED_SESSION_KEY, true);

        return back();
    }
}
