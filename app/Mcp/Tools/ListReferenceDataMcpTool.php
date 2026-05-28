<?php

declare(strict_types=1);

namespace App\Mcp\Tools;

use App\AI\Tools\ListReferenceDataTool;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;

#[Name('list_reference_data')]
#[Description(
    'Return the valid code/name pairs for programs, regions, academic years, '
    .'document statuses, liquidation statuses, and RC note statuses. Call '
    .'this first when uncertain which exact filter value to pass elsewhere.',
)]
class ListReferenceDataMcpTool extends AbstractDomainTool
{
    public function __construct(ListReferenceDataTool $domain)
    {
        parent::__construct($domain);
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'categories' => $schema->array()
                ->items(
                    $schema->string()->enum([
                        'all',
                        'programs',
                        'regions',
                        'academic_years',
                        'document_statuses',
                        'liquidation_statuses',
                        'rc_note_statuses',
                    ]),
                )
                ->description('Which reference tables to include. Use ["all"] for everything.')
                ->required(),
        ];
    }
}
