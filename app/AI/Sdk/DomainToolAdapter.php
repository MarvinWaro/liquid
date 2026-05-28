<?php

declare(strict_types=1);

namespace App\AI\Sdk;

use App\AI\Tools\Tool as DomainTool;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\JsonSchema\Types\Type;
use JsonException;
use Laravel\Ai\Contracts\Tool as SdkTool;
use Laravel\Ai\Tools\Request;
use Stringable;
use Throwable;

/**
 * Bridges our protocol-agnostic domain tools to the Laravel AI SDK's Tool
 * contract. One adapter per (domain tool, user) pair — the user is captured
 * at construction time so each prompt invocation runs with the caller's
 * access scope.
 *
 * Schema translation: domain tools own their schema in OpenAI/Groq array
 * form (a single source of truth used by the MCP wrappers' schema()
 * declarations too). This adapter converts that array to the SDK's fluent
 * JsonSchema builder so we don't duplicate every property.
 */
class DomainToolAdapter implements SdkTool
{
    public function __construct(
        private readonly DomainTool $domain,
        private readonly User $user,
    ) {}

    /**
     * The SDK's ToolNameResolver looks for a name() method first, then falls
     * back to class_basename. We expose the domain tool's snake_case name so
     * the model sees the same identifiers as before the SDK migration.
     */
    public function name(): string
    {
        return $this->domain->name();
    }

    public function description(): Stringable|string
    {
        return $this->domain->description();
    }

    /**
     * Execute the domain tool and JSON-encode the array result for the SDK.
     * Errors are returned as a JSON error object rather than thrown so a
     * single tool failure does not abort the entire agent loop.
     */
    public function handle(Request $request): Stringable|string
    {
        try {
            $result = $this->domain->execute($this->user, $request->all());

            return json_encode($result, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        } catch (Throwable $exception) {
            try {
                return json_encode([
                    'error' => 'Tool execution failed: '.$exception->getMessage(),
                ], JSON_THROW_ON_ERROR);
            } catch (JsonException) {
                return '{"error":"Tool execution failed."}';
            }
        }
    }

    /**
     * @return array<string, Type>
     */
    public function schema(JsonSchema $schema): array
    {
        $jsonSchema = $this->domain->jsonSchema();
        $properties = is_array($jsonSchema['properties'] ?? null) ? $jsonSchema['properties'] : [];
        $required = is_array($jsonSchema['required'] ?? null) ? $jsonSchema['required'] : [];

        $result = [];
        foreach ($properties as $name => $definition) {
            if (! is_string($name) || ! is_array($definition)) {
                continue;
            }
            $type = $this->buildType($definition, $schema);
            if (in_array($name, $required, true)) {
                $type->required();
            }
            $result[$name] = $type;
        }

        return $result;
    }

    /**
     * Recursively translate a JSON-Schema property definition into a fluent
     * Type. Only the keys our domain tools actually use are supported.
     *
     * @param  array<string, mixed>  $definition
     */
    private function buildType(array $definition, JsonSchema $schema): Type
    {
        $type = match ($definition['type'] ?? 'string') {
            'integer' => $schema->integer(),
            'number' => $schema->number(),
            'boolean' => $schema->boolean(),
            'array' => $schema->array()->items(
                $this->buildType(
                    is_array($definition['items'] ?? null) ? $definition['items'] : ['type' => 'string'],
                    $schema,
                ),
            ),
            default => $schema->string(),
        };

        if (isset($definition['description']) && is_string($definition['description'])) {
            $type->description($definition['description']);
        }
        if (isset($definition['enum']) && is_array($definition['enum'])) {
            $type->enum($definition['enum']);
        }
        if (isset($definition['minimum']) && is_int($definition['minimum'])) {
            $type->min($definition['minimum']);
        }
        if (isset($definition['maximum']) && is_int($definition['maximum'])) {
            $type->max($definition['maximum']);
        }

        return $type;
    }
}
