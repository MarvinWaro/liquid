<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // First drop the old enum column
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('region');
        });

        // Add the new foreign key column
        Schema::table('users', function (Blueprint $table) {
            $table->uuid('region_id')->nullable()->after('hei_id');
            $table->foreign('region_id')->references('id')->on('regions')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['region_id']);
            $table->dropColumn('region_id');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->enum('region', ['region_12', 'barmm_b'])->nullable()->after('hei_id');
        });
    }
};
