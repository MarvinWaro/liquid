<?php

declare(strict_types=1);

namespace App\AI\Tools;

use App\Models\User;
use App\Services\ReportAssistantQueryService;

class ListLiquidationsTool extends Tool
{
    public function __construct(private readonly ReportAssistantQueryService $query) {}

    public function name(): string
    {
        return 'list_liquidations';
    }

    public function description(): string
    {
        return 'List individual liquidation records matching the supplied filters. '
            .'Paginated (max 25 per page) and bounded by the requester\'s role scope. '
            .'Use when the user wants specific records, not just totals — e.g. "which '
            .'liquidations from HEI X are unliquidated", "show submissions for AY 2024-2025".';
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
                'control_no_search' => [
                    'type' => 'string',
                    'description' => 'Optional substring to match against control_no or HEI name.',
                ],
                'page' => [
                    'type' => 'integer',
                    'minimum' => 1,
                    'description' => 'Page number, starting at 1.',
                ],
                'per_page' => [
                    'type' => 'integer',
                    'minimum' => 1,
                    'maximum' => 25,
                    'description' => 'Records per page (1-25).',
                ],
                'order_by' => [
                    'type' => 'string',
                    'enum' => [
                        'control_no_asc',
                        'unliquidated_desc',
                        'disbursed_desc',
                        'liquidated_desc',
                        'date_submitted_desc',
                        'date_submitted_asc',
                    ],
                    'description' => 'How to sort records. Default control_no_asc. Use unliquidated_desc for "records with largest outstanding balance", disbursed_desc for "largest disbursements", date_submitted_desc for "most recent submissions".',
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
                'control_no_search',
                'page',
                'per_page',
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
        return $this->query->listLiquidations($user, $arguments);
    }
}
