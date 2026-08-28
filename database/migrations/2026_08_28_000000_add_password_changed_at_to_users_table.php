<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // NULL means the account is still on the password an administrator
            // typed for it. That is what the first-login prompt keys on, so it
            // is deliberately left NULL for every existing row: those are
            // exactly the accounts that have never chosen their own password.
            //
            // Not indexed - it is only ever read for the signed-in user, never
            // filtered or sorted on.
            $table->timestamp('password_changed_at')->nullable()->after('password');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('password_changed_at');
        });
    }
};
