<?php

declare(strict_types=1);

namespace App\Http\Requests\Liquidation;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateLiquidationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $user = $this->user();

        if (! $user || ! $user->hasPermission('edit_liquidation')) {
            return false;
        }

        $liquidation = $this->route('liquidation');

        return $user->can('edit', $liquidation);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $heiExists = Rule::exists('heis', 'id');
        $liquidation = $this->route('liquidation');
        $roleName = $this->user()?->role?->name;

        if ($roleName === 'Regional Coordinator') {
            $liquidation->loadMissing('hei:id,region_id');

            if ($liquidation->hei?->region_id === $this->user()->region_id) {
                // The current owning RC may reassign within its official region.
                $heiExists->where('region_id', $this->user()->region_id);
            } else {
                // A former processing RC may maintain the historical record, but
                // cannot move official ownership away from the transferred HEI.
                $heiExists->where('id', $liquidation->hei_id);
            }
        } elseif (! in_array($roleName, ['Admin', 'Super Admin'], true)) {
            // Owner-based editors and program reviewers may edit the record, but
            // changing its institution is outside their workflow.
            $heiExists->where('id', $liquidation->hei_id);
        }

        return [
            'hei_id' => ['sometimes', $heiExists],
            // The Details card edits these three; without rules here they were
            // stripped by validated() and the save reported success anyway.
            // Shapes mirror StoreLiquidationRequest: the academic year travels as
            // an id, the semester as its name (resolved by findSemesterId).
            'academic_year_id' => 'sometimes|nullable|exists:academic_years,id',
            'semester' => 'sometimes|nullable|string|max:50',
            'batch_no' => 'sometimes|nullable|string|max:50',
            'amount_received' => 'sometimes|numeric|min:0',
            'disbursed_amount' => 'sometimes|numeric|min:0',
            'disbursement_date' => 'nullable|date',
            'fund_source' => 'nullable|string|max:255',
            'liquidated_amount' => 'nullable|numeric|min:0',
            'purpose' => 'nullable|string',
            'remarks' => 'nullable|string',
            'date_fund_released' => 'nullable|date',
            'due_date' => 'nullable|date',
            'number_of_grantees' => 'nullable|integer|min:0',
            'document_status' => 'nullable|string',
            'liquidation_status' => 'nullable|string',
            'review_remarks' => 'nullable|string',
        ];
    }

    /**
     * Keep amount_liquidated <= amount_received after the save.
     *
     * The create paths already refuse to liquidate more than was disbursed
     * (LiquidationFinancialRules), but editing had no equivalent, so lowering the
     * received amount under what was already liquidated was accepted. That
     * difference is SUM()'d into the dashboard and table totals as the
     * unliquidated figure, so one negative row drags a whole region's number down.
     *
     * This runs as an after-hook rather than an `lte:` rule because the Edit
     * Liquidation modal posts amount_received on its own. A field-to-field rule
     * only sees the payload, so whichever side is not being edited has to be read
     * from the stored record.
     */
    protected function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            // Let the per-field rules (numeric, min:0) report first; without this a
            // non-numeric amount would be cast to 0 here and misreported.
            if ($validator->errors()->hasAny(['amount_received', 'liquidated_amount'])) {
                return;
            }

            $financial = $this->route('liquidation')?->financial;

            // What each figure will be once this save lands: the submitted value,
            // or the stored one for whichever side the request leaves out.
            $received = $this->has('amount_received')
                ? (float) $this->input('amount_received')
                : (float) ($financial->amount_received ?? 0);

            $liquidated = $this->has('liquidated_amount')
                ? (float) $this->input('liquidated_amount')
                : (float) ($financial->amount_liquidated ?? 0);

            // lte, not lt: fully liquidating a disbursement is the goal state.
            if ($liquidated <= $received) {
                return;
            }

            // Point the message at the field the editor actually changed.
            if ($this->has('liquidated_amount')) {
                $validator->errors()->add('liquidated_amount', sprintf(
                    'Amount Liquidated cannot be more than the %s received for this liquidation.',
                    self::peso($received),
                ));

                return;
            }

            $validator->errors()->add('amount_received', sprintf(
                'Amount Received cannot be lower than the %s already liquidated for this liquidation.',
                self::peso($liquidated),
            ));
        });
    }

    /** Format a figure the way the liquidation screens show it. */
    private static function peso(float $amount): string
    {
        return "\u{20B1}".number_format($amount, 2);
    }
}
