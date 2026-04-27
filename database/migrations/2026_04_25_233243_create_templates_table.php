<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 255);
            $table->string('category', 100)->nullable();
            $table->text('description')->nullable();
            $table->string('file_path', 1024);
            $table->string('original_filename', 255);
            $table->unsignedBigInteger('file_size');
            $table->string('mime_type', 150);
            $table->boolean('is_active')->default(true);
            $table->uuid('uploaded_by')->nullable();
            $table->foreign('uploaded_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamps();

            $table->index('is_active');
            $table->index('category');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('templates');
    }
};
