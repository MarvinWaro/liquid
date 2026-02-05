<?php

namespace Database\Seeders;

use App\Models\Region;
use Illuminate\Database\Seeder;

class RegionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $regions = [
            [
                'code' => 'R12',
                'name' => 'Region 12',
                'description' => 'SOCCSKSARGEN Region',
                'status' => 'active',
            ],
            [
                'code' => 'BARMM',
                'name' => 'BARMM',
                'description' => 'Bangsamoro Autonomous Region in Muslim Mindanao',
                'status' => 'active',
            ],
        ];

        foreach ($regions as $region) {
            Region::updateOrCreate(
                ['code' => $region['code']],
                $region
            );
        }
    }
}
