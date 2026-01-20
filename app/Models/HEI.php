<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HEI extends Model
{
    use HasFactory;

    protected $table = 'heis';

    protected $fillable = [
        'code',
        'name',
        'type',
        'region',
        'province',
        'city_municipality',
        'address',
        'contact_person',
        'contact_number',
        'email',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'status' => 'string',
        ];
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
