<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Template extends Model
{
    use HasFactory, HasUuid, LogsActivity;

    protected static function getActivityModule(): string
    {
        return 'Templates';
    }

    protected static function getActivityForeignKeys(): array
    {
        return [
            'uploaded_by' => ['uploader', 'name'],
        ];
    }

    protected static function getActivityFieldLabels(): array
    {
        return [
            'name' => 'Name',
            'category' => 'Category',
            'description' => 'Description',
            'original_filename' => 'File',
            'is_active' => 'Active',
        ];
    }

    protected static function getActivityHiddenFields(): array
    {
        return ['file_path', 'file_size', 'mime_type'];
    }

    protected $fillable = [
        'name',
        'category',
        'description',
        'file_path',
        'original_filename',
        'file_size',
        'mime_type',
        'is_active',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'file_size' => 'integer',
        ];
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }
}
