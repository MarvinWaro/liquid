<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('liquidation_items', function (Blueprint $table) {
            // Drop old column if exists
            if (Schema::hasColumn('liquidation_items', 'full_name')) {
                $table->dropColumn('full_name');
            }

            // Add new split columns
            $table->string('last_name')->after('student_no');
            $table->string('first_name')->after('last_name');
            $table->string('middle_name')->nullable()->after('first_name');
            $table->string('extension_name')->nullable()->after('middle_name');
        });
    }

    public function down()
    {
        Schema::table('liquidation_items', function (Blueprint $table) {
            $table->dropColumn(['last_name', 'first_name', 'middle_name', 'extension_name']);
            $table->string('full_name')->nullable();
        });
    }
};
