<?php

namespace App\Providers;

use App\Models\ImportBatch;
use App\Models\Liquidation;
use App\Models\LiquidationDocument;
use App\Observers\ImportBatchObserver;
use App\Observers\LiquidationDocumentObserver;
use App\Policies\LiquidationPolicy;
use App\Services\HtmlSanitizer;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Assembling HTMLPurifier's definition is costly, so share one instance
        // rather than rebuilding it for every announcement saved.
        $this->app->singleton(HtmlSanitizer::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::policy(Liquidation::class, LiquidationPolicy::class);

        // Auto-delete persisted S3 files when their owning row is deleted.
        // Catches deletes from any path: model->delete(), cascade, factory
        // tearDown, raw queries dispatched through Eloquent, etc.
        ImportBatch::observe(ImportBatchObserver::class);
        LiquidationDocument::observe(LiquidationDocumentObserver::class);

        // Note: LogSuccessfulLogin / LogSuccessfulLogout listeners in
        // app/Listeners are auto-discovered by Laravel from their handle()
        // type-hints, so no manual Event::listen() registration is needed here
        // (registering them again would fire — and log — each event twice).

        // Block destructive Artisan commands (db:wipe, migrate:fresh,
        // migrate:refresh, migrate:rollback) in production ONLY.
        // - Production (APP_ENV=production): prohibition active → can't wipe.
        // - Local/staging/testing: prohibition off → RefreshDatabase works,
        //   you can still run migrate:fresh locally when needed.
        // If you ever need to genuinely reset production (decommissioning),
        // temporarily flip APP_ENV or comment this line, run the command,
        // then restore.
        // DB::prohibitDestructiveCommands($this->app->isProduction());
    }
}
