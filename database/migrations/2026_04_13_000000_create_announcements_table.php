<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('announcements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('category', 32)->default('news');    // news, event, important, update
            $table->string('tag_color', 16)->nullable();        // blue, emerald, violet, amber, sky, rose
            $table->string('excerpt', 500)->nullable();
            $table->longText('content');                        // TipTap HTML
            $table->string('cover_original_path')->nullable();
            $table->string('cover_display_path')->nullable();
            $table->string('cover_thumb_path')->nullable();
            $table->boolean('is_featured')->default(false);
            $table->boolean('show_to_hei')->default(true);     // visibility toggle
            $table->timestamp('published_at')->nullable();
            $table->timestamp('end_date')->nullable();          // optional auto-expire
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['published_at', 'end_date', 'is_featured']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('announcements');
    }
};
