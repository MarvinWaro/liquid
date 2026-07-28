<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Bulk import moved from a synchronous chunk loop to a queued job, so a batch
 * now has a lifetime beyond the request that created it:
 *
 *   processing → active   (job finished)
 *   processing → failed   (job threw; failed_reason explains why)
 *   active     → undone   (unchanged)
 *
 * The batch row doubles as the progress record — imported_count / total_rows are
 * polled by the client — which is what lets progress survive a page refresh.
 *
 * `status` becomes a plain string rather than a widened enum. MySQL enums need
 * raw ALTERs and SQLite enforces them as CHECK constraints that can only be
 * changed by rebuilding the table, so every future status would mean another
 * migration. The allowed values live on the model as ImportBatch::STATUS_*.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('import_batches', function (Blueprint $table) {
            $table->string('status', 20)->default('active')->change();
            $table->text('failed_reason')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        // Collapse the new states into an existing value first — the restored
        // enum/CHECK would reject anything else.
        DB::table('import_batches')
            ->whereIn('status', ['processing', 'failed'])
            ->update(['status' => 'active']);

        Schema::table('import_batches', function (Blueprint $table) {
            $table->enum('status', ['active', 'undone'])->default('active')->change();
            $table->dropColumn('failed_reason');
        });
    }
};
