<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            // Percentage (0–100) of where the subject sits inside the cover.
            // Used via CSS `object-position` on cropped thumbnails/hero images.
            $table->unsignedTinyInteger('cover_focal_x')->default(50)->after('cover_thumb_path');
            $table->unsignedTinyInteger('cover_focal_y')->default(50)->after('cover_focal_x');
        });
    }

    public function down(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->dropColumn(['cover_focal_x', 'cover_focal_y']);
        });
    }
};
