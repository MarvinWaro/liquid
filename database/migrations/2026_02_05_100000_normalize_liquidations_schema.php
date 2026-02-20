<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * This migration normalizes the liquidations schema by:
     * 1. Dropping the redundant liquidation_items table (liquidation_beneficiaries serves the same purpose)
     * 2. Creating review_types lookup table (BCNF: replaces review_type ENUM)
     * 3. Creating compliance_statuses lookup table (BCNF: replaces compliance_status ENUM)
     * 4. Creating liquidation_reviews table for audit trail
     * 5. Creating liquidation_transmittals table for endorsement details
     * 6. Creating liquidation_compliance table for compliance tracking
     * 7. Removing extracted columns from liquidations table
     */
    public function up(): void
    {
        // Step 1: Drop redundant liquidation_items table
        Schema::dropIfExists('liquidation_items');

        // Step 2: Create review_types lookup table (BCNF compliance)
        Schema::create('review_types', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 50)->unique();
            $table->string('name', 100);
            $table->string('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        DB::table('review_types')->insert([
            ['id' => Str::uuid(), 'code' => 'rc_return',               'name' => 'RC Return',               'description' => 'Regional Coordinator returned to HEI',           'sort_order' => 1, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => Str::uuid(), 'code' => 'rc_endorsement',          'name' => 'RC Endorsement',          'description' => 'Regional Coordinator endorsed to Accounting',     'sort_order' => 2, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => Str::uuid(), 'code' => 'hei_resubmission',        'name' => 'HEI Resubmission',        'description' => 'HEI resubmitted after RC return',                'sort_order' => 3, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => Str::uuid(), 'code' => 'accountant_return',       'name' => 'Accountant Return',       'description' => 'Accountant returned to Regional Coordinator',    'sort_order' => 4, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => Str::uuid(), 'code' => 'accountant_endorsement',  'name' => 'Accountant Endorsement',  'description' => 'Accountant endorsed to COA',                     'sort_order' => 5, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Step 3: Create compliance_statuses lookup table (BCNF compliance)
        Schema::create('compliance_statuses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 50)->unique();
            $table->string('name', 100);
            $table->string('description')->nullable();
            $table->string('badge_color', 50)->default('secondary');
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        DB::table('compliance_statuses')->insert([
            ['id' => Str::uuid(), 'code' => 'pending_hei_review',   'name' => 'Pending HEI Review',   'description' => 'Awaiting HEI to review compliance requirements', 'badge_color' => 'warning',     'sort_order' => 1, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => Str::uuid(), 'code' => 'documents_submitted',  'name' => 'Documents Submitted',  'description' => 'HEI has submitted compliance documents',         'badge_color' => 'info',        'sort_order' => 2, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => Str::uuid(), 'code' => 'under_review',         'name' => 'Under Review',         'description' => 'Compliance documents are being reviewed',        'badge_color' => 'info',        'sort_order' => 3, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => Str::uuid(), 'code' => 'compliant',            'name' => 'Compliant',            'description' => 'HEI has met all compliance requirements',        'badge_color' => 'success',     'sort_order' => 4, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => Str::uuid(), 'code' => 'non_compliant',        'name' => 'Non-Compliant',        'description' => 'HEI has not met compliance requirements',        'badge_color' => 'destructive', 'sort_order' => 5, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Step 4: Create liquidation_reviews table for audit trail
        Schema::create('liquidation_reviews', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('liquidation_id');
            $table->foreign('liquidation_id')->references('id')->on('liquidations')->onDelete('cascade');

            // Review type FK (replaces ENUM for BCNF compliance)
            $table->uuid('review_type_id');
            $table->foreign('review_type_id', 'fk_lreviews_review_type')->references('id')->on('review_types');

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
            $table->index(['liquidation_id', 'review_type_id']);
            $table->index(['liquidation_id', 'performed_at']);
        });

        // Step 5: Create liquidation_transmittals table
        Schema::create('liquidation_transmittals', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('liquidation_id');
            $table->foreign('liquidation_id')->references('id')->on('liquidations')->onDelete('cascade');

            // Transmittal details
            $table->string('transmittal_reference_no');
            $table->string('receiver_name')->nullable();
            // FK added in create_document_locations migration (that table doesn't exist yet here)
            $table->uuid('document_location_id')->nullable();
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

        // Step 6: Create liquidation_compliance table
        Schema::create('liquidation_compliance', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('liquidation_id');
            $table->foreign('liquidation_id')->references('id')->on('liquidations')->onDelete('cascade');

            // Compliance tracking
            $table->text('documents_required')->nullable();

            // Compliance status FK (replaces ENUM for BCNF compliance)
            $table->uuid('compliance_status_id')->nullable();
            $table->foreign('compliance_status_id', 'fk_lcompliance_status')->references('id')->on('compliance_statuses')->onDelete('set null');

            // Communication tracking
            $table->timestamp('concerns_emailed_at')->nullable();
            $table->timestamp('compliance_submitted_at')->nullable();

            // Financial compliance
            $table->decimal('amount_with_complete_docs', 15, 2)->nullable();

            $table->timestamps();

            // Index
            $table->index(['liquidation_id']);
            $table->index(['compliance_status_id']);
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

        // Drop new tables (order matters: FK dependents first)
        Schema::dropIfExists('liquidation_compliance');
        Schema::dropIfExists('compliance_statuses');
        Schema::dropIfExists('liquidation_transmittals');
        Schema::dropIfExists('liquidation_reviews');
        Schema::dropIfExists('review_types');

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
