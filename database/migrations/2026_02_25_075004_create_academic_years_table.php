<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Create the academic_years lookup table
        Schema::create('academic_years', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 20)->unique();   // e.g. "2024-2025"
            $table->string('name', 50);              // e.g. "2024-2025"
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // 2. Migrate existing academic_year strings into lookup table
        $existingYears = DB::table('liquidations')
            ->whereNotNull('academic_year')
            ->where('academic_year', '!=', '')
            ->distinct()
            ->pluck('academic_year');

        $sortOrder = 1;
        foreach ($existingYears->sort() as $year) {
            DB::table('academic_years')->insert([
                'id' => Str::uuid()->toString(),
                'code' => $year,
                'name' => $year,
                'sort_order' => $sortOrder++,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // 3. Add academic_year_id FK column to liquidations
        Schema::table('liquidations', function (Blueprint $table) {
            $table->uuid('academic_year_id')->nullable()->after('program_id');
            $table->foreign('academic_year_id')->references('id')->on('academic_years')->nullOnDelete();
        });

        // 4. Populate academic_year_id from existing academic_year strings
        $academicYears = DB::table('academic_years')->pluck('id', 'code');
        foreach ($academicYears as $code => $id) {
            DB::table('liquidations')
                ->where('academic_year', $code)
                ->update(['academic_year_id' => $id]);
        }

        // 5. Drop the old string column
        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropColumn('academic_year');
        });
    }

    public function down(): void
    {
        // Re-add the string column
        Schema::table('liquidations', function (Blueprint $table) {
            $table->string('academic_year')->nullable()->after('program_id');
        });

        // Migrate data back
        $academicYears = DB::table('academic_years')->pluck('code', 'id');
        foreach ($academicYears as $id => $code) {
            DB::table('liquidations')
                ->where('academic_year_id', $id)
                ->update(['academic_year' => $code]);
        }

        // Drop FK column
        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropForeign(['academic_year_id']);
            $table->dropColumn('academic_year_id');
        });

        Schema::dropIfExists('academic_years');
    }
};
