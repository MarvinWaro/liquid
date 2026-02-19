<?php

declare(strict_types=1);

namespace App\Http\Requests\Liquidation;

use Illuminate\Foundation\Http\FormRequest;

class UpdateLiquidationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $user = $this->user();

        if (!$user || !$user->hasPermission('edit_liquidation')) {
            return false;
        }

        $liquidation = $this->route('liquidation');

        // Super Admin and Admin can edit any liquidation
        if ($user->isSuperAdmin() || $user->role->name === 'Admin') {
            return true;
        }

        // Regional Coordinators can edit liquidations in their region
        if ($user->isRegionalCoordinator()) {
            return true;
        }

        // Regular users can only edit their own editable liquidations
        return $liquidation->created_by === $user->id && $liquidation->isEditableByHEI();
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'hei_id' => 'sometimes|exists:heis,id',
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
