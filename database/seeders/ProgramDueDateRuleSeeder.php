<?php

namespace Database\Seeders;

use App\Models\AcademicYear;
use App\Models\Program;
use App\Models\ProgramDueDateRule;
use Illuminate\Database\Seeder;

// php artisan db:seed --class=ProgramDueDateRuleSeeder

class ProgramDueDateRuleSeeder extends Seeder
{
    public function run(): void
    {
        $rules = [
            // UniFAST parent programs — 90 days
            ['program_code' => 'TES', 'ay_code' => null, 'days' => 90],
            ['program_code' => 'TDP', 'ay_code' => null, 'days' => 90],

            // STUFAPS sub-programs
            ['program_code' => 'MSRS',      'ay_code' => null, 'days' => 30],
            ['program_code' => 'ACEF-GIAHEP','ay_code' => null, 'days' => 120],
            ['program_code' => 'SIDA-SGP',  'ay_code' => null, 'days' => 45],
            ['program_code' => 'CHED-TDP',  'ay_code' => null, 'days' => 60],
            ['program_code' => 'COSCHO',    'ay_code' => null, 'days' => 120],

            // CMSP — default 60 days (2024 and below), 30 days for 2025+
            ['program_code' => 'CMSP', 'ay_code' => null,       'days' => 60],
            ['program_code' => 'CMSP', 'ay_code' => '2025-2026','days' => 30],
            ['program_code' => 'CMSP', 'ay_code' => '2026-2027','days' => 30],
        ];

        foreach ($rules as $rule) {
            $program = Program::where('code', $rule['program_code'])->first();
            if (!$program) {
                continue;
            }

            $ayId = null;
            if ($rule['ay_code']) {
                $ay = AcademicYear::where('code', $rule['ay_code'])->first();
                if (!$ay) {
                    continue;
                }
                $ayId = $ay->id;
            }

            ProgramDueDateRule::firstOrCreate(
                [
                    'program_id'      => $program->id,
                    'academic_year_id' => $ayId,
                ],
                [
                    'due_date_days' => $rule['days'],
                ]
            );
        }
    }
}
