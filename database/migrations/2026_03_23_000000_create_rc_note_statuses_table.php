<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Create the lookup table
        Schema::create('rc_note_statuses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 30)->unique();
            $table->string('name', 50);
            $table->string('badge_color', 20)->default('gray');
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // 2. Add FK column to liquidations
        Schema::table('liquidations', function (Blueprint $table) {
            $table->uuid('rc_note_status_id')->nullable()->after('document_status_id');
            $table->foreign('rc_note_status_id')
                  ->references('id')
                  ->on('rc_note_statuses')
                  ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropForeign(['rc_note_status_id']);
            $table->dropColumn('rc_note_status_id');
        });

        Schema::dropIfExists('rc_note_statuses');
    }
};
