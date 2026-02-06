<?php

declare(strict_types=1);

namespace App\Http\Requests\Liquidation;

use Illuminate\Foundation\Http\FormRequest;

class EndorseToCOARequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $user = $this->user();
        $liquidation = $this->route('liquidation');

        // Only Accountant or Super Admin can endorse to COA
        if ($user->role->name !== 'Accountant' && !$user->isSuperAdmin()) {
            return false;
        }

        return $liquidation->isPendingAccountantReview();
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'accountant_remarks' => 'nullable|string',
        ];
    }

    /**
     * Handle a failed authorization attempt.
     */
    protected function failedAuthorization(): void
    {
        $user = $this->user();

        if ($user->role->name !== 'Accountant' && !$user->isSuperAdmin()) {
            abort(403, 'Only Accountant can endorse to COA.');
        }

        abort(403, 'This liquidation is not pending Accountant review.');
    }
}
