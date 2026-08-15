# Production Infrastructure Notes

**UniFAST Liquidation System** · `liquidation.unifast12.com`
Work done 13–14 August 2026. Complements the senior's Ubuntu/Nginx setup guide —
this covers Redis, Horizon, the security patching, and the deploy-script fixes.

---

## Server at a glance

| Item | Value |
|---|---|
| Provider | DigitalOcean droplet, 1 GB RAM / 1 vCPU / 25 GB |
| OS | Ubuntu 24.04.4 LTS, kernel 6.8.0-137 |
| App path | `/var/www/html/liquid` |
| PHP | 8.4.23 (FPM + CLI) |
| Web | Nginx, Certbot TLS, Cloudflare in front |
| Database | DigitalOcean Managed MySQL 8.4 (SGP1) |
| Files | DigitalOcean Spaces (S3-compatible) |
| Cache / sessions / queue | **Redis 7.0.15** (local to the droplet) |
| Queue dashboard | **Laravel Horizon**, Super Admin only |
| Deploy | `./build.sh` — pulls `main`, frontend artifact from GitHub Actions |

---

## What changed

| Before | After |
|---|---|
| Cache, sessions, queue on **MySQL** (remote, SGP1) | All three on **Redis** (local) |
| No queue visibility at all | **Horizon** + an in-app Queue Health page |
| **42** security advisories | **0** |
| `APP_DEBUG=true` on a public URL | `APP_DEBUG=false` |
| `build.sh` skipped `composer install` | Full 6-step deploy |
| Kernel 6.8.0-124 (unpatched) | 6.8.0-137, rebooted |

**Why Redis mattered here:** every page load previously made a network round-trip
to the managed MySQL in SGP1 just to read the session, before any application code
ran. Measured locally: **0.097 ms/op on Redis vs 0.490 ms on database** — about 5×.
On production the gap is larger because the database is a network hop away.

---

## Part 1 — Redis

### Install

```bash
sudo apt install -y redis-server php8.4-redis
sudo systemctl enable --now redis-server

redis-cli ping          # must print PONG
php -m | grep redis     # must print redis
```

> Do not continue until **both** print what's expected. Pointing `.env` at Redis
> before it exists takes the whole site down — with `SESSION_DRIVER=redis` and no
> Redis, every request fails.

### Memory cap — important on 1 GB

Ubuntu's default is **unlimited**, which means Redis grows until the droplet swaps.

```bash
sudo nano /etc/redis/redis.conf
```
```
maxmemory 64mb
maxmemory-policy allkeys-lru
```
```bash
sudo systemctl restart redis-server
```

Or without the editor (persists to disk via `CONFIG REWRITE`):

```bash
redis-cli CONFIG SET maxmemory 64mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG REWRITE
```

**64mb, not the 256mb in the setup guide.** Baseline memory use is already ~33%.
`allkeys-lru` evicts least-used keys at the cap instead of erroring — correct for a
cache. Raise it after any droplet upgrade.

### `.env`

```
CACHE_STORE=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis
REDIS_CLIENT=phpredis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=null
```

`phpredis` (C extension) on Linux — faster than `predis`. `predis` is only needed
on Windows where compiling the extension is impractical.

```bash
php artisan config:clear && php artisan optimize --except=views
sudo systemctl restart php8.4-fpm
```

The PHP-FPM restart matters: `php -m` shows the CLI's extensions, but the web
process needs restarting to load it too.

### Verify

```bash
php artisan tinker --execute="echo get_class(Cache::store()->getStore());"
# Illuminate\Cache\RedisStore

redis-cli -n 1 DBSIZE     # cache keys - browse a few pages first
redis-cli -n 1 KEYS '*'
redis-cli INFO memory | grep used_memory_human
```

> **`-n 1` matters.** Laravel puts cache in database **1**, sessions/queue in **0**.
> Without it you query db 0, see `0`, and think it's broken.

`get_class(...)` is the only check that proves *which driver is in use*.
`Cache::put`/`get` succeed on every driver, so they prove nothing.

### Expect to be logged out once

Sessions move from MySQL to Redis, which starts empty. Normal, not a fault.

---

## Part 2 — Laravel Horizon

Requires a **Redis queue** — it does not work with `QUEUE_CONNECTION=database`.

### Install

```bash
composer require laravel/horizon
php artisan horizon:install
```

### Access gate — do not skip

Horizon ships with an email allow-list that drifts the moment someone changes their
address. Replaced with the app's own role check in
`app/Providers/HorizonServiceProvider.php`:

```php
protected function gate(): void
{
    Gate::define('viewHorizon', fn (?User $user = null) => (bool) $user?->isSuperAdmin());
}
```

Super Admin only, deliberately not a permission — Horizon exposes full job payloads
and stack traces, which carry record ids and internal paths.

### Supervisor tuning — `config/horizon.php`

Horizon's default is `maxProcesses: 10`. Ten PHP workers at ~50–80 MB each is
**500–800 MB** on a 1 GB box, alongside nginx, PHP-FPM and Redis — an out-of-memory
incident on the first busy import.

```php
'maxProcesses' => 2,
```

`balance: auto` scales *up to* that ceiling, so an idle queue shows 1 process.
Raise after a droplet upgrade.

### systemd unit

```bash
sudo systemctl stop laravel-queue
sudo systemctl disable laravel-queue     # never run both against one queue
sudo nano /etc/systemd/system/horizon.service
```

```ini
[Unit]
Description=Laravel Horizon
After=network.target redis-server.service
Requires=redis-server.service

[Service]
User=www-data
Group=www-data
Restart=always
RestartSec=5
ExecStart=/usr/bin/php /var/www/html/liquid/artisan horizon
WorkingDirectory=/var/www/html/liquid

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now horizon
sudo systemctl status horizon --no-pager
```

Dashboard: `/horizon` — Status should read **Active**.

### Horizon cannot run on Windows

```
INFO   Horizon started successfully.
Error  Call to undefined function pcntl_async_signals()
```

`ext-pcntl` and `ext-posix` are POSIX-only. Horizon is production-only for this
project. The package still installs on Windows with:

```bash
composer require laravel/horizon --ignore-platform-req=ext-pcntl --ignore-platform-req=ext-posix
```

…and `composer.json` carries a matching `config.platform` block so `composer install`
works locally without flags. On Linux both extensions genuinely exist, so nothing is
faked in production.

### In-app Queue Health page

`Settings → Queue Health` (Super Admin). Driver-agnostic — works on `database` or
`redis`, with or without Horizon, and on Windows where Horizon can't run.
Shows waiting count, failures in 24 h / all time, running batches, retry + dismiss.

Summary lives in the app; deep dive lives in Horizon.

---

## Part 3 — Security patching

```bash
composer audit
```

Went from **42 advisories → 0** in two steps.

**Step 1** — everything except PhpSpreadsheet (42 → 7):

```bash
composer update "symfony/*" "laravel/framework" "guzzlehttp/*" \
  "league/commonmark" "phpseclib/phpseclib" "mtdowling/jmespath.php"
```

`laravel/framework` 12.56.0 → 12.66.0, `symfony/*` 7.4.8 → 7.4.16, guzzle 7.10 → 7.15.

**Step 2** — PhpSpreadsheet on its own (7 → 0):

```bash
composer update phpoffice/phpspreadsheet     # 5.6.0 -> 5.9.0
```

Separated deliberately: PhpSpreadsheet reads *and writes* every Excel file in the
system, and the test suite covers that exports get **queued**, not that the file is
correct. Manual checks before shipping: **export a report, run a bulk import,
generate a print** — verified totals reconcile in the exported sheet.

**Always update locally → run the suite → commit `composer.lock` → deploy.**
Production only ever runs `composer install` from the lock file.

Rollback: `git checkout composer.lock`, redeploy.

---

## Part 4 — `build.sh`

The original silently skipped `composer install`, which caused **two** production
outages (`HTMLPurifier_Config not found`, then
`HorizonApplicationServiceProvider not found`). New PHP packages could never reach
the server.

Final order:

```
[1/4]    git fetch / checkout / reset --hard origin/main
[1.5/4]  COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --prefer-dist \
           --optimize-autoloader --no-interaction
[2/4]    ./download-build.sh          # frontend artifact from GitHub Actions
[2.5/4]  php artisan migrate --force
[3/4]    php artisan optimize:clear
[4/4]    php artisan optimize --except=views
         php artisan queue:restart
         php artisan horizon:terminate
```

**Why each addition:**

- **`composer install`** — the outage fix. Must run *before* migrations, in case a
  migration needs a new package.
- **`COMPOSER_ALLOW_SUPERUSER=1`** — without it Composer disables plugins when run
  as root, which skips Laravel package discovery. `laravel/horizon .... DONE` in the
  output confirms it worked.
- **`migrate --force`** — Laravel refuses to migrate non-interactively in production;
  `--force` only skips the confirmation prompt. It still runs pending migrations in
  order and stops on error.
- **`--except=views`** — `view:cache` fails once `APP_DEBUG=false`, because it tries
  to compile the framework's own error-page views which reference
  `<x-laravel-exceptions-renderer::topbar>` — a component only registered in debug
  mode. Harmless (views compile on demand) but ends every deploy in red otherwise.
- **`horizon:terminate`** — Horizon workers are long-running and hold code in memory.
  `maxTime` and `maxJobs` are both `0`, so they **never recycle on their own**.
  Without this, deploys apply to web requests but queued jobs keep running old code.
  Graceful: current jobs finish first, systemd restarts it.

---

## Gotchas worth remembering

**`APP_DEBUG=true` was left on in production for weeks.** Error pages expose stack
traces, file paths and environment values — including database and Spaces
credentials. "No real data yet" doesn't cover it: the credentials are real.

```bash
grep -E "^APP_(ENV|DEBUG)=" .env      # production, debug false
tail -50 storage/logs/laravel.log     # where details go instead
```

**Nginx `add_header` appends, it doesn't replace.** The app middleware and the nginx
config both set security headers, so responses carry duplicates — and
`X-Frame-Options` had *conflicting* values (`DENY` from Laravel, `SAMEORIGIN` from
nginx). Harmless today only because the CSP includes `frame-ancestors 'self'`, which
browsers honour in preference to `X-Frame-Options`. Worth consolidating to one source
of truth eventually.

**`frame-src` must include `blob:`** if any page frames a blob URL — or, better, frame
a same-origin URL instead. The PDF preview was fixed the second way, which also
streams progressively rather than buffering the whole file in memory first.

**The inline dark-mode script in `app.blade.php` is blocked by CSP**
(`script-src 'self'` with no `'unsafe-inline'`). Effect: users on "System" appearance
see a white flash before dark mode applies. Cosmetic, unfixed. A hash won't work
cleanly because the script interpolates `$appearance`, producing three different
hashes.

**Composer's deprecation flood on the droplet is cosmetic** — Ubuntu ships Composer
2.7.1, which emits notices on PHP 8.4. Ignorable.

---

## Local development (Windows) — DBngin Redis bug

**DBngin's Redis will not start if the Windows username contains a space.** It writes
an unquoted path into `redis.conf`:

```
*** FATAL CONFIG FILE ERROR ***
>>> 'dir C:\Users\Marvin Waro\AppData\Local\...'
wrong number of arguments
```

Redis splits config lines on whitespace, so `Marvin Waro` becomes two arguments and
it dies instantly — the UI just flips back to "Start" with no error shown.

**Editing DBngin's config does not help** — it regenerates both `redis.conf` and
`DBEngines.json` from its install path on every launch.

**Do not rename the Windows user folder to fix this.** It requires registry edits and
breaks every absolute path in PHP, Composer, Node, git, VS Code and SSH keys.

**Workaround** — run Redis standalone from a space-free path:

```
C:\redis\redis-server.exe
C:\redis\redis.conf        # bind 127.0.0.1, protected-mode yes, dir C:\redis
C:\redis\start-redis.bat
C:\redis\redis-silent.vbs  # hidden launcher, shortcut in shell:startup
```

Use `REDIS_CLIENT=predis` locally (`composer require predis/predis`) — the phpredis
C extension is impractical to build for PHP 8.5 ZTS on Windows.

**PowerShell quoting:** use double quotes outside, single inside, or PHP sees
undefined constants:

```powershell
php artisan tinker --execute="Cache::put('t','ok',60); echo Cache::get('t');"
```

---

## Command reference

### Health check

```bash
cd /var/www/html/liquid
php artisan about | head -20
sudo systemctl status horizon redis-server php8.4-fpm nginx --no-pager | grep -E "●|Active"
redis-cli ping
composer audit
```

### Deploy

```bash
cd /var/www/html/liquid && ./build.sh
```

### Queue / Horizon

```bash
php artisan queue:failed          # list failures
php artisan queue:retry all
php artisan queue:flush           # clear failed jobs
php artisan horizon:terminate     # graceful restart
sudo systemctl restart horizon
php artisan tinker --execute="echo config('queue.default');"
```

### Test a failed job end to end

```bash
php artisan tinker --execute="App\Jobs\GenerateLiquidationReportJob::dispatch('00000000-0000-0000-0000-000000000000', 'excel', []);"
```

Non-existent user id → `findOrFail` throws → appears in Horizon → Failed Jobs and in
Queue Health. Cannot touch real data. Dismiss afterwards.

### Redis inspection

```bash
redis-cli -n 1 DBSIZE
redis-cli -n 1 KEYS '*'
redis-cli INFO memory | grep used_memory_human
redis-cli CONFIG GET maxmemory
```

### Rollback

```bash
# config only
sed -i 's/^CACHE_STORE=.*/CACHE_STORE=database/' .env
sed -i 's/^SESSION_DRIVER=.*/SESSION_DRIVER=database/' .env
sed -i 's/^QUEUE_CONNECTION=.*/QUEUE_CONNECTION=database/' .env
php artisan optimize --except=views && sudo systemctl restart php8.4-fpm

# code — revert the merge on main, then
./build.sh
```

---

## Still open

- **27 apt updates** (1 standard security). Review with `sudo apt list --upgradable`
  before a blanket upgrade.
- **Duplicate security headers** between the app middleware and nginx — pick one
  source of truth.
- **CSP blocks the dark-mode inline script** — cosmetic flash for "System" users.
- **Landing page is `noindex, nofollow`** via `X-Robots-Tag` on the whole site.
  Intentional? Google will not index the public page.
- **`maxmemory 64mb` / `maxProcesses 2`** are sized for the current 1 GB droplet.
  Raise both if it's upgraded to the 2 vCPU / 4 GB plan.

---

## Rules of thumb learned here

1. **Install the service before pointing `.env` at it.** With `SESSION_DRIVER=redis`
   and no Redis, every page errors.
2. **One change at a time on production**, so a failure has one obvious cause.
3. **`get_class(Cache::store()->getStore())`** is the only honest driver check.
4. **Update dependencies locally, run the suite, commit the lock file, then deploy.**
   Never update directly on the server.
5. **A green test suite doesn't cover file *contents*** — Excel and PDF output need
   opening by a human.
6. **Long-running workers need explicit restarting** after every deploy.
