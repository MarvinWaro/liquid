<?php

declare(strict_types=1);

namespace App\Http\Requests\Support;

use App\Models\SupportTicket;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSupportTicketRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null && $user->hasPermission('create_ticket');
    }

    public function rules(): array
    {
        return [
            'category' => ['required', Rule::in(SupportTicket::categories())],
            'priority' => ['required', Rule::in(SupportTicket::priorities())],
            'liquidation_id' => ['nullable', 'uuid'],
            'subject' => ['required', 'string', 'max:180'],
            'description' => ['required', 'string', 'max:5000'],
        ];
    }
}
