<?php

use App\Models\HEI;
use App\Models\Liquidation;
use App\Models\Notification;
use App\Models\Permission;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\SupportTicket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

/**
 * Support ticket visibility keyed only on who OPENED a ticket, never on which
 * liquidation it was about. So a ticket an Admin or RC raised for an institution
 * was invisible to that institution: no notification, a dead deep link, and a 403
 * on reply. Regional Coordinators and STUFAPS Focals already had
 * liquidation-scoped access; HEI users were left out of that pattern.
 *
 * Helpers are declared here rather than borrowed from another test file: Pest
 * helpers are global but only exist once their file loads, so a borrowed one
 * breaks whenever the files land in different --parallel processes.
 *
 * @param  list<string>  $permissionNames
 */
function heiVisibilityRole(string $name, array $permissionNames = []): Role
{
    $role = Role::firstOrCreate(
        ['name' => $name],
        ['description' => "{$name} role for HEI ticket visibility tests"],
    );

    foreach ($permissionNames as $permissionName) {
        $permission = Permission::firstOrCreate(
            ['name' => $permissionName],
            ['module' => 'Contact & Support', 'description' => "Test {$permissionName}"],
        );

        $role->permissions()->syncWithoutDetaching([$permission->id]);
    }

    return $role;
}

/**
 * One region, two institutions, and the cast of accounts around them.
 */
function heiVisibilityWorld(): array
{
    $region = Region::create(['code' => 'R12-VIS', 'name' => 'Region XII Visibility', 'status' => 'active']);

    $adminRole = heiVisibilityRole('Admin', ['create_ticket', 'view_liquidation']);
    $rcRole = heiVisibilityRole('Regional Coordinator', ['create_ticket', 'view_liquidation']);
    $heiRole = heiVisibilityRole('HEI', ['create_ticket', 'view_liquidation']);

    $hei = HEI::create([
        'uii' => 'VIS-HEI-1',
        'code' => 'VIS-1',
        'name' => 'ACLC COLLEGE OF MARBEL',
        'type' => 'Private',
        'region_id' => $region->id,
        'status' => 'active',
    ]);

    $otherHei = HEI::create([
        'uii' => 'VIS-HEI-2',
        'code' => 'VIS-2',
        'name' => 'OTHER COLLEGE',
        'type' => 'Private',
        'region_id' => $region->id,
        'status' => 'active',
    ]);

    $program = Program::create(['code' => 'VIS-TES', 'name' => 'TES', 'status' => 'active']);

    $admin = User::factory()->create(['name' => 'Admin', 'role_id' => $adminRole->id, 'status' => 'active']);
    $rc = User::factory()->create([
        'name' => 'Region XII RC',
        'role_id' => $rcRole->id,
        'region_id' => $region->id,
        'status' => 'active',
    ]);

    $heiUser = User::factory()->create([
        'name' => 'ACLC Encoder',
        'role_id' => $heiRole->id,
        'hei_id' => $hei->id,
        'region_id' => $region->id,
        'status' => 'active',
    ]);
    $heiTeammate = User::factory()->create([
        'name' => 'ACLC Second Account',
        'role_id' => $heiRole->id,
        'hei_id' => $hei->id,
        'region_id' => $region->id,
        'status' => 'active',
    ]);
    $inactiveHeiUser = User::factory()->create([
        'name' => 'ACLC Retired Account',
        'role_id' => $heiRole->id,
        'hei_id' => $hei->id,
        'region_id' => $region->id,
        'status' => 'inactive',
    ]);
    $otherHeiUser = User::factory()->create([
        'name' => 'Other College Encoder',
        'role_id' => $heiRole->id,
        'hei_id' => $otherHei->id,
        'region_id' => $region->id,
        'status' => 'active',
    ]);

    $liquidation = Liquidation::create([
        'control_no' => 'TES-2026-0001',
        'hei_id' => $hei->id,
        'processing_region_id' => $region->id,
        'program_id' => $program->id,
        'created_by' => $admin->id,
    ]);

    return compact(
        'region', 'hei', 'otherHei', 'program', 'admin', 'rc',
        'heiUser', 'heiTeammate', 'inactiveHeiUser', 'otherHeiUser', 'liquidation',
    );
}

/** The payload the New Ticket form submits. */
function heiVisibilityPayload(?Liquidation $liquidation, string $subject = 'Submission Incomplete and incorrect file'): array
{
    return [
        'category' => SupportTicket::CATEGORY_LIQUIDATION_RECORD,
        'priority' => SupportTicket::PRIORITY_HIGH,
        'liquidation_id' => $liquidation?->id,
        'subject' => $subject,
        'description' => 'please re upload the billing form',
    ];
}

it('notifies the institution when an admin opens a ticket on their liquidation', function () {
    // Marvin's exact case: the Admin wrote "please re upload the billing form"
    // and nobody at ACLC was ever told.
    $w = heiVisibilityWorld();

    $this->actingAs($w['admin'])
        ->post(route('support-tickets.store'), heiVisibilityPayload($w['liquidation']))
        ->assertSessionHasNoErrors();

    $ticket = SupportTicket::firstOrFail();

    foreach (['heiUser', 'heiTeammate'] as $key) {
        expect(
            Notification::where('user_id', $w[$key]->id)
                ->where('action', 'support_ticket_created')
                ->exists()
        )->toBeTrue("{$key} should have been notified");
    }
});

it('shows the admin-opened ticket in the institution ticket list', function () {
    $w = heiVisibilityWorld();

    $this->actingAs($w['admin'])
        ->post(route('support-tickets.store'), heiVisibilityPayload($w['liquidation']));

    $this->actingAs($w['heiUser'])
        ->get(route('contact-support'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('tickets.data', 1));
});

it('opens the ticket from the notification deep link', function () {
    // The notification metadata links to /contact-support?ticket=<id>, so the
    // link is only as good as selectedTicket's visibility query.
    $w = heiVisibilityWorld();

    $this->actingAs($w['admin'])
        ->post(route('support-tickets.store'), heiVisibilityPayload($w['liquidation']));

    $ticket = SupportTicket::firstOrFail();

    $this->actingAs($w['heiUser'])
        ->get(route('contact-support', ['ticket' => $ticket->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('selectedTicket.id', $ticket->id));
});

it('lets the institution reply to a ticket an admin opened', function () {
    $w = heiVisibilityWorld();

    $this->actingAs($w['admin'])
        ->post(route('support-tickets.store'), heiVisibilityPayload($w['liquidation']));

    $ticket = SupportTicket::firstOrFail();

    $this->actingAs($w['heiUser'])
        ->post(route('support-tickets.reply', $ticket), ['body' => 'Re-uploaded, thank you.'])
        ->assertSessionHasNoErrors();

    expect($ticket->messages()->where('user_id', $w['heiUser']->id)->exists())->toBeTrue();
});

it('behaves the same when a regional coordinator opens the ticket', function () {
    $w = heiVisibilityWorld();

    $this->actingAs($w['rc'])
        ->post(route('support-tickets.store'), heiVisibilityPayload($w['liquidation']))
        ->assertSessionHasNoErrors();

    expect(
        Notification::where('user_id', $w['heiUser']->id)
            ->where('action', 'support_ticket_created')
            ->exists()
    )->toBeTrue();
});

it('keeps the ticket away from a different institution', function () {
    // Regression: the fix must widen access to the owning HEI only.
    $w = heiVisibilityWorld();

    $this->actingAs($w['admin'])
        ->post(route('support-tickets.store'), heiVisibilityPayload($w['liquidation']));

    $ticket = SupportTicket::firstOrFail();

    expect(Notification::where('user_id', $w['otherHeiUser']->id)->exists())->toBeFalse();

    $this->actingAs($w['otherHeiUser'])
        ->get(route('contact-support'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('tickets.data', 0));

    $this->actingAs($w['otherHeiUser'])
        ->post(route('support-tickets.reply', $ticket), ['body' => 'Not mine.'])
        ->assertForbidden();
});

it('tells no institution about a ticket with no liquidation attached', function () {
    // Regression: a general enquiry an admin raises has no institution behind it.
    $w = heiVisibilityWorld();

    $this->actingAs($w['admin'])
        ->post(route('support-tickets.store'), heiVisibilityPayload(null, 'General question'))
        ->assertSessionHasNoErrors();

    expect(Notification::where('user_id', $w['heiUser']->id)->exists())->toBeFalse();

    $this->actingAs($w['heiUser'])
        ->get(route('contact-support'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('tickets.data', 0));
});

it('still notifies admins when the institution opens a ticket', function () {
    // Regression: the direction that already worked must keep working.
    $w = heiVisibilityWorld();

    $this->actingAs($w['heiUser'])
        ->post(route('support-tickets.store'), heiVisibilityPayload($w['liquidation'], 'Upload concern'))
        ->assertSessionHasNoErrors();

    expect(
        Notification::where('user_id', $w['admin']->id)
            ->where('action', 'support_ticket_created')
            ->exists()
    )->toBeTrue();
});

it('does not notify an inactive account at the institution', function () {
    // Regression: heiPeersForTicket filters on status, and it must keep doing so.
    $w = heiVisibilityWorld();

    $this->actingAs($w['admin'])
        ->post(route('support-tickets.store'), heiVisibilityPayload($w['liquidation']));

    expect(Notification::where('user_id', $w['inactiveHeiUser']->id)->exists())->toBeFalse();
});
