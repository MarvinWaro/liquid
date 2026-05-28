<?php

declare(strict_types=1);

namespace App\Mcp\Tools;

use App\AI\Tools\ListHeisTool;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;

#[Name('list_heis')]
#[Description(
    'Browse the catalog of Higher Education Institutions (HEIs) with optional '
    .'name/UII search and region filter. Paginated (max 50 per page). Use to '
    .'confirm an HEI\'s official name or UII before filtering other tools.',
)]
class ListHeisMcpTool extends AbstractDomainTool
{
    public function __construct(ListHeisTool $domain)
    {
        parent::__construct($domain);
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'search' => $schema->string()
                ->description('Optional substring to match against HEI name or UII.'),
            'regions' => $schema->array()
                ->items($schema->string())
                ->description('Filter by region code, name, or UUID.'),
            'page' => $schema->integer()
                ->description('Page number, starting at 1.')
                ->min(1),
            'per_page' => $schema->integer()
                ->description('HEIs per page (1-50).')
                ->min(1)
                ->max(50),
        ];
    }
}
