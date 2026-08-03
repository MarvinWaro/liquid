<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HEIRegionTransfer extends Model
{
    use HasUuid;

    protected $table = 'hei_region_transfers';

    protected $fillable = [
        'hei_id',
        'from_region_id',
        'to_region_id',
        'effective_date',
        'memo_reference',
        'reason',
        'transferred_by',
    ];

    protected function casts(): array
    {
        return [
            'effective_date' => 'date',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (): never {
            throw new \LogicException('HEI region transfer history is immutable.');
        });

        static::deleting(function (): never {
            throw new \LogicException('HEI region transfer history cannot be deleted.');
        });
    }

    public function hei(): BelongsTo
    {
        return $this->belongsTo(HEI::class, 'hei_id');
    }

    public function fromRegion(): BelongsTo
    {
        return $this->belongsTo(Region::class, 'from_region_id');
    }

    public function toRegion(): BelongsTo
    {
        return $this->belongsTo(Region::class, 'to_region_id');
    }

    public function transferredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'transferred_by');
    }
}
