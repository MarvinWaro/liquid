<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_requirements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('program_id');
            $table->foreign('program_id')->references('id')->on('programs')->onDelete('cascade');
            $table->string('code', 50);
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_required')->default(true);
            $table->timestamps();

            $table->unique(['program_id', 'code']);
        });

        Schema::table('liquidation_documents', function (Blueprint $table) {
            $table->uuid('document_requirement_id')->nullable()->after('liquidation_id');
            $table->foreign('document_requirement_id')
                ->references('id')
                ->on('document_requirements')
                ->onDelete('set null');

            $table->unique(['liquidation_id', 'document_requirement_id'], 'liq_doc_requirement_unique');
        });
    }

    public function down(): void
    {
        Schema::table('liquidation_documents', function (Blueprint $table) {
            $table->dropUnique('liq_doc_requirement_unique');
            $table->dropForeign(['document_requirement_id']);
            $table->dropColumn('document_requirement_id');
        });

        Schema::dropIfExists('document_requirements');
    }
};
