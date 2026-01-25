<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // First, update existing status values to new format
        DB::statement("UPDATE `liquidations` SET `status` = 'draft' WHERE `status` = 'Draft'");
        DB::statement("UPDATE `liquidations` SET `status` = 'for_initial_review' WHERE `status` = 'Submitted'");
        DB::statement("UPDATE `liquidations` SET `status` = 'endorsed_to_accounting' WHERE `status` = 'Verified'");
        DB::statement("UPDATE `liquidations` SET `status` = 'returned_to_hei' WHERE `status` = 'Returned'");
        DB::statement("UPDATE `liquidations` SET `status` = 'approved' WHERE `status` = 'Cleared'");

        // Then modify the status enum with new workflow statuses
        DB::statement("ALTER TABLE `liquidations` MODIFY COLUMN `status` ENUM(
            'draft',
            'for_initial_review',
            'returned_to_hei',
            'endorsed_to_accounting',
            'returned_to_rc',
            'endorsed_to_coa',
            'approved',
            'rejected'
        ) NOT NULL DEFAULT 'draft'");

        Schema::table('liquidations', function (Blueprint $table) {
            // Add workflow tracking columns if they don't exist
            if (!Schema::hasColumn('liquidations', 'created_by')) {
                $table->uuid('created_by')->nullable()->after('hei_id');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
            }

            if (!Schema::hasColumn('liquidations', 'disbursed_amount')) {
                $table->decimal('disbursed_amount', 15, 2)->nullable()->after('amount_received')->comment('Amount disbursed to HEI');
            }

            if (!Schema::hasColumn('liquidations', 'disbursement_date')) {
                $table->date('disbursement_date')->nullable()->after('disbursed_amount');
            }

            if (!Schema::hasColumn('liquidations', 'fund_source')) {
                $table->string('fund_source')->nullable()->after('disbursement_date');
            }

            if (!Schema::hasColumn('liquidations', 'liquidated_amount')) {
                $table->decimal('liquidated_amount', 15, 2)->default(0)->after('fund_source');
            }

            if (!Schema::hasColumn('liquidations', 'purpose')) {
                $table->text('purpose')->nullable()->after('liquidated_amount');
            }

            // Regional Coordinator Review
            if (!Schema::hasColumn('liquidations', 'reviewed_by')) {
                $table->uuid('reviewed_by')->nullable()->comment('Regional Coordinator');
                $table->foreign('reviewed_by')->references('id')->on('users');
            }
            if (!Schema::hasColumn('liquidations', 'reviewed_at')) {
                $table->timestamp('reviewed_at')->nullable();
            }
            if (!Schema::hasColumn('liquidations', 'review_remarks')) {
                $table->text('review_remarks')->nullable();
            }

            // Accountant Review
            if (!Schema::hasColumn('liquidations', 'accountant_reviewed_by')) {
                $table->uuid('accountant_reviewed_by')->nullable()->comment('Accountant');
                $table->foreign('accountant_reviewed_by')->references('id')->on('users');
            }
            if (!Schema::hasColumn('liquidations', 'accountant_reviewed_at')) {
                $table->timestamp('accountant_reviewed_at')->nullable();
            }
            if (!Schema::hasColumn('liquidations', 'accountant_remarks')) {
                $table->text('accountant_remarks')->nullable();
            }

            // COA Endorsement
            if (!Schema::hasColumn('liquidations', 'coa_endorsed_by')) {
                $table->uuid('coa_endorsed_by')->nullable()->comment('Who endorsed to COA');
                $table->foreign('coa_endorsed_by')->references('id')->on('users');
            }
            if (!Schema::hasColumn('liquidations', 'coa_endorsed_at')) {
                $table->timestamp('coa_endorsed_at')->nullable();
            }

            // Soft deletes
            if (!Schema::hasColumn('liquidations', 'deleted_at')) {
                $table->softDeletes();
            }
        });
    }

    public function down(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropColumn([
                'created_by',
                'disbursed_amount',
                'disbursement_date',
                'fund_source',
                'liquidated_amount',
                'purpose',
                'reviewed_by',
                'reviewed_at',
                'review_remarks',
                'accountant_reviewed_by',
                'accountant_reviewed_at',
                'accountant_remarks',
                'coa_endorsed_by',
                'coa_endorsed_at',
                'deleted_at',
            ]);
        });

        // Restore original enum
        DB::statement("ALTER TABLE `liquidations` MODIFY COLUMN `status` ENUM(
            'Draft',
            'Submitted',
            'Verified',
            'Returned',
            'Cleared'
        ) NOT NULL DEFAULT 'Draft'");
    }
};
