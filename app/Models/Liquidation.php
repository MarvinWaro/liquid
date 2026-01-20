<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Liquidation extends Model
{
    use HasFactory;

    protected $fillable = [
        'control_no',
        'batch_no', // ✅ Added
        'hei_id',
        'program_id',
        'academic_year',
        'semester',
        'amount_received',
        'amount_disbursed',
        'amount_refunded',
        'status',
        'transmittal_ref_no',
        'no_of_folders',
        'date_endorsed',
        'endorsed_by',
        'file_location',
    ];

    /**
     * Get the individual line items (students) for this report.
     */
    public function items(): HasMany
    {
        return $this->hasMany(LiquidationItem::class);
    }

    /**
     * Get the HEI/User who owns this report.
     * (Assuming you will link this to your User table for now)
     */
    public function hei(): BelongsTo
    {
        return $this->belongsTo(User::class, 'hei_id');
    }
}
