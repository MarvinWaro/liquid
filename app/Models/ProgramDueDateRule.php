<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Cache;

class ProgramDueDateRule extends Model
{
    use HasUuid;

    /** Cached map of every rule, keyed by program id. The table is tiny. */
    private const RULES_CACHE_KEY = 'lookup:due_date_rules';

    private const RULES_CACHE_TTL = 3600;

    /**
     * Busting the cache on write.
     *
     * Rules ride inside the cached `lookup:programs` entry (CacheService::getPrograms
     * eager-loads them) and inside this model's own rule map. The rule endpoints in
     * ProgramController never cleared either, so editing a rule left the create form
     * using the old number for up to an hour. Doing it here rather than in the
     * controller means no future write path can forget.
     */
    protected static function booted(): void
    {
        $flush = function (): void {
            Cache::forget(self::RULES_CACHE_KEY);
            Cache::forget('lookup:programs');
        };

        static::saved($flush);
        static::deleted($flush);
    }

    protected $fillable = [
        'program_id',
        'academic_year_id',
        'due_date_days',
    ];

    protected $casts = [
        'due_date_days' => 'integer',
    ];

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    /**
     * Look up due date days for a program + optional academic year.
     * Priority: program+AY specific → program default (null AY) → fallback.
     *
     * Reads from a cached map rather than querying. LiquidationFinancial's due date
     * accessor calls this once per row, so the previous one-or-two queries per call
     * became an N+1 on every liquidation list. The whole table is a handful of rows,
     * so it is cheaper to hold all of it. Writes bust the cache in booted() above.
     */
    public static function getDueDateDays(string $programId, ?string $academicYearId = null, int $fallback = 90): int
    {
        $rules = static::cachedRulesFor($programId);

        // 1. Try program + specific AY
        if ($academicYearId) {
            foreach ($rules as $rule) {
                if ($rule['academic_year_id'] === $academicYearId) {
                    return $rule['due_date_days'];
                }
            }
        }

        // 2. Try program default (null AY)
        foreach ($rules as $rule) {
            if ($rule['academic_year_id'] === null) {
                return $rule['due_date_days'];
            }
        }

        // 3. Fallback
        return $fallback;
    }

    /**
     * Every rule for one program, from the cached whole-table map.
     *
     * @return list<array{academic_year_id: ?string, due_date_days: int}>
     */
    private static function cachedRulesFor(string $programId): array
    {
        $all = Cache::remember(self::RULES_CACHE_KEY, self::RULES_CACHE_TTL, function (): array {
            return static::query()
                ->get(['program_id', 'academic_year_id', 'due_date_days'])
                ->groupBy('program_id')
                ->map(fn ($rules) => $rules->map(fn ($rule) => [
                    'academic_year_id' => $rule->academic_year_id,
                    'due_date_days' => (int) $rule->due_date_days,
                ])->values()->all())
                ->all();
        });

        return $all[$programId] ?? [];
    }
}
