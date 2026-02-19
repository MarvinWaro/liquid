<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Drop the old table (it only had id + timestamps) and recreate properly
        Schema::dropIfExists('liquidation_tracking_entries');

        Schema::create('liquidation_tracking_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('liquidation_id');
            $table->string('document_status')->default('No Submission');
            $table->string('received_by')->nullable();
            $table->date('date_received')->nullable();
            $table->string('document_location')->nullable();
            $table->string('reviewed_by')->nullable();
            $table->date('date_reviewed')->nullable();
            $table->string('rc_note')->nullable();
            $table->date('date_endorsement')->nullable();
            $table->string('liquidation_status')->default('Unliquidated');
            $table->timestamps();

            $table->foreign('liquidation_id')->references('id')->on('liquidations')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('liquidation_tracking_entries');
    }
};
