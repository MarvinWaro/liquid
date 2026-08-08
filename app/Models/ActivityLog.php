<?php

declare(strict_types=1);

namespace App\Models;

use App\Services\NotificationService;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ActivityLog extends Model
{
    use HasUuid;

    protected $fillable = [
        'user_id',
        'user_name',
        'action',
        'description',
        'subject_type',
        'subject_id',
        'subject_label',
        'old_values',
        'new_values',
        'module',
        'ip_address',
        'user_agent',
    ];

    protected function casts(): array
    {
        return [
            'old_values' => 'array',
            'new_values' => 'array',
        ];
    }

    // ========================================
    // RELATIONSHIPS
    // ========================================

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // ========================================
    // ACCESSORS
    // ========================================

    /**
     * Human-readable device label parsed from the raw user agent,
     * e.g. "Chrome on Windows". Computed on read — not persisted.
     */
    protected function device(): Attribute
    {
        return Attribute::make(
            get: fn (): ?string => self::parseDevice($this->user_agent),
        );
    }

    /**
     * Parse a user-agent string into a friendly "Browser on OS" label.
     * Order matters: Edge/Opera/Samsung UAs also contain "Chrome"/"Safari",
     * so the more specific tokens are matched first. Falls back to the raw
     * agent (truncated) for non-browser clients such as CLI/seeder requests.
     */
    private static function parseDevice(?string $userAgent): ?string
    {
        if (empty($userAgent)) {
            return null;
        }

        $browser = match (true) {
            str_contains($userAgent, 'Edg/'), str_contains($userAgent, 'Edge') => 'Edge',
            str_contains($userAgent, 'OPR/'), str_contains($userAgent, 'Opera') => 'Opera',
            str_contains($userAgent, 'SamsungBrowser') => 'Samsung Internet',
            str_contains($userAgent, 'Firefox') => 'Firefox',
            str_contains($userAgent, 'Chrome') => 'Chrome',
            str_contains($userAgent, 'Safari') => 'Safari',
            default => null,
        };

        $os = match (true) {
            str_contains($userAgent, 'Windows NT 10.0') => 'Windows 10/11',
            str_contains($userAgent, 'Windows') => 'Windows',
            str_contains($userAgent, 'iPhone'), str_contains($userAgent, 'iPad') => 'iOS',
            str_contains($userAgent, 'Mac OS X'), str_contains($userAgent, 'Macintosh') => 'macOS',
            str_contains($userAgent, 'Android') => 'Android',
            str_contains($userAgent, 'Linux') => 'Linux',
            default => null,
        };

        if ($browser === null && $os === null) {
            return Str::limit($userAgent, 40);
        }

        return ($browser ?? 'Unknown browser').' on '.($os ?? 'Unknown OS');
    }

    // ========================================
    // STATIC HELPER - Manual Logging
    // ========================================

    /**
     * Log a custom activity.
     */
    public static function log(
        string $action,
        string $description,
        ?Model $subject = null,
        ?string $module = null,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?User $actor = null,
    ): self {
        // Queued jobs run with no logged-in session, so auth() is empty there and
        // the entry would read "System" even though a real person started the work.
        // Callers outside a request pass the actor explicitly — see
        // BulkImportLiquidationsJob. Deliberately does NOT touch auth() itself:
        // NotificationService::dispatch() below bails out when auth() is empty, and
        // the queued jobs that would be affected already send their own
        // notifications, so signing the user in here would deliver each twice.
        $user = $actor ?? auth()->user();

        // Outside an HTTP request there is no browser and no visitor IP. Laravel
        // still hands back a synthetic Request, which records a "Symfony" client at
        // 127.0.0.1 — details that read as though someone really browsed from the
        // server. Store nothing rather than something untrue; the activity log UI
        // already omits both chips when they are null.
        $request = app()->runningInConsole() ? null : request();

        $log = self::create([
            'user_id' => $user?->id,
            'user_name' => $user?->name ?? 'System',
            'action' => $action,
            'description' => $description,
            'subject_type' => $subject ? get_class($subject) : null,
            'subject_id' => $subject?->id,
            'subject_label' => $subject ? self::resolveSubjectLabel($subject) : null,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'module' => $module,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
        ]);

        // Dispatch notifications for relevant actions
        NotificationService::dispatch($action, $description, $subject, $module);

        return $log;
    }

    /**
     * Resolve a human-readable label for the subject model.
     */
    private static function resolveSubjectLabel(Model $subject): ?string
    {
        foreach (['ticket_number', 'control_no', 'name', 'email', 'uii', 'code', 'file_name'] as $attr) {
            if (! empty($subject->$attr)) {
                return (string) $subject->$attr;
            }
        }

        return (string) $subject->id;
    }

    // ========================================
    // SCOPES
    // ========================================

    public function scopeByUser(Builder $query, string $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    public function scopeByAction(Builder $query, string $action): Builder
    {
        return $query->where('action', $action);
    }

    public function scopeByModule(Builder $query, string $module): Builder
    {
        return $query->where('module', $module);
    }

    public function scopeByDateRange(Builder $query, ?string $from, ?string $to): Builder
    {
        if ($from) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $query->whereDate('created_at', '<=', $to);
        }

        return $query;
    }

    public function scopeSearch(Builder $query, string $search): Builder
    {
        return $query->where(function ($q) use ($search) {
            $q->where('description', 'like', "%{$search}%")
                ->orWhere('user_name', 'like', "%{$search}%")
                ->orWhere('subject_label', 'like', "%{$search}%");
        });
    }
}
