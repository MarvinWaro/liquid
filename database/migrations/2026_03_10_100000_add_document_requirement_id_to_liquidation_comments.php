<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liquidation_comments', function (Blueprint $table) {
            $table->uuid('document_requirement_id')->nullable()->after('liquidation_id');
            $table->foreign('document_requirement_id')->references('id')->on('document_requirements')->nullOnDelete();
            $table->index('document_requirement_id');
        });
    }

    public function down(): void
    {
        Schema::table('liquidation_comments', function (Blueprint $table) {
            $table->dropForeign(['document_requirement_id']);
            $table->dropIndex(['document_requirement_id']);
            $table->dropColumn('document_requirement_id');
        });
    }
};
