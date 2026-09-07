<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'light') == 'dark']) data-appearance="{{ $appearance ?? 'light' }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        {{-- Applies system dark mode before first paint, reading data-appearance above.

             External rather than inline: production serves a Content-Security-Policy
             with `script-src 'self'` from the web server, which blocked the inline
             version this replaced - so every viewer on the default "system" setting
             with a dark OS got the light theme until React hydrated.

             No defer: it must run before the body paints. Bump ?v= when the file
             changes; it is served with far-future caching otherwise. --}}
        <script src="{{ asset('js/appearance.js') }}?v=1"></script>

        {{-- Inline style to set the HTML background color based on our theme in app.css --}}
        <style>
            html {
                background-color: oklch(1 0 0);
            }

            html.dark {
                background-color: oklch(0.145 0 0);
            }
        </style>

        <title inertia>{{ config('app.name', 'Laravel') }}</title>

        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Anton&family=IBM+Plex+Sans:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet">

        <link rel="icon" href="/assets/img/unifast.png" type="image/png">
        <link rel="apple-touch-icon" href="/assets/img/unifast.png">

        <script id="ziggy-routes-json" type="application/json">{!! json_encode((new \Tighten\Ziggy\Ziggy())->toArray()) !!}</script>
        @viteReactRefresh
        @vite(['resources/js/app.tsx'])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
