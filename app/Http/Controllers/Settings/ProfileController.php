<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

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
                Storage::disk('s3')->delete($user->avatar);
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
            Storage::disk('s3')->delete($user->avatar);
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

        if ($user->avatar) {
            Storage::disk('s3')->delete($user->avatar);
        }

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
