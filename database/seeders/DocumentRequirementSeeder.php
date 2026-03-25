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
        // TES & TDP share the same 10 requirements
        $tesAndTdpRequirements = [
            [
                'code' => 'TRANSMITTAL',
                'name' => 'Transmittal',
                'sort_order' => 1,
                'description' => 'Should be duly signed by the president or head of HEI',
                'upload_message' => 'The attached transmittal letter must be duly signed by the President/Head of your HEI. Proceed with upload?',
            ],
            [
                'code' => 'FUR',
                'name' => 'Fund Utilization Report',
                'sort_order' => 2,
                'description' => null,
                'upload_message' => 'The attached Fund Utilization Report must be complete and duly signed by the authorized official of your HEI. Proceed with upload?',
            ],
            [
                'code' => 'OR_ASC_MGMT',
                'name' => 'Official Receipt for the use of ASC or Management Fee',
                'sort_order' => 3,
                'description' => "Administrative Support Cost (ASC)\r\nThe ASC for HEIs, shall cover expenses on monitoring, notarization of legal documents, office supplies and materials, hiring of project technical staff/s or job order, communication, transportation / travel, remedial / mentoring program and meetings / orientation / general assembly and cash cards that will be issued to the TES student-grantees. Also, see Memorandum Circular No. 3 series of 2024 for the detailed allowable expenses and required attachments.\r\n\r\n\r\nManagement Fee\r\nOfficial receipt issued by the HEI duly signed by the  Finance Officer or Authorized Official of the  HEI for the receipt of fund (Effective starting Academic Year 2024-2025 and onwards)",
                'upload_message' => 'The attached Official Receipt and other supporting documents for the ASC or Management Fee must be complete and duly signed/authorized. Proceed with upload?',
            ],
            [
                'code' => 'CHEQUE_REPORT',
                'name' => 'Report of Cheque Issued',
                'sort_order' => 4,
                'description' => 'Report of Checks issued with supporting documents for ASC, signed by Disbursing Officer, approved by the Finance Officer or Authorized Official (Annex 9);',
                'upload_message' => 'The attached report of checks issued, with supporting documents for ASC, must be signed by the Disbursing Officer and approved by the Finance Officer or Authorized Official (Annex 9) Proceed with upload?',
            ],
            [
                'code' => 'PROOF_DISBURSEMENT',
                'name' => 'Proof of Disbursement (General Payroll/Bank Transfer/Money Remittance)',
                'sort_order' => 5,
                'description' => null,
                'upload_message' => 'The attached proof of Disbursement (General Payroll / Bank Transfer / Money Remittance) must be complete and duly signed. Proceed with upload?',
            ],
            [
                'code' => 'BILLING_DOCS',
                'name' => 'Billing Documents',
                'sort_order' => 6,
                'description' => "Attach the updated Billing documents received from CHED's Cashier's Office",
                'upload_message' => "The attached updated billing documents must be received from CHED's Cashier's Office. Proceed with upload?",
            ],
            [
                'code' => 'COR_COE',
                'name' => 'Certificate of Registration/Certificate of Enrollment',
                'sort_order' => 7,
                'description' => 'Attach the final Certificate of Registration/Certificate of Enrollment',
                'upload_message' => 'The attached Certificate of Registration/Certificate of Enrollment must be final. Proceed with upload?',
            ],
            [
                'code' => 'SHARING_ANNEX10',
                'name' => 'Sharing Agreement or Annex 10',
                'sort_order' => 8,
                'description' => "Sharing Agreement - Applicable for Academic Years  2018-2019 to 1st semester Academic Year 2021-2022\r\n\r\nAnnex 10: Certified List of Tertiary Education Subsidy (TES) Grantees with Notarized TES Sharing Agreement starting 2nd semester Academic Year 2021-2022 and onwards\r\n\r\nApplicable Batch: Batch 1 Grantees (P30,000.00 stipend)",
                'upload_message' => 'Attach the signed sharing agreement, if applicable. Proceed with upload?',
            ],
            [
                'code' => 'SCHOOL_ID',
                'name' => 'School Identification Card',
                'sort_order' => 9,
                'description' => "Must have three (3) specimen signatures of the student-grantee. Specimen signatures must be the same signature appearing in the student-grantee's school ID",
                'upload_message' => 'The attached ID must have 3 specimen signatures of the student-grantee, same as on the school ID. Proceed with upload?',
            ],
            [
                'code' => 'OR_REFUND',
                'name' => 'Official Receipt for Refund',
                'sort_order' => 10,
                'description' => "Attach scanned copy of refund for unutilized Adminisitrative Support Cost or unclaimed student-grantee's stipend",
                'upload_message' => "The attached scanned copy of refund for unutilized Administrative Support Cost or unclaimed student-grantee's stipend, must be complete and final, if any. Proceed with upload?",
                'is_required' => false,
            ],
        ];

        // Seed TES and TDP requirements
        $programs = Program::whereIn('code', ['TES', 'TDP'])->get();

        foreach ($programs as $program) {
            foreach ($tesAndTdpRequirements as $requirement) {
                $isRequired = $requirement['is_required'] ?? true;
                unset($requirement['is_required']);

                DocumentRequirement::firstOrCreate(
                    [
                        'program_id' => $program->id,
                        'code' => $requirement['code'],
                    ],
                    array_merge($requirement, [
                        'is_active' => true,
                        'is_required' => $isRequired,
                    ])
                );
            }
        }

        // COSCHO requirements
        $this->seedProgramRequirements('COSCHO', [
            [
                'code' => 'FSR',
                'name' => 'Financial Status Report',
                'sort_order' => 1,
                'description' => 'Original copy of the Financial Status Report duly certified correct by the Accountant, approved by the HEI President and received by the Commission on Audit (COA)',
                'upload_message' => 'The signature/s in the Financial Status Report should be fresh not e - signature',
            ],
            [
                'code' => 'GP',
                'name' => 'General Payroll (Billing)',
                'sort_order' => 2,
                'description' => 'Original or certified true copy of the General Payroll (Billing) signed by scholars duly certified correct by the accountant, approved by the HEI President and Received COA for SUCs / verified by the internal auditor for Private HEIs',
                'upload_message' => 'Please make sure that all grantees have signed in the billing.',
            ],
            [
                'code' => 'CORA',
                'name' => 'Certificate of Registration with Assessment',
                'sort_order' => 3,
                'description' => 'Original or certified true copy of Certificate of Registration with assessment',
                'upload_message' => 'Please upload complete and approriate document',
            ],
            [
                'code' => 'COG',
                'name' => 'Certificate of Grades',
                'sort_order' => 4,
                'description' => 'Original or certified true copy of certificate of grades',
                'upload_message' => 'Please upload complete and approriate document',
            ],
            [
                'code' => 'VIC',
                'name' => 'Valid Identification Card',
                'sort_order' => 5,
                'description' => "Certified true copy of valid Identification (ID) Card bearing scholars' signature",
                'upload_message' => 'Must bear 3 specimen signature of grantee/s',
            ],
            [
                'code' => 'OR',
                'name' => 'Official Receipt of the utilized/returned ASC',
                'sort_order' => 6,
                'description' => 'Original/Certified True Copy of the Official Receipt of the utilized/returned Administrative Cost',
                'upload_message' => null,
            ],
        ]);

        // CMSP requirements
        $this->seedProgramRequirements('CMSP', [
            [
                'code' => 'TRANSMITTAL',
                'name' => 'Transmittal',
                'sort_order' => 1,
                'description' => 'Transmittal',
                'upload_message' => 'The attached transmittal letter must be duly signed by the President/Head of your HEI.',
            ],
            [
                'code' => 'LRF',
                'name' => 'Liquidation Report Form',
                'sort_order' => 2,
                'description' => 'Annex F-7 Liquidation Report Form duly signed by grantees (1 Original copy, 2 Certified True Photocopy)',
                'upload_message' => "Please ensure that all grantees have signed.\nIf there is a returned fund, attach a photocopy of the Official Receipt (OR).",
            ],
            [
                'code' => 'BF',
                'name' => 'Billing Form',
                'sort_order' => 3,
                'description' => 'Billing Form duly signed by grantees (1 Original copy, 2 Certified True Photocopy)',
                'upload_message' => "Please ensure that all grantees have signed.\nIf there is a returned fund, attach a photocopy of the Official Receipt (OR).",
            ],
        ]);

        // CHED-TDP requirements
        $this->seedProgramRequirements('CHED-TDP', [
            [
                'code' => 'BF',
                'name' => 'Billing Form',
                'sort_order' => 1,
                'description' => 'Billing Form duly signed by grantees (1 Original copy, 2 Certified True Photocopy)',
                'upload_message' => null,
            ],
        ]);

        // ACEF-GIAHEP requirements
        $this->seedProgramRequirements('ACEF-GIAHEP', [
            [
                'code' => 'BF',
                'name' => 'Billing Form',
                'sort_order' => 1,
                'description' => 'Billing Form duly signed by the grantees (1 Original copy, 2 Certified True Photocopy)',
                'upload_message' => "Please ensure that all grantees have signed.\nIf there is a returned fund, attach a Certified True Copy of the Official Receipt (OR).",
            ],
        ]);

        // SIDA-SGP requirements
        $this->seedProgramRequirements('SIDA-SGP', [
            [
                'code' => 'COE-COR',
                'name' => 'Certificate of Enrollment (COE) or Certificate of Registration (COR)',
                'sort_order' => 1,
                'description' => 'Original/Certified True Copy of Certificate of Enrollment (COE) or Certificate of Registration (COR)',
                'upload_message' => 'Please upload complete documents.',
            ],
            [
                'code' => 'COG',
                'name' => 'Certificate of Grades',
                'sort_order' => 2,
                'description' => 'Original/Certified True Copy of Certificate of Grades from previous semester',
                'upload_message' => 'Please upload complete documents.',
            ],
            [
                'code' => 'SPPR',
                'name' => 'Signed Payroll or Proof of Receipt',
                'sort_order' => 3,
                'description' => 'Original/Certified True Copy of Signed Payroll or any proof of receipt of allowance',
                'upload_message' => 'Please ensure that all grantees have signed.',
            ],
            [
                'code' => 'SID',
                'name' => 'School Identification Card',
                'sort_order' => 4,
                'description' => 'Original/Certified True Copy of School Identification Card',
                'upload_message' => 'Please upload complete documents.',
            ],
            [
                'code' => 'OR',
                'name' => 'Official Receipt of the utilized/returned ASC',
                'sort_order' => 5,
                'description' => 'Original/Certified True Copy of the Official Receipt of the utilized/returned Administrative Cost',
                'upload_message' => null,
            ],
        ]);

        // MSRS requirements
        $this->seedProgramRequirements('MSRS', [
            [
                'code' => 'TRANSMITTAL',
                'name' => 'Transmittal letter',
                'sort_order' => 1,
                'description' => 'Transmittal letter',
                'upload_message' => null,
            ],
            [
                'code' => 'PR',
                'name' => 'Proof of Receipt',
                'sort_order' => 2,
                'description' => 'Original copy of Official Receipt (OR) of grant released by the CHEDRO',
                'upload_message' => null,
            ],
            [
                'code' => 'SP',
                'name' => 'Signed Payroll',
                'sort_order' => 3,
                'description' => 'Signed Payroll (refer to Form No. 9) or any proof of payment that the scholar received the allowance',
                'upload_message' => "Please ensure that all scholars have signed.\nIf there is a returned fund, attach a Certified True Copy of the Official Receipt (OR).",
            ],
            [
                'code' => 'SID',
                'name' => 'School Identification Card',
                'sort_order' => 4,
                'description' => 'Copy of School ID (front and back)',
                'upload_message' => 'Please upload complete documents.',
            ],
            [
                'code' => 'COE-COR',
                'name' => 'Certificate of Enrollment (COE) or Certificate of Registration (COR)',
                'sort_order' => 5,
                'description' => 'Individual copy of Certificate of Registration /Enrollment of each scholar',
                'upload_message' => 'Please upload complete documents.',
            ],
            [
                'code' => 'SOA',
                'name' => 'Statement of Account (SOA)',
                'sort_order' => 6,
                'description' => 'Individual copy of Individual Statement of Account (SOA) showing that the amount received from CHED was deducted from the TOSF of the scholar',
                'upload_message' => 'Please upload complete documents.',
            ],
        ]);
    }

    /**
     * Seed requirements for a specific program.
     */
    private function seedProgramRequirements(string $programCode, array $requirements): void
    {
        $program = Program::where('code', $programCode)->first();

        if (!$program) {
            $this->command?->warn("Program '{$programCode}' not found. Skipping its requirements.");
            return;
        }

        foreach ($requirements as $requirement) {
            DocumentRequirement::firstOrCreate(
                [
                    'program_id' => $program->id,
                    'code' => $requirement['code'],
                ],
                [
                    'name' => $requirement['name'],
                    'description' => $requirement['description'] ?? null,
                    'sort_order' => $requirement['sort_order'],
                    'upload_message' => $requirement['upload_message'] ?? null,
                    'is_active' => true,
                    'is_required' => true,
                ]
            );
        }
    }
}
