<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('heis', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('uii')->unique()->comment('Unique Institutional Identifier');
            $table->string('code')->nullable()->comment('HEI Code');
            $table->string('name');
            $table->enum('type', ['Private', 'SUC', 'LUC'])->comment('Private, SUC (State University Colleges), LUC (Local University Colleges)');
            $table->uuid('region_id')->nullable();
            $table->foreign('region_id')->references('id')->on('regions')->onDelete('set null');
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('heis');
    }
};
