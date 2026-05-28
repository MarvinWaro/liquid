<?php

declare(strict_types=1);

namespace App\AI\Tools;

use App\Models\User;
use App\Services\ReportAssistantQueryService;

class ListReferenceDataTool extends Tool
{
    public function __construct(private readonly ReportAssistantQueryService $query) {}

    public function name(): string
    {
        return 'list_reference_data';
    }

    public function description(): string
    {
        return 'Return the valid code/name pairs for programs, regions, academic years, '
            .'document statuses, liquidation statuses, and RC note statuses. Call this '
            .'first when uncertain which exact code or name to pass to other tools — it '
            .'prevents guessing invalid filter values.';
    }

    public function jsonSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'categories' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'string',
                        'enum' => [
                            'all',
                            'programs',
                            'regions',
                            'academic_years',
                            'document_statuses',
                            'liquidation_statuses',
                            'rc_note_statuses',
                        ],
                    ],
                    'description' => 'Which reference tables to include. Use ["all"] for everything.',
                ],
            ],
            'required' => ['categories'],
            'additionalProperties' => false,
        ];
    }

    public function execute(User $user, array $arguments): array
    {
        return $this->query->getReferenceData($user, $arguments);
    }
}
