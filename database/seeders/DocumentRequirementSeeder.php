<?php

namespace Database\Seeders;

use App\Models\DocumentRequirement;
use App\Models\Program;
use Illuminate\Database\Seeder;

// php artisan db:seed --class=DocumentRequirementSeeder

class DocumentRequirementSeeder extends Seeder
{
    public function run(): void
    {
        $requirements = [
            ['code' => 'TRANSMITTAL', 'name' => 'Transmittal', 'sort_order' => 1],
            ['code' => 'FUR', 'name' => 'Fund Utilization Report', 'sort_order' => 2],
            ['code' => 'OR_ASC_MGMT', 'name' => 'Official Receipt for the use of ASC or Management Fee', 'sort_order' => 3],
            ['code' => 'CHEQUE_REPORT', 'name' => 'Report of Cheque Issued', 'sort_order' => 4],
            ['code' => 'PROOF_DISBURSEMENT', 'name' => 'Proof of Disbursement (General Payroll/Bank Transfer/Money Remittance)', 'sort_order' => 5],
            ['code' => 'BILLING_DOCS', 'name' => 'Billing Documents', 'sort_order' => 6],
            ['code' => 'COR_COE', 'name' => 'Certificate of Registration/Certificate of Enrollment', 'sort_order' => 7],
            ['code' => 'SHARING_ANNEX10', 'name' => 'Sharing Agreement or Annex 10', 'sort_order' => 8],
            ['code' => 'SCHOOL_ID', 'name' => 'School Identification Card', 'sort_order' => 9],
            ['code' => 'OR_REFUND', 'name' => 'Official Receipt for Refund', 'sort_order' => 10],
        ];

        $programs = Program::whereIn('code', ['TES', 'TDP'])->get();

        foreach ($programs as $program) {
            foreach ($requirements as $requirement) {
                DocumentRequirement::firstOrCreate(
                    [
                        'program_id' => $program->id,
                        'code' => $requirement['code'],
                    ],
                    [
                        'name' => $requirement['name'],
                        'sort_order' => $requirement['sort_order'],
                        'is_active' => true,
                        'is_required' => true,
                    ]
                );
            }
        }
    }
}
