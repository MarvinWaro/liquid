<?php

use App\Models\Permission;
use App\Models\Role;
use App\Models\SupportTicket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Resolution remarks used to live only inside the ticket thread, so the ticket
 * itself could not say how it had been resolved. These cover the outcome now
 * carried on the ticket and shown beside "Resolved by X on Y".
 */
function remarksStaff(string $name = 'Support Staff'): User
{
    $role = Role::firstOrCreate(['name' => 'Admin'], ['description' => 'test']);
    foreach (['view_support_tickets', 'manage_support_tickets'] as $permission) {
        $perm = Permission::firstOrCreate(
            ['name' => $permission],
            ['module' => 'Support', 'description' => 'test']
        );
        $role->permissions()->syncWithoutDetaching([$perm->id]);
    }

    return User::factory()->create(['role_id' => $role->id, 'name' => $name]);
}

function remarksTicket(User $requester): SupportTicket
{
    return SupportTicket::create([
        'ticket_number' => 'TKT-'.strtoupper(substr(uniqid(), -8)),
        'requester_id' => $requester->id,
        'category' => 'general',
        'priority' => 'normal',
        'status' => 'open',
        'subject' => 'Cannot upload my liquidation',
        'description' => 'The upload button does nothing.',
    ]);
}

function setStatus(User $actor, SupportTicket $ticket, string $status, ?string $remarks = null): void
{
    test()->actingAs($actor)
        ->patch("/contact-support/tickets/{$ticket->id}/status", array_filter([
            'status' => $status,
            'remarks' => $remarks,
        ], fn ($value) => $value !== null))
        ->assertRedirect();
}

function selectedTicketProp(User $viewer, SupportTicket $ticket): array
{
    $page = test()->actingAs($viewer)
        ->get("/contact-support?ticket={$ticket->id}")
        ->assertSuccessful();

    return $page->viewData('page')['props']['selectedTicket'];
}

it('carries the resolution remarks on the ticket so the banner can show them', function () {
    $staff = remarksStaff();
    $ticket = remarksTicket(remarksStaff('Requester'));

    setStatus($staff, $ticket, 'resolved', 'Fixed by re-uploading the document.');

    $prop = selectedTicketProp($staff, $ticket);

    expect($prop['resolution_remarks'])->toBe('Fixed by re-uploading the document.')
        ->and($prop['resolved_by_name'])->toBe('Support Staff')
        ->and($prop['resolved_at'])->not->toBeNull();
});

it('still writes the remark into the thread as history', function () {
    $staff = remarksStaff();
    $ticket = remarksTicket(remarksStaff('Requester'));

    setStatus($staff, $ticket, 'resolved', 'Fixed by re-uploading the document.');

    // The thread entry is what existed before; it must not disappear just because
    // the outcome is now also stored on the ticket.
    expect($ticket->messages()->pluck('body')->all())
        ->toBe(['Resolution note: Fixed by re-uploading the document.']);
});

it('leaves the remarks empty when the case is resolved without a note', function () {
    $staff = remarksStaff();
    $ticket = remarksTicket(remarksStaff('Requester'));

    setStatus($staff, $ticket, 'resolved');

    $prop = selectedTicketProp($staff, $ticket);

    expect($prop['resolution_remarks'])->toBeNull()
        ->and($prop['resolved_at'])->not->toBeNull();
});

it('clears the remarks when the ticket is reopened by status change', function () {
    $staff = remarksStaff();
    $ticket = remarksTicket(remarksStaff('Requester'));

    setStatus($staff, $ticket, 'resolved', 'Fixed by re-uploading the document.');
    setStatus($staff, $ticket, 'open', 'Reopening, still broken.');

    // A reopened ticket must not advertise a resolution.
    expect($ticket->fresh()->resolution_remarks)->toBeNull()
        ->and($ticket->fresh()->resolved_at)->toBeNull();
});

it('clears the remarks when a reply reopens the ticket', function () {
    $staff = remarksStaff();
    $requester = remarksStaff('Requester');
    $ticket = remarksTicket($requester);

    setStatus($staff, $ticket, 'resolved', 'Fixed by re-uploading the document.');

    test()->actingAs($staff)
        ->post("/contact-support/tickets/{$ticket->id}/messages", ['body' => 'Actually it is back.'])
        ->assertRedirect();

    expect($ticket->fresh()->status)->toBe('open')
        ->and($ticket->fresh()->resolution_remarks)->toBeNull();
});

it('recovers remarks from the thread for tickets resolved before the column existed', function () {
    $staff = remarksStaff();
    $ticket = remarksTicket(remarksStaff('Requester'));

    setStatus($staff, $ticket, 'resolved', 'Handled offline with the RC.');

    // Simulate a pre-migration row: thread note present, column empty.
    $ticket->forceFill(['resolution_remarks' => null])->save();

    $migration = require database_path(
        'migrations/2026_08_11_000000_add_resolution_remarks_to_support_tickets_table.php'
    );
    $backfill = (new ReflectionClass($migration))->getMethod('backfillFromThreadMessages');
    $backfill->setAccessible(true);
    $backfill->invoke($migration);

    expect($ticket->fresh()->resolution_remarks)->toBe('Handled offline with the RC.');
});
