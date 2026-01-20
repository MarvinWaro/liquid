<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liquidation_items', function (Blueprint $table) {
            $table->id();

            // Link to Parent Table
            $table->foreignId('liquidation_id')
                  ->constrained('liquidations')
                  ->onDelete('cascade'); // If report is deleted, delete items too

            // Student Details
            // Note: Using string for student_no/name for flexibility if Masterlist isn't linked yet
            $table->string('student_no')->nullable();
            $table->string('full_name');
            $table->string('award_no')->nullable(); // UniFAST Award No

            // Disbursement Details
            $table->decimal('amount', 15, 2); // Exact amount received
            $table->date('date_disbursed'); // When they got the money
            $table->text('remarks')->nullable(); // e.g., "Partial", "Claimed by parent"

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liquidation_items');
    }
};
