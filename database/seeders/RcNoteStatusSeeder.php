<?php

namespace Database\Seeders;

use App\Models\RcNoteStatus;
use Illuminate\Database\Seeder;

class RcNoteStatusSeeder extends Seeder
{
    public function run(): void
    {
        $statuses = [
            ['code' => 'NO_SUBMISSION',       'name' => 'No Submission',       'badge_color' => 'gray',   'sort_order' => 0],
            ['code' => 'FOR_REVIEW',          'name' => 'For Review',          'badge_color' => 'blue',   'sort_order' => 1],
            ['code' => 'FOR_COMPLIANCE',      'name' => 'For Compliance',      'badge_color' => 'yellow', 'sort_order' => 2],
            ['code' => 'FOR_ENDORSEMENT',     'name' => 'For Endorsement',     'badge_color' => 'orange', 'sort_order' => 3],
            ['code' => 'FULLY_ENDORSED',      'name' => 'Fully Endorsed',      'badge_color' => 'green',  'sort_order' => 4],
            ['code' => 'PARTIALLY_ENDORSED',  'name' => 'Partially Endorsed',  'badge_color' => 'amber',  'sort_order' => 5],
        ];

        foreach ($statuses as $status) {
            RcNoteStatus::firstOrCreate(
                ['code' => $status['code']],
                [
                    'name'        => $status['name'],
                    'badge_color' => $status['badge_color'],
                    'sort_order'  => $status['sort_order'],
                    'is_active'   => true,
                ]
            );
        }
    }
}
