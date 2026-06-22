<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Models\ActivityLog;
use Illuminate\Auth\Events\Logout;

class LogSuccessfulLogout
{
    /**
     * Record an activity log entry whenever a user signs out.
     * The guard still exposes auth()->user() at dispatch time (it clears the
     * user only after firing this event), so ActivityLog::log() stamps the
     * correct user_id / user_name.
     */
    public function handle(Logout $event): void
    {
        if (! $event->user) {
            return;
        }

        $name = $event->user->name ?? 'Unknown user';

        ActivityLog::log(
            action: 'logout',
            description: $name.' logged out',
            module: 'Authentication',
        );
    }
}
