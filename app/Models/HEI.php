<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\LogsActivity;
use Closure;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Cache;

class HEI extends Model
{
    use HasFactory, HasUuid, LogsActivity;

    private static bool $regionTransferInProgress = false;

    protected static function booted(): void
    {
        static::updating(function (HEI $hei): void {
            if ($hei->isDirty('region_id') && ! self::$regionTransferInProgress) {
                throw new \LogicException('HEI region changes must use the audited transfer workflow.');
            }
        });

        static::deleting(function (HEI $hei): void {
            if ($hei->regionTransfers()->exists()) {
                throw new \LogicException('An HEI with region transfer history cannot be deleted.');
            }
        });

        static::saved(function (HEI $hei) {
            $uiis = array_filter(
                array_unique([$hei->uii, $hei->getOriginal('uii')]),
                fn ($uii) => is_string($uii) && $uii !== '',
            );

            foreach ($uiis as $uii) {
                Cache::forget('hei_uii_'.strtolower($uii));
                Cache::forget('hei:uii:'.strtolower($uii));
            }

            Cache::forget('heis_active');
            Cache::forget('lookup:heis');
        });

        static::deleted(function (HEI $hei) {
            Cache::forget('hei_uii_'.strtolower($hei->uii));
            Cache::forget('hei:uii:'.strtolower($hei->uii));
            Cache::forget('heis_active');
            Cache::forget('lookup:heis');
        });
    }

    public static function duringRegionTransfer(Closure $callback): mixed
    {
        $previous = self::$regionTransferInProgress;
        self::$regionTransferInProgress = true;

        try {
            return $callback();
        } finally {
            self::$regionTransferInProgress = $previous;
        }
    }

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
        'logo',
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
     * Get users belonging to this HEI.
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'hei_id');
    }

    /**
     * Get liquidations for this HEI.
     */
    public function liquidations(): HasMany
    {
        return $this->hasMany(Liquidation::class);
    }

    /**
     * Immutable history of official region changes for this HEI.
     */
    public function regionTransfers(): HasMany
    {
        return $this->hasMany(HEIRegionTransfer::class, 'hei_id')
            ->orderByDesc('effective_date')
            ->orderByDesc('created_at');
    }

    /**
     * Check if HEI is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
