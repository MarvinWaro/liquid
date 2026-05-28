<?php

declare(strict_types=1);

namespace App\AI\Tools;

use App\Models\User;

/**
 * Base class for assistant tools.
 *
 * A single tool implementation is consumed by both the in-app Groq chat
 * service (via OpenAI-compatible function calling) and the Laravel MCP server
 * (added in Phase 2). The two surfaces share name, description, schema, and
 * execute() so behavior cannot drift between them.
 */
abstract class Tool
{
    abstract public function name(): string;

    abstract public function description(): string;

    /**
     * JSON Schema object describing the tool's input arguments. Must be
     * compatible with the OpenAI/Groq function-calling shape (top-level
     * `type: object` with `properties` and `required`).
     *
     * @return array<string, mixed>
     */
    abstract public function jsonSchema(): array;

    /**
     * Execute the tool. Return value must be JSON-serializable.
     *
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    abstract public function execute(User $user, array $arguments): array;

    /**
     * Render this tool as an OpenAI/Groq `tools[]` descriptor.
     *
     * @return array<string, mixed>
     */
    public function toOpenAiSchema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => $this->description(),
                'parameters' => $this->jsonSchema(),
            ],
        ];
    }
}
