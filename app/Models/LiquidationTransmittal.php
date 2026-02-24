<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiquidationTransmittal extends Model
{
    use HasFactory, HasUuid, LogsActivity;

    protected static function getActivityModule(): string
    {
        return 'Liquidation';
    }

    protected $fillable = [
        'liquidation_id',
        'transmittal_reference_no',
        'receiver_name',
        'document_location_id',
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
            'endorsed_at'      => 'datetime',
            'received_at'      => 'datetime',
            'location_history' => 'array',
        ];
    }

    public function liquidation(): BelongsTo
    {
        return $this->belongsTo(Liquidation::class);
    }

    public function endorser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'endorsed_by');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(DocumentLocation::class, 'document_location_id');
    }

    /**
     * Record a location change in the audit history and update the FK.
     * Accepts the location name string; resolves to ID internally.
     */
    public function addLocationHistory(string $locationName, ?string $notes = null): void
    {
        $newLocation = DocumentLocation::where('name', $locationName)->first();

        $history   = $this->location_history ?? [];
        $history[] = [
            'location'          => $locationName,
            'changed_at'        => now()->toIso8601String(),
            'previous_location' => $this->location?->name,
            'notes'             => $notes,
        ];

        $this->update([
            'document_location_id' => $newLocation?->id,
            'location_history'     => $history,
        ]);
    }

    /**
     * Get the current location name (from relationship or latest history entry).
     */
    public function getLatestLocationFromHistory(): ?string
    {
        if (!empty($this->location_history)) {
            $latest = end($this->location_history);
            return $latest['location'] ?? $this->location?->name;
        }

        return $this->location?->name;
    }
}
