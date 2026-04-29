<?php

declare(strict_types=1);

namespace App\Http\Requests\Liquidation;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Shape-only validation for bulk-entry drafts.
 *
 * Drafts represent partial, half-typed data — fields are intentionally
 * lenient (any string/null) and we don't enforce business rules here.
 * Full validation happens at submit time via the existing bulk-store flow.
 */
class StoreBulkEntryDraftRequest extends FormRequest
{
    /**
     * Maximum draft rows accepted in a single save.
     * Manual entry past this is bad UX (slow modal, big payloads) — at that
     * point the user should be using bulk import (Excel) instead.
     * Mirror this value in the frontend `MAX_DRAFT_ROWS` constant.
     */
    private const MAX_DRAFT_ROWS = 100;

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'rows'                              => ['required', 'array', 'min:1', 'max:' . self::MAX_DRAFT_ROWS],
            'rows.*.program_id'                 => ['nullable', 'string', 'max:64'],
            'rows.*.uii'                        => ['nullable', 'string', 'max:64'],
            'rows.*.date_fund_released'         => ['nullable', 'string', 'max:32'],
            'rows.*.due_date'                   => ['nullable', 'string', 'max:32'],
            'rows.*.academic_year_id'           => ['nullable', 'string', 'max:64'],
            'rows.*.semester'                   => ['nullable', 'string', 'max:32'],
            'rows.*.batch_no'                   => ['nullable', 'string', 'max:64'],
            'rows.*.dv_control_no'              => ['nullable', 'string', 'max:64'],
            'rows.*.number_of_grantees'         => ['nullable', 'string', 'max:16'],
            'rows.*.total_disbursements'        => ['nullable', 'string', 'max:32'],
            'rows.*.total_amount_liquidated'    => ['nullable', 'string', 'max:32'],
            'rows.*.document_status'            => ['nullable', 'string', 'max:64'],
            'rows.*.rc_notes'                   => ['nullable', 'string', 'max:64'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'rows.required' => 'Draft must include at least one row.',
            'rows.max'      => 'Draft exceeds the maximum allowed rows (' . self::MAX_DRAFT_ROWS . ').',
        ];
    }
}
