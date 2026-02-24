<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiquidationBeneficiary extends Model
{
    use HasFactory, HasUuid, LogsActivity;

    protected static function getActivityModule(): string
    {
        return 'Liquidation';
    }

    protected $fillable = [
        'liquidation_id',
        'student_no',
        'last_name',
        'first_name',
        'middle_name',
        'extension_name',
        'award_no',
        'date_disbursed',
        'amount',
        'remarks',
    ];

    protected function casts(): array
    {
        return [
            'date_disbursed' => 'date',
            'amount' => 'decimal:2',
        ];
    }

    /**
     * Get the liquidation that owns this beneficiary.
     */
    public function liquidation(): BelongsTo
    {
        return $this->belongsTo(Liquidation::class);
    }

    /**
     * Get full name of beneficiary.
     */
    public function getFullNameAttribute(): string
    {
        $name = trim("{$this->first_name} {$this->middle_name} {$this->last_name}");

        if ($this->extension_name) {
            $name .= " {$this->extension_name}";
        }

        return $name;
    }
}
