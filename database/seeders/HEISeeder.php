<?php

namespace Database\Seeders;

use App\Models\HEI;
use Illuminate\Database\Seeder;

class HEISeeder extends Seeder
{
    public function run(): void
    {
        $heis = [
            [
                'code' => 'USTP',
                'name' => 'University of Science and Technology of Southern Philippines',
                'type' => 'Public',
                'region' => 'Region X',
                'province' => 'Misamis Oriental',
                'city_municipality' => 'Cagayan de Oro City',
                'address' => 'Claro M. Recto Avenue, Lapasan, Cagayan de Oro City',
                'contact_person' => 'Dr. Ambrosio B. Cultura II',
                'contact_number' => '(088) 856-1738',
                'email' => 'ustp@ustp.edu.ph',
                'status' => 'active',
            ],
            [
                'code' => 'MSU-IIT',
                'name' => 'Mindanao State University - Iligan Institute of Technology',
                'type' => 'Public',
                'region' => 'Region X',
                'province' => 'Lanao del Norte',
                'city_municipality' => 'Iligan City',
                'address' => 'Andres Bonifacio Avenue, Tibanga, Iligan City',
                'contact_person' => 'Dr. Elpidio M. Iroy',
                'contact_number' => '(063) 221-4056',
                'email' => 'chancellor@msuiit.edu.ph',
                'status' => 'active',
            ],
            [
                'code' => 'XU',
                'name' => 'Xavier University - Ateneo de Cagayan',
                'type' => 'Private',
                'region' => 'Region X',
                'province' => 'Misamis Oriental',
                'city_municipality' => 'Cagayan de Oro City',
                'address' => 'Corrales Avenue, Cagayan de Oro City',
                'contact_person' => 'Fr. Roberto C. Yap, SJ',
                'contact_number' => '(088) 858-4000',
                'email' => 'info@xu.edu.ph',
                'status' => 'active',
            ],
        ];

        foreach ($heis as $hei) {
            HEI::updateOrCreate(
                ['code' => $hei['code']],
                $hei
            );
        }
    }
}
