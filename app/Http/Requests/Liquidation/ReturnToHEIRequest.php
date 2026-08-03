<?php

declare(strict_types=1);

namespace App\Http\Requests\Liquidation;

use Illuminate\Contracts\Validation\ValidationRule;
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

        return $user->can('review', $liquidation)
            && ($user->role->name === 'Regional Coordinator' || $user->isSuperAdmin());
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
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

        abort(403, 'This liquidation is outside your Regional Coordinator review scope.');
    }
}
