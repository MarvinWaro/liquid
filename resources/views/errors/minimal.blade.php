@php
    // Theme is read directly from the cookie so it works even when the
    // appearance-share middleware doesn't run on framework error responses.
    $appearance = request()->cookie('appearance') ?? 'system';
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => $appearance === 'dark'])>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">

    <title>@yield('code') · @yield('title') — UniFAST</title>

    <link rel="icon" href="/assets/img/unifast.png" type="image/png">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

    {{-- Apply system preference immediately to avoid a flash of wrong theme --}}
    <script>
        (function () {
            var appearance = '{{ $appearance }}';
            if (appearance === 'system') {
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (prefersDark) document.documentElement.classList.add('dark');
            }
        })();
    </script>

    <style>
        :root {
            --bg: #ffffff;
            --fg: #0a0a0a;
            --muted: #71717a;
            --border: #e4e4e7;
            --accent: #18181b;
            --accent-fg: #fafafa;
        }
        html.dark {
            --bg: #0a0a0a;
            --fg: #fafafa;
            --muted: #a1a1aa;
            --border: #27272a;
            --accent: #fafafa;
            --accent-fg: #18181b;
        }
        * { box-sizing: border-box; }
        html, body {
            margin: 0;
            padding: 0;
            height: 100%;
            background-color: var(--bg);
            color: var(--fg);
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        .wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 2rem 1rem;
            text-align: center;
        }
        .logos {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1.25rem;
            margin-bottom: 2.5rem;
        }
        .logos img {
            height: 90px;
            width: auto;
            object-fit: contain;
        }
        .code {
            font-size: clamp(4rem, 12vw, 6rem);
            font-weight: 700;
            line-height: 1;
            letter-spacing: -0.04em;
            margin: 0;
        }
        .divider {
            width: 1px;
            height: 1.75rem;
            background-color: var(--border);
            margin: 0 1rem;
        }
        .head-row {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 1rem;
        }
        .title {
            font-size: 1rem;
            font-weight: 500;
            color: var(--muted);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin: 0;
        }
        .description {
            color: var(--muted);
            font-size: 0.95rem;
            max-width: 28rem;
            margin: 0 0 2rem;
            line-height: 1.6;
        }
        .button {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.6rem 1.25rem;
            background-color: var(--accent);
            color: var(--accent-fg);
            text-decoration: none;
            border-radius: 0.5rem;
            font-size: 0.875rem;
            font-weight: 500;
            transition: opacity 0.15s;
        }
        .button:hover { opacity: 0.85; }
        .footer {
            position: absolute;
            bottom: 1.5rem;
            font-size: 0.75rem;
            color: var(--muted);
            letter-spacing: 0.02em;
        }
    </style>
</head>
<body>
    <main class="wrap">
        <div class="logos">
            <img src="/assets/img/ched-logo.png" alt="CHED">
        </div>

        <div class="head-row">
            <h1 class="code">@yield('code')</h1>
            <span class="divider"></span>
            <p class="title">@yield('title')</p>
        </div>

        <p class="description">@yield('message')</p>

        <a href="{{ url('/') }}" class="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m12 19-7-7 7-7"/>
                <path d="M19 12H5"/>
            </svg>
            Back to home
        </a>

        <p class="footer">UniFAST &middot; Liquidation Management System</p>
    </main>
</body>
</html>
