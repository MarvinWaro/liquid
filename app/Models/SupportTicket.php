<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupportTicket extends Model
{
    use HasFactory, HasUuid;

    public const STATUS_OPEN = 'open';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_RESOLVED = 'resolved';

    public const PRIORITY_LOW = 'low';

    public const PRIORITY_NORMAL = 'normal';

    public const PRIORITY_HIGH = 'high';

    public const PRIORITY_URGENT = 'urgent';

    public const CATEGORY_LIQUIDATION_RECORD = 'liquidation_record';

    public const CATEGORY_STATUS_FOLLOW_UP = 'status_follow_up';

    public const CATEGORY_DOCUMENT_UPLOAD = 'document_upload';

    public const CATEGORY_ACCOUNT_ACCESS = 'account_access';

    public const CATEGORY_TECHNICAL_ISSUE = 'technical_issue';

    public const CATEGORY_OTHER = 'other';

    protected $fillable = [
        'ticket_number',
        'requester_id',
        'liquidation_id',
        'assigned_to',
        'category',
        'priority',
        'status',
        'subject',
        'description',
        'last_reply_at',
        'resolved_at',
        'resolved_by',
        'resolution_remarks',
    ];

    protected function casts(): array
    {
        return [
            'last_reply_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    public static function statuses(): array
    {
        return [
            self::STATUS_OPEN,
            self::STATUS_IN_PROGRESS,
            self::STATUS_RESOLVED,
        ];
    }

    public static function priorities(): array
    {
        return [
            self::PRIORITY_LOW,
            self::PRIORITY_NORMAL,
            self::PRIORITY_HIGH,
            self::PRIORITY_URGENT,
        ];
    }

    public static function categories(): array
    {
        return [
            self::CATEGORY_LIQUIDATION_RECORD,
            self::CATEGORY_STATUS_FOLLOW_UP,
            self::CATEGORY_DOCUMENT_UPLOAD,
            self::CATEGORY_ACCOUNT_ACCESS,
            self::CATEGORY_TECHNICAL_ISSUE,
            self::CATEGORY_OTHER,
        ];
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function liquidation(): BelongsTo
    {
        return $this->belongsTo(Liquidation::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(SupportTicketMessage::class)->orderBy('created_at');
    }

    public function isResolved(): bool
    {
        return $this->status === self::STATUS_RESOLVED;
    }
}
