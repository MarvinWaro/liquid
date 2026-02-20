<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * Run with: php artisan db:seed
     * Or fresh: php artisan migrate:fresh --seed
     */
    public function run(): void
    {
        $this->call([
            PermissionSeeder::class,      // roles & permissions (no deps)
            ProgramSeeder::class,         // TES, TDP programs (no deps)
            RegionSeeder::class,          // R12, BARMM regions (no deps)
            HEISeeder::class,             // HEIs — depends on RegionSeeder
            DocumentLocationSeeder::class, // shelf locations (no deps)
        ]);
    }
}
