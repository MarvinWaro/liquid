<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liquidation_documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('liquidation_id');
            $table->foreign('liquidation_id')->references('id')->on('liquidations')->onDelete('cascade');
            $table->string('document_type')->comment('e.g., Receipt, Invoice, Certificate, etc.');
            $table->string('file_name');
            $table->string('file_path');
            $table->string('file_type')->nullable()->comment('MIME type');
            $table->integer('file_size')->nullable()->comment('File size in bytes');
            $table->text('description')->nullable();
            $table->uuid('uploaded_by');
            $table->foreign('uploaded_by')->references('id')->on('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liquidation_documents');
    }
};
