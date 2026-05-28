<?php

use App\AI\ToolRegistry;
use App\AI\Tools\FindLiquidationTool;
use App\AI\Tools\ListHeisTool;
use App\AI\Tools\ListLiquidationsTool;
use App\AI\Tools\ListReferenceDataTool;
use App\AI\Tools\LiquidationSummaryTool;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Ai\Ai;
use Laravel\Ai\AnonymousAgent;
use Laravel\Ai\Responses\Data\Meta;
use Laravel\Ai\Responses\Data\ToolCall;
use Laravel\Ai\Responses\Data\Usage;
use Laravel\Ai\Responses\TextResponse;

uses(RefreshDatabase::class);

function reportAssistantUser(string $roleName, bool $canViewReports = true): User
{
    $role = Role::create([
        'name' => $roleName,
        'description' => $roleName,
    ]);

    if ($canViewReports) {
        $permission = Permission::firstOrCreate(
            ['name' => 'view_reports'],
            ['module' => 'Reports', 'description' => 'View reports'],
        );
        $role->permissions()->attach($permission);
    }

    return User::factory()->create([
        'role_id' => $role->id,
        'status' => 'active',
    ]);
}

test('only configured reporting administrators can open the report assistant', function () {
    config()->set('ai.providers.openai.key', 'test-key');

    foreach (['Admin', 'Super Admin'] as $roleName) {
        $user = reportAssistantUser($roleName);

        $this->actingAs($user)
            ->get(route('report-assistant.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('report-assistant')
                ->where('isConfigured', true)
            );
    }
});

test('non admin roles and administrators without report access cannot use the report assistant', function () {
    $regionalCoordinator = reportAssistantUser('Regional Coordinator');
    $adminWithoutPermission = reportAssistantUser('Admin', false);

    $this->actingAs($regionalCoordinator)
        ->get(route('report-assistant.index'))
        ->assertForbidden();

    $this->actingAs($adminWithoutPermission)
        ->postJson(route('report-assistant.answer'), [
            'messages' => [['role' => 'user', 'content' => 'Show totals.']],
        ])
        ->assertForbidden();
});

test('an unconfigured assistant reports that configuration is required', function () {
    config()->set('ai.providers.openai.key', null);

    $this->actingAs(reportAssistantUser('Admin'))
        ->postJson(route('report-assistant.answer'), [
            'messages' => [['role' => 'user', 'content' => 'Show totals.']],
        ])
        ->assertStatus(503)
        ->assertJsonPath('message', 'The report assistant is not configured. An administrator must set the OpenAI API key.');
});

test('the report assistant supplies bounded query results through a model tool call', function () {
    config()->set('ai.providers.openai.key', 'test-key');

    Ai::fakeAgent(AnonymousAgent::class, [
        new ToolCall(
            id: 'call_summary',
            name: 'get_liquidation_summary',
            arguments: [
                'group_by' => 'program',
                'order_by' => 'disbursed_desc',
                'programs' => [],
                'academic_years' => [],
                'regions' => [],
                'heis' => [],
                'document_statuses' => [],
                'liquidation_statuses' => [],
                'rc_note_statuses' => [],
            ],
        ),
        new TextResponse(
            text: "There are no liquidation records in the selected scope.\n###FOLLOWUPS###\n- Try filtering by academic year\n- Try filtering by program",
            usage: new Usage(0, 0, 0),
            meta: new Meta,
        ),
    ]);

    $this->actingAs(reportAssistantUser('Admin'))
        ->postJson(route('report-assistant.answer'), [
            'messages' => [['role' => 'user', 'content' => 'Summarize liquidation totals by program.']],
        ])
        ->assertOk()
        ->assertJsonPath('answer', 'There are no liquidation records in the selected scope.')
        ->assertJsonPath('data.0.tool', 'get_liquidation_summary')
        ->assertJsonPath('data.0.result.totals.records', 0)
        ->assertJsonPath('data.0.result.voided_records', 'Excluded by default')
        ->assertJsonPath('compact', false)
        ->assertJsonPath('followups.0', 'Try filtering by academic year');
});

test('the tool registry exposes the expected tools by name', function () {
    $registry = app(ToolRegistry::class);
    $names = collect($registry->all())->map(fn ($tool) => $tool->name())->all();

    expect($names)->toEqual([
        'get_liquidation_summary',
        'list_liquidations',
        'find_liquidation',
        'list_heis',
        'list_reference_data',
    ]);

    expect($registry->has('list_liquidations'))->toBeTrue();
    expect($registry->has('does_not_exist'))->toBeFalse();
    expect($registry->get('find_liquidation'))->toBeInstanceOf(FindLiquidationTool::class);
});

test('every registered tool advertises an OpenAI-compatible function schema', function () {
    foreach (app(ToolRegistry::class)->toOpenAiSchemas() as $schema) {
        expect($schema)->toHaveKey('type', 'function');
        expect(data_get($schema, 'function.name'))->toBeString()->not->toBeEmpty();
        expect(data_get($schema, 'function.description'))->toBeString()->not->toBeEmpty();
        expect(data_get($schema, 'function.parameters.type'))->toBe('object');
        expect(data_get($schema, 'function.parameters.required'))->toBeArray();
    }
});

test('list_liquidations returns the bounded paginated shape with no records', function () {
    $user = reportAssistantUser('Admin');

    $result = app(ListLiquidationsTool::class)->execute($user, [
        'control_no_search' => '',
        'page' => 1,
        'per_page' => 10,
        'programs' => [],
        'academic_years' => [],
        'regions' => [],
        'heis' => [],
        'document_statuses' => [],
        'liquidation_statuses' => [],
        'rc_note_statuses' => [],
    ]);

    expect($result)->toHaveKey('records')
        ->and($result['records'])->toBe([])
        ->and($result['total_matching'])->toBe(0)
        ->and($result['page'])->toBe(1)
        ->and($result['per_page'])->toBe(10)
        ->and($result['has_more'])->toBeFalse()
        ->and($result['voided_records'])->toBe('Excluded by default');
});

test('list_liquidations clamps per_page to the documented maximum', function () {
    $user = reportAssistantUser('Admin');

    $result = app(ListLiquidationsTool::class)->execute($user, [
        'control_no_search' => '',
        'page' => 1,
        'per_page' => 9999,
        'programs' => [],
        'academic_years' => [],
        'regions' => [],
        'heis' => [],
        'document_statuses' => [],
        'liquidation_statuses' => [],
        'rc_note_statuses' => [],
    ]);

    expect($result['per_page'])->toBe(25);
});

test('list_liquidations reports unmatched filters and returns no records', function () {
    $user = reportAssistantUser('Admin');

    $result = app(ListLiquidationsTool::class)->execute($user, [
        'control_no_search' => '',
        'page' => 1,
        'per_page' => 10,
        'programs' => ['THIS_PROGRAM_DOES_NOT_EXIST'],
        'academic_years' => [],
        'regions' => [],
        'heis' => [],
        'document_statuses' => [],
        'liquidation_statuses' => [],
        'rc_note_statuses' => [],
    ]);

    expect($result['unmatched_filters'])->toHaveKey('programs')
        ->and($result['records'])->toBe([])
        ->and($result['total_matching'])->toBe(0);
});

test('find_liquidation returns not-found for unknown control numbers', function () {
    $user = reportAssistantUser('Admin');

    $result = app(FindLiquidationTool::class)->execute($user, [
        'control_no' => 'NON-EXISTENT-CONTROL-NO',
    ]);

    expect($result['found'])->toBeFalse()
        ->and($result['control_no'])->toBe('NON-EXISTENT-CONTROL-NO');
});

test('find_liquidation requires a control number', function () {
    $user = reportAssistantUser('Admin');

    $result = app(FindLiquidationTool::class)->execute($user, ['control_no' => '']);

    expect($result['found'])->toBeFalse()
        ->and($result)->toHaveKey('error');
});

test('list_heis returns the catalog shape with pagination metadata', function () {
    $user = reportAssistantUser('Admin');

    $result = app(ListHeisTool::class)->execute($user, [
        'search' => '',
        'regions' => [],
        'page' => 1,
        'per_page' => 25,
    ]);

    expect($result)->toHaveKeys(['heis', 'total_matching', 'page', 'per_page', 'has_more'])
        ->and($result['per_page'])->toBe(25)
        ->and($result['page'])->toBe(1);
});

test('list_reference_data returns only requested categories', function () {
    $user = reportAssistantUser('Admin');

    $result = app(ListReferenceDataTool::class)->execute($user, [
        'categories' => ['programs', 'regions'],
    ]);

    expect($result)->toHaveKeys(['programs', 'regions'])
        ->and($result)->not->toHaveKey('liquidation_statuses')
        ->and($result)->not->toHaveKey('rc_note_statuses');
});

test('list_reference_data with all returns every category', function () {
    $user = reportAssistantUser('Admin');

    $result = app(ListReferenceDataTool::class)->execute($user, [
        'categories' => ['all'],
    ]);

    expect($result)->toHaveKeys([
        'programs',
        'regions',
        'academic_years',
        'document_statuses',
        'liquidation_statuses',
        'rc_note_statuses',
    ]);
});

test('the summary tool delegates to the query service unchanged', function () {
    $user = reportAssistantUser('Admin');

    $result = app(LiquidationSummaryTool::class)->execute($user, [
        'group_by' => 'program',
        'programs' => [],
        'academic_years' => [],
        'regions' => [],
        'heis' => [],
        'document_statuses' => [],
        'liquidation_statuses' => [],
        'rc_note_statuses' => [],
    ]);

    expect($result['scope']['role'])->toBe('Admin')
        ->and($result['totals']['records'])->toBe(0)
        ->and($result['grouped_by'])->toBe('program')
        ->and($result['voided_records'])->toBe('Excluded by default');
});
