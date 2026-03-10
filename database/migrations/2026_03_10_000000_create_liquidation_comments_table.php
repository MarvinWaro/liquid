<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liquidation_comments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('liquidation_id');
            $table->uuid('user_id');
            $table->uuid('parent_id')->nullable();
            $table->text('body');
            $table->json('mentions')->nullable();
            $table->timestamps();

            $table->foreign('liquidation_id')->references('id')->on('liquidations')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('parent_id')->references('id')->on('liquidation_comments')->nullOnDelete();

            $table->index(['liquidation_id', 'created_at']);
            $table->index('parent_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liquidation_comments');
    }
};
