<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('liquidation_documents', function (Blueprint $table) {
            $table->string('gdrive_link')->nullable()->after('file_size');
            $table->boolean('is_gdrive')->default(false)->after('gdrive_link');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('liquidation_documents', function (Blueprint $table) {
            $table->dropColumn(['gdrive_link', 'is_gdrive']);
        });
    }
};
