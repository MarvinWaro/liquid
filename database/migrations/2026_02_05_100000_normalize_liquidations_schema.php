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

        // Step 5: Migrate existing data to new tables
        $this->migrateExistingData();

        // Step 6: Remove extracted columns from liquidations table
        Schema::table('liquidations', function (Blueprint $table) {
            // Drop columns that have been moved to liquidation_reviews
            if (Schema::hasColumn('liquidations', 'review_history')) {
                $table->dropColumn('review_history');
            }
            if (Schema::hasColumn('liquidations', 'accountant_review_history')) {
                $table->dropColumn('accountant_review_history');
            }

            // Drop columns that have been moved to liquidation_transmittals
            if (Schema::hasColumn('liquidations', 'transmittal_reference_no')) {
                $table->dropColumn('transmittal_reference_no');
            }
            if (Schema::hasColumn('liquidations', 'receiver_name')) {
                $table->dropColumn('receiver_name');
            }
            if (Schema::hasColumn('liquidations', 'received_at')) {
                $table->dropColumn('received_at');
            }
            if (Schema::hasColumn('liquidations', 'document_location')) {
                $table->dropColumn('document_location');
            }
            if (Schema::hasColumn('liquidations', 'document_location_history')) {
                $table->dropColumn('document_location_history');
            }
            if (Schema::hasColumn('liquidations', 'number_of_folders')) {
                $table->dropColumn('number_of_folders');
            }
            if (Schema::hasColumn('liquidations', 'folder_location_number')) {
                $table->dropColumn('folder_location_number');
            }
            if (Schema::hasColumn('liquidations', 'group_transmittal')) {
                $table->dropColumn('group_transmittal');
            }
            if (Schema::hasColumn('liquidations', 'other_file_location')) {
                $table->dropColumn('other_file_location');
            }

            // Drop columns that have been moved to liquidation_compliance
            if (Schema::hasColumn('liquidations', 'documents_for_compliance')) {
                $table->dropColumn('documents_for_compliance');
            }
            if (Schema::hasColumn('liquidations', 'compliance_status')) {
                $table->dropColumn('compliance_status');
            }
            if (Schema::hasColumn('liquidations', 'date_concerns_emailed')) {
                $table->dropColumn('date_concerns_emailed');
            }
            if (Schema::hasColumn('liquidations', 'date_compliance_submitted')) {
                $table->dropColumn('date_compliance_submitted');
            }
            if (Schema::hasColumn('liquidations', 'amount_with_complete_docs')) {
                $table->dropColumn('amount_with_complete_docs');
            }
            if (Schema::hasColumn('liquidations', 'refund_or_number')) {
                $table->dropColumn('refund_or_number');
            }
        });
    }

    /**
     * Migrate existing data from liquidations table to new normalized tables.
     */
    private function migrateExistingData(): void
    {
        // Get all liquidations with existing data
        $liquidations = DB::table('liquidations')
            ->whereNotNull('review_history')
            ->orWhereNotNull('accountant_review_history')
            ->orWhereNotNull('transmittal_reference_no')
            ->orWhereNotNull('documents_for_compliance')
            ->get();

        foreach ($liquidations as $liquidation) {
            // Migrate review history
            if (!empty($liquidation->review_history)) {
                $reviewHistory = json_decode($liquidation->review_history, true) ?? [];
                foreach ($reviewHistory as $entry) {
                    $type = isset($entry['type']) && $entry['type'] === 'hei_resubmission'
                        ? 'hei_resubmission'
                        : 'rc_return';

                    $performedBy = $type === 'hei_resubmission'
                        ? ($entry['resubmitted_by_id'] ?? null)
                        : ($entry['returned_by_id'] ?? null);

                    $performedByName = $type === 'hei_resubmission'
                        ? ($entry['resubmitted_by'] ?? 'Unknown')
                        : ($entry['returned_by'] ?? 'Unknown');

                    $performedAt = $type === 'hei_resubmission'
                        ? ($entry['resubmitted_at'] ?? now())
                        : ($entry['returned_at'] ?? now());

                    $remarks = $type === 'hei_resubmission'
                        ? ($entry['hei_remarks'] ?? null)
                        : ($entry['review_remarks'] ?? null);

                    if ($performedBy) {
                        DB::table('liquidation_reviews')->insert([
                            'id' => \Illuminate\Support\Str::uuid(),
                            'liquidation_id' => $liquidation->id,
                            'review_type' => $type,
                            'performed_by' => $performedBy,
                            'performed_by_name' => $performedByName,
                            'remarks' => $remarks,
                            'documents_for_compliance' => $entry['documents_for_compliance'] ?? null,
                            'performed_at' => $performedAt,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }
            }

            // Migrate accountant review history
            if (!empty($liquidation->accountant_review_history)) {
                $accountantHistory = json_decode($liquidation->accountant_review_history, true) ?? [];
                foreach ($accountantHistory as $entry) {
                    if (!empty($entry['returned_by_id'])) {
                        DB::table('liquidation_reviews')->insert([
                            'id' => \Illuminate\Support\Str::uuid(),
                            'liquidation_id' => $liquidation->id,
                            'review_type' => 'accountant_return',
                            'performed_by' => $entry['returned_by_id'],
                            'performed_by_name' => $entry['returned_by'] ?? 'Unknown',
                            'remarks' => $entry['accountant_remarks'] ?? null,
                            'documents_for_compliance' => null,
                            'performed_at' => $entry['returned_at'] ?? now(),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }
            }

            // Migrate transmittal data
            if (!empty($liquidation->transmittal_reference_no)) {
                DB::table('liquidation_transmittals')->insert([
                    'id' => \Illuminate\Support\Str::uuid(),
                    'liquidation_id' => $liquidation->id,
                    'transmittal_reference_no' => $liquidation->transmittal_reference_no,
                    'receiver_name' => $liquidation->receiver_name,
                    'document_location' => $liquidation->document_location,
                    'number_of_folders' => $liquidation->number_of_folders,
                    'folder_location_number' => $liquidation->folder_location_number,
                    'group_transmittal' => $liquidation->group_transmittal,
                    'other_file_location' => $liquidation->other_file_location,
                    'endorsed_by' => $liquidation->reviewed_by ?? $liquidation->created_by,
                    'endorsed_at' => $liquidation->reviewed_at ?? now(),
                    'received_at' => $liquidation->received_at,
                    'location_history' => $liquidation->document_location_history,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            // Migrate compliance data
            if (!empty($liquidation->documents_for_compliance) || !empty($liquidation->compliance_status)) {
                $complianceStatus = match($liquidation->compliance_status) {
                    'Pending Review by HEI' => 'pending_hei_review',
                    'Documents Submitted' => 'documents_submitted',
                    'Under Review' => 'under_review',
                    'Compliant' => 'compliant',
                    'Non-Compliant' => 'non_compliant',
                    default => 'pending_hei_review',
                };

                DB::table('liquidation_compliance')->insert([
                    'id' => \Illuminate\Support\Str::uuid(),
                    'liquidation_id' => $liquidation->id,
                    'documents_required' => $liquidation->documents_for_compliance,
                    'compliance_status' => $complianceStatus,
                    'concerns_emailed_at' => $liquidation->date_concerns_emailed,
                    'compliance_submitted_at' => $liquidation->date_compliance_submitted,
                    'amount_with_complete_docs' => $liquidation->amount_with_complete_docs,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
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
