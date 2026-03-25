<?php

declare(strict_types=1);

namespace App\Http\Requests\Liquidation;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreLiquidationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $user = $this->user();

        return $user && (
            in_array($user->role->name, ['Regional Coordinator', 'Admin', 'STUFAPS Focal']) ||
            $user->isSuperAdmin()
        );
    }

    /**
     * Prepare data before validation — trim control number whitespace.
     */
    protected function prepareForValidation(): void
    {
        if ($this->has('dv_control_no')) {
            $this->merge([
                'dv_control_no' => strtoupper(trim($this->input('dv_control_no'))),
            ]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'program_id' => 'required|exists:programs,id',
            'uii' => 'required|string',
            'date_fund_released' => 'required|date',
            'due_date' => 'nullable|date',
            'academic_year_id' => 'required|exists:academic_years,id',
            'semester' => 'required|string|max:50',
            'batch_no' => 'nullable|string|max:50',
            'dv_control_no' => [
                'required',
                'string',
                'max:100',
                'regex:/^[A-Za-z0-9\-]+$/',
                Rule::unique('liquidations', 'control_no'),
            ],
            'number_of_grantees' => 'nullable|integer|min:0',
            'total_disbursements' => 'required|numeric|min:0',
            'total_amount_liquidated' => 'nullable|numeric|min:0',
            'document_status' => 'nullable|string|in:NONE,PARTIAL,COMPLETE',
            'rc_notes' => 'nullable|string|max:1000',
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'uii.required' => 'The UII (Unique Institutional Identifier) is required.',
            'program_id.required' => 'Please select a program.',
            'program_id.exists' => 'The selected program is invalid.',
            'dv_control_no.required' => 'Control number is required.',
            'dv_control_no.regex' => 'Control number may only contain letters, numbers, and hyphens (no spaces or special characters).',
            'dv_control_no.unique' => 'This control number already exists. Please use a different one.',
        ];
    }
}
