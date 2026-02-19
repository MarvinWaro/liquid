<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiquidationRunningData extends Model
{
    use HasFactory, HasUuid;

    protected $table = 'liquidation_running_data';

    protected $fillable = [
        'liquidation_id',
        'grantees_liquidated',
        'amount_complete_docs',
        'amount_refunded',
        'refund_or_no',
        'total_amount_liquidated',
        'transmittal_ref_no',
        'group_transmittal_ref_no',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'grantees_liquidated' => 'integer',
            'amount_complete_docs' => 'decimal:2',
            'amount_refunded' => 'decimal:2',
            'total_amount_liquidated' => 'decimal:2',
            'sort_order' => 'integer',
        ];
    }

    public function liquidation(): BelongsTo
    {
        return $this->belongsTo(Liquidation::class);
    }
}
