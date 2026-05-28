<?php

declare(strict_types=1);

namespace App\Mcp\Tools;

use App\AI\Tools\Tool as DomainTool;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Tool as McpTool;
use Throwable;

/**
 * Bridge between Laravel MCP tools and the in-app domain tool registry.
 *
 * Every concrete MCP tool only needs to declare its input schema and pass a
 * domain tool instance to the parent constructor. Execution, authentication,
 * error handling, and serialization stay here so we cannot drift from the
 * in-app Groq assistant's behavior.
 */
abstract class AbstractDomainTool extends McpTool
{
    public function __construct(
        protected readonly DomainTool $domain,
    ) {}

    public function handle(Request $request): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return Response::error(
                'Unauthenticated. Send Authorization: Bearer <MCP_API_KEY> to call this tool.',
            );
        }

        try {
            $result = $this->domain->execute($user, $request->all());
        } catch (Throwable $exception) {
            Log::warning('MCP tool execution failed.', [
                'tool' => $this->name(),
                'user_id' => $user->id,
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            return Response::error('The requested tool could not complete this request.');
        }

        return Response::json($result);
    }
}
