<?php

namespace Database\Seeders;

use App\Models\Semester;
use Illuminate\Database\Seeder;

// php artisan db:seed --class=SemesterSeeder

class SemesterSeeder extends Seeder
{
    public function run(): void
    {
        $semesters = [
            ['code' => '1ST',     'name' => '1st Semester',        'sort_order' => 1],
            ['code' => '2ND',     'name' => '2nd Semester',        'sort_order' => 2],
            ['code' => 'SUM',     'name' => 'Summer',              'sort_order' => 3],
            ['code' => 'TES3A',   'name' => 'TES3A',               'sort_order' => 4],
            ['code' => 'TES3B',   'name' => 'TES3B',               'sort_order' => 5],
            ['code' => '1ST&2ND', 'name' => '1st and 2nd Semester', 'sort_order' => 6],
        ];

        foreach ($semesters as $semester) {
            Semester::firstOrCreate(
                ['code' => $semester['code']],
                $semester
            );
        }
    }
}
