<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HEI extends Model
{
    use HasFactory, HasUuid, LogsActivity;

    protected static function getActivityModule(): string
    {
        return 'HEI';
    }

    protected static function getActivityModelLabel(): string
    {
        return 'HEI';
    }

    protected static function getActivityForeignKeys(): array
    {
        return [
            'region_id' => ['region', 'name'],
        ];
    }

    protected static function getActivityFieldLabels(): array
    {
        return [
            'region_id' => 'Region',
            'uii' => 'UII',
            'code' => 'Code',
            'name' => 'Name',
            'type' => 'Type',
            'status' => 'Status',
        ];
    }

    protected $table = 'heis';

    protected $fillable = [
        'uii',
        'code',
        'name',
        'type',
        'region_id',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'status' => 'string',
        ];
    }

    /**
     * Get the region this HEI belongs to.
     */
    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }

    /**
     * Get liquidations for this HEI.
     */
    public function liquidations(): HasMany
    {
        return $this->hasMany(Liquidation::class);
    }

    /**
     * Check if HEI is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
