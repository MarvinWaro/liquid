<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_program', function (Blueprint $table) {
            $table->uuid('user_id');
            $table->uuid('program_id');
            $table->timestamps();

            $table->primary(['user_id', 'program_id']);
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('program_id')->references('id')->on('programs')->onDelete('cascade');
            $table->index('program_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_program');
    }
};
