<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liquidations', function (Blueprint $table) {
            $table->uuid('id')->primary();

            // Reference Information
            $table->string('control_no')->unique(); // e.g., LIQ-2024-001
            $table->uuid('hei_id'); // Links to the School (User or HEI table)
            $table->uuid('program_id'); // Links to TES, TDP, etc.
            $table->uuid('created_by')->nullable(); // User who created this liquidation

            // Period Coverage
            $table->string('academic_year'); // e.g., "2023-2024"
            $table->string('semester')->nullable(); // Will be replaced by semester_id in later migration
            $table->string('batch_no')->nullable(); // Batch number for the liquidation

            // Financials (legacy columns - will be moved to liquidation_financials)
            $table->decimal('amount_received', 15, 2)->default(0); // Total fund from CHED
            $table->decimal('amount_disbursed', 15, 2)->default(0); // Total given to students
            $table->decimal('amount_refunded', 15, 2)->default(0); // Unused fund returned
            $table->string('or_number')->nullable(); // Receipt for refund

            // Status Tracking (workflow statuses)
            $table->enum('status', [
                'draft',
                'for_initial_review',
                'returned_to_hei',
                'endorsed_to_accounting',
                'returned_to_rc',
                'endorsed_to_coa',
                'approved',
                'rejected'
            ])->default('draft');

            // Liquidation Status (stored enum with 3 options)
            $table->enum('liquidation_status', [
                'Unliquidated',
                'Partially Liquidated - Endorsed to Accounting',
                'Fully Liquidated - Endorsed to Accounting'
            ])->default('Unliquidated');

            $table->date('date_submitted')->nullable();
            $table->text('remarks')->nullable(); // For comments/rejection notes

            // Regional Coordinator Review
            $table->uuid('reviewed_by')->nullable()->comment('Regional Coordinator');
            $table->timestamp('reviewed_at')->nullable();

            // Accountant Review
            $table->uuid('accountant_reviewed_by')->nullable()->comment('Accountant');
            $table->timestamp('accountant_reviewed_at')->nullable();

            // COA Endorsement
            $table->uuid('coa_endorsed_by')->nullable()->comment('Who endorsed to COA');
            $table->timestamp('coa_endorsed_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            // Foreign key constraints
            $table->foreign('hei_id')->references('id')->on('heis')->onDelete('cascade');
            $table->foreign('program_id')->references('id')->on('programs')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('reviewed_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('accountant_reviewed_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('coa_endorsed_by')->references('id')->on('users')->onDelete('set null');

            // Indexes for faster searching
            $table->index(['hei_id', 'status']);
            $table->index('status');
            $table->index('liquidation_status');
            $table->index('created_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liquidations');
    }
};
