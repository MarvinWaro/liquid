<?php

declare(strict_types=1);

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * Live CPU / memory / disk snapshot for Super Admins, read-only.
 *
 * Same motivation as Queue Health and Server Logs: "how loaded is the box
 * right now" previously needed an SSH session. This reads straight from
 * /proc, the same source `top` and `free` use, so it needs no new service,
 * no persisted metrics table and no dependency beyond PHP itself.
 *
 * Linux-only, because /proc does not exist elsewhere. On the Windows dev
 * machine every reading comes back null and the page says "unavailable"
 * rather than showing invented numbers — the same honesty Queue Health uses
 * when Horizon cannot run locally.
 */
class ServerMonitoringController extends Controller
{
    public function index(Request $request): InertiaResponse
    {
        $this->authorizeSuperAdmin($request);

        return Inertia::render('settings/server-monitoring', [
            'available' => $this->isLinux(),

            // Deferred so the page paints immediately. All four share the
            // default group, so they resolve in a single follow-up request
            // rather than four — the same reasoning as Queue Health's stats
            // and recentFailures.
            'system' => Inertia::defer(fn () => $this->systemInfo()),
            'cpu' => Inertia::defer(fn () => $this->cpu()),
            'memory' => Inertia::defer(fn () => $this->memory()),
            'disk' => Inertia::defer(fn () => $this->disk()),
        ]);
    }

    private function isLinux(): bool
    {
        return PHP_OS_FAMILY === 'Linux';
    }

    /**
     * @return array{user: float, system: float, idle: float}|null
     */
    private function cpu(): ?array
    {
        if (! $this->isLinux() || ! is_readable('/proc/stat')) {
            return null;
        }

        try {
            $first = $this->readCpuLine();

            // /proc/stat only holds cumulative jiffies since boot, so a live
            // percentage needs two samples. 200ms is enough signal without
            // making a manual "Refresh" click feel slow.
            usleep(200_000);

            $second = $this->readCpuLine();

            if ($first === null || $second === null) {
                return null;
            }

            $deltaUser = ($second['user'] + $second['nice']) - ($first['user'] + $first['nice']);
            $deltaSystem = ($second['system'] + $second['irq'] + $second['softirq'])
                - ($first['system'] + $first['irq'] + $first['softirq']);
            $deltaIdle = ($second['idle'] + $second['iowait']) - ($first['idle'] + $first['iowait']);
            $deltaTotal = $deltaUser + $deltaSystem + $deltaIdle;

            if ($deltaTotal <= 0) {
                return ['user' => 0.0, 'system' => 0.0, 'idle' => 100.0];
            }

            return [
                'user' => round($deltaUser / $deltaTotal * 100, 1),
                'system' => round($deltaSystem / $deltaTotal * 100, 1),
                'idle' => round($deltaIdle / $deltaTotal * 100, 1),
            ];
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @return array{user: int, nice: int, system: int, idle: int, iowait: int, irq: int, softirq: int}|null
     */
    private function readCpuLine(): ?array
    {
        $line = @file_get_contents('/proc/stat', false, null, 0, 512);

        if ($line === false || ! preg_match(
            '/^cpu\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/',
            $line,
            $m
        )) {
            return null;
        }

        return [
            'user' => (int) $m[1],
            'nice' => (int) $m[2],
            'system' => (int) $m[3],
            'idle' => (int) $m[4],
            'iowait' => (int) $m[5],
            'irq' => (int) $m[6],
            'softirq' => (int) $m[7],
        ];
    }

    /**
     * @return array{totalBytes: int, usedBytes: int, reclaimableBytes: int, unusedBytes: int, availableBytes: int}|null
     */
    private function memory(): ?array
    {
        if (! $this->isLinux() || ! is_readable('/proc/meminfo')) {
            return null;
        }

        try {
            $raw = file_get_contents('/proc/meminfo') ?: '';
            $kb = fn (string $key): int => preg_match('/^'.$key.':\s+(\d+)/m', $raw, $m) ? (int) $m[1] : 0;

            $totalKb = $kb('MemTotal');

            if ($totalKb <= 0) {
                return null;
            }

            $freeKb = $kb('MemFree');
            $availableKb = $kb('MemAvailable');
            // Buffers + Cached is what the kernel can hand back to applications
            // under memory pressure — "Reclaimable" in the UI, not "used".
            $reclaimableKb = $kb('Buffers') + $kb('Cached');
            $usedKb = max(0, $totalKb - $freeKb - $reclaimableKb);

            return [
                'totalBytes' => $totalKb * 1024,
                'usedBytes' => $usedKb * 1024,
                'reclaimableBytes' => $reclaimableKb * 1024,
                'unusedBytes' => $freeKb * 1024,
                'availableBytes' => $availableKb * 1024,
            ];
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @return array{totalBytes: int, usedBytes: int, freeBytes: int}|null
     */
    private function disk(): ?array
    {
        try {
            // base_path() rather than a hardcoded "/": on the droplet the app
            // lives on the same single partition as root, and this stays
            // correct if that ever changes without editing this file.
            $total = @disk_total_space(base_path());
            $free = @disk_free_space(base_path());

            if ($total === false || $free === false || $total <= 0) {
                return null;
            }

            return [
                'totalBytes' => (int) $total,
                'usedBytes' => (int) ($total - $free),
                'freeBytes' => (int) $free,
            ];
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function systemInfo(): array
    {
        return [
            'hostname' => gethostname() ?: null,
            'os' => $this->osName(),
            'kernel' => $this->isLinux() ? php_uname('r') : null,
            'cpuModel' => $this->cpuModel(),
            'cpuCores' => $this->cpuCores(),
            'uptimeSeconds' => $this->uptimeSeconds(),
            'loadAverage' => $this->isLinux() ? sys_getloadavg() : null,
        ];
    }

    private function osName(): ?string
    {
        if (! is_readable('/etc/os-release')) {
            return null;
        }

        $raw = file_get_contents('/etc/os-release') ?: '';

        return preg_match('/^PRETTY_NAME="(.+)"$/m', $raw, $m) ? $m[1] : null;
    }

    private function cpuModel(): ?string
    {
        if (! is_readable('/proc/cpuinfo')) {
            return null;
        }

        $raw = file_get_contents('/proc/cpuinfo') ?: '';

        return preg_match('/^model name\s*:\s*(.+)$/m', $raw, $m) ? trim($m[1]) : null;
    }

    private function cpuCores(): ?int
    {
        if (! is_readable('/proc/cpuinfo')) {
            return null;
        }

        $raw = file_get_contents('/proc/cpuinfo') ?: '';
        $count = preg_match_all('/^processor\s*:/m', $raw);

        return $count > 0 ? $count : null;
    }

    private function uptimeSeconds(): ?int
    {
        if (! is_readable('/proc/uptime')) {
            return null;
        }

        $raw = trim(file_get_contents('/proc/uptime') ?: '');
        $parts = explode(' ', $raw);

        return isset($parts[0]) && is_numeric($parts[0]) ? (int) floor((float) $parts[0]) : null;
    }

    /**
     * Role-based rather than permission-based, matching Queue Health and
     * Server Logs: this exposes hostname, kernel version and load figures,
     * which are reconnaissance value for an attacker and should not be
     * grantable by editing a role.
     */
    private function authorizeSuperAdmin(Request $request): void
    {
        abort_unless($request->user()?->isSuperAdmin(), 403, 'Unauthorized action.');
    }
}
