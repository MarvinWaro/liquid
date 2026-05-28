<?php

declare(strict_types=1);

use App\Mcp\Servers\LiquidationReportServer;
use Laravel\Mcp\Facades\Mcp;

/*
|--------------------------------------------------------------------------
| AI / MCP Routes
|--------------------------------------------------------------------------
|
| Routes registered here are auto-loaded by Laravel\Mcp\Server\McpServiceProvider.
| The Liquidation Report Server exposes the same read-only tools used by the
| in-app Report Assistant, gated by the mcp.auth bearer-token middleware.
|
*/

Mcp::web('/mcp/liquidation', LiquidationReportServer::class)
    ->middleware(['mcp.auth', 'throttle:60,1']);
