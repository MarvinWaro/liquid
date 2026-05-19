<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('support_tickets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('ticket_number', 32)->unique();
            $table->foreignUuid('requester_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('liquidation_id')->nullable()->constrained('liquidations')->nullOnDelete();
            $table->foreignUuid('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->string('category', 50);
            $table->string('priority', 20)->default('normal');
            $table->string('status', 30)->default('open');
            $table->string('subject', 180);
            $table->text('description');
            $table->timestamp('last_reply_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->foreignUuid('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['requester_id', 'status']);
            $table->index(['liquidation_id', 'status']);
            $table->index(['status', 'last_reply_at']);
            $table->index('category');
            $table->index('priority');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_tickets');
    }
};
