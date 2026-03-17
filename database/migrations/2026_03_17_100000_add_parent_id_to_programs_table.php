<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('programs', function (Blueprint $table) {
            $table->uuid('parent_id')->nullable()->after('id');
            $table->foreign('parent_id', 'programs_parent_fk')
                  ->references('id')
                  ->on('programs')
                  ->nullOnDelete();
            $table->index('parent_id');
        });
    }

    public function down(): void
    {
        Schema::table('programs', function (Blueprint $table) {
            $table->dropForeign('programs_parent_fk');
            $table->dropIndex(['parent_id']);
            $table->dropColumn('parent_id');
        });
    }
};
