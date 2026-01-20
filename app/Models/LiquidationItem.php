<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiquidationItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'liquidation_id',
        'student_no',
        'last_name',
        'first_name',
        'middle_name',
        'extension_name',
        'award_no',
        'amount',
        'date_disbursed',
        'remarks'
    ];

    /**
     * Get the parent liquidation report.
     */
    public function liquidation(): BelongsTo
    {
        return $this->belongsTo(Liquidation::class);
    }

    // ✅ Accessor: This lets your frontend still use 'item.full_name' without breaking code
    protected $appends = ['full_name'];

    public function getFullNameAttribute()
    {
        $name = "{$this->last_name}, {$this->first_name}";

        if ($this->middle_name) {
            $name .= " " . substr($this->middle_name, 0, 1) . ".";
        }

        if ($this->extension_name) {
            $name .= " " . $this->extension_name;
        }

        return $name; // Output: Dela Cruz, Juan A. Jr.
    }
}
