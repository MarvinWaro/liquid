<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Adds the browser-side defence headers the app was missing.
 *
 * These tell the browser to refuse a handful of attacks that server-side checks
 * cannot see: framing the site to trick a user into clicking something they did
 * not intend, guessing a response's type and running an upload as script, or
 * leaking the full liquidation URL to an external site through the referrer.
 *
 * Content-Security-Policy is deliberately NOT set here. It is the one header
 * that can white-screen the app, and getting it right requires auditing every
 * inline style and script Vite, Tailwind, TipTap and Recharts emit. It belongs
 * in its own change, ideally starting in report-only mode.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Refuse to be embedded in a frame anywhere. The app has no legitimate
        // iframe host, so DENY is safe and stops clickjacking outright.
        $response->headers->set('X-Frame-Options', 'DENY');

        // Trust the declared Content-Type. Without this a browser may sniff an
        // uploaded file and decide a PDF is really HTML, then run it.
        $response->headers->set('X-Content-Type-Options', 'nosniff');

        // Send the full URL only to ourselves. Liquidation URLs carry record ids,
        // so an outbound link should not hand them to a third-party site.
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Deny hardware the app never asks for, so injected code cannot either.
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');

        // HSTS pins the browser to HTTPS for a year. Only sent over a secure
        // connection — issuing it on plain http://127.0.0.1 would lock local
        // development out of the site in that browser.
        if ($request->secure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }
}
