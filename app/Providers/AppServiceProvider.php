<?php

namespace App\Providers;

use App\Models\ImportBatch;
use App\Models\LiquidationDocument;
use App\Observers\ImportBatchObserver;
use App\Observers\LiquidationDocumentObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Auto-delete persisted S3 files when their owning row is deleted.
        // Catches deletes from any path: model->delete(), cascade, factory
        // tearDown, raw queries dispatched through Eloquent, etc.
        ImportBatch::observe(ImportBatchObserver::class);
        LiquidationDocument::observe(LiquidationDocumentObserver::class);
    }
}
