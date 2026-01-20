<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liquidation_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('liquidation_id')->constrained('liquidations')->onDelete('cascade');
            $table->string('document_type')->comment('e.g., Receipt, Invoice, Certificate, etc.');
            $table->string('file_name');
            $table->string('file_path');
            $table->string('file_type')->nullable()->comment('MIME type');
            $table->integer('file_size')->nullable()->comment('File size in bytes');
            $table->text('description')->nullable();
            $table->foreignId('uploaded_by')->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liquidation_documents');
    }
};
