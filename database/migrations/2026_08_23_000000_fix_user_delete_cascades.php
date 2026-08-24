<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Stop a user deletion from destroying liquidation history.
 *
 * `liquidations.created_by` cascaded, so removing one account wiped every
 * liquidation that account created — and with it the documents, beneficiaries,
 * financials, comments, reviews and transmittals hanging off those rows.
 * `Liquidation` uses SoftDeletes, but a database-level cascade never consults
 * `deleted_at`, so the records were gone for good.
 *
 * `created_by` is nullable and every reader is already null-safe
 * (`$liquidation->creator?->name`), so it becomes SET NULL. The other two
 * columns are NOT NULL and cannot be nulled, so they become RESTRICT — a
 * constraint that can only refuse, never destroy.
 *
 * The controllers block the delete long before MySQL is asked (see
 * User::deletionBlockers()); this is the net for any path that skips them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
        });

        Schema::table('liquidation_reviews', function (Blueprint $table) {
            $table->dropForeign(['performed_by']);
            $table->foreign('performed_by')->references('id')->on('users')->restrictOnDelete();
        });

        Schema::table('liquidation_transmittals', function (Blueprint $table) {
            $table->dropForeign(['endorsed_by']);
            $table->foreign('endorsed_by')->references('id')->on('users')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->foreign('created_by')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::table('liquidation_reviews', function (Blueprint $table) {
            $table->dropForeign(['performed_by']);
            $table->foreign('performed_by')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::table('liquidation_transmittals', function (Blueprint $table) {
            $table->dropForeign(['endorsed_by']);
            $table->foreign('endorsed_by')->references('id')->on('users')->cascadeOnDelete();
        });
    }
};
