<?php

namespace Database\Seeders;

use App\Models\AcademicYear;
use Illuminate\Database\Seeder;

// php artisan db:seed --class=AcademicYearSeeder

class AcademicYearSeeder extends Seeder
{
    public function run(): void
    {
        $academicYears = [
            ['code' => '2026-2027', 'name' => 'Academic Year 2026-2027', 'sort_order' => 0],
            ['code' => '2025-2026', 'name' => 'Academic Year 2025-2026', 'sort_order' => 1],
            ['code' => '2024-2025', 'name' => 'Academic Year 2024-2025', 'sort_order' => 2],
            ['code' => '2023-2024', 'name' => 'Academic Year 2023-2024', 'sort_order' => 3],
            ['code' => '2022-2023', 'name' => 'Academic Year 2022-2023', 'sort_order' => 4],
            ['code' => '2021-2022', 'name' => 'Academic Year 2021-2022', 'sort_order' => 5],
            ['code' => '2020-2021', 'name' => 'Academic Year 2020-2021', 'sort_order' => 6],
        ];

        foreach ($academicYears as $ay) {
            AcademicYear::firstOrCreate(
                ['code' => $ay['code']],
                $ay
            );
        }
    }
}
