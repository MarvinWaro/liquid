<?php

use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\Permission;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

/**
 * @param  list<string>  $permissionNames
 */
function liquidationRegionContextTestRole(string $name, array $permissionNames): Role
{
    $role = Role::create([
        'name' => $name,
        'description' => "{$name} role for liquidation region context tests",
    ]);

    foreach ($permissionNames as $permissionName) {
        $permission = Permission::firstOrCreate(
            ['name' => $permissionName],
            ['module' => 'Liquidation', 'description' => "Test {$permissionName}"],
        );

        $role->permissions()->attach($permission->id);
    }

    return $role;
}

function liquidationRegionContextTestUser(
    Role $role,
    string $name,
    ?Region $region = null,
    ?HEI $hei = null,
): User {
    return User::factory()->create([
        'name' => $name,
        'role_id' => $role->id,
        'region_id' => $region?->id,
        'hei_id' => $hei?->id,
        'status' => 'active',
    ]);
}

/**
 * @return array{
 *     region_twelve: Region,
 *     barmm: Region,
 *     unrelated_region: Region,
 *     former_rc: User,
 *     current_rc: User,
 *     unrelated_rc: User,
 *     hei_user: User,
 *     liquidation: Liquidation
 * }
 */
function liquidationRegionContextTestScenario(): array
{
    $regionTwelve = Region::create([
        'code' => 'R12',
        'name' => 'Region XII',
        'status' => 'active',
    ]);
    $barmm = Region::create([
        'code' => 'BARMM',
        'name' => 'Bangsamoro Autonomous Region in Muslim Mindanao',
        'status' => 'active',
    ]);
    $unrelatedRegion = Region::create([
        'code' => 'R11',
        'name' => 'Region XI',
        'status' => 'active',
    ]);

    $rcRole = liquidationRegionContextTestRole('Regional Coordinator', ['view_liquidation']);
    $heiRole = liquidationRegionContextTestRole('HEI', ['view_liquidation']);

    $hei = HEI::create([
        'uii' => 'CTX-HEI-001',
        'code' => 'CSU',
        'name' => 'COTABATO STATE UNIVERSITY',
        'type' => 'SUC',
        'region_id' => $barmm->id,
        'status' => 'active',
    ]);

    $formerRc = liquidationRegionContextTestUser($rcRole, 'Former Region XII RC', $regionTwelve);
    $currentRc = liquidationRegionContextTestUser($rcRole, 'Current BARMM RC', $barmm);
    $unrelatedRc = liquidationRegionContextTestUser($rcRole, 'Unrelated Region XI RC', $unrelatedRegion);
    $heiUser = liquidationRegionContextTestUser($heiRole, 'Cotabato State University User', null, $hei);

    $program = Program::create([
        'code' => 'CTX-TES',
        'name' => 'Tertiary Education Subsidy',
        'status' => 'active',
    ]);

    $liquidation = Liquidation::create([
        'control_no' => 'CTX-TES-2026-0001',
        'hei_id' => $hei->id,
        'processing_region_id' => $regionTwelve->id,
        'program_id' => $program->id,
        'created_by' => $formerRc->id,
    ]);

    return compact(
        'regionTwelve',
        'barmm',
        'unrelatedRegion',
        'formerRc',
        'currentRc',
        'unrelatedRc',
        'heiUser',
        'liquidation',
    );
}

test('an authorized internal RC sees historical region context and both operational reviewers', function () {
    $scenario = liquidationRegionContextTestScenario();
    $expectedReviewerIds = collect([
        $scenario['formerRc']->id,
        $scenario['currentRc']->id,
    ])->sort()->values()->all();

    $this->actingAs($scenario['formerRc'])
        ->get(route('liquidation.show', $scenario['liquidation']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('liquidation/show')
            ->where('liquidation.region_context.current_region.id', $scenario['barmm']->id)
            ->where('liquidation.region_context.current_region.code', 'BARMM')
            ->where('liquidation.region_context.processing_region.id', $scenario['regionTwelve']->id)
            ->where('liquidation.region_context.processing_region.code', 'R12')
            ->where('regionalCoordinators', function ($coordinators) use ($expectedReviewerIds): bool {
                return collect($coordinators)
                    ->pluck('id')
                    ->sort()
                    ->values()
                    ->all() === $expectedReviewerIds;
            })
        );
});

test('an HEI user can view the historical liquidation without receiving transfer context', function () {
    $scenario = liquidationRegionContextTestScenario();

    $this->actingAs($scenario['heiUser'])
        ->get(route('liquidation.show', $scenario['liquidation']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('liquidation/show')
            ->where('liquidation.id', $scenario['liquidation']->id)
            ->missing('liquidation.region_context')
        );
});

test('mentionable users include both operational RC regions but exclude unrelated RCs', function () {
    $scenario = liquidationRegionContextTestScenario();

    $this->actingAs($scenario['heiUser'])
        ->getJson(route('liquidation.mentionable-users', $scenario['liquidation']))
        ->assertOk()
        ->assertJsonCount(2)
        ->assertJsonFragment([
            'id' => $scenario['formerRc']->id,
            'name' => $scenario['formerRc']->name,
            'role' => 'Regional Coordinator',
        ])
        ->assertJsonFragment([
            'id' => $scenario['currentRc']->id,
            'name' => $scenario['currentRc']->name,
            'role' => 'Regional Coordinator',
        ])
        ->assertJsonMissing([
            'id' => $scenario['unrelatedRc']->id,
        ]);
});
