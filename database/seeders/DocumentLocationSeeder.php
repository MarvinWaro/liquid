<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\DocumentLocation;
use Illuminate\Database\Seeder;

class DocumentLocationSeeder extends Seeder
{
    public function run(): void
    {
        $locations = [];
        $order = 0;

        // Shelf 1: Sections A-I, Rows R1-R5
        foreach (range('A', 'I') as $section) {
            foreach (range(1, 5) as $row) {
                $locations[] = [
                    'name' => "Shelf 1-{$section}-R{$row}",
                    'sort_order' => $order++,
                ];
            }
        }

        // Shelf 2: Sections A-G, Rows R1-R5
        foreach (range('A', 'G') as $section) {
            foreach (range(1, 5) as $row) {
                $locations[] = [
                    'name' => "Shelf 2-{$section}-R{$row}",
                    'sort_order' => $order++,
                ];
            }
        }

        // Special locations
        $locations[] = ['name' => 'Outside Office - Storage Box', 'sort_order' => $order++];
        $locations[] = ['name' => 'In Personnel Area', 'sort_order' => $order++];

        foreach ($locations as $location) {
            DocumentLocation::firstOrCreate(
                ['name' => $location['name']],
                ['sort_order' => $location['sort_order']]
            );
        }
    }
}
