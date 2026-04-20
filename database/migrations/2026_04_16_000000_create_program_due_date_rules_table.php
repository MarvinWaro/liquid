<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('program_due_date_rules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('program_id');
            $table->uuid('academic_year_id')->nullable(); // NULL = default for the program
            $table->unsignedInteger('due_date_days');
            $table->timestamps();

            $table->foreign('program_id')->references('id')->on('programs')->cascadeOnDelete();
            $table->foreign('academic_year_id')->references('id')->on('academic_years')->nullOnDelete();

            // One rule per program + academic year combo (NULL AY = default)
            $table->unique(['program_id', 'academic_year_id'], 'program_ay_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('program_due_date_rules');
    }
};
