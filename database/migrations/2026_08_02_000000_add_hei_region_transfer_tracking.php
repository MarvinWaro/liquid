<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('liquidations', function (Blueprint $table) {
            $table->uuid('processing_region_id')->nullable()->after('hei_id');
            $table->index('processing_region_id');
            $table->foreign('processing_region_id')
                ->references('id')
                ->on('regions')
                ->restrictOnDelete();
        });

        // Existing rows were processed by the HEI's region at deployment time.
        // Future transfers never rewrite this immutable snapshot.
        DB::table('heis')
            ->select(['id', 'region_id'])
            ->whereNotNull('region_id')
            ->orderBy('id')
            ->eachById(function (object $hei): void {
                DB::table('liquidations')
                    ->where('hei_id', $hei->id)
                    ->whereNull('processing_region_id')
                    ->update(['processing_region_id' => $hei->region_id]);
            });

        Schema::create('hei_region_transfers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('hei_id');
            $table->uuid('from_region_id')->nullable();
            $table->uuid('to_region_id');
            $table->date('effective_date');
            $table->string('memo_reference')->nullable();
            $table->text('reason');
            $table->uuid('transferred_by')->nullable();
            $table->timestamps();

            $table->foreign('hei_id')->references('id')->on('heis')->restrictOnDelete();
            $table->foreign('from_region_id')->references('id')->on('regions')->restrictOnDelete();
            $table->foreign('to_region_id')->references('id')->on('regions')->restrictOnDelete();
            $table->foreign('transferred_by')->references('id')->on('users')->nullOnDelete();

            $table->index(['hei_id', 'effective_date']);
            $table->index('from_region_id');
            $table->index('to_region_id');
        });

        // Deploy the permission with the schema change so existing installations
        // do not depend on a destructive full permission re-seed.
        $permissionId = DB::table('permissions')
            ->where('name', 'transfer_hei_region')
            ->value('id');

        if (! $permissionId) {
            $permissionId = (string) Str::uuid();
            DB::table('permissions')->insert([
                'id' => $permissionId,
                'name' => 'transfer_hei_region',
                'module' => 'HEI',
                'description' => 'Transfer an HEI to another region',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $now = now();
        DB::table('roles')
            ->whereIn('name', ['Admin', 'Super Admin'])
            ->pluck('id')
            ->each(function (string $roleId) use ($permissionId, $now): void {
                DB::table('role_permission')->insertOrIgnore([
                    'role_id' => $roleId,
                    'permission_id' => $permissionId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('hei_region_transfers');

        Schema::table('liquidations', function (Blueprint $table) {
            $table->dropForeign(['processing_region_id']);
            $table->dropIndex(['processing_region_id']);
            $table->dropColumn('processing_region_id');
        });

        // Keep the harmless permission record on rollback: this migration may
        // have reused a pre-existing permission, which must not be destroyed.
    }
};
