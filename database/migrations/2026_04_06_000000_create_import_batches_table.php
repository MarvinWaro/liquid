<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('import_batches', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('file_name');
            $table->unsignedInteger('total_rows');
            $table->unsignedInteger('imported_count');
            $table->enum('status', ['active', 'undone'])->default('active');
            $table->timestamp('undone_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index('status');
        });

        Schema::table('liquidations', function (Blueprint $table) {
            $table->foreignUuid('import_batch_id')->nullable()->after('created_by')
                ->constrained('import_batches')->nullOnDelete();
            $table->index('import_batch_id');
        });
    }

    public function down(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropForeign(['import_batch_id']);
            $table->dropColumn('import_batch_id');
        });

        Schema::dropIfExists('import_batches');
    }
};
