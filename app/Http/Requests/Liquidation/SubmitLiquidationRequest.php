<?php

declare(strict_types=1);

namespace App\Http\Requests\Liquidation;

use Illuminate\Foundation\Http\FormRequest;

class SubmitLiquidationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $user = $this->user();
        $liquidation = $this->route('liquidation');

        // Only creator can submit
        if ($liquidation->created_by !== $user->id) {
            return false;
        }

        return $liquidation->canBeSubmitted();
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'remarks' => 'nullable|string',
        ];
    }

    /**
     * Get custom error messages.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [];
    }

    /**
     * Handle a failed authorization attempt.
     */
    protected function failedAuthorization(): void
    {
        $liquidation = $this->route('liquidation');

        if ($liquidation->created_by !== $this->user()->id) {
            abort(403, 'Only the creator can submit this liquidation.');
        }

        abort(403, 'This liquidation cannot be submitted in its current status.');
    }
}
