<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
    ): self {
        $user = auth()->user();
        $request = request();

        return self::create([
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
    }

    /**
     * Resolve a human-readable label for the subject model.
     */
    private static function resolveSubjectLabel(Model $subject): ?string
    {
        foreach (['control_no', 'name', 'email', 'uii', 'code', 'file_name'] as $attr) {
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
