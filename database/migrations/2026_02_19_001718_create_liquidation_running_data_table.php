<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liquidation_running_data', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('liquidation_id')->constrained()->cascadeOnDelete();
            $table->integer('grantees_liquidated')->nullable();
            $table->decimal('amount_complete_docs', 15, 2)->nullable();
            $table->decimal('amount_refunded', 15, 2)->nullable();
            $table->string('refund_or_no', 100)->nullable();
            $table->string('transmittal_ref_no', 255)->nullable();
            $table->string('group_transmittal_ref_no', 255)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index('liquidation_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liquidation_running_data');
    }
};
