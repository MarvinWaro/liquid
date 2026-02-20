<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_locations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name')->unique();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // Now that document_locations exists, add the FK constraint on transmittals
        Schema::table('liquidation_transmittals', function (Blueprint $table) {
            $table->foreign('document_location_id', 'fk_transmittals_location')
                ->references('id')
                ->on('document_locations')
                ->onDelete('set null');
        });

        // Pivot table linking tracking entries to their document locations (many-to-many)
        // Created here because document_locations must exist before the FK can reference it.
        Schema::create('liquidation_tracking_entry_locations', function (Blueprint $table) {
            $table->uuid('tracking_entry_id');
            $table->uuid('document_location_id');
            $table->integer('sort_order')->default(0);

            $table->primary(['tracking_entry_id', 'document_location_id']);
            // Explicit short names to stay within MySQL's 64-char identifier limit
            $table->foreign('tracking_entry_id', 'fk_ltel_entry')
                ->references('id')->on('liquidation_tracking_entries')->onDelete('cascade');
            $table->foreign('document_location_id', 'fk_ltel_location')
                ->references('id')->on('document_locations')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        // Drop FK constraints referencing document_locations before dropping the table
        Schema::table('liquidation_transmittals', function (Blueprint $table) {
            $table->dropForeign('fk_transmittals_location');
        });

        // Drop pivot first (also has FK to document_locations)
        Schema::dropIfExists('liquidation_tracking_entry_locations');
        Schema::dropIfExists('document_locations');
    }
};
