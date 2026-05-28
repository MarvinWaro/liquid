<?php

declare(strict_types=1);

namespace App\AI\Tools;

use App\Models\User;
use App\Services\ReportAssistantQueryService;

class FindLiquidationTool extends Tool
{
    public function __construct(private readonly ReportAssistantQueryService $query) {}

    public function name(): string
    {
        return 'find_liquidation';
    }

    public function description(): string
    {
        return 'Look up a single liquidation by its exact control number and return its '
            .'HEI, program, period, statuses, and financial figures. Respects role scope: '
            .'returns "not found" if the record exists but is outside the requester\'s access.';
    }

    public function jsonSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'control_no' => [
                    'type' => 'string',
                    'description' => 'Exact control number of the liquidation, e.g. "TES-2024-0001".',
                ],
            ],
            'required' => ['control_no'],
            'additionalProperties' => false,
        ];
    }

    public function execute(User $user, array $arguments): array
    {
        return $this->query->findLiquidation($user, $arguments);
    }
}
