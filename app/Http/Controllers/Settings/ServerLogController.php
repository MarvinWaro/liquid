<?php

declare(strict_types=1);

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Read-only viewer for the application log, for Super Admins.
 *
 * "Did that actually error on the server?" previously needed an SSH session. This
 * answers it in the app, as the read-only sibling of the Queue Health page.
 *
 * Deliberately read-only. There is no clear/delete and no way to run a command:
 * the log is the evidence trail, and an admin screen that can erase or execute is
 * a much larger attack surface than one that can only look.
 *
 * The load-bearing decision here is that the log file is NEVER read whole. Laravel
 * writes to a single file that grows without bound (LOG_STACK=single), and the
 * production droplet has 1 GB of RAM — file_get_contents() on a log that has been
 * growing for months is how that box runs out of memory mid-request. Everything
 * below works off the last TAIL_BYTES of the file, so cost stays flat whether the
 * log is 2 MB or 2 GB.
 */
class ServerLogController extends Controller
{
    /**
     * How much of the end of the file to read. Sized so the parsed payload stays
     * small on a 1 GB droplet while still covering a normal day of logging.
     */
    private const TAIL_BYTES = 262144; // 256 KB

    /** Upper bound on entries sent to the browser, newest last. */
    private const MAX_ENTRIES = 150;

    /** A single stack trace can be enormous; the full text is a download away. */
    private const TRACE_CHARS = 4000;

    private const MESSAGE_CHARS = 500;

    /**
     * Monolog's line format, e.g. "[2026-07-07 05:32:41] local.ERROR: message".
     *
     * Optional microseconds and offset are tolerated because the format changes
     * with the logging config, and a viewer that silently shows nothing is worse
     * than one that shows a little too much.
     */
    private const ENTRY_HEADER = '/^\[(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)?)\]\s+([\w-]+)\.([A-Z]+):\s?(.*)$/m';

    public function index(Request $request): InertiaResponse
    {
        $this->authorizeSuperAdmin($request);

        $files = $this->availableFiles();
        $selected = $this->resolveSelected($request->query('file'), $files);

        $level = strtoupper((string) $request->query('level', 'ALL'));
        $search = trim((string) $request->query('search', ''));

        return Inertia::render('settings/server-logs', [
            'files' => $files,
            'filters' => [
                'file' => $selected,
                'level' => $level,
                'search' => $search,
            ],

            // Deferred so the page paints immediately, matching Queue Health. The
            // read is cheap, but it is still disk I/O on a small droplet.
            'log' => Inertia::defer(fn () => $this->read($selected, $level, $search)),
        ]);
    }

    /**
     * Download the raw log file.
     *
     * Exists because the on-screen trace is capped: when 4 000 characters are not
     * enough, the whole file is one click away instead of one SSH session away.
     * Laravel streams this, so a large file does not land in memory.
     */
    public function download(Request $request): BinaryFileResponse
    {
        $this->authorizeSuperAdmin($request);

        $selected = $this->resolveSelected($request->query('file'), $this->availableFiles());

        abort_if($selected === null, 404, 'No log file available.');

        return response()->download($this->pathFor($selected));
    }

    /**
     * Log files present on disk, newest first.
     *
     * Doubles as the allow-list for every path this controller will open.
     *
     * @return array<int, array<string, mixed>>
     */
    private function availableFiles(): array
    {
        $paths = glob(storage_path('logs').DIRECTORY_SEPARATOR.'*.log') ?: [];

        // Newest first: the file someone wants is almost always the current one.
        usort($paths, fn (string $a, string $b) => filemtime($b) <=> filemtime($a));

        return array_map(fn (string $path) => [
            'name' => basename($path),
            'size' => filesize($path) ?: 0,
            'modifiedAt' => Carbon::createFromTimestamp(filemtime($path) ?: 0)
                ->setTimezone('Asia/Manila')
                ->toIso8601String(),
        ], $paths);
    }

    /**
     * Pick the file to show, accepting a request value only when it matches a file
     * we already found ourselves.
     *
     * This is the whole path-traversal defence: the request supplies a name to
     * compare, never a path to open, so "../../.env" simply fails to match and
     * falls back to the newest log.
     *
     * @param  array<int, array<string, mixed>>  $files
     */
    private function resolveSelected(mixed $requested, array $files): ?string
    {
        $names = array_column($files, 'name');

        if (is_string($requested) && in_array($requested, $names, true)) {
            return $requested;
        }

        return $names[0] ?? null;
    }

    /** Safe by construction: $name always comes from availableFiles(). */
    private function pathFor(string $name): string
    {
        return storage_path('logs').DIRECTORY_SEPARATOR.$name;
    }

    /**
     * @return array<string, mixed>
     */
    private function read(?string $name, string $level, string $search): array
    {
        $empty = ['entries' => [], 'truncated' => false, 'scannedBytes' => 0, 'totalBytes' => 0];

        if ($name === null) {
            return $empty;
        }

        $path = $this->pathFor($name);

        if (! is_readable($path)) {
            return $empty;
        }

        [$content, $truncated, $scanned, $total] = $this->tail($path);

        return [
            'entries' => $this->parse($content, $level, $search),
            // Tells the UI to say "showing the most recent activity" rather than
            // implying this is the whole file.
            'truncated' => $truncated,
            'scannedBytes' => $scanned,
            'totalBytes' => $total,
        ];
    }

    /**
     * Read only the last TAIL_BYTES of the file by seeking from the end.
     *
     * The seek is the point: it never touches the earlier bytes, so memory and
     * time stay constant no matter how large the log has grown.
     *
     * @return array{0: string, 1: bool, 2: int, 3: int}
     */
    private function tail(string $path): array
    {
        $total = filesize($path) ?: 0;
        $offset = max(0, $total - self::TAIL_BYTES);

        $handle = @fopen($path, 'rb');

        if ($handle === false) {
            return ['', false, 0, $total];
        }

        if ($offset > 0) {
            fseek($handle, $offset);
        }

        $content = stream_get_contents($handle) ?: '';
        fclose($handle);

        return [$content, $offset > 0, strlen($content), $total];
    }

    /**
     * Split the raw tail into entries.
     *
     * Splitting on the timestamp header rather than on newlines is what keeps a
     * stack trace attached to the error that produced it — a line-based reader
     * shows 30 orphaned "#12 /var/www/..." rows and hides the actual message.
     *
     * Slicing between header positions also discards whatever came before the
     * first header, which is the half-entry left over from seeking into the
     * middle of the file.
     *
     * @return array<int, array<string, mixed>>
     */
    private function parse(string $content, string $level, string $search): array
    {
        if (! preg_match_all(self::ENTRY_HEADER, $content, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE)) {
            return [];
        }

        $total = count($matches);
        $entries = [];

        foreach ($matches as $i => $match) {
            $start = $match[0][1];
            $end = $i + 1 < $total ? $matches[$i + 1][0][1] : strlen($content);

            $entryLevel = $match[3][0];
            $message = trim($match[4][0]);

            // The block minus its own header line is the context/stack trace.
            $body = trim(substr($content, $start + strlen($match[0][0]), $end - $start - strlen($match[0][0])));

            if (! $this->matchesLevel($entryLevel, $level)) {
                continue;
            }

            if ($search !== '' && ! $this->matchesSearch($search, $message, $body)) {
                continue;
            }

            $entries[] = [
                // Position in the tail — stable enough to key a list that is
                // replaced wholesale on every refresh.
                'id' => $start,
                'level' => $entryLevel,
                'environment' => $match[2][0],
                // Logged in the app timezone (UTC per config/app.php) with no
                // marker of its own. Converting here means the browser is handed
                // an unambiguous instant instead of digits it would read as local.
                'loggedAt' => $this->toManila($match[1][0]),
                'message' => mb_strimwidth($message, 0, self::MESSAGE_CHARS, '…'),
                'trace' => mb_strimwidth($body, 0, self::TRACE_CHARS, "\n… trace truncated — download the log file for the rest."),
                'hasTrace' => $body !== '',
            ];
        }

        // Newest last, so the console reads top-to-bottom like a real terminal.
        return array_slice($entries, -self::MAX_ENTRIES);
    }

    private function matchesLevel(string $entryLevel, string $filter): bool
    {
        return $filter === 'ALL' || $entryLevel === $filter;
    }

    private function matchesSearch(string $needle, string $message, string $body): bool
    {
        return mb_stripos($message, $needle) !== false || mb_stripos($body, $needle) !== false;
    }

    /**
     * A malformed timestamp should cost one entry's date, not the whole page.
     */
    private function toManila(string $timestamp): ?string
    {
        try {
            return Carbon::parse($timestamp, config('app.timezone'))
                ->setTimezone('Asia/Manila')
                ->toIso8601String();
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Role-based rather than permission-based, for the same reason as Queue
     * Health: logs carry stack traces, email addresses and occasionally tokens,
     * so access should not be grantable by editing a role.
     */
    private function authorizeSuperAdmin(Request $request): void
    {
        abort_unless($request->user()?->isSuperAdmin(), 403, 'Unauthorized action.');
    }
}
