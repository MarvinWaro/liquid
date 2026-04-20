<?php

namespace Database\Seeders;

use App\Models\AcademicYear;
use App\Models\DocumentRequirement;
use App\Models\HEI;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\Semester;
use App\Models\User;
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
        // Disable activity logging during seeding to prevent flooding logs
        $models = [Role::class, User::class, HEI::class, Region::class, Program::class, DocumentRequirement::class, Semester::class, AcademicYear::class];
        foreach ($models as $model) {
            if (property_exists($model, 'loggingEnabled')) {
                $model::$loggingEnabled = false;
            }
        }

        $this->call([
            PermissionSeeder::class,            // roles & permissions (no deps)
            SemesterSeeder::class,              // 1ST, 2ND, SUM semesters (no deps)
            AcademicYearSeeder::class,          // 2020-2021 through 2026-2027 (no deps)
            ProgramSeeder::class,               // TES, TDP, STUFAPS + children (no deps)
            ProgramDueDateRuleSeeder::class,    // Due date rules — depends on ProgramSeeder, AcademicYearSeeder
            RegionSeeder::class,                // R12, BARMM regions (no deps)
            HEISeeder::class,                   // HEIs — depends on RegionSeeder
            DocumentLocationSeeder::class,      // shelf locations (no deps)
            DocumentRequirementSeeder::class,   // document requirements — depends on ProgramSeeder
            RcNoteStatusSeeder::class,          // RC note statuses (no deps)
            AcademicYearRequirementSeeder::class, // AY overrides — depends on AY, Programs, DocReqs
            TestUserSeeder::class,              // Temporary: dummy RC & STUFAPS Focal users for testing
        ]);

        // Re-enable logging
        foreach ($models as $model) {
            if (property_exists($model, 'loggingEnabled')) {
                $model::$loggingEnabled = true;
            }
        }
    }
}
