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
            ['code' => '2026-2027', 'name' => '2026-2027', 'sort_order' => 0],
            ['code' => '2025-2026', 'name' => '2025-2026', 'sort_order' => 1],
            ['code' => '2024-2025', 'name' => '2024-2025', 'sort_order' => 2],
            ['code' => '2023-2024', 'name' => '2023-2024', 'sort_order' => 3],
            ['code' => '2022-2023', 'name' => '2022-2023', 'sort_order' => 4],
            ['code' => '2021-2022', 'name' => '2021-2022', 'sort_order' => 5],
            ['code' => '2020-2021', 'name' => '2020-2021', 'sort_order' => 6],
            ['code' => '2019-2020', 'name' => '2019-2020', 'sort_order' => 7],
            ['code' => '2018-2019', 'name' => '2018-2019', 'sort_order' => 8],
            ['code' => '2017-2018', 'name' => '2017-2018', 'sort_order' => 9],
        ];

        foreach ($academicYears as $ay) {
            AcademicYear::updateOrCreate(
                ['code' => $ay['code']],
                $ay
            );
        }
    }
}
