<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Program extends Model
{
    use HasUuid;

    protected $fillable = [
        'code',
        'name',
        'description',
        'status',
    ];

    /**
     * Get liquidations for this program.
     */
    public function liquidations()
    {
        return $this->hasMany(Liquidation::class);
    }

    /**
     * Check if program is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Scope to get only active programs.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
