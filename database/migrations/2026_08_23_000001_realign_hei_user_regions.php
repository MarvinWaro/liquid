<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Repair HEI accounts left in their old region by a past transfer.
 *
 * An HEI account carries its own `region_id`, auto-filled from the institution
 * when the account is created. The transfer workflow moved the HEI and its
 * liquidations but never these accounts, so User Management kept showing them
 * under the region they came from - it reads users.region ahead of
 * users.hei.region.
 *
 * HEIRegionTransferService now keeps the two in step; this realigns the rows
 * that drifted before that fix. Idempotent: it only writes rows that disagree.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Compared and written row by row rather than as one UPDATE ... JOIN:
        // that form needs MySQL's <=> for the nullable region, and neither the
        // operator nor a joined SET clause exists in SQLite, which the test
        // suite runs on. Only HEI-attached accounts are considered, and in
        // practice only a handful ever disagree.
        DB::table('users')
            ->join('heis', 'users.hei_id', '=', 'heis.id')
            ->whereNotNull('users.hei_id')
            ->orderBy('users.id')
            ->select('users.id', 'users.region_id', 'heis.region_id as hei_region_id')
            ->chunk(500, function ($rows) {
                foreach ($rows as $row) {
                    if ($row->region_id === $row->hei_region_id) {
                        continue;
                    }

                    DB::table('users')
                        ->where('id', $row->id)
                        ->update(['region_id' => $row->hei_region_id]);
                }
            });
    }

    public function down(): void
    {
        // Not reversible: the superseded region_id values are not recorded
        // anywhere, and the official history lives in hei_region_transfers.
    }
};
