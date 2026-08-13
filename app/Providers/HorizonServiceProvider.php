<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Laravel\Horizon\HorizonApplicationServiceProvider;

class HorizonServiceProvider extends HorizonApplicationServiceProvider
{
    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        parent::boot();

        // Horizon::routeSmsNotificationsTo('15556667777');
        // Horizon::routeMailNotificationsTo('example@example.com');
        // Horizon::routeSlackNotificationsTo('slack-webhook-url', '#channel');
    }

    /**
     * Who may open the Horizon dashboard in non-local environments.
     *
     * Horizon ships with a hardcoded email allow-list, which drifts the moment
     * someone changes their address or a new admin joins. This uses the same
     * role check as the Queue Health page instead, so access follows the user
     * record rather than a list nobody remembers to update.
     *
     * Deliberately Super Admin only, not a permission: Horizon exposes full job
     * payloads and stack traces, which carry record ids and internal paths. That
     * should not be grantable by editing a role.
     */
    protected function gate(): void
    {
        Gate::define('viewHorizon', function (?User $user = null) {
            return (bool) $user?->isSuperAdmin();
        });
    }
}
