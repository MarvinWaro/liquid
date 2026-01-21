<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

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
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'code' => 'TDP',
                'name' => 'Tulong Dunong Program',
                'description' => 'Scholarship program for deserving students',
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        \DB::table('programs')->insert($programs);
    }
}
