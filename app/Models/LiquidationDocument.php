<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiquidationDocument extends Model
{
    use HasFactory, HasUuid;

    protected $fillable = [
        'liquidation_id',
        'document_type',
        'file_name',
        'file_path',
        'file_type',
        'file_size',
        'gdrive_link',
        'is_gdrive',
        'description',
        'uploaded_by',
    ];

    protected $casts = [
        'is_gdrive' => 'boolean',
    ];

    /**
     * Get the liquidation for this document.
     */
    public function liquidation(): BelongsTo
    {
        return $this->belongsTo(Liquidation::class);
    }

    /**
     * Get the user who uploaded this document.
     */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /**
     * Get formatted file size.
     */
    public function getFormattedFileSize(): string
    {
        $bytes = $this->file_size;
        $units = ['B', 'KB', 'MB', 'GB'];
        $i = 0;

        while ($bytes > 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }

        return round($bytes, 2) . ' ' . $units[$i];
    }
}
