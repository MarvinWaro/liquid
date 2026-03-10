<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LiquidationComment extends Model
{
    use HasUuid;

    protected $fillable = [
        'liquidation_id',
        'user_id',
        'parent_id',
        'document_requirement_id',
        'body',
        'mentions',
        'attachments',
    ];

    protected function casts(): array
    {
        return [
            'mentions' => 'array',
            'attachments' => 'array',
        ];
    }

    public function liquidation(): BelongsTo
    {
        return $this->belongsTo(Liquidation::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('created_at');
    }

    /**
     * Get mentioned user IDs from the body text.
     * Mention format: @[Name](userId)
     */
    public static function parseMentions(string $body): array
    {
        preg_match_all('/@\[.+?\]\(([a-f0-9\-]+)\)/', $body, $matches);

        return array_unique($matches[1] ?? []);
    }
}
