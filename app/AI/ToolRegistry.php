<?php

declare(strict_types=1);

namespace App\AI;

use App\AI\Tools\FindLiquidationTool;
use App\AI\Tools\ListHeisTool;
use App\AI\Tools\ListLiquidationsTool;
use App\AI\Tools\ListReferenceDataTool;
use App\AI\Tools\LiquidationSummaryTool;
use App\AI\Tools\Tool;
use App\Models\User;
use Illuminate\Contracts\Container\Container;
use RuntimeException;

/**
 * Single source of truth for the assistant's available tools.
 *
 * Both the in-app ReportAssistantService and (later) the Laravel MCP server
 * iterate this registry, so adding a tool here exposes it on both surfaces.
 */
class ToolRegistry
{
    /**
     * Ordered list of tool classes. The first entry remains
     * `get_liquidation_summary` so existing tests and the JSON-schema
     * snapshot stay stable.
     *
     * @var array<int, class-string<Tool>>
     */
    public const TOOLS = [
        LiquidationSummaryTool::class,
        ListLiquidationsTool::class,
        FindLiquidationTool::class,
        ListHeisTool::class,
        ListReferenceDataTool::class,
    ];

    public function __construct(private readonly Container $container) {}

    /**
     * @return array<int, Tool>
     */
    public function all(): array
    {
        return array_map(
            fn (string $class): Tool => $this->container->make($class),
            self::TOOLS,
        );
    }

    public function get(string $name): Tool
    {
        foreach ($this->all() as $tool) {
            if ($tool->name() === $name) {
                return $tool;
            }
        }

        throw new RuntimeException("Unknown assistant tool: {$name}");
    }

    public function has(string $name): bool
    {
        foreach ($this->all() as $tool) {
            if ($tool->name() === $name) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function toOpenAiSchemas(): array
    {
        return array_map(
            fn (Tool $tool): array => $tool->toOpenAiSchema(),
            $this->all(),
        );
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    public function execute(string $name, User $user, array $arguments): array
    {
        return $this->get($name)->execute($user, $arguments);
    }
}
