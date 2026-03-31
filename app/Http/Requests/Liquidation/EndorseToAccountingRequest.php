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

        // Only Regional Coordinator, STUFAPS Focal, or Super Admin can endorse
        if (!in_array($user->role->name, ['Regional Coordinator', 'STUFAPS Focal']) && !$user->isSuperAdmin()) {
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
        ];
    }

    /**
     * Handle a failed authorization attempt.
     */
    protected function failedAuthorization(): void
    {
        $user = $this->user();

        if (!in_array($user->role->name, ['Regional Coordinator', 'STUFAPS Focal']) && !$user->isSuperAdmin()) {
            abort(403, 'Only Regional Coordinator or STUFAPS Focal can endorse to accounting.');
        }

        abort(403, 'This liquidation is not available for Regional Coordinator review.');
    }
}
