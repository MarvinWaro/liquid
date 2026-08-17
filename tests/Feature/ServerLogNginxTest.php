<?php

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Nginx sits in front of PHP, so it records the failures that never reach
 * Laravel at all — 502/504 when PHP-FPM dies or times out, 413 when an upload
 * exceeds client_max_body_size. Those are invisible in laravel.log because PHP
 * was never handed the request.
 *
 * Its format looks nothing like Monolog's, so it gets its own parser. These
 * tests pin that parser down, and check the application log still reads the way
 * it always did.
 */
function nginxLogUser(string $roleName = 'Super Admin'): User
{
    $role = Role::firstOrCreate(['name' => $roleName], ['description' => 'test']);

    return User::factory()->create(['role_id' => $role->id, 'status' => 'active']);
}

/** A realistic slice of /var/log/nginx/error.log. */
function writeNginxLog(): string
{
    $path = sys_get_temp_dir().DIRECTORY_SEPARATOR.'nginx-error-test.log';

    file_put_contents($path, implode("\n", [
        '2026/08/17 13:55:36 [error] 1234#0: *1 connect() failed (111: Connection refused) while connecting to upstream, client: 122.53.47.156, server: liquidation.unifast12.com, request: "GET /liquidation HTTP/1.1", upstream: "fastcgi://127.0.0.1:9000"',
        '2026/08/17 14:02:11 [warn] 1234#0: *2 a client request body is buffered to a temporary file, client: 122.53.47.156, server: liquidation.unifast12.com',
        '2026/08/17 14:10:03 [crit] 1234#0: *3 SSL_do_handshake() failed while SSL handshaking, client: 1.2.3.4, server: 0.0.0.0:443',
        '2026/08/17 14:15:44 [error] 1234#0: *4 client intended to send too large body: 27262976 bytes, client: 122.53.47.156, server: liquidation.unifast12.com',
        '2026/08/17 14:20:01 [notice] 1234#0: signal process started',
        '',
    ]));

    config(['logging.nginx_error_path' => $path]);

    return $path;
}

/** Fetch a deferred Inertia prop, which is absent from the first response. */
function serverLogDeferred(User $user, string $prop, array $query = []): mixed
{
    $url = '/settings/server-logs'.($query ? '?'.http_build_query($query) : '');

    // withHeaders() below sticks to the test client, so a second call in the
    // same test would send X-Inertia on this first request too and get JSON
    // back instead of the view we need the asset version from.
    $first = test()->flushHeaders()->actingAs($user)->get($url)->assertSuccessful();

    return test()->actingAs($user)
        ->withHeaders([
            'X-Inertia' => 'true',
            'X-Inertia-Version' => $first->viewData('page')['version'],
            'X-Inertia-Partial-Component' => 'settings/server-logs',
            'X-Inertia-Partial-Data' => $prop,
        ])
        ->get($url)
        ->json("props.{$prop}");
}

afterEach(function () {
    $path = sys_get_temp_dir().DIRECTORY_SEPARATOR.'nginx-error-test.log';

    if (file_exists($path)) {
        unlink($path);
    }
});

it('lists the nginx error log as its own source once configured', function () {
    writeNginxLog();

    $files = test()->actingAs(nginxLogUser())
        ->get('/settings/server-logs')
        ->assertSuccessful()
        ->viewData('page')['props']['files'];

    $nginx = collect($files)->firstWhere('name', 'nginx-error-test.log');

    expect($nginx)->not->toBeNull()
        ->and($nginx['source'])->toBe('nginx');
});

it('hides the nginx log when the path is not configured', function () {
    config(['logging.nginx_error_path' => null]);

    $files = test()->actingAs(nginxLogUser())
        ->get('/settings/server-logs')
        ->assertSuccessful()
        ->viewData('page')['props']['files'];

    expect(collect($files)->pluck('source')->unique()->all())->not->toContain('nginx');
});

it('hides the nginx log when the file cannot be read', function () {
    // The real trap on a server: /var/log/nginx/error.log is root:adm 640, so
    // www-data cannot open it. Offering it anyway would show a permanently
    // empty viewer and look like a bug in the page.
    config(['logging.nginx_error_path' => sys_get_temp_dir().'/definitely-not-here.log']);

    $files = test()->actingAs(nginxLogUser())
        ->get('/settings/server-logs')
        ->assertSuccessful()
        ->viewData('page')['props']['files'];

    expect(collect($files)->pluck('source')->unique()->all())->not->toContain('nginx');
});

it('maps nginx severities onto the levels the filter already offers', function () {
    writeNginxLog();

    $log = serverLogDeferred(nginxLogUser(), 'log', ['file' => 'nginx-error-test.log']);

    expect(collect($log['entries'])->pluck('level')->all())
        ->toBe(['ERROR', 'WARNING', 'CRITICAL', 'ERROR', 'NOTICE']);
});

it('splits the request context off the error message', function () {
    writeNginxLog();

    $log = serverLogDeferred(nginxLogUser(), 'log', ['file' => 'nginx-error-test.log']);
    $entries = collect($log['entries']);

    $upstream = $entries->first();

    // The message is the failure itself; who/where it happened is context.
    expect($upstream['message'])->toContain('connect() failed')
        ->and($upstream['message'])->not->toContain('client:')
        ->and($upstream['hasTrace'])->toBeTrue()
        ->and($upstream['trace'])->toContain('122.53.47.156');

    // A line with no ", client:" tail has nothing to expand.
    expect($entries->last()['hasTrace'])->toBeFalse();
});

it('reads nginx timestamps in the server timezone and sends them as Manila time', function () {
    writeNginxLog();

    $log = serverLogDeferred(nginxLogUser(), 'log', ['file' => 'nginx-error-test.log']);

    // 13:55:36 UTC is 21:55 in Manila. A bare string with no offset would be
    // read by the browser as its own local time and land hours out.
    expect($log['entries'][0]['loggedAt'])->toBe('2026-08-17T21:55:36+08:00');
});

it('filters nginx entries by level and by search', function () {
    writeNginxLog();
    $user = nginxLogUser();

    $errors = serverLogDeferred($user, 'log', ['file' => 'nginx-error-test.log', 'level' => 'ERROR']);
    expect($errors['entries'])->toHaveCount(2);

    $search = serverLogDeferred($user, 'log', ['file' => 'nginx-error-test.log', 'search' => 'too large body']);
    expect($search['entries'])->toHaveCount(1)
        ->and($search['entries'][0]['message'])->toContain('too large body');
});

it('still parses the application log unchanged', function () {
    writeNginxLog();

    file_put_contents(
        storage_path('logs').DIRECTORY_SEPARATOR.'laravel.log',
        "[2026-08-17 05:00:00] production.ERROR: Something broke\n#0 /app/foo.php(1)\n"
    );

    $log = serverLogDeferred(nginxLogUser(), 'log', ['file' => 'laravel.log']);
    $entry = collect($log['entries'])->firstWhere('message', 'Something broke');

    expect($entry)->not->toBeNull()
        ->and($entry['level'])->toBe('ERROR')
        ->and($entry['environment'])->toBe('production')
        ->and($entry['hasTrace'])->toBeTrue();
});

it('refuses anyone who is not a Super Admin', function () {
    writeNginxLog();

    test()->actingAs(nginxLogUser('Admin'))
        ->get('/settings/server-logs')
        ->assertForbidden();
});
