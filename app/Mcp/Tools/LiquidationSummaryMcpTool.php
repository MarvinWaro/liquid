<?php

declare(strict_types=1);

namespace App\Mcp\Tools;

use App\AI\Tools\LiquidationSummaryTool;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;

#[Name('get_liquidation_summary')]
#[Description(
    'Aggregate liquidation totals (records, grantees, amount disbursed, '
    .'liquidated, unliquidated, for-endorsement) plus a grouped breakdown. '
    .'Read-only. Voided records are excluded unless VOIDED is explicitly '
    .'listed in liquidation_statuses.',
)]
class LiquidationSummaryMcpTool extends AbstractDomainTool
{
    public function __construct(LiquidationSummaryTool $domain)
    {
        parent::__construct($domain);
    }

    public function schema(JsonSchema $schema): array
    {
        $stringArray = $schema->array()->items($schema->string());

        return [
            'group_by' => $schema->string()
                ->description('Dimension to use for the breakdown.')
                ->enum([
                    'program',
                    'academic_year',
                    'region',
                    'hei',
                    'document_status',
                    'liquidation_status',
                    'rc_note_status',
                ])
                ->required(),
            'order_by' => $schema->string()
                ->description('Breakdown sort. Default disbursed_desc. Use liquidation_percentage_desc for "fully liquidated" questions, liquidation_percentage_asc for "lagging" questions, unliquidated_desc for largest outstanding balance.')
                ->enum([
                    'disbursed_desc',
                    'liquidation_percentage_desc',
                    'liquidation_percentage_asc',
                    'records_desc',
                    'grantees_desc',
                    'unliquidated_desc',
                ]),
            'programs' => $stringArray->description('Filter by program code, name, or UUID.'),
            'academic_years' => $stringArray->description('Filter by academic year name (e.g. "2024-2025").'),
            'regions' => $stringArray->description('Filter by region code, name, or UUID.'),
            'heis' => $stringArray->description('Filter by HEI UII, name, or UUID.'),
            'document_statuses' => $stringArray->description('Filter by document status code or name.'),
            'liquidation_statuses' => $stringArray->description('Filter by liquidation status code or name. Include VOIDED to opt voided records back in.'),
            'rc_note_statuses' => $stringArray->description('Filter by RC note status code or name. Use "none" for records with no RC note.'),
        ];
    }
}
