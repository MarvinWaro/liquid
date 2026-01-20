<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('liquidations', function (Blueprint $table) {
            // Fields for CHED/Admin use only (from Sheet 1.csv)
            $table->string('transmittal_ref_no')->nullable()->after('status');
            $table->integer('no_of_folders')->nullable()->after('transmittal_ref_no');
            $table->date('date_endorsed')->nullable()->after('no_of_folders');
            $table->string('endorsed_by')->nullable()->after('date_endorsed'); // Regional Coordinator
            $table->string('file_location')->nullable()->after('endorsed_by'); // e.g., Cabinet 1, Row 2
        });
    }

    public function down()
    {
        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropColumn([
                'transmittal_ref_no',
                'no_of_folders',
                'date_endorsed',
                'endorsed_by',
                'file_location'
            ]);
        });
    }
};
