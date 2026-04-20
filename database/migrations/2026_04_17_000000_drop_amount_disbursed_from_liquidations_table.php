<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropColumn('amount_disbursed');
        });
    }

    public function down(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            $table->decimal('amount_disbursed', 15, 2)->default(0)->after('batch_no');
        });
    }
};
