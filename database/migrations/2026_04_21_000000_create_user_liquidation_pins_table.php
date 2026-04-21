<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-user row bookmarks for the liquidation table.
     * Allows users to pin records they want to revisit later without
     * affecting global ordering, reports, or other users' views.
     */
    public function up(): void
    {
        Schema::create('user_liquidation_pins', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('liquidation_id')->constrained()->cascadeOnDelete();
            $table->timestamp('pinned_at')->useCurrent();

            $table->unique(['user_id', 'liquidation_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_liquidation_pins');
    }
};
