<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProgramDueDateRule extends Model
{
    use HasUuid;

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
     */
    public static function getDueDateDays(string $programId, ?string $academicYearId = null, int $fallback = 90): int
    {
        // 1. Try program + specific AY
        if ($academicYearId) {
            $rule = static::where('program_id', $programId)
                ->where('academic_year_id', $academicYearId)
                ->first();
            if ($rule) {
                return $rule->due_date_days;
            }
        }

        // 2. Try program default (null AY)
        $rule = static::where('program_id', $programId)
            ->whereNull('academic_year_id')
            ->first();
        if ($rule) {
            return $rule->due_date_days;
        }

        // 3. Fallback
        return $fallback;
    }
}
