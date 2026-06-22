<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Models\ActivityLog;
use Illuminate\Auth\Events\Login;

class LogSuccessfulLogin
{
    /**
     * Record an activity log entry whenever a user signs in.
     * Fires for both the Fortify form login and the Google OAuth login,
     * since both end with Auth::login() dispatching the Login event.
     */
    public function handle(Login $event): void
    {
        $name = $event->user->name ?? 'Unknown user';

        ActivityLog::log(
            action: 'login',
            description: $name.' logged in',
            module: 'Authentication',
        );
    }
}
