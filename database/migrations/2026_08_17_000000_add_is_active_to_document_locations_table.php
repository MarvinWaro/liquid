<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Archiving for shelf locations.
 *
 * A location cannot simply be deleted once liquidations are filed against it:
 * `liquidation_transmittals.document_location_id` is ON DELETE SET NULL and the
 * `liquidation_tracking_entry_locations` pivot is ON DELETE CASCADE, so removing
 * a shelf silently blanks transmittals and destroys tracking rows. Archiving
 * retires a shelf from the picker while every historical record keeps pointing
 * at something real.
 *
 * Boolean rather than Region's status enum: this mirrors Semester, which shares
 * the same name + sort_order shape and is the module this CRUD is modelled on.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_locations', function (Blueprint $table) {
            // Existing rows — and the ones bulk import auto-creates — are active.
            $table->boolean('is_active')->default(true)->after('sort_order');
        });
    }

    public function down(): void
    {
        Schema::table('document_locations', function (Blueprint $table) {
            $table->dropColumn('is_active');
        });
    }
};
