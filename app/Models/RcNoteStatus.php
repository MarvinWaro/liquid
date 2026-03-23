<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;

/**
 * RC Note Status lookup model.
 *
 * Represents the RC note/remark status for a liquidation.
 * Used as a foreign key reference in liquidations.
 *
 * @property string $id
 * @property string $code
 * @property string $name
 * @property string $badge_color
 * @property int $sort_order
 * @property bool $is_active
 */
class RcNoteStatus extends Model
{
    use HasFactory, HasUuid;

    protected $fillable = [
        'code',
        'name',
        'badge_color',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    // Status code constants
    public const CODE_FOR_REVIEW = 'FOR_REVIEW';
    public const CODE_FOR_COMPLIANCE = 'FOR_COMPLIANCE';
    public const CODE_FOR_ENDORSEMENT = 'FOR_ENDORSEMENT';
    public const CODE_FULLY_ENDORSED = 'FULLY_ENDORSED';
    public const CODE_PARTIALLY_ENDORSED = 'PARTIALLY_ENDORSED';

    public function liquidations(): HasMany
    {
        return $this->hasMany(Liquidation::class, 'rc_note_status_id');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('sort_order');
    }

    public static function getDropdownOptions()
    {
        return static::active()
            ->ordered()
            ->get(['id', 'code', 'name', 'badge_color']);
    }

    public static function findByCode(string $code): ?self
    {
        return static::where('code', strtoupper(str_replace(' ', '_', $code)))->first();
    }
}
