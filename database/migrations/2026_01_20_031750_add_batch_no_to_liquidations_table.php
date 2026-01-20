<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('liquidations', function (Blueprint $table) {
            // Adding batch_no as a string (e.g., "Batch 1", "2024-B1")
            $table->string('batch_no')->nullable()->after('control_no');
        });
    }

    public function down()
    {
        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropColumn('batch_no');
        });
    }
};
