<?php

use App\Models\LiquidationStatus;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Insert VOIDED status into the lookup table
        LiquidationStatus::updateOrCreate(
            ['code' => 'VOIDED'],
            [
                'name'        => 'Voided',
                'description' => 'Record has been voided by an administrator',
                'badge_color' => 'gray',
                'sort_order'  => 99,
                'is_active'   => true,
            ]
        );
    }

    public function down(): void
    {
        LiquidationStatus::where('code', 'VOIDED')->delete();
    }
};
