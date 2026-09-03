<?php

declare(strict_types=1);

namespace App\Http\Requests\Liquidation;

/**
 * Validation rules for the money fields shared by every path that creates a
 * liquidation.
 *
 * Single entry (StoreLiquidationRequest) and bulk entry (LiquidationController::bulkStore)
 * used to carry their own copies of these, differing only by an "entries.*." prefix.
 * That is how a missing ceiling on the liquidated amount ended up on both paths at once,
 * so they share one definition here instead.
 */
final class LiquidationFinancialRules
{
    /**
     * @param  string  $prefix  Field path prefix, e.g. 'entries.*.' for array payloads.
     * @return array<string, string>
     */
    public static function rules(string $prefix = ''): array
    {
        return [
            $prefix.'number_of_grantees' => 'nullable|integer|min:0',
            $prefix.'total_disbursements' => 'required|numeric|min:0',

            // Liquidating more than was disbursed leaves amount_received - amount_liquidated
            // negative, and that difference is SUM()'d into the table summary and dashboard
            // totals - so one bad row drags a whole region's unliquidated figure down.
            //
            // lte, not lt: fully liquidating a disbursement is the goal state, so equal
            // amounts must pass. Laravel resolves the asterisk in the parameter against the
            // attribute's own keys (Validator::replaceAsterisksInParameters), so in an array
            // payload each row is compared with its own disbursement, not row zero's.
            $prefix.'total_amount_liquidated' => 'nullable|numeric|min:0|lte:'.$prefix.'total_disbursements',
        ];
    }

    /**
     * Laravel's default lte message names a raw field path and repeats the number.
     * These say which field lost and, for array payloads, which row.
     *
     * @return array<string, string>
     */
    public static function messages(string $prefix = ''): array
    {
        $where = $prefix === '' ? '' : ' in row :position';

        return [
            $prefix.'total_amount_liquidated.lte' => "Total Amount Liquidated{$where} cannot be more than Total Disbursements.",
        ];
    }
}
