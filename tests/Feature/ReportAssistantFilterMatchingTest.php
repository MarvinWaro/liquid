<?php

use App\Models\AcademicYear;
use App\Models\Region;
use App\Services\ReportAssistantQueryService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/** Runs the private normalizeFilters() the tools go through. */
function resolveFilters(array $arguments): array
{
    $service = app(ReportAssistantQueryService::class);
    $method = new ReflectionMethod($service, 'normalizeFilters');
    $method->setAccessible(true);

    [$filters, $applied, $unmatched] = $method->invoke($service, $arguments);

    return compact('filters', 'applied', 'unmatched');
}

beforeEach(function () {
    AcademicYear::query()->delete();
    Region::query()->delete();

    AcademicYear::create(['code' => '2025-2026', 'name' => '2025-2026']);
    AcademicYear::create(['code' => '2024-2025', 'name' => '2024-2025']);
    Region::create(['code' => 'R12', 'name' => 'Region 12']);
    Region::create(['code' => 'BARMM', 'name' => 'BARMM']);
});

it('matches an academic year written with the AY prefix', function () {
    // The exact failure seen in the assistant: 333 records existed, but
    // "AY 2025-2026" reported the year as unrecognised.
    foreach (['2025-2026', 'AY 2025-2026', 'ay 2025-2026', 'A.Y. 2025-2026', 'SY 2025-2026'] as $input) {
        $result = resolveFilters(['academic_years' => [$input]]);

        expect($result['unmatched'])->toBe([], "'{$input}' should resolve")
            ->and($result['applied']['academic_years'])->toBe(['2025-2026']);
    }
});

it('matches a region written in roman numerals', function () {
    // The login page reads "CHED REGION XII"; the record is stored "Region 12".
    foreach (['Region 12', 'Region XII', 'region xii', 'R12', 'BARMM'] as $input) {
        $result = resolveFilters(['regions' => [$input]]);

        expect($result['unmatched'])->toBe([], "'{$input}' should resolve");
    }
});

it('ignores stray internal whitespace', function () {
    $result = resolveFilters(['regions' => ['Region   12']]);

    expect($result['unmatched'])->toBe([])
        ->and($result['applied']['regions'])->toBe(['Region 12']);
});

it('still refuses a year that does not exist', function () {
    // Normalisation must not become guessing — a wrong year silently accepted
    // would filter a financial report to the wrong period.
    $result = resolveFilters(['academic_years' => ['AY 2099-2100']]);

    expect($result['unmatched']['academic_years'])->toBe(['AY 2099-2100'])
        ->and($result['applied'])->toBe([]);
});

it('does not turn a malformed roman numeral into a number', function () {
    $result = resolveFilters(['regions' => ['Region XIIX']]);

    expect($result['unmatched']['regions'])->toBe(['Region XIIX']);
});

it('resolves the exact stored value unchanged', function () {
    // Guards the common path: normalisation must not disturb values that
    // already matched before this change.
    $result = resolveFilters([
        'academic_years' => ['2024-2025'],
        'regions' => ['BARMM'],
    ]);

    expect($result['unmatched'])->toBe([])
        ->and($result['applied']['academic_years'])->toBe(['2024-2025'])
        ->and($result['applied']['regions'])->toBe(['BARMM']);
});
