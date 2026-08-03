<?php

declare(strict_types=1);

namespace App\Http\Requests\Liquidation;

use Illuminate\Contracts\Validation\ValidationRule;
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
}
