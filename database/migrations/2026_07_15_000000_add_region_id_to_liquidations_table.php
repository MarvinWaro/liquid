<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            $table->uuid('region_id')->nullable()->after('hei_id')
                ->comment('Region the record was processed under (snapshot at creation; survives HEI region transfers)');
            $table->foreign('region_id')->references('id')->on('regions')->onDelete('set null');
            $table->index('region_id');
        });

        // Backfill from the HEI's current region: everything created before this
        // migration was processed under the region the HEI belongs to today.
        DB::statement(
            'UPDATE liquidations SET region_id = (SELECT region_id FROM heis WHERE heis.id = liquidations.hei_id)'
        );
    }

    public function down(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropForeign(['region_id']);
            $table->dropIndex(['region_id']);
            $table->dropColumn('region_id');
        });
    }
};
