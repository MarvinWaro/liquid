<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

// php artisan db:seed --class=ProgramSeeder  

class ProgramSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $programs = [
            [
                'code' => 'TES',
                'name' => 'Tertiary Education Subsidy',
                'description' => 'Financial assistance program for tertiary education students',
                'status' => 'active',
            ],
            [
                'code' => 'TDP',
                'name' => 'Tulong Dunong Program',
                'description' => 'Scholarship program for deserving students',
                'status' => 'active',
            ],
        ];

        foreach ($programs as $program) {
            \App\Models\Program::updateOrCreate(
                ['code' => $program['code']],
                $program
            );
        }
    }
}
