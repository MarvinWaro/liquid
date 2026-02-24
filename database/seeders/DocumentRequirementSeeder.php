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
            [
                'code' => 'TRANSMITTAL',
                'name' => 'Transmittal',
                'sort_order' => 1,
                'upload_message' => 'The attached transmittal letter must be duly signed by the President/Head of your HEI. Please ensure all signatures are complete before uploading.',
            ],
            [
                'code' => 'FUR',
                'name' => 'Fund Utilization Report',
                'sort_order' => 2,
                'upload_message' => 'The Fund Utilization Report (FUR) must be signed by the Accountant and the Head of the HEI. Please ensure all amounts are accurate and reconciled.',
            ],
            [
                'code' => 'OR_ASC_MGMT',
                'name' => 'Official Receipt for the use of ASC or Management Fee',
                'sort_order' => 3,
                'upload_message' => 'Please upload the Official Receipt (OR) issued by the HEI for the Administrative Service Charge (ASC) or Management Fee deducted from the fund.',
            ],
            [
                'code' => 'CHEQUE_REPORT',
                'name' => 'Report of Cheque Issued',
                'sort_order' => 4,
                'upload_message' => 'The Report of Cheques Issued must include all cheque numbers, payee names, and amounts. Please ensure all entries are accounted for.',
            ],
            [
                'code' => 'PROOF_DISBURSEMENT',
                'name' => 'Proof of Disbursement (General Payroll/Bank Transfer/Money Remittance)',
                'sort_order' => 5,
                'upload_message' => 'Please upload proof of disbursement such as General Payroll, Bank Transfer confirmation, or Money Remittance receipts. All beneficiaries must be accounted for.',
            ],
            [
                'code' => 'BILLING_DOCS',
                'name' => 'Billing Documents',
                'sort_order' => 6,
                'upload_message' => 'Please upload billing documents including Statement of Account (SOA) and other supporting billing records.',
            ],
            [
                'code' => 'COR_COE',
                'name' => 'Certificate of Registration/Certificate of Enrollment',
                'sort_order' => 7,
                'upload_message' => 'Please upload the Certificate of Registration (COR) or Certificate of Enrollment (COE) for all beneficiaries listed in the liquidation.',
            ],
            [
                'code' => 'SHARING_ANNEX10',
                'name' => 'Sharing Agreement or Annex 10',
                'sort_order' => 8,
                'upload_message' => 'The Sharing Agreement or Annex 10 must be duly signed by both parties. Please ensure the document is complete and legible.',
            ],
            [
                'code' => 'SCHOOL_ID',
                'name' => 'School Identification Card',
                'sort_order' => 9,
                'upload_message' => 'Please upload scanned copies of School IDs for all beneficiaries. Ensure that photos and details are clearly visible.',
            ],
            [
                'code' => 'OR_REFUND',
                'name' => 'Official Receipt for Refund',
                'sort_order' => 10,
                'upload_message' => 'Please upload the Official Receipt (OR) for all refunded amounts. The OR must be issued by the HEI cashier or authorized officer.',
            ],
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
                        'upload_message' => $requirement['upload_message'] ?? null,
                        'is_active' => true,
                        'is_required' => true,
                    ]
                );
            }
        }
    }
}
