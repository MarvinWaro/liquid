<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            // Fund Release & Endorsement Tracking
            $table->date('date_fund_released')->nullable()->after('batch_no');

            // Document Status Tracking
            $table->enum('document_status', ['Complete Submission', 'Partial Submission', 'No Submission'])
                ->default('No Submission')->after('status');
            $table->datetime('date_submitted')->nullable()->after('document_status');

            // Physical Document Management
            $table->string('receiver_name')->nullable()->after('date_submitted');
            $table->datetime('received_at')->nullable()->after('receiver_name');
            $table->string('document_location')->nullable()->after('received_at');
            $table->json('document_location_history')->nullable()->after('document_location');

            // Refund Details
            $table->string('refund_or_number')->nullable()->after('amount_refunded');
            $table->decimal('amount_with_complete_docs', 15, 2)->nullable()->after('liquidated_amount');

            // Compliance Tracking (FOR COMPLIANCE status)
            $table->text('documents_for_compliance')->nullable()->after('review_remarks');
            $table->string('compliance_status')->nullable()->after('documents_for_compliance');
            $table->datetime('date_concerns_emailed')->nullable()->after('compliance_status');
            $table->datetime('date_compliance_submitted')->nullable()->after('date_concerns_emailed');

            // Endorsement to Accounting
            $table->string('transmittal_reference_no')->nullable()->after('accountant_remarks');
            $table->integer('number_of_folders')->nullable()->after('transmittal_reference_no');
            $table->string('folder_location_number')->nullable()->after('number_of_folders');
            $table->string('group_transmittal')->nullable()->after('folder_location_number');
            $table->text('other_file_location')->nullable()->after('group_transmittal');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropColumn([
                'date_fund_released',
                'document_status',
                'date_submitted',
                'receiver_name',
                'received_at',
                'document_location',
                'document_location_history',
                'refund_or_number',
                'amount_with_complete_docs',
                'documents_for_compliance',
                'compliance_status',
                'date_concerns_emailed',
                'date_compliance_submitted',
                'transmittal_reference_no',
                'number_of_folders',
                'folder_location_number',
                'group_transmittal',
                'other_file_location',
            ]);
        });
    }
};
