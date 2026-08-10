<?php

use App\Models\AcademicYear;
use App\Models\ActivityLog;
use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\LiquidationFinancial;
use App\Models\Program;
use App\Models\Region;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/** Reads the protected opt-out without adding a method that exists only for tests. */
function logsCreation(string $modelClass): bool
{
    $method = new ReflectionMethod($modelClass, 'logsCreation');
    $method->setAccessible(true);

    return $method->invoke(null);
}

/** Minimal parent chain so a Liquidation can be inserted for real. */
function makeLiquidation(string $controlNo): Liquidation
{
    $region = Region::firstOrCreate(['code' => 'R12'], ['name' => 'Region 12', 'status' => 'active']);
    $hei = HEI::firstOrCreate(
        ['uii' => '12345'],
        ['name' => 'Test HEI', 'region_id' => $region->id, 'status' => 'active', 'type' => 'SUC']
    );
    $program = Program::firstOrCreate(['code' => 'TES'], ['name' => 'Tertiary Education Subsidy']);
    $year = AcademicYear::firstOrCreate(['code' => '2025-2026'], ['name' => '2025-2026']);

    return Liquidation::create([
        'control_no' => $controlNo,
        'hei_id' => $hei->id,
        'program_id' => $program->id,
        'academic_year' => $year->name,
        'academic_year_id' => $year->id,
    ]);
}

it('writes one entry when a liquidation is created, not two', function () {
    // Reproduces what was seen in the activity log: creating a liquidation
    // produced "Created liquidation TES-2026-0001" AND "Created liquidation
    // financial <uuid>" at the very same second.
    $liquidation = makeLiquidation('TES-2026-0001');

    ActivityLog::query()->delete();

    $liquidation->financial()->create(['amount_received' => 70000]);

    expect(ActivityLog::where('action', 'created')->count())->toBe(0);
});

it('still logs an edit to a financial row', function () {
    $liquidation = makeLiquidation('TES-2026-0002');
    $financial = $liquidation->financial()->create(['amount_received' => 70000]);

    ActivityLog::query()->delete();

    $financial->update(['amount_received' => 85000]);

    // Suppressing creation must not have suppressed updates — changing a stored
    // amount after the fact is exactly the history an audit needs.
    $log = ActivityLog::where('action', 'updated')->first();

    expect($log)->not->toBeNull()
        ->and($log->subject_type)->toBe(LiquidationFinancial::class);
});

it('leaves the liquidation itself announcing its creation', function () {
    ActivityLog::query()->delete();

    makeLiquidation('TES-2026-0003');

    $log = ActivityLog::where('action', 'created')
        ->where('subject_type', Liquidation::class)
        ->first();

    expect($log)->not->toBeNull()
        ->and($log->description)->toContain('TES-2026-0003');
});

it('leaves every other model logging creation as before', function () {
    expect(logsCreation(LiquidationFinancial::class))->toBeFalse()
        ->and(logsCreation(Liquidation::class))->toBeTrue()
        ->and(logsCreation(User::class))->toBeTrue()
        ->and(logsCreation(HEI::class))->toBeTrue();
});
