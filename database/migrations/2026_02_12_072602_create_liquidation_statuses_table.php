<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Create liquidation_statuses lookup table and migrate existing ENUM data.
 *
 * Normalizes the liquidation_status ENUM column into a proper FK reference,
 * following the same pattern as document_statuses.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Step 1: Create lookup table
        Schema::create('liquidation_statuses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 30)->unique();
            $table->string('name', 80);
            $table->string('description')->nullable();
            $table->string('badge_color', 20)->default('gray');
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Step 2: Seed default values
        $now = now();
        $statuses = [
            ['code' => 'UNLIQUIDATED', 'name' => 'Unliquidated', 'badge_color' => 'red', 'sort_order' => 1],
            ['code' => 'PARTIALLY_LIQUIDATED', 'name' => 'Partially Liquidated', 'badge_color' => 'yellow', 'sort_order' => 2],
            ['code' => 'FULLY_LIQUIDATED', 'name' => 'Fully Liquidated', 'badge_color' => 'green', 'sort_order' => 3],
        ];

        foreach ($statuses as $status) {
            DB::table('liquidation_statuses')->insert([
                'id' => Str::uuid(),
                'code' => $status['code'],
                'name' => $status['name'],
                'badge_color' => $status['badge_color'],
                'sort_order' => $status['sort_order'],
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // Step 3: Add FK column to liquidations
        Schema::table('liquidations', function (Blueprint $table) {
            $table->uuid('liquidation_status_id')->nullable()->after('document_status_id');
        });

        // Step 4: Migrate existing ENUM values to FK IDs
        $statusMap = DB::table('liquidation_statuses')->pluck('id', 'name')->toArray();

        // Map old ENUM values to new lookup names
        $enumToNameMap = [
            'Unliquidated' => 'Unliquidated',
            'Partially Liquidated - Endorsed to Accounting' => 'Partially Liquidated',
            'Fully Liquidated - Endorsed to Accounting' => 'Fully Liquidated',
        ];

        foreach ($enumToNameMap as $enumValue => $lookupName) {
            if (isset($statusMap[$lookupName])) {
                DB::table('liquidations')
                    ->where('liquidation_status', $enumValue)
                    ->update(['liquidation_status_id' => $statusMap[$lookupName]]);
            }
        }

        // Set any remaining NULLs to Unliquidated
        $unliquidatedId = $statusMap['Unliquidated'] ?? null;
        if ($unliquidatedId) {
            DB::table('liquidations')
                ->whereNull('liquidation_status_id')
                ->update(['liquidation_status_id' => $unliquidatedId]);
        }

        // Step 5: Drop old ENUM column
        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropColumn('liquidation_status');
        });

        // Step 6: Add FK constraint and index
        Schema::table('liquidations', function (Blueprint $table) {
            $table->foreign('liquidation_status_id')
                ->references('id')
                ->on('liquidation_statuses')
                ->onDelete('set null');

            $table->index('liquidation_status_id', 'idx_liquidations_liq_status');
        });
    }

    public function down(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropForeign(['liquidation_status_id']);
            $table->dropIndex('idx_liquidations_liq_status');
        });

        // Re-add ENUM column
        Schema::table('liquidations', function (Blueprint $table) {
            $table->enum('liquidation_status', [
                'Unliquidated',
                'Partially Liquidated - Endorsed to Accounting',
                'Fully Liquidated - Endorsed to Accounting',
            ])->default('Unliquidated')->after('document_status_id');
        });

        // Migrate data back
        $statusMap = DB::table('liquidation_statuses')->pluck('name', 'id')->toArray();
        $nameToEnumMap = [
            'Unliquidated' => 'Unliquidated',
            'Partially Liquidated' => 'Partially Liquidated - Endorsed to Accounting',
            'Fully Liquidated' => 'Fully Liquidated - Endorsed to Accounting',
        ];

        foreach (DB::table('liquidations')->whereNotNull('liquidation_status_id')->get(['id', 'liquidation_status_id']) as $row) {
            $name = $statusMap[$row->liquidation_status_id] ?? 'Unliquidated';
            $enumValue = $nameToEnumMap[$name] ?? 'Unliquidated';
            DB::table('liquidations')->where('id', $row->id)->update(['liquidation_status' => $enumValue]);
        }

        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropColumn('liquidation_status_id');
        });

        Schema::dropIfExists('liquidation_statuses');
    }
};
