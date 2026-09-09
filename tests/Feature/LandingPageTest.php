<?php

use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\LiquidationFinancial;
use App\Models\Program;
use App\Models\Region;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

/**
 * The public landing page used to publish an Honor Roll and a "For Action" board
 * naming every institution with its peso figures and percentage, to anyone, with
 * no login - measured as a plain SUM(liquidated) / SUM(received) with no
 * due-date or workflow filtering, so an HEI whose funds were not yet due showed
 * at 0% as though it were delinquent.
 *
 * The boards are off the page until that measure is fair. These pin both halves
 * of that: nothing identifying is published, and the public root does no work.
 */
function landingLiquidation(): Liquidation
{
    $region = Region::create(['code' => 'R12-LP', 'name' => 'Region XII Landing', 'status' => 'active']);

    $hei = HEI::create([
        'uii' => '99123',
        'code' => 'LP-HEI',
        'name' => 'LANDING PAGE COLLEGE',
        'type' => 'Private',
        'region_id' => $region->id,
        'status' => 'active',
    ]);

    $program = Program::create(['code' => 'LP-TES', 'name' => 'TES', 'status' => 'active']);

    $liquidation = Liquidation::create([
        'control_no' => 'TES-2026-LP01',
        'hei_id' => $hei->id,
        'program_id' => $program->id,
        'created_by' => User::factory()->create(['status' => 'active'])->id,
    ]);

    LiquidationFinancial::create([
        'liquidation_id' => $liquidation->id,
        'amount_received' => 10000,
        'amount_disbursed' => 10000,
        'amount_liquidated' => 0,
    ]);

    return $liquidation;
}

it('shows the landing page to a guest', function () {
    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('welcome'));
});

it('publishes no institution data', function () {
    // The guard that matters. A liquidation sitting at 0% is exactly the row that
    // used to be named publicly at the top of "For Action" - this fails if the
    // boards are ever wired back in without a deliberate decision.
    landingLiquidation();

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('welcome')
            ->missing('honorBoard')
            ->missing('shameBoard')
        );
});

it('does not name an institution anywhere in the response', function () {
    landingLiquidation();

    $html = $this->get('/')->assertOk()->getContent();

    expect($html)->not->toContain('LANDING PAGE COLLEGE')
        ->and($html)->not->toContain('99123');
});

it('queries no liquidation data to render', function () {
    // The public root is the one URL reachable without authenticating, on a very
    // small box. It used to run a four-table join with SUM, COUNT DISTINCT and a
    // division on every hit, uncached.
    landingLiquidation();

    $touched = [];
    DB::listen(function ($query) use (&$touched): void {
        foreach (['liquidations', 'liquidation_financials', 'heis'] as $table) {
            if (str_contains($query->sql, $table)) {
                $touched[] = $table;
            }
        }
    });

    $this->get('/')->assertOk();

    expect($touched)->toBe([]);
});

it('still renders for a signed-in user', function () {
    // The call to action branches on auth.user, so both states have to render.
    $user = User::factory()->create(['status' => 'active']);

    $this->actingAs($user)
        ->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('welcome'));
});
