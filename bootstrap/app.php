<?php

use App\Http\Middleware\AuthenticateMcpClient;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\TrackUserActivity;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        // Trust Cloudflare so $request->ip() resolves the real visitor IP from the
        // forwarded headers (otherwise it returns Cloudflare's edge IP). This feeds
        // the activity-log IP column and the login rate-limiter alike.
        //
        // We trust only Cloudflare's published ranges (https://www.cloudflare.com/ips/)
        // rather than '*', so a request sent straight to the origin cannot spoof
        // X-Forwarded-For. Update this list if Cloudflare revises its ranges. (If the
        // origin is firewalled to accept Cloudflare traffic only, '*' is a simpler
        // equivalent.)
        $middleware->trustProxies(at: [
            // IPv4
            '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
            '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
            '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
            '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
            // IPv6
            '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32',
            '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
        ], headers: Request::HEADER_X_FORWARDED_FOR
            | Request::HEADER_X_FORWARDED_HOST
            | Request::HEADER_X_FORWARDED_PORT
            | Request::HEADER_X_FORWARDED_PROTO);

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            // Inside HandleInertiaRequests on purpose. This one can return a
            // redirect, and Inertia rewrites a 302 into a 303 for PUT/PATCH/
            // DELETE so the browser re-requests with GET. Placed outside it, a
            // deactivated user clicking Delete would have the DELETE replayed
            // against /login. Nothing is wasted by sitting here - the shared
            // Inertia props are lazy, and this returns before $next().
            EnsureUserIsActive::class,
            AddLinkHeadersForPreloadedAssets::class,
            TrackUserActivity::class,
            SecurityHeaders::class,
            // Appended, so it runs after StartSession and can key the limit on the
            // authenticated user rather than the IP. See the 'global' limiter in
            // FortifyServiceProvider for the reasoning behind the numbers.
            'throttle:global',
        ]);

        $middleware->alias([
            'mcp.auth' => AuthenticateMcpClient::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
