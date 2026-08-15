<?php

use App\Http\Controllers\Settings\PasswordController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\QueueHealthController;
use App\Http\Controllers\Settings\ServerLogController;
use App\Http\Controllers\Settings\TwoFactorAuthenticationController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::redirect('settings', '/settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
    Route::delete('settings/profile/avatar', [ProfileController::class, 'destroyAvatar'])->name('profile.avatar.destroy');

    Route::get('settings/password', [PasswordController::class, 'edit'])->name('user-password.edit');

    Route::put('settings/password', [PasswordController::class, 'update'])
        ->middleware('throttle:6,1')
        ->name('user-password.update');

    Route::get('settings/appearance', function () {
        return Inertia::render('settings/appearance');
    })->name('appearance.edit');

    Route::get('settings/two-factor', [TwoFactorAuthenticationController::class, 'show'])
        ->name('two-factor.show');

    // Queue health — Super Admin only, enforced in the controller rather than by
    // a permission so it cannot be granted away by editing a role.
    Route::get('settings/queue-health', [QueueHealthController::class, 'index'])
        ->name('queue-health.index');
    Route::post('settings/queue-health/{uuid}/retry', [QueueHealthController::class, 'retry'])
        ->name('queue-health.retry');
    Route::delete('settings/queue-health/{uuid}', [QueueHealthController::class, 'forget'])
        ->name('queue-health.forget');

    // Server logs — read-only, Super Admin only, enforced in the controller for
    // the same reason as queue health above.
    Route::get('settings/server-logs', [ServerLogController::class, 'index'])
        ->name('server-logs.index');
    Route::get('settings/server-logs/download', [ServerLogController::class, 'download'])
        ->name('server-logs.download');
});
