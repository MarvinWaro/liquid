<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liquidations', function (Blueprint $table) {
            $table->id();

            // Reference Information
            $table->string('control_no')->unique(); // e.g., LIQ-2024-001
            $table->unsignedBigInteger('hei_id'); // Links to the School (User or HEI table)
            $table->unsignedBigInteger('program_id'); // Links to TES, TDP, etc.

            // Period Coverage
            $table->string('academic_year'); // e.g., "2023-2024"
            $table->string('semester'); // e.g., "1st", "2nd", "Summer"

            // Financials
            $table->decimal('amount_received', 15, 2); // Total fund from CHED
            $table->decimal('amount_disbursed', 15, 2)->default(0); // Total given to students
            $table->decimal('amount_refunded', 15, 2)->default(0); // Unused fund returned
            $table->string('or_number')->nullable(); // Receipt for refund

            // Status Tracking
            $table->enum('status', [
                'Draft',
                'Submitted',
                'Verified',
                'Returned',
                'Cleared'
            ])->default('Draft');

            $table->text('remarks')->nullable(); // For comments/rejection notes

            $table->timestamps();

            // Indexes for faster searching
            $table->index(['hei_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liquidations');
    }
};
