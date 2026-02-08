<?php

declare(strict_types=1);

namespace App\Http\Requests\Liquidation;

use Illuminate\Foundation\Http\FormRequest;

class EndorseToAccountingRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $user = $this->user();
        $liquidation = $this->route('liquidation');

        // Only Regional Coordinator or Super Admin can endorse
        if ($user->role->name !== 'Regional Coordinator' && !$user->isSuperAdmin()) {
            return false;
        }

        // RC can endorse any liquidation they have access to
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'review_remarks' => 'nullable|string',
            'receiver_name' => 'nullable|string|max:255',
            'document_location' => 'nullable|string|max:255',
            'transmittal_reference_no' => 'required|string|max:255',
            'number_of_folders' => 'nullable|integer',
            'folder_location_number' => 'nullable|string|max:255',
            'group_transmittal' => 'nullable|string|max:255',
        ];
    }

    /**
     * Get custom error messages.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'transmittal_reference_no.required' => 'Transmittal reference number is required for endorsement.',
        ];
    }

    /**
     * Handle a failed authorization attempt.
     */
    protected function failedAuthorization(): void
    {
        $user = $this->user();

        if ($user->role->name !== 'Regional Coordinator' && !$user->isSuperAdmin()) {
            abort(403, 'Only Regional Coordinator can endorse to accounting.');
        }

        abort(403, 'This liquidation is not available for Regional Coordinator review.');
    }
}
