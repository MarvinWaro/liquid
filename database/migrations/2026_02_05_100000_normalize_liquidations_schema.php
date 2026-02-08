<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * This migration normalizes the liquidations schema by:
     * 1. Dropping the redundant liquidation_items table (liquidation_beneficiaries serves the same purpose)
     * 2. Creating liquidation_reviews table for audit trail
     * 3. Creating liquidation_transmittals table for endorsement details
     * 4. Creating liquidation_compliance table for compliance tracking
     * 5. Removing extracted columns from liquidations table
     */
    public function up(): void
    {
        // Step 1: Drop redundant liquidation_items table
        Schema::dropIfExists('liquidation_items');

        // Step 2: Create liquidation_reviews table for audit trail
        Schema::create('liquidation_reviews', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('liquidation_id');
            $table->foreign('liquidation_id')->references('id')->on('liquidations')->onDelete('cascade');

            // Review type: 'rc_return', 'hei_resubmission', 'accountant_return'
            $table->enum('review_type', ['rc_return', 'hei_resubmission', 'accountant_return']);

            // Who performed the action
            $table->uuid('performed_by');
            $table->foreign('performed_by')->references('id')->on('users')->onDelete('cascade');
            $table->string('performed_by_name'); // Denormalized for history display

            // Action details
            $table->text('remarks')->nullable();
            $table->text('documents_for_compliance')->nullable(); // Only for rc_return

            $table->timestamp('performed_at');
            $table->timestamps();

            // Index for faster queries
            $table->index(['liquidation_id', 'review_type']);
            $table->index(['liquidation_id', 'performed_at']);
        });

        // Step 3: Create liquidation_transmittals table
        Schema::create('liquidation_transmittals', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('liquidation_id');
            $table->foreign('liquidation_id')->references('id')->on('liquidations')->onDelete('cascade');

            // Transmittal details
            $table->string('transmittal_reference_no');
            $table->string('receiver_name')->nullable();
            $table->string('document_location')->nullable();
            $table->integer('number_of_folders')->nullable();
            $table->string('folder_location_number')->nullable();
            $table->string('group_transmittal')->nullable();
            $table->text('other_file_location')->nullable();

            // Who endorsed
            $table->uuid('endorsed_by');
            $table->foreign('endorsed_by')->references('id')->on('users')->onDelete('cascade');
            $table->timestamp('endorsed_at');

            // Physical document tracking
            $table->timestamp('received_at')->nullable();
            $table->json('location_history')->nullable(); // Track location changes

            $table->timestamps();

            // Index for lookups
            $table->index(['liquidation_id']);
            $table->unique(['transmittal_reference_no']);
        });

        // Step 4: Create liquidation_compliance table
        Schema::create('liquidation_compliance', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('liquidation_id');
            $table->foreign('liquidation_id')->references('id')->on('liquidations')->onDelete('cascade');

            // Compliance tracking
            $table->text('documents_required')->nullable();
            $table->enum('compliance_status', [
                'pending_hei_review',
                'documents_submitted',
                'under_review',
                'compliant',
                'non_compliant'
            ])->default('pending_hei_review');

            // Communication tracking
            $table->timestamp('concerns_emailed_at')->nullable();
            $table->timestamp('compliance_submitted_at')->nullable();

            // Financial compliance
            $table->decimal('amount_with_complete_docs', 15, 2)->nullable();

            $table->timestamps();

            // Index
            $table->index(['liquidation_id']);
            $table->index(['compliance_status']);
        });

        // Note: For fresh migrations, no data migration needed as tables start empty
        // The old columns that would have been migrated are no longer in the base schema
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Restore columns to liquidations table
        Schema::table('liquidations', function (Blueprint $table) {
            $table->json('review_history')->nullable();
            $table->json('accountant_review_history')->nullable();
            $table->string('transmittal_reference_no')->nullable();
            $table->string('receiver_name')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->string('document_location')->nullable();
            $table->json('document_location_history')->nullable();
            $table->integer('number_of_folders')->nullable();
            $table->string('folder_location_number')->nullable();
            $table->string('group_transmittal')->nullable();
            $table->text('other_file_location')->nullable();
            $table->text('documents_for_compliance')->nullable();
            $table->string('compliance_status')->nullable();
            $table->timestamp('date_concerns_emailed')->nullable();
            $table->timestamp('date_compliance_submitted')->nullable();
            $table->decimal('amount_with_complete_docs', 15, 2)->nullable();
            $table->string('refund_or_number')->nullable();
        });

        // Drop new tables
        Schema::dropIfExists('liquidation_compliance');
        Schema::dropIfExists('liquidation_transmittals');
        Schema::dropIfExists('liquidation_reviews');

        // Restore liquidation_items table
        Schema::create('liquidation_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('liquidation_id');
            $table->foreign('liquidation_id')
                  ->references('id')
                  ->on('liquidations')
                  ->onDelete('cascade');
            $table->string('student_no')->nullable();
            $table->string('full_name');
            $table->string('award_no')->nullable();
            $table->decimal('amount', 15, 2);
            $table->date('date_disbursed');
            $table->text('remarks')->nullable();
            $table->timestamps();
        });
    }
};
