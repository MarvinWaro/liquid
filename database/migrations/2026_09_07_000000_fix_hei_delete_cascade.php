<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Stop an HEI deletion from destroying that institution's liquidation history.
 *
 * `liquidations.hei_id` cascaded, so deleting one HEI wiped every liquidation it
 * ever filed - and with it the documents, beneficiaries, financials, tracking
 * entries and comments hanging off those rows. `Liquidation` uses SoftDeletes,
 * but a database-level cascade never consults `deleted_at`, so archived reports
 * went too.
 *
 * `hei_id` is NOT NULL, so it cannot become SET NULL the way `created_by` did in
 * 2026_08_23_000000_fix_user_delete_cascades. It becomes RESTRICT instead - a
 * constraint that can only refuse, never destroy.
 *
 * `users.hei_id` is deliberately left as SET NULL: the controller now counts
 * attached accounts as a blocker, and making it RESTRICT would leave an HEI
 * permanently undeletable after any account it ever held was removed.
 *
 * HEIController::destroy blocks the delete long before MySQL is asked (see
 * HEI::deletionBlockers()); this is the net for any path that skips it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropForeign(['hei_id']);
            $table->foreign('hei_id')->references('id')->on('heis')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropForeign(['hei_id']);
            $table->foreign('hei_id')->references('id')->on('heis')->cascadeOnDelete();
        });
    }
};
