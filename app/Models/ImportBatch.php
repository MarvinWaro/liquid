<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ImportBatch extends Model
{
    use HasUuid;

    protected $fillable = [
        'user_id',
        'file_name',
        'total_rows',
        'imported_count',
        'status',
        'undone_at',
    ];

    protected function casts(): array
    {
        return [
            'total_rows' => 'integer',
            'imported_count' => 'integer',
            'undone_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function liquidations(): HasMany
    {
        return $this->hasMany(Liquidation::class, 'import_batch_id');
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function isUndone(): bool
    {
        return $this->status === 'undone';
    }
}
