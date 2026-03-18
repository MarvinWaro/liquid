<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('academic_year_document_requirements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('academic_year_id');
            $table->uuid('document_requirement_id');
            $table->foreign('academic_year_id', 'ay_req_ay_fk')->references('id')->on('academic_years')->cascadeOnDelete();
            $table->foreign('document_requirement_id', 'ay_req_dr_fk')->references('id')->on('document_requirements')->cascadeOnDelete();
            $table->boolean('is_required')->default(true);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['academic_year_id', 'document_requirement_id'], 'ay_doc_req_unique');
            $table->index('academic_year_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('academic_year_document_requirements');
    }
};
