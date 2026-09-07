<?php

namespace App\Models;

use App\Traits\DescribesDeletionBlockers;
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
    use DescribesDeletionBlockers, HasFactory, HasUuid, LogsActivity;

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
     * Records that a hard delete of this institution would destroy or orphan.
     *
     * `liquidations.hei_id` cascaded, so removing one HEI took every liquidation
     * it ever filed - and with it the documents, beneficiaries, financials,
     * tracking entries and comments hanging off those rows. `Liquidation` uses
     * SoftDeletes, but a database-level cascade never consults `deleted_at`, so
     * even already-archived reports were gone for good.
     *
     * An institution that has history should be set to inactive, not deleted.
     *
     * @return array<string, int> Singular label => count, empty when safe to delete.
     */
    public function deletionBlockers(): array
    {
        return array_filter([
            // withTrashed on purpose: the cascade ignored `deleted_at`, so a
            // guard that counted only live rows would still lose the archive.
            'liquidation' => Liquidation::withTrashed()->where('hei_id', $this->id)->count(),
            // users.hei_id is SET NULL, so these accounts survive the delete but
            // come out orphaned - an HEI role pointing at no institution, which
            // renders as a blank Institution field and scopes to nothing.
            'user account' => User::where('hei_id', $this->id)->count(),
            // Immutable audit trail; hei_region_transfers.hei_id is RESTRICT, so
            // the database refuses this one outright.
            'region transfer record' => $this->regionTransfers()->count(),
        ]);
    }

    /**
     * Check if HEI is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
