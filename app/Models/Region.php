<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Region extends Model
{
    use HasFactory, HasUuid, LogsActivity;

    protected static function getActivityModule(): string
    {
        return 'Regions';
    }

    protected $fillable = [
        'code',
        'name',
        'description',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'status' => 'string',
        ];
    }

    /**
     * Get users for this region.
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function heis(): HasMany
    {
        return $this->hasMany(HEI::class);
    }

    public function processedLiquidations(): HasMany
    {
        return $this->hasMany(Liquidation::class, 'processing_region_id');
    }

    public function outgoingHeiTransfers(): HasMany
    {
        return $this->hasMany(HEIRegionTransfer::class, 'from_region_id');
    }

    public function incomingHeiTransfers(): HasMany
    {
        return $this->hasMany(HEIRegionTransfer::class, 'to_region_id');
    }

    /**
     * Check if region is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
