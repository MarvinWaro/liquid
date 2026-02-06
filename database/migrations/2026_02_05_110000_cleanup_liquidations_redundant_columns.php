<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Columns to remove from liquidations table.
     * These are now stored in separate normalized tables:
     * - liquidation_transmittals
     * - liquidation_reviews
     * - liquidation_compliance
     */
    private array $columnsToRemove = [
        // Transmittal data → now in liquidation_transmittals
        'transmittal_ref_no',
        'no_of_folders',
        'date_endorsed',
        'endorsed_by',
        'file_location',

        // These were duplicates/unused
        'amount_disbursed',  // duplicate of disbursed_amount
    ];

    public function up(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            foreach ($this->columnsToRemove as $column) {
                if (Schema::hasColumn('liquidations', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            // Restore transmittal columns
            if (!Schema::hasColumn('liquidations', 'transmittal_ref_no')) {
                $table->string('transmittal_ref_no')->nullable();
            }
            if (!Schema::hasColumn('liquidations', 'no_of_folders')) {
                $table->integer('no_of_folders')->nullable();
            }
            if (!Schema::hasColumn('liquidations', 'date_endorsed')) {
                $table->date('date_endorsed')->nullable();
            }
            if (!Schema::hasColumn('liquidations', 'endorsed_by')) {
                $table->string('endorsed_by')->nullable();
            }
            if (!Schema::hasColumn('liquidations', 'file_location')) {
                $table->string('file_location')->nullable();
            }
            if (!Schema::hasColumn('liquidations', 'amount_disbursed')) {
                $table->decimal('amount_disbursed', 15, 2)->default(0);
            }
        });
    }
};
