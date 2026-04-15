<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liquidation_tracking_entries', function (Blueprint $table) {
            $table->unsignedInteger('sort_order')->default(0)->after('liquidation_status_id');
        });

        // Backfill existing rows: assign sort_order by created_at within each liquidation
        $entries = \DB::table('liquidation_tracking_entries')
            ->orderBy('liquidation_id')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        $groups = $entries->groupBy('liquidation_id');
        foreach ($groups as $rows) {
            foreach ($rows->values() as $index => $row) {
                \DB::table('liquidation_tracking_entries')
                    ->where('id', $row->id)
                    ->update(['sort_order' => $index]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('liquidation_tracking_entries', function (Blueprint $table) {
            $table->dropColumn('sort_order');
        });
    }
};
