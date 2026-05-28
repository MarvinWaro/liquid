<?php

declare(strict_types=1);

namespace App\Mcp\Tools;

use App\AI\Tools\ListLiquidationsTool;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;

#[Name('list_liquidations')]
#[Description(
    'List individual liquidation records matching the supplied filters. '
    .'Paginated (max 25 per page) and bounded by the requester\'s role scope. '
    .'Use when the caller wants specific records, not just totals.',
)]
class ListLiquidationsMcpTool extends AbstractDomainTool
{
    public function __construct(ListLiquidationsTool $domain)
    {
        parent::__construct($domain);
    }

    public function schema(JsonSchema $schema): array
    {
        $stringArray = $schema->array()->items($schema->string());

        return [
            'control_no_search' => $schema->string()
                ->description('Optional substring to match against control_no or HEI name.'),
            'page' => $schema->integer()
                ->description('Page number, starting at 1.')
                ->min(1),
            'per_page' => $schema->integer()
                ->description('Records per page (1-25).')
                ->min(1)
                ->max(25),
            'order_by' => $schema->string()
                ->description('Record sort. Default control_no_asc. Use unliquidated_desc for "largest outstanding balance", disbursed_desc for "largest disbursements", date_submitted_desc for "most recent submissions".')
                ->enum([
                    'control_no_asc',
                    'unliquidated_desc',
                    'disbursed_desc',
                    'liquidated_desc',
                    'date_submitted_desc',
                    'date_submitted_asc',
                ]),
            'programs' => $stringArray->description('Filter by program code, name, or UUID.'),
            'academic_years' => $stringArray->description('Filter by academic year name.'),
            'regions' => $stringArray->description('Filter by region code, name, or UUID.'),
            'heis' => $stringArray->description('Filter by HEI UII, name, or UUID.'),
            'document_statuses' => $stringArray->description('Filter by document status code or name.'),
            'liquidation_statuses' => $stringArray->description('Filter by liquidation status code or name.'),
            'rc_note_statuses' => $stringArray->description('Filter by RC note status code, name, or "none".'),
        ];
    }
}
