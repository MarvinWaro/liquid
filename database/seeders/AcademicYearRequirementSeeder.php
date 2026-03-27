<?php

namespace Database\Seeders;

use App\Models\AcademicYear;
use App\Models\AcademicYearDocumentRequirement;
use App\Models\DocumentRequirement;
use App\Models\Program;
use Illuminate\Database\Seeder;

// php artisan db:seed --class=AcademicYearRequirementSeeder

class AcademicYearRequirementSeeder extends Seeder
{
    public function run(): void
    {
        $cmsp = Program::where('code', 'CMSP')->first();

        if (!$cmsp) {
            $this->command?->warn("Program 'CMSP' not found. Skipping AY requirement overrides.");
            return;
        }

        // AY 2024-2025: CMSP's LRF and TRANSMITTAL are inactive (only BF remains active)
        $ay2024 = AcademicYear::where('code', '2024-2025')->first();
        if ($ay2024) {
            $this->createOverride($ay2024, $cmsp, 'LRF', ['is_active' => false]);
            $this->createOverride($ay2024, $cmsp, 'TRANSMITTAL', ['is_active' => false]);
        }

        // AY 2025-2026: CMSP's BF is inactive (only TRANSMITTAL + LRF remain active)
        $ay2025 = AcademicYear::where('code', '2025-2026')->first();
        if ($ay2025) {
            $this->createOverride($ay2025, $cmsp, 'BF', ['is_active' => false]);
        }
    }

    /**
     * Create an AY-specific document requirement override.
     */
    private function createOverride(AcademicYear $ay, Program $program, string $reqCode, array $overrides): void
    {
        $requirement = DocumentRequirement::where('program_id', $program->id)
            ->where('code', $reqCode)
            ->first();

        if (!$requirement) {
            $this->command?->warn("Requirement '{$reqCode}' for program '{$program->code}' not found. Skipping.");
            return;
        }

        AcademicYearDocumentRequirement::firstOrCreate(
            [
                'academic_year_id' => $ay->id,
                'document_requirement_id' => $requirement->id,
            ],
            $overrides
        );
    }
}
