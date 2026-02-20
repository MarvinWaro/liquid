<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop the stub table (only had id + timestamps) and recreate with proper schema
        Schema::dropIfExists('liquidation_tracking_entries');

        Schema::create('liquidation_tracking_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('liquidation_id');
            $table->uuid('document_status_id')->nullable();
            $table->text('received_by')->nullable();
            $table->date('date_received')->nullable();
            $table->text('reviewed_by')->nullable();
            $table->date('date_reviewed')->nullable();
            $table->string('rc_note')->nullable();
            $table->date('date_endorsement')->nullable();
            $table->uuid('liquidation_status_id')->nullable();
            $table->timestamps();

            $table->foreign('liquidation_id')
                ->references('id')->on('liquidations')->onDelete('cascade');
            $table->foreign('document_status_id')
                ->references('id')->on('document_statuses')->onDelete('set null');
            $table->foreign('liquidation_status_id')
                ->references('id')->on('liquidation_statuses')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liquidation_tracking_entries');
    }
};
