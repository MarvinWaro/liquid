<?php

declare(strict_types=1);

namespace App\Mcp\Servers;

use App\Mcp\Tools\FindLiquidationMcpTool;
use App\Mcp\Tools\ListHeisMcpTool;
use App\Mcp\Tools\ListLiquidationsMcpTool;
use App\Mcp\Tools\ListReferenceDataMcpTool;
use App\Mcp\Tools\LiquidationSummaryMcpTool;
use Laravel\Mcp\Server;
use Laravel\Mcp\Server\Attributes\Instructions;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Version;

#[Name('UniFAST Liquidation Report Server')]
#[Version('1.0.0')]
#[Instructions(<<<'TXT'
Read-only MCP server exposing the UniFAST Liquidation Management System reporting tools.

Available tools:
- get_liquidation_summary: aggregate totals and grouped breakdowns.
- list_liquidations: paginated list of individual liquidation records.
- find_liquidation: look up a single liquidation by exact control number.
- list_heis: browse the HEI catalog with optional name/UII search.
- list_reference_data: valid codes/names for filter values.

Guidance:
- All tools are read-only and bounded by the authenticated user's role scope.
- Voided records are excluded unless VOIDED is explicitly listed in liquidation_statuses.
- Call list_reference_data or list_heis when uncertain about a filter value rather than guessing.
- If a filter returns under "unmatched_filters", surface that to the user instead of treating the empty result as authoritative.
- Currency figures are Philippine pesos.
TXT)]
class LiquidationReportServer extends Server
{
    protected array $tools = [
        LiquidationSummaryMcpTool::class,
        ListLiquidationsMcpTool::class,
        FindLiquidationMcpTool::class,
        ListHeisMcpTool::class,
        ListReferenceDataMcpTool::class,
    ];

    protected array $resources = [];

    protected array $prompts = [];
}
