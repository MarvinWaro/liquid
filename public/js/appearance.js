/**
 * Adds the `dark` class before first paint so a viewer whose appearance is
 * "system" on a dark OS never sees a flash of the light theme.
 *
 * Deliberately a file rather than an inline <script>: production serves a
 * Content-Security-Policy with `script-src 'self'`, set at the web-server layer
 * rather than by the app, which blocked the inline version outright. The
 * appearance value it needs is rendered onto <html data-appearance> instead of
 * being interpolated into the script body.
 *
 * Plain script, no build step, and loaded without defer on purpose: it has to run
 * before the body paints, while the Vite bundle is a module and therefore
 * deferred until after parsing - far too late to prevent the flash.
 *
 * Only the "system" case is handled here. An explicit "dark" choice is already on
 * the <html> element from the server, and "light" needs nothing.
 */
(function () {
    var el = document.documentElement;

    if (el.getAttribute('data-appearance') !== 'system') {
        return;
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        el.classList.add('dark');
    }
})();
