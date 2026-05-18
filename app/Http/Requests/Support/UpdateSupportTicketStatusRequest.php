<?php

declare(strict_types=1);

namespace App\Http\Requests\Support;

use App\Models\SupportTicket;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSupportTicketStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(SupportTicket::statuses())],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
