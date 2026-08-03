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
 * @param  list<string>  $permissionNames
 */
function supportTransferTestRole(string $name, array $permissionNames = []): Role
{
    $role = Role::create([
        'name' => $name,
        'description' => "{$name} role for support transfer tests",
    ]);

    foreach ($permissionNames as $permissionName) {
        $permission = Permission::firstOrCreate(
            ['name' => $permissionName],
            ['module' => 'Contact & Support', 'description' => "Test {$permissionName}"],
        );

        $role->permissions()->attach($permission->id);
    }

    return $role;
}

/**
 * @return array{
 *     processing_rc: User,
 *     current_rc: User,
 *     unrelated_rc: User,
 *     hei_user: User,
 *     liquidation: Liquidation,
 *     ticket: SupportTicket
 * }
 */
function supportTransferTestScenario(): array
{
    $processingRegion = Region::create([
        'code' => 'R12',
        'name' => 'Region XII',
        'status' => 'active',
    ]);
    $currentRegion = Region::create([
        'code' => 'BARMM',
        'name' => 'Bangsamoro Autonomous Region in Muslim Mindanao',
        'status' => 'active',
    ]);
    $unrelatedRegion = Region::create([
        'code' => 'R11',
        'name' => 'Region XI',
        'status' => 'active',
    ]);

    $rcRole = supportTransferTestRole('Regional Coordinator', ['create_ticket']);
    $heiRole = supportTransferTestRole('HEI', ['create_ticket']);

    $hei = HEI::create([
        'uii' => 'SUPPORT-TRANSFER-HEI',
        'code' => 'ST-HEI',
        'name' => 'COTABATO STATE UNIVERSITY',
        'type' => 'SUC',
        'region_id' => $currentRegion->id,
        'status' => 'active',
    ]);

    $processingRc = User::factory()->create([
        'name' => 'Region XII Support RC',
        'role_id' => $rcRole->id,
        'region_id' => $processingRegion->id,
        'status' => 'active',
    ]);
    $currentRc = User::factory()->create([
        'name' => 'BARMM Support RC',
        'role_id' => $rcRole->id,
        'region_id' => $currentRegion->id,
        'status' => 'active',
    ]);
    $unrelatedRc = User::factory()->create([
        'name' => 'Region XI Support RC',
        'role_id' => $rcRole->id,
        'region_id' => $unrelatedRegion->id,
        'status' => 'active',
    ]);
    $heiUser = User::factory()->create([
        'name' => 'Cotabato State University User',
        'role_id' => $heiRole->id,
        'hei_id' => $hei->id,
        'status' => 'active',
    ]);

    $program = Program::create([
        'code' => 'SUPPORT-TES',
        'name' => 'Support Ticket Test Program',
        'status' => 'active',
    ]);
    $liquidation = Liquidation::create([
        'control_no' => 'SUPPORT-2026-0001',
        'hei_id' => $hei->id,
        'processing_region_id' => $processingRegion->id,
        'program_id' => $program->id,
        'created_by' => $processingRc->id,
    ]);

    $ticket = SupportTicket::create([
        'ticket_number' => 'TKT-TRANSFER-0001',
        'requester_id' => $heiUser->id,
        'liquidation_id' => $liquidation->id,
        'category' => SupportTicket::CATEGORY_LIQUIDATION_RECORD,
        'priority' => SupportTicket::PRIORITY_NORMAL,
        'status' => SupportTicket::STATUS_OPEN,
        'subject' => 'Historical liquidation assistance',
        'description' => 'Please review the historical liquidation record.',
        'last_reply_at' => now(),
    ]);
    $ticket->messages()->create([
        'user_id' => $heiUser->id,
        'body' => $ticket->description,
    ]);

    return [
        'processing_rc' => $processingRc,
        'current_rc' => $currentRc,
        'unrelated_rc' => $unrelatedRc,
        'hei_user' => $heiUser,
        'liquidation' => $liquidation,
        'ticket' => $ticket,
    ];
}

test('both operational RC groups can select the historical liquidation and its support ticket', function () {
    $scenario = supportTransferTestScenario();

    foreach (['processing_rc', 'current_rc'] as $userKey) {
        $this->actingAs($scenario[$userKey])
            ->get(route('contact-support', [
                'ticket' => $scenario['ticket']->id,
                'status' => 'all',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('contact-support')
                ->where('selectedTicket.id', $scenario['ticket']->id)
                ->where('selectedTicket.can_manage', true)
                ->where('tickets.data', fn ($tickets): bool => collect($tickets)
                    ->contains('id', $scenario['ticket']->id))
                ->where('liquidationOptions', fn ($liquidations): bool => collect($liquidations)
                    ->contains('id', $scenario['liquidation']->id))
            );
    }

    $this->actingAs($scenario['unrelated_rc'])
        ->get(route('contact-support', [
            'ticket' => $scenario['ticket']->id,
            'status' => 'all',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('contact-support')
            ->where('selectedTicket', null)
            ->where('tickets.data', fn ($tickets): bool => collect($tickets)->isEmpty())
            ->where('liquidationOptions', fn ($liquidations): bool => collect($liquidations)
                ->doesntContain('id', $scenario['liquidation']->id))
        );
});

test('both operational RC groups can manage the historical ticket while an unrelated RC is forbidden', function () {
    $scenario = supportTransferTestScenario();

    $this->actingAs($scenario['processing_rc'])
        ->post(route('support-tickets.reply', $scenario['ticket']), [
            'body' => 'Region XII reviewed this historical record.',
        ])
        ->assertRedirect(route('contact-support', ['ticket' => $scenario['ticket']->id]));

    expect($scenario['ticket']->fresh()->status)->toBe(SupportTicket::STATUS_IN_PROGRESS);
    $this->assertDatabaseHas('support_ticket_messages', [
        'support_ticket_id' => $scenario['ticket']->id,
        'user_id' => $scenario['processing_rc']->id,
        'body' => 'Region XII reviewed this historical record.',
    ]);

    $this->actingAs($scenario['current_rc'])
        ->patch(route('support-tickets.update-status', $scenario['ticket']), [
            'status' => SupportTicket::STATUS_RESOLVED,
            'remarks' => 'BARMM completed the follow-up.',
        ])
        ->assertRedirect();

    expect($scenario['ticket']->fresh()->status)->toBe(SupportTicket::STATUS_RESOLVED);

    $this->actingAs($scenario['unrelated_rc'])
        ->post(route('support-tickets.reply', $scenario['ticket']), [
            'body' => 'An unrelated region must not add this reply.',
        ])
        ->assertForbidden();

    $this->actingAs($scenario['unrelated_rc'])
        ->patch(route('support-tickets.update-status', $scenario['ticket']), [
            'status' => SupportTicket::STATUS_OPEN,
            'remarks' => 'An unrelated region must not reopen this ticket.',
        ])
        ->assertForbidden();

    expect($scenario['ticket']->fresh()->status)->toBe(SupportTicket::STATUS_RESOLVED);
    $this->assertDatabaseMissing('support_ticket_messages', [
        'support_ticket_id' => $scenario['ticket']->id,
        'user_id' => $scenario['unrelated_rc']->id,
    ]);
});

test('a new linked ticket notifies both operational RC groups and excludes unrelated RCs', function () {
    $scenario = supportTransferTestScenario();

    Notification::query()->delete();
    $scenario['ticket']->messages()->delete();
    $scenario['ticket']->delete();

    $this->actingAs($scenario['hei_user'])
        ->post(route('support-tickets.store'), [
            'category' => SupportTicket::CATEGORY_LIQUIDATION_RECORD,
            'priority' => SupportTicket::PRIORITY_HIGH,
            'liquidation_id' => $scenario['liquidation']->id,
            'subject' => 'Transferred liquidation follow-up',
            'description' => 'Please coordinate across the former and current regions.',
        ])
        ->assertRedirect();

    $ticket = SupportTicket::where('subject', 'Transferred liquidation follow-up')->sole();
    $recipientIds = Notification::where('action', 'support_ticket_created')
        ->where('subject_type', SupportTicket::class)
        ->where('subject_id', $ticket->id)
        ->pluck('user_id')
        ->sort()
        ->values()
        ->all();

    expect($recipientIds)->toBe(collect([
        $scenario['processing_rc']->id,
        $scenario['current_rc']->id,
    ])->sort()->values()->all())
        ->and($recipientIds)->not->toContain($scenario['unrelated_rc']->id);
});
