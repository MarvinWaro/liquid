<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();

            // Who performed the action
            $table->uuid('user_id')->nullable();
            $table->string('user_name')->nullable();

            // What was done
            $table->string('action', 50);
            $table->string('description');

            // What was affected
            $table->string('subject_type')->nullable();
            $table->uuid('subject_id')->nullable();
            $table->string('subject_label')->nullable();

            // Change details
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();

            // Context
            $table->string('module', 50)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();

            $table->timestamps();

            // Foreign keys
            $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');

            // Indexes
            $table->index('user_id');
            $table->index('action');
            $table->index('subject_type');
            $table->index('module');
            $table->index('created_at');
            $table->index(['subject_type', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
