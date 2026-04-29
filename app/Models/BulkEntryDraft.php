<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BulkEntryDraft extends Model
{
    use HasUuid;

    protected $fillable = [
        'user_id',
        'rows',
    ];

    protected function casts(): array
    {
        return [
            'rows' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
