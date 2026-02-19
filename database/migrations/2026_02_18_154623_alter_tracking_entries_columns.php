<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liquidation_tracking_entries', function (Blueprint $table) {
            $table->text('received_by')->nullable()->change();
            $table->text('reviewed_by')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('liquidation_tracking_entries', function (Blueprint $table) {
            $table->string('received_by')->nullable()->change();
            $table->string('reviewed_by')->nullable()->change();
        });
    }
};
