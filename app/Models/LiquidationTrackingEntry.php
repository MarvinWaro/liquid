<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiquidationTrackingEntry extends Model
{
    use HasFactory, HasUuid;

    protected $fillable = [
        'liquidation_id',
        'document_status',
        'received_by',
        'date_received',
        'document_location',
        'reviewed_by',
        'date_reviewed',
        'rc_note',
        'date_endorsement',
        'liquidation_status',
    ];

    protected function casts(): array
    {
        return [
            'date_received' => 'date',
            'date_reviewed' => 'date',
            'date_endorsement' => 'date',
        ];
    }

    public function liquidation(): BelongsTo
    {
        return $this->belongsTo(Liquidation::class);
    }
}
