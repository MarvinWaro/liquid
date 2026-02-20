<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class LiquidationTrackingEntry extends Model
{
    use HasFactory, HasUuid;

    protected $fillable = [
        'liquidation_id',
        'document_status_id',
        'received_by',
        'date_received',
        'liquidation_status_id',
        'reviewed_by',
        'date_reviewed',
        'rc_note',
        'date_endorsement',
    ];

    protected function casts(): array
    {
        return [
            'date_received'    => 'date',
            'date_reviewed'    => 'date',
            'date_endorsement' => 'date',
        ];
    }

    public function liquidation(): BelongsTo
    {
        return $this->belongsTo(Liquidation::class);
    }

    public function documentStatus(): BelongsTo
    {
        return $this->belongsTo(DocumentStatus::class);
    }

    public function liquidationStatus(): BelongsTo
    {
        return $this->belongsTo(LiquidationStatus::class);
    }

    public function locations(): BelongsToMany
    {
        return $this->belongsToMany(
            DocumentLocation::class,
            'liquidation_tracking_entry_locations',
            'tracking_entry_id',
            'document_location_id'
        )->withPivot('sort_order')->orderByPivot('sort_order');
    }
}
