<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Sweep generated report files past their 7-day expiry, daily.
Schedule::command('reports:cleanup-expired')->daily();

// One CPU/memory sample a minute, feeding the Server Monitoring trend graph.
// Cheap by design: /proc reads plus a single cache write, and it replaces the
// browser polling that would otherwise cost a Laravel boot every few seconds.
Schedule::command('server:sample-metrics')->everyMinute();
