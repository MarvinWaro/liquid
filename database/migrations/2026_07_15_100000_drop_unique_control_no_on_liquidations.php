<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Control/Ledger numbers are DV/batch-level identifiers shared by many
     * HEIs in the same disbursement, so they are not globally unique.
     * Exact-duplicate rows are still blocked at import time via the
     * disbursement fingerprint check (see LiquidationController::parseImportRow).
     */
    public function up(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropUnique(['control_no']);
            $table->index('control_no');
        });
    }

    public function down(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropIndex(['control_no']);
            $table->unique('control_no');
        });
    }
};
