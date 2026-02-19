<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liquidation_running_data', function (Blueprint $table) {
            $table->decimal('total_amount_liquidated', 15, 2)->nullable()->after('refund_or_no');
        });
    }

    public function down(): void
    {
        Schema::table('liquidation_running_data', function (Blueprint $table) {
            $table->dropColumn('total_amount_liquidated');
        });
    }
};
