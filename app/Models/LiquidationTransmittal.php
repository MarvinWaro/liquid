<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiquidationTransmittal extends Model
{
    use HasFactory, HasUuid;

    protected $fillable = [
        'liquidation_id',
        'transmittal_reference_no',
        'receiver_name',
        'document_location',
        'number_of_folders',
        'folder_location_number',
        'group_transmittal',
        'other_file_location',
        'endorsed_by',
        'endorsed_at',
        'received_at',
        'location_history',
    ];

    protected function casts(): array
    {
        return [
            'endorsed_at' => 'datetime',
            'received_at' => 'datetime',
            'location_history' => 'array',
        ];
    }

    /**
     * Get the liquidation this transmittal belongs to.
     */
    public function liquidation(): BelongsTo
    {
        return $this->belongsTo(Liquidation::class);
    }

    /**
     * Get the user who endorsed.
     */
    public function endorser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'endorsed_by');
    }

    /**
     * Add a location change to history.
     */
    public function addLocationHistory(string $newLocation, ?string $notes = null): void
    {
        $history = $this->location_history ?? [];
        $history[] = [
            'location' => $newLocation,
            'changed_at' => now()->toIso8601String(),
            'previous_location' => $this->document_location,
            'notes' => $notes,
        ];

        $this->update([
            'document_location' => $newLocation,
            'location_history' => $history,
        ]);
    }

    /**
     * Get the latest location from history.
     */
    public function getLatestLocationFromHistory(): ?string
    {
        if (empty($this->location_history)) {
            return $this->document_location;
        }

        $latest = end($this->location_history);
        return $latest['location'] ?? $this->document_location;
    }
}
