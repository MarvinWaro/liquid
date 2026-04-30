<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-ledger grantee breakdown for legacy STUFAPS imports.
 *
 * Some Excel rows describe a single billing tracked under multiple ledger
 * numbers, where the NUMBER OF GRANTEES cell holds N values stacked
 * vertically (one per ledger). `number_of_grantees` continues to hold the
 * sum; this column preserves the original {ledger -> grantees} pairs so the
 * UI can show the breakdown.
 *
 * NULL for the common single-ledger case → behaviour is unchanged for the
 * vast majority of rows.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liquidation_financials', function (Blueprint $table) {
            $table->json('ledger_breakdown')->nullable()->after('number_of_grantees');
        });
    }

    public function down(): void
    {
        Schema::table('liquidation_financials', function (Blueprint $table) {
            $table->dropColumn('ledger_breakdown');
        });
    }
};
