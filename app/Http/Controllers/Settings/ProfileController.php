<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class ProfileController extends Controller
{
    /**
     * Show the user's profile settings page.
     */
    public function edit(Request $request): Response
    {
        $user = $request->user()->loadMissing(['role', 'hei', 'region', 'program', 'programs']);

        $programs = $user->programs->isNotEmpty()
            ? $user->programs->pluck('name')->all()
            : ($user->program ? [$user->program->name] : []);

        return Inertia::render('settings/profile', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
            'accountDetails' => [
                'role' => $user->role?->name,
                'status' => $user->status,
                'hei' => $user->hei ? [
                    'name' => $user->hei->name,
                    'uii' => $user->hei->uii,
                ] : null,
                'region' => $user->region?->name,
                'programs' => $programs,
                'member_since' => $user->created_at?->timezone('Asia/Manila')->format('M d, Y'),
                'email_verified' => $user->email_verified_at !== null,
            ],
        ]);
    }

    /**
     * Update the user's profile settings.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $user = $request->user();

        if ($request->hasFile('avatar')) {
            if ($user->avatar) {
                $this->forgetAvatarFile($user->avatar);
            }

            $path = $request->file('avatar')->store('avatars', 's3');
            $user->avatar = $path;
        }

        $user->fill($request->safe()->only(['name', 'email']));

        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        $user->save();

        Cache::forget('users:regional_coordinators');
        Cache::forget('users:accountants');

        return to_route('profile.edit');
    }

    /**
     * Remove the user's avatar.
     */
    public function destroyAvatar(Request $request): RedirectResponse
    {
        $user = $request->user();

        if ($user->avatar) {
            $this->forgetAvatarFile($user->avatar);
            $user->avatar = null;
            $user->save();

            Cache::forget('users:regional_coordinators');
            Cache::forget('users:accountants');
        }

        return to_route('profile.edit');
    }

    /**
     * Delete the user's account.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();

        // Checked before logout so a blocked user is not signed out for nothing.
        // Same rule as User Management: an account that authored liquidations,
        // uploads, reviews or transmittals keeps its history and is deactivated
        // by an administrator instead of deleted.
        if ($blockers = $user->describeDeletionBlockers()) {
            return to_route('profile.edit')->with(
                'error',
                "Your account is attached to {$blockers} and cannot be deleted. Ask an administrator to deactivate it instead."
            );
        }

        if ($user->avatar) {
            $this->forgetAvatarFile($user->avatar);
        }

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }

    /**
     * Remove an old avatar from storage, tolerating a file that is no longer there.
     *
     * The s3 disk is configured with 'throw' => true (config/filesystems.php), so a
     * failed delete raises UnableToDeleteFile instead of returning false. That made
     * a stale avatar path fatal: replacing your picture would 500 and the profile —
     * name and email included — could not be saved at all.
     *
     * Deleting the previous file is cleanup. Whether it succeeds has no bearing on
     * whether the user's new details are valid, so it must never abort the request.
     * Still logged, so a genuinely misconfigured bucket surfaces rather than every
     * failure disappearing quietly.
     *
     * Scoped to avatars on purpose. The same unguarded call exists elsewhere for
     * liquidation documents, where losing a file silently would matter more and
     * deserves its own think.
     */
    private function forgetAvatarFile(?string $path): void
    {
        if (! $path) {
            return;
        }

        try {
            Storage::disk('s3')->delete($path);
        } catch (Throwable $e) {
            Log::warning('Could not delete old avatar; continuing.', [
                'path' => $path,
                'message' => $e->getMessage(),
            ]);
        }
    }
}
