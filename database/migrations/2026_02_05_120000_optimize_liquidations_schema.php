<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Optimize Liquidations Schema
 *
 * This migration improves the database architecture by:
 * 1. Creating lookup tables for enums (semesters, document_statuses)
 * 2. Extracting financial data to a separate table (liquidation_financials)
 * 3. Removing duplicate columns (review_remarks, accountant_remarks)
 * 4. Adding performance indexes
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Step 1: Create lookup tables
        $this->createLookupTables();

        // Step 2: Create financials table
        $this->createFinancialsTable();

        // Step 3: Add new foreign key columns to liquidations
        $this->addNewColumns();

        // Step 4: Migrate existing data
        $this->migrateExistingData();

        // Step 5: Drop old columns
        $this->dropOldColumns();

        // Step 6: Add performance indexes
        $this->addPerformanceIndexes();
    }

    /**
     * Create lookup tables for enum values.
     */
    private function createLookupTables(): void
    {
        // Semesters lookup table
        Schema::create('semesters', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 20)->unique();
            $table->string('name', 50);
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Document statuses lookup table
        Schema::create('document_statuses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 30)->unique();
            $table->string('name', 50);
            $table->string('description')->nullable();
            $table->string('badge_color', 20)->default('gray');
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Seed default values
        $this->seedLookupTables();
    }

    /**
     * Seed lookup tables with default values.
     */
    private function seedLookupTables(): void
    {
        $now = now();

        // Semesters
        $semesters = [
            ['code' => '1ST', 'name' => '1st Semester', 'sort_order' => 1],
            ['code' => '2ND', 'name' => '2nd Semester', 'sort_order' => 2],
            ['code' => 'SUM', 'name' => 'Summer', 'sort_order' => 3],
        ];

        foreach ($semesters as $semester) {
            DB::table('semesters')->insert([
                'id' => Str::uuid(),
                'code' => $semester['code'],
                'name' => $semester['name'],
                'sort_order' => $semester['sort_order'],
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // Document statuses
        $statuses = [
            ['code' => 'COMPLETE', 'name' => 'Complete Submission', 'badge_color' => 'green', 'sort_order' => 1],
            ['code' => 'PARTIAL', 'name' => 'Partial Submission', 'badge_color' => 'yellow', 'sort_order' => 2],
            ['code' => 'NONE', 'name' => 'No Submission', 'badge_color' => 'gray', 'sort_order' => 3],
        ];

        foreach ($statuses as $status) {
            DB::table('document_statuses')->insert([
                'id' => Str::uuid(),
                'code' => $status['code'],
                'name' => $status['name'],
                'badge_color' => $status['badge_color'],
                'sort_order' => $status['sort_order'],
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    /**
     * Create financials table.
     */
    private function createFinancialsTable(): void
    {
        Schema::create('liquidation_financials', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('liquidation_id')->unique();
            $table->foreign('liquidation_id')->references('id')->on('liquidations')->onDelete('cascade');

            $table->date('date_fund_released')->nullable();
            $table->date('due_date')->nullable();
            $table->string('fund_source', 100)->nullable();
            $table->decimal('amount_received', 15, 2)->default(0);
            $table->decimal('amount_disbursed', 15, 2)->default(0);
            $table->decimal('amount_liquidated', 15, 2)->default(0);
            $table->decimal('amount_refunded', 15, 2)->default(0);
            $table->date('disbursement_date')->nullable();
            $table->integer('number_of_grantees')->nullable();
            $table->string('or_number', 50)->nullable();
            $table->text('purpose')->nullable();

            $table->timestamps();
            $table->index('date_fund_released');
        });
    }

    /**
     * Add new foreign key columns to liquidations.
     */
    private function addNewColumns(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            $table->uuid('semester_id')->nullable()->after('academic_year');
            $table->uuid('document_status_id')->nullable()->after('liquidation_status');
        });
    }

    /**
     * Migrate existing data.
     * For fresh migrations, this creates financial records from legacy columns if they exist.
     */
    private function migrateExistingData(): void
    {
        // Build mappings
        $semesterMap = [];
        $semesters = DB::table('semesters')->get();
        foreach ($semesters as $sem) {
            $semesterMap[$sem->name] = $sem->id;
        }

        $docStatusMap = [];
        $statuses = DB::table('document_statuses')->get();
        foreach ($statuses as $status) {
            $docStatusMap[$status->name] = $status->id;
        }

        // Check if legacy columns exist (for fresh migrations they won't have data)
        $hasLegacyColumns = Schema::hasColumn('liquidations', 'amount_received');

        if (!$hasLegacyColumns) {
            return; // Fresh migration, no data to migrate
        }

        // Migrate each liquidation
        $liquidations = DB::table('liquidations')->get();

        foreach ($liquidations as $liq) {
            // Create financial record from legacy columns
            DB::table('liquidation_financials')->insert([
                'id' => Str::uuid(),
                'liquidation_id' => $liq->id,
                'amount_received' => $liq->amount_received ?? 0,
                'amount_disbursed' => $liq->amount_disbursed ?? 0,
                'amount_refunded' => $liq->amount_refunded ?? 0,
                'or_number' => $liq->or_number ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Update semester_id from legacy semester column if it exists
            if (Schema::hasColumn('liquidations', 'semester') && !empty($liq->semester)) {
                $semesterId = $semesterMap[$liq->semester] ?? $semesterMap['1st Semester'] ?? null;
                DB::table('liquidations')
                    ->where('id', $liq->id)
                    ->update(['semester_id' => $semesterId]);
            }
        }
    }

    /**
     * Drop old columns from liquidations.
     */
    private function dropOldColumns(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            // Drop old semester column (was varchar)
            if (Schema::hasColumn('liquidations', 'semester')) {
                $table->dropColumn('semester');
            }

            // Drop old document_status column (was enum)
            if (Schema::hasColumn('liquidations', 'document_status')) {
                $table->dropColumn('document_status');
            }

            // Drop financial columns (moved to liquidation_financials)
            $financialColumns = [
                'date_fund_released',
                'amount_received',
                'disbursed_amount',
                'disbursement_date',
                'fund_source',
                'liquidated_amount',
                'amount_refunded',
                'or_number',
                'number_of_grantees',
                'purpose',
            ];

            foreach ($financialColumns as $column) {
                if (Schema::hasColumn('liquidations', $column)) {
                    $table->dropColumn($column);
                }
            }

            // Drop duplicate remarks columns
            $remarkColumns = ['review_remarks', 'accountant_remarks'];
            foreach ($remarkColumns as $column) {
                if (Schema::hasColumn('liquidations', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    /**
     * Add performance indexes.
     */
    private function addPerformanceIndexes(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            // Single column indexes
            $table->index('semester_id', 'idx_liquidations_semester');
            $table->index('document_status_id', 'idx_liquidations_doc_status');

            // Composite indexes
            $table->index(['hei_id', 'academic_year'], 'idx_liquidations_hei_year');

            // Add foreign key constraints
            $table->foreign('semester_id')->references('id')->on('semesters')->onDelete('set null');
            $table->foreign('document_status_id')->references('id')->on('document_statuses')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop foreign keys and indexes
        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropForeign(['semester_id']);
            $table->dropForeign(['document_status_id']);
            $table->dropIndex('idx_liquidations_semester');
            $table->dropIndex('idx_liquidations_doc_status');
            $table->dropIndex('idx_liquidations_hei_year');
        });

        // Restore old columns
        Schema::table('liquidations', function (Blueprint $table) {
            $table->string('semester')->nullable();
            $table->enum('document_status', ['Complete Submission', 'Partial Submission', 'No Submission'])->default('No Submission');
            $table->date('date_fund_released')->nullable();
            $table->decimal('amount_received', 15, 2)->default(0);
            $table->decimal('disbursed_amount', 15, 2)->default(0);
            $table->date('disbursement_date')->nullable();
            $table->string('fund_source')->nullable();
            $table->decimal('liquidated_amount', 15, 2)->default(0);
            $table->decimal('amount_refunded', 15, 2)->default(0);
            $table->string('or_number')->nullable();
            $table->integer('number_of_grantees')->nullable();
            $table->text('purpose')->nullable();
            $table->text('review_remarks')->nullable();
            $table->text('accountant_remarks')->nullable();
        });

        // Drop new columns
        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropColumn(['semester_id', 'document_status_id']);
        });

        // Drop new tables
        Schema::dropIfExists('liquidation_financials');
        Schema::dropIfExists('document_statuses');
        Schema::dropIfExists('semesters');
    }
};
