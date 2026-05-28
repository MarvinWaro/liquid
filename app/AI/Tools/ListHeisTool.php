<?php

declare(strict_types=1);

namespace App\AI\Tools;

use App\Models\User;
use App\Services\ReportAssistantQueryService;

class ListHeisTool extends Tool
{
    public function __construct(private readonly ReportAssistantQueryService $query) {}

    public function name(): string
    {
        return 'list_heis';
    }

    public function description(): string
    {
        return 'Browse the catalog of Higher Education Institutions (HEIs) with optional '
            .'name/UII search and region filter. Paginated (max 50 per page). Use when the '
            .'user names an HEI inexactly and you need to confirm the official name or UII '
            .'before calling another tool.';
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
                'search' => [
                    'type' => 'string',
                    'description' => 'Optional substring to match against HEI name or UII.',
                ],
                'regions' => $stringArray,
                'page' => [
                    'type' => 'integer',
                    'minimum' => 1,
                    'description' => 'Page number, starting at 1.',
                ],
                'per_page' => [
                    'type' => 'integer',
                    'minimum' => 1,
                    'maximum' => 50,
                    'description' => 'HEIs per page (1-50).',
                ],
            ],
            'required' => ['search', 'regions', 'page', 'per_page'],
            'additionalProperties' => false,
        ];
    }

    public function execute(User $user, array $arguments): array
    {
        return $this->query->listHeis($user, $arguments);
    }
}
