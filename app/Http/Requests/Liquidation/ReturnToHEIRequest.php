<?php

declare(strict_types=1);

namespace App\Http\Requests\Liquidation;

use Illuminate\Foundation\Http\FormRequest;

class ReturnToHEIRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $user = $this->user();
        $liquidation = $this->route('liquidation');

        // Only Regional Coordinator or Super Admin can return
        if ($user->role->name !== 'Regional Coordinator' && !$user->isSuperAdmin()) {
            return false;
        }

        // Check if liquidation is in correct status for RC review
        return in_array($liquidation->status, ['for_initial_review', 'returned_to_rc']);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'review_remarks' => 'required|string',
            'documents_for_compliance' => 'nullable|string',
            'receiver_name' => 'nullable|string|max:255',
            'document_location' => 'nullable|string|max:255',
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
            'review_remarks.required' => 'Please provide remarks explaining why the liquidation is being returned.',
        ];
    }

    /**
     * Handle a failed authorization attempt.
     */
    protected function failedAuthorization(): void
    {
        $user = $this->user();

        if ($user->role->name !== 'Regional Coordinator' && !$user->isSuperAdmin()) {
            abort(403, 'Only Regional Coordinator can return liquidation to HEI.');
        }

        abort(403, 'This liquidation is not available for Regional Coordinator review.');
    }
}
