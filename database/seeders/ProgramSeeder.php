<?php

namespace Database\Seeders;

use App\Models\Program;
use Illuminate\Database\Seeder;

// php artisan db:seed --class=ProgramSeeder

class ProgramSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Top-level programs (parent_id = null)
        $topLevel = [
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
            [
                'code' => 'STUFAPS',
                'name' => 'Student Financial Assistance Programs',
                'description' => null,
                'status' => 'active',
            ],
        ];

        foreach ($topLevel as $program) {
            Program::firstOrCreate(
                ['code' => $program['code']],
                $program
            );
        }

        // Children of STUFAPS
        $stufaps = Program::where('code', 'STUFAPS')->first();

        $children = [
            [
                'code' => 'CMSP',
                'name' => 'CMSP',
                'description' => 'CHED Merit Scholarship Program',
                'status' => 'active',
            ],
            [
                'code' => 'COSCHO',
                'name' => 'CoScho',
                'description' => 'Scholarship Program for Coconut Farmers and their Families',
                'status' => 'active',
            ],
            [
                'code' => 'CHED-TDP',
                'name' => 'CHED TDP',
                'description' => 'CHED Tulong Dunong Program',
                'status' => 'active',
            ],
            [
                'code' => 'ACEF-GIAHEP',
                'name' => 'ACEF-GIAHEP',
                'description' => 'Agricultural Competitiveness Enhancement Fund-Grants-in-Aid for Higher Education Program',
                'status' => 'active',
            ],
            [
                'code' => 'SIDA-SGP',
                'name' => 'SIDA-SGP',
                'description' => 'Scholarship Grant for Children and Dependents of Sugarcane Industry Workers and Small Sugarcane Farmers',
                'status' => 'active',
            ],
            [
                'code' => 'MSRS',
                'name' => 'MSRS',
                'description' => 'Medical Scholarship and Return Service',
                'status' => 'active',
            ],
        ];

        foreach ($children as $child) {
            Program::firstOrCreate(
                ['code' => $child['code']],
                array_merge($child, ['parent_id' => $stufaps->id])
            );
        }
    }
}
