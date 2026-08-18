<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A physical filing location for liquidation documents — a shelf position such
 * as "Shelf 1-A-R1", or a named spot like "Outside Office - Storage Box".
 *
 * Deliberately one free-text name rather than shelf/section/row columns: two of
 * the seeded locations are not shelves at all, so a structured form could not
 * represent the real data.
 *
 * @property string $id
 * @property string $name
 * @property int $sort_order
 * @property bool $is_active
 */
class DocumentLocation extends Model
{
    use HasFactory, HasUuid, LogsActivity;

    protected static function getActivityModule(): string
    {
        return 'Settings';
    }

    /**
     * @return array<string, string>
     */
    protected static function getActivityFieldLabels(): array
    {
        return [
            'name' => 'Name',
            'sort_order' => 'Sort Order',
            'is_active' => 'Active',
        ];
    }

    protected $fillable = [
        'name',
        'sort_order',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Transmittals filed at this location.
     *
     * Exists so deletion can be refused while records still point here. The
     * foreign key is ON DELETE SET NULL, so without this check a delete would
     * quietly blank the location on every affected transmittal.
     */
    public function transmittals(): HasMany
    {
        return $this->hasMany(LiquidationTransmittal::class, 'document_location_id');
    }

    /**
     * Document-tracking entries filed at this location.
     *
     * Same reasoning, and more urgent: the pivot is ON DELETE CASCADE, so a
     * delete would destroy the tracking rows outright rather than blank them.
     */
    public function trackingEntries(): BelongsToMany
    {
        return $this->belongsToMany(
            LiquidationTrackingEntry::class,
            'liquidation_tracking_entry_locations',
            'document_location_id',
            'tracking_entry_id'
        );
    }

    /**
     * True when any record still refers to this location.
     */
    public function isInUse(): bool
    {
        return $this->transmittals()->exists() || $this->trackingEntries()->exists();
    }

    /**
     * Locations still offered when filing something new. Archived ones stay
     * readable on the records that already use them.
     *
     * @param  Builder<DocumentLocation>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }

    /**
     * The display order used everywhere a location is listed.
     *
     * @param  Builder<DocumentLocation>  $query
     */
    public function scopeOrdered(Builder $query): void
    {
        $query->orderBy('sort_order')->orderBy('name');
    }
}
