<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Reads live CPU / memory / disk figures straight from the kernel.
 *
 * Everything here comes from Linux's /proc filesystem — the same source `top`,
 * `free` and `uptime` read — so no agent, no package and no stored state is
 * involved. A reading is a reading: this class never caches, never persists and
 * never decides anything. ServerMetricsHistory handles remembering, the
 * controller handles presenting.
 *
 * Extracted from ServerMonitoringController so the scheduled sampler
 * (server:sample-metrics) reads through exactly the same code the page does.
 * Two implementations of "what is CPU usage" would drift apart, and the graph
 * would quietly disagree with the number printed beside it.
 *
 * Linux-only by nature. Off Linux every reading returns null so the caller can
 * say "unavailable" rather than display an invented figure.
 */
class ServerMetrics
{
    /**
     * How long to wait between the two /proc/stat samples a CPU percentage
     * needs. Long enough to be a meaningful slice, short enough that clicking
     * Refresh still feels instant.
     */
    private const CPU_SAMPLE_MICROSECONDS = 200_000;

    public function isAvailable(): bool
    {
        return PHP_OS_FAMILY === 'Linux';
    }

    /**
     * Current CPU split, as percentages that sum to 100.
     *
     * @return array{user: float, system: float, idle: float}|null
     */
    public function cpu(): ?array
    {
        if (! $this->isAvailable() || ! is_readable('/proc/stat')) {
            return null;
        }

        try {
            $first = $this->readCpuLine();

            // /proc/stat holds cumulative jiffies since boot, never a rate. A
            // live percentage is therefore the *difference* between two reads —
            // a single read can only ever describe the whole uptime.
            usleep(self::CPU_SAMPLE_MICROSECONDS);

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
    public function memory(): ?array
    {
        if (! $this->isAvailable() || ! is_readable('/proc/meminfo')) {
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
            // Buffers + Cached is memory the kernel will hand straight back when
            // an application asks for it. Counting it as "used" is what makes
            // people think a healthy Linux box is nearly out of RAM.
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
    public function disk(): ?array
    {
        try {
            // base_path() rather than a hardcoded "/": on the droplet the app
            // shares the single root partition, and this stays correct if that
            // ever stops being true.
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
     * Static facts about the machine. Cheap: no sampling, no waiting.
     *
     * @return array<string, mixed>
     */
    public function system(): array
    {
        return [
            'hostname' => gethostname() ?: null,
            'os' => $this->osName(),
            'kernel' => $this->isAvailable() ? php_uname('r') : null,
            'cpuModel' => $this->cpuModel(),
            'cpuCores' => $this->cpuCores(),
            'uptimeSeconds' => $this->uptimeSeconds(),
            'loadAverage' => $this->isAvailable() ? sys_getloadavg() : null,
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
}
