<?php

use App\Models\AcademicYear;
use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\LiquidationFinancial;
use App\Models\Program;
use App\Models\ProgramDueDateRule;
use App\Models\Region;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

/**
 * Due Date Rules (Settings -> Programs -> Due Date Rules) set how many days after
 * fund release a liquidation is due, with an AY-specific rule taking priority over
 * the program default. The import path honoured them, but the due-date accessor
 * hardcoded 90 days (30 for sub-programs) and ignored them - so a program set to
 * 30 days was still judged at 90, including by the overdue figures.
 *
 * Helpers are declared here rather than borrowed from another test file: Pest
 * helpers are global but only exist once their file loads, so a borrowed one
 * breaks whenever the files land in different --parallel processes.
 */
function dueDateWorld(): array
{
    Cache::flush();

    $region = Region::create(['code' => 'R12-DUE', 'name' => 'Region XII Due', 'status' => 'active']);

    return [
        'user' => User::factory()->create(['status' => 'active']),
        'hei' => HEI::create([
            'uii' => '24680',
            'name' => 'Due Date Test College',
            'type' => 'Private',
            'region_id' => $region->id,
            'status' => 'active',
        ]),
        // AHEAD stands in for Marvin's real case: a top-level program, 90-day default.
        'ahead' => Program::create(['code' => 'AHEAD-T', 'name' => 'AHEAD', 'status' => 'active']),
        'ay2526' => AcademicYear::firstOrCreate(
            ['code' => '2025-2026'],
            ['name' => 'AY 2025-2026', 'is_active' => true],
        ),
        'ay2627' => AcademicYear::firstOrCreate(
            ['code' => '2026-2027'],
            ['name' => 'AY 2026-2027', 'is_active' => true],
        ),
    ];
}

/**
 * A liquidation with a fund release date and NO stored due date, so the accessor
 * has to derive one.
 */
function dueDateLiquidation(array $w, Program $program, ?AcademicYear $ay, ?string $storedDueDate = null): Liquidation
{
    $liquidation = Liquidation::create([
        'control_no' => 'AHEAD-2026-'.fake()->unique()->numerify('####'),
        'hei_id' => $w['hei']->id,
        'program_id' => $program->id,
        'academic_year_id' => $ay?->id,
        'created_by' => $w['user']->id,
    ]);

    LiquidationFinancial::create([
        'liquidation_id' => $liquidation->id,
        'amount_received' => 10000,
        'amount_disbursed' => 10000,
        'amount_liquidated' => 0,
        'date_fund_released' => '2026-09-07',
        'due_date' => $storedDueDate,
    ]);

    return $liquidation;
}

it('uses the academic-year rule instead of the hardcoded 90 days', function () {
    // Marvin's exact case: AHEAD, AY 2026-2027, rule of 30 days.
    // Sep 7 2026 + 30 = Oct 7 2026. It used to return Dec 6 (+90).
    $w = dueDateWorld();
    ProgramDueDateRule::create([
        'program_id' => $w['ahead']->id,
        'academic_year_id' => $w['ay2627']->id,
        'due_date_days' => 30,
    ]);

    $liquidation = dueDateLiquidation($w, $w['ahead'], $w['ay2627']);

    expect($liquidation->financial->due_date?->format('Y-m-d'))->toBe('2026-10-07');
});

it('picks the rule matching the record academic year', function () {
    // Both of Marvin's rules present: the 2025-2026 record must take 60, not 30.
    // Sep 7 2026 + 60 = Nov 6 2026, which is what his screenshot showed.
    $w = dueDateWorld();
    ProgramDueDateRule::create([
        'program_id' => $w['ahead']->id,
        'academic_year_id' => $w['ay2627']->id,
        'due_date_days' => 30,
    ]);
    ProgramDueDateRule::create([
        'program_id' => $w['ahead']->id,
        'academic_year_id' => $w['ay2526']->id,
        'due_date_days' => 60,
    ]);

    $liquidation = dueDateLiquidation($w, $w['ahead'], $w['ay2526']);

    expect($liquidation->financial->due_date?->format('Y-m-d'))->toBe('2026-11-06');
});

it('falls back to the program default rule when no academic-year rule matches', function () {
    $w = dueDateWorld();
    ProgramDueDateRule::create([
        'program_id' => $w['ahead']->id,
        'academic_year_id' => null,
        'due_date_days' => 45,
    ]);

    $liquidation = dueDateLiquidation($w, $w['ahead'], $w['ay2627']);

    expect($liquidation->financial->due_date?->format('Y-m-d'))->toBe('2026-10-22');
});

it('still uses 90 days for a program with no rules at all', function () {
    // Regression: nothing changes for programs nobody has configured.
    $w = dueDateWorld();
    $liquidation = dueDateLiquidation($w, $w['ahead'], $w['ay2627']);

    expect($liquidation->financial->due_date?->format('Y-m-d'))->toBe('2026-12-06');
});

it('still uses 30 days for a sub-program with no rules at all', function () {
    // Regression: STUFAPS sub-programs keep their shorter default.
    $w = dueDateWorld();
    $sub = Program::create([
        'code' => 'SUB-T',
        'name' => 'STUFAPS Sub',
        'status' => 'active',
        'parent_id' => $w['ahead']->id,
    ]);

    $liquidation = dueDateLiquidation($w, $sub, $w['ay2627']);

    expect($liquidation->financial->due_date?->format('Y-m-d'))->toBe('2026-10-07');
});

it('always prefers an explicitly stored due date over any rule', function () {
    // Regression: a date someone deliberately typed must never be recalculated.
    $w = dueDateWorld();
    ProgramDueDateRule::create([
        'program_id' => $w['ahead']->id,
        'academic_year_id' => $w['ay2627']->id,
        'due_date_days' => 30,
    ]);

    $liquidation = dueDateLiquidation($w, $w['ahead'], $w['ay2627'], '2027-01-31');

    expect($liquidation->financial->due_date?->format('Y-m-d'))->toBe('2027-01-31');
});

it('reflects a changed rule immediately instead of serving a stale cache', function () {
    // The gap that would have made testing the rest look random: rules live inside
    // cached lookups that the rule endpoints never cleared, so a change took up to
    // an hour to show. ProgramDueDateRule busts them on write now.
    $w = dueDateWorld();
    $rule = ProgramDueDateRule::create([
        'program_id' => $w['ahead']->id,
        'academic_year_id' => $w['ay2627']->id,
        'due_date_days' => 30,
    ]);

    $liquidation = dueDateLiquidation($w, $w['ahead'], $w['ay2627']);

    // Warm the cache.
    expect($liquidation->financial->due_date?->format('Y-m-d'))->toBe('2026-10-07');

    $rule->update(['due_date_days' => 60]);

    expect($liquidation->fresh()->financial->due_date?->format('Y-m-d'))->toBe('2026-11-06');
});

it('reflects a deleted rule immediately', function () {
    $w = dueDateWorld();
    $rule = ProgramDueDateRule::create([
        'program_id' => $w['ahead']->id,
        'academic_year_id' => $w['ay2627']->id,
        'due_date_days' => 30,
    ]);

    $liquidation = dueDateLiquidation($w, $w['ahead'], $w['ay2627']);
    expect($liquidation->financial->due_date?->format('Y-m-d'))->toBe('2026-10-07');

    $rule->delete();

    // Back to the 90-day default for a top-level program.
    expect($liquidation->fresh()->financial->due_date?->format('Y-m-d'))->toBe('2026-12-06');
});

it('judges overdue against the rule-derived date, not the hardcoded default', function () {
    // The accessor feeds isOverdue(), so a 30-day rule must make a record overdue
    // that a 90-day default would still call current.
    $w = dueDateWorld();
    ProgramDueDateRule::create([
        'program_id' => $w['ahead']->id,
        'academic_year_id' => $w['ay2627']->id,
        'due_date_days' => 30,
    ]);

    $liquidation = dueDateLiquidation($w, $w['ahead'], $w['ay2627']);

    // Released 60 days ago: past a 30-day rule, still inside the old 90-day default.
    $liquidation->financial->update(['date_fund_released' => now()->subDays(60)->toDateString()]);

    expect($liquidation->fresh()->financial->isOverdue())->toBeTrue();
});

it('reads the rules without querying once per record', function () {
    // The accessor runs on every row of every liquidation list, so the resolver has
    // to come out of the cached map rather than hitting the database per row.
    $w = dueDateWorld();
    ProgramDueDateRule::create([
        'program_id' => $w['ahead']->id,
        'academic_year_id' => $w['ay2627']->id,
        'due_date_days' => 30,
    ]);

    // Warm the rule cache once.
    ProgramDueDateRule::getDueDateDays($w['ahead']->id, $w['ay2627']->id, 90);

    $queries = 0;
    DB::listen(function () use (&$queries): void {
        $queries++;
    });

    for ($i = 0; $i < 25; $i++) {
        ProgramDueDateRule::getDueDateDays($w['ahead']->id, $w['ay2627']->id, 90);
    }

    expect($queries)->toBe(0);
});
