<?php

declare(strict_types=1);

namespace App\Mcp\Tools;

use App\AI\Tools\FindLiquidationTool;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;

#[Name('find_liquidation')]
#[Description(
    'Look up liquidations by exact control number and return HEI, program, '
    .'period, statuses, and financial figures. Control numbers are DV/batch-level '
    .'and may match multiple records (multiple_matches=true with a records array). '
    .'Respects role scope: returns not-found if the record exists but is outside access.',
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
