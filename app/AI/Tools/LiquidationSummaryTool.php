<?php

declare(strict_types=1);

namespace App\AI\Tools;

use App\Models\User;
use App\Services\ReportAssistantQueryService;

class LiquidationSummaryTool extends Tool
{
    public function __construct(private readonly ReportAssistantQueryService $query) {}

    public function name(): string
    {
        return 'get_liquidation_summary';
    }

    public function description(): string
    {
        return 'Aggregate liquidation totals (record count, grantees, amount disbursed, '
            .'amount liquidated, unliquidated, for-endorsement) plus a grouped breakdown. '
            .'Use for system totals, rankings, and trends. Read-only. Voided records are '
            .'excluded unless VOIDED is explicitly listed in liquidation_statuses.';
    }

    public function jsonSchema(): array
    {
        $stringArray = [
            'type' => 'array',
            'items' => ['type' => 'string'],
        ];

        return [
            'type' => 'object',
            'properties' => [
                'group_by' => [
                    'type' => 'string',
                    'enum' => [
                        'program',
                        'academic_year',
                        'region',
                        'hei',
                        'document_status',
                        'liquidation_status',
                        'rc_note_status',
                    ],
                    'description' => 'Dimension to use for the report breakdown.',
                ],
                'order_by' => [
                    'type' => 'string',
                    'enum' => [
                        'disbursed_desc',
                        'liquidation_percentage_desc',
                        'liquidation_percentage_asc',
                        'records_desc',
                        'grantees_desc',
                        'unliquidated_desc',
                    ],
                    'description' => 'How to sort the breakdown rows. Default is disbursed_desc (largest amounts first). Use liquidation_percentage_desc for "fully liquidated / top by completion" questions, liquidation_percentage_asc for "lagging / lowest completion" questions, unliquidated_desc for "largest outstanding balance" questions.',
                ],
                'programs' => $stringArray,
                'academic_years' => $stringArray,
                'regions' => $stringArray,
                'heis' => $stringArray,
                'document_statuses' => $stringArray,
                'liquidation_statuses' => $stringArray,
                'rc_note_statuses' => $stringArray,
            ],
            'required' => [
                'group_by',
                'order_by',
                'programs',
                'academic_years',
                'regions',
                'heis',
                'document_statuses',
                'liquidation_statuses',
                'rc_note_statuses',
            ],
            'additionalProperties' => false,
        ];
    }

    public function execute(User $user, array $arguments): array
    {
        return $this->query->getLiquidationSummary($user, $arguments);
    }
}
