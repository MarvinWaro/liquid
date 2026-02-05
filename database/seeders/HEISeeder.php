<?php

namespace Database\Seeders;

use App\Models\HEI;
use App\Models\Region;
use Illuminate\Database\Seeder;

class HEISeeder extends Seeder
{
    public function run(): void
    {
        // Get region IDs
        $region12 = Region::where('code', 'R12')->first();

        $heis = [
            [
                'uii' => 'HEI-R12-0001',
                'code' => 'USTP',
                'name' => 'University of Science and Technology of Southern Philippines',
                'type' => 'SUC',
                'region_id' => $region12?->id,
                'status' => 'active',
            ],
            [
                'uii' => 'HEI-R12-0002',
                'code' => 'MSU-IIT',
                'name' => 'Mindanao State University - Iligan Institute of Technology',
                'type' => 'SUC',
                'region_id' => $region12?->id,
                'status' => 'active',
            ],
            [
                'uii' => 'HEI-R12-0003',
                'code' => 'XU',
                'name' => 'Xavier University - Ateneo de Cagayan',
                'type' => 'Private',
                'region_id' => $region12?->id,
                'status' => 'active',
            ],
        ];

        foreach ($heis as $hei) {
            HEI::updateOrCreate(
                ['uii' => $hei['uii']],
                $hei
            );
        }
    }
}
