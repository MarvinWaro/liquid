<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Server-side persistence for the bulk-entry modal draft.
 *
 * One draft per user (1:1) — replaces the previous browser-localStorage
 * approach so drafts follow the user across devices/browsers.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bulk_entry_drafts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->json('rows');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bulk_entry_drafts');
    }
};
