<?php

use App\Models\AcademicYear;
use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\LiquidationFinancial;
use App\Models\Permission;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\Semester;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

/**
 * The Details card on the liquidation page posts ten fields, but three of them
 * (Academic Year, Semester, Batch No.) had no validation rule and were stripped
 * before the service ever saw them, and the financial loop tested isset(), which
 * is false for null - so clearing a date left the old value stored. Every one of
 * those saves still answered "Liquidation updated successfully".
 *
 * Helpers are declared here rather than borrowed from another test file: Pest
 * helpers are global but only exist once their file loads, so a borrowed one
 * breaks whenever the files land in different --parallel processes.
 */
function detailUpdateWorld(): array
{
    Cache::flush();

    $region = Region::create(['code' => 'R12-DET', 'name' => 'Region XII Detail', 'status' => 'active']);
    $role = Role::create(['name' => 'Admin', 'description' => 'Admin']);

    foreach (['view_liquidation', 'edit_liquidation'] as $name) {
        $permission = Permission::firstOrCreate(
            ['name' => $name],
            ['module' => 'Liquidation', 'description' => 'test'],
        );
        $role->permissions()->attach($permission->id);
    }

    return [
        'user' => User::factory()->create(['role_id' => $role->id, 'status' => 'active']),
        'hei' => HEI::create([
            'uii' => '13579',
            'name' => 'Detail Test College',
            'type' => 'Private',
            'region_id' => $region->id,
            'status' => 'active',
        ]),
        'program' => Program::create(['code' => 'TES-DET', 'name' => 'TES', 'status' => 'active']),
        // firstOrCreate: migrations already seed the semester and academic-year
        // lookup tables, and their codes are unique.
        'ayOld' => AcademicYear::firstOrCreate(
            ['code' => '2024-2025'],
            ['name' => 'AY 2024-2025', 'is_active' => true],
        ),
        'ayNew' => AcademicYear::firstOrCreate(
            ['code' => '2025-2026'],
            ['name' => 'AY 2025-2026', 'is_active' => true],
        ),
        'semFirst' => Semester::firstOrCreate(
            ['code' => Semester::CODE_FIRST],
            ['name' => '1st Semester', 'is_active' => true],
        ),
        'semSecond' => Semester::firstOrCreate(
            ['code' => Semester::CODE_SECOND],
            ['name' => '2nd Semester', 'is_active' => true],
        ),
    ];
}

/** A liquidation carrying the starting values a Details-card edit would change. */
function detailUpdateLiquidation(array $w): Liquidation
{
    $liquidation = Liquidation::create([
        'control_no' => 'TES-2026-'.fake()->unique()->numerify('####'),
        'hei_id' => $w['hei']->id,
        'program_id' => $w['program']->id,
        'academic_year_id' => $w['ayOld']->id,
        'semester_id' => $w['semFirst']->id,
        'batch_no' => 'BATCH-1',
        'created_by' => $w['user']->id,
    ]);

    LiquidationFinancial::create([
        'liquidation_id' => $liquidation->id,
        'amount_received' => 1000,
        'amount_disbursed' => 1000,
        'amount_liquidated' => 0,
        'date_fund_released' => '2026-01-15',
        'due_date' => '2026-06-30',
        'number_of_grantees' => 25,
    ]);

    return $liquidation;
}

it('saves a changed academic year', function () {
    $w = detailUpdateWorld();
    $liquidation = detailUpdateLiquidation($w);

    $this->actingAs($w['user'])
        ->from(route('liquidation.index'))
        ->put(route('liquidation.update', $liquidation), ['academic_year_id' => $w['ayNew']->id])
        ->assertSessionHasNoErrors();

    expect($liquidation->fresh()->academic_year_id)->toBe($w['ayNew']->id);
});

it('saves a changed semester', function () {
    $w = detailUpdateWorld();
    $liquidation = detailUpdateLiquidation($w);

    // The card posts the semester NAME, matching the create form.
    $this->actingAs($w['user'])
        ->from(route('liquidation.index'))
        ->put(route('liquidation.update', $liquidation), ['semester' => '2nd Semester'])
        ->assertSessionHasNoErrors();

    expect($liquidation->fresh()->semester_id)->toBe($w['semSecond']->id);
});

it('saves a changed batch number', function () {
    $w = detailUpdateWorld();
    $liquidation = detailUpdateLiquidation($w);

    $this->actingAs($w['user'])
        ->from(route('liquidation.index'))
        ->put(route('liquidation.update', $liquidation), ['batch_no' => 'BATCH-7'])
        ->assertSessionHasNoErrors();

    expect($liquidation->fresh()->batch_no)->toBe('BATCH-7');
});

it('clears a due date when the field is emptied', function () {
    // The reported case: the card sends due_date as value-or-null, and isset()
    // is false for null, so the old date used to survive the save.
    //
    // Asserted on the stored column, not the attribute: LiquidationFinancial has
    // a getDueDateAttribute accessor that falls back to date_fund_released + 90
    // days (30 for STUFAPS sub-programs) whenever no explicit date is stored.
    // Clearing the field means "no explicit due date", which hands the record
    // back to that automatic rule - it does not leave the liquidation with none.
    $w = detailUpdateWorld();
    $liquidation = detailUpdateLiquidation($w);

    expect($liquidation->financial->getRawOriginal('due_date'))->not->toBeNull();

    $this->actingAs($w['user'])
        ->from(route('liquidation.index'))
        ->put(route('liquidation.update', $liquidation), ['due_date' => null])
        ->assertSessionHasNoErrors();

    expect($liquidation->fresh()->financial->getRawOriginal('due_date'))->toBeNull();
});

it('falls back to the automatic due date once the explicit one is cleared', function () {
    // Documents the behaviour the test above relies on: 90 days after the fund
    // release date for an ordinary program.
    $w = detailUpdateWorld();
    $liquidation = detailUpdateLiquidation($w);

    $this->actingAs($w['user'])
        ->from(route('liquidation.index'))
        ->put(route('liquidation.update', $liquidation), ['due_date' => null])
        ->assertSessionHasNoErrors();

    expect($liquidation->fresh()->financial->due_date?->format('Y-m-d'))
        ->toBe('2026-04-15');
});

it('clears a fund release date when the field is emptied', function () {
    $w = detailUpdateWorld();
    $liquidation = detailUpdateLiquidation($w);

    $this->actingAs($w['user'])
        ->from(route('liquidation.index'))
        ->put(route('liquidation.update', $liquidation), ['date_fund_released' => null])
        ->assertSessionHasNoErrors();

    expect($liquidation->fresh()->financial->date_fund_released)->toBeNull();
});

it('rejects an academic year that does not exist', function () {
    $w = detailUpdateWorld();
    $liquidation = detailUpdateLiquidation($w);

    $this->actingAs($w['user'])
        ->from(route('liquidation.index'))
        ->put(route('liquidation.update', $liquidation), [
            'academic_year_id' => '00000000-0000-0000-0000-000000000000',
        ])
        ->assertSessionHasErrors('academic_year_id');

    expect($liquidation->fresh()->academic_year_id)->toBe($w['ayOld']->id);
});

it('clears the semester instead of falling back to the first one', function () {
    // findSemesterId with an empty value returns 1st Semester by design for the
    // import paths, so the update path has to guard the empty case itself.
    $w = detailUpdateWorld();
    $liquidation = detailUpdateLiquidation($w);

    $this->actingAs($w['user'])
        ->from(route('liquidation.index'))
        ->put(route('liquidation.update', $liquidation), ['semester' => null])
        ->assertSessionHasNoErrors();

    expect($liquidation->fresh()->semester_id)->toBeNull();
});

it('leaves untouched fields alone when only one field is sent', function () {
    $w = detailUpdateWorld();
    $liquidation = detailUpdateLiquidation($w);

    $this->actingAs($w['user'])
        ->from(route('liquidation.index'))
        ->put(route('liquidation.update', $liquidation), ['batch_no' => 'BATCH-9'])
        ->assertSessionHasNoErrors();

    $fresh = $liquidation->fresh();

    expect($fresh->batch_no)->toBe('BATCH-9')
        ->and($fresh->academic_year_id)->toBe($w['ayOld']->id)
        ->and($fresh->semester_id)->toBe($w['semFirst']->id)
        ->and($fresh->financial->due_date?->format('Y-m-d'))->toBe('2026-06-30')
        ->and((float) $fresh->financial->amount_received)->toBe(1000.0);
});
