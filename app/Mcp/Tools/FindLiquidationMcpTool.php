<?php

declare(strict_types=1);

namespace App\Mcp\Tools;

use App\AI\Tools\FindLiquidationTool;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;

#[Name('find_liquidation')]
#[Description(
    'Look up a single liquidation by its exact control number and return its '
    .'HEI, program, period, statuses, and financial figures. Respects role '
    .'scope: returns not-found if the record exists but is outside access.',
)]
class FindLiquidationMcpTool extends AbstractDomainTool
{
    public function __construct(FindLiquidationTool $domain)
    {
        parent::__construct($domain);
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'control_no' => $schema->string()
                ->description('Exact control number of the liquidation, e.g. "TES-2024-0001".')
                ->required(),
        ];
    }
}
