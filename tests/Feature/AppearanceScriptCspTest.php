<?php

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Production serves a Content-Security-Policy with `script-src 'self'` from the
 * web server rather than from the app, so the inline dark-mode script in the
 * layout was blocked outright. HandleAppearance defaults the cookie to "system",
 * so that hit most viewers: anyone on a dark OS got the light theme until React
 * hydrated, then a visible flash.
 *
 * The script moved into public/js/appearance.js, which `'self'` already allows.
 * These guard the shape that fix depends on.
 */
it('loads the appearance script from a file the CSP already allows', function () {
    $this->get('/login')
        ->assertOk()
        ->assertSee('js/appearance.js', false);
});

it('carries the appearance value on the html element, not inside a script', function () {
    // The script reads data-appearance, so the value never has to be interpolated
    // into a script body - which is what forced it to be inline before.
    $this->get('/login')
        ->assertOk()
        ->assertSee('data-appearance="system"', false);
});

it('has no inline dark-mode script left in the layout', function () {
    // The regression that matters: re-inlining this silently reintroduces the CSP
    // violation, and the only symptom is a theme flash nobody reports.
    $html = $this->get('/login')->assertOk()->getContent();

    // matchMedia only ever appeared in the inline block; the external file is
    // referenced by src, so its body is never part of the response.
    expect($html)->not->toContain('matchMedia')
        ->and($html)->not->toContain("classList.add('dark')");
});

it('ships the script file itself', function () {
    $path = public_path('js/appearance.js');

    expect(file_exists($path))->toBeTrue();

    $contents = file_get_contents($path);

    expect($contents)->toContain('data-appearance')
        ->and($contents)->toContain('prefers-color-scheme: dark');
});
