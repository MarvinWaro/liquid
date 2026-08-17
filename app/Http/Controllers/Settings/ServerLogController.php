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

    private const SOURCE_APP = 'app';

    private const SOURCE_NGINX = 'nginx';

    /**
     * An nginx error line, e.g.
     * "2026/08/17 13:55:36 [error] 1234#0: *1 connect() failed ..."
     *
     * Nothing like Monolog's format, hence its own pattern and its own parser.
     */
    private const NGINX_ENTRY = '/^(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] \d+#\d+:\s*(.*)$/m';

    /**
     * Nginx severities mapped onto the level vocabulary the UI already filters
     * by, so one dropdown keeps working across both kinds of log.
     */
    private const NGINX_LEVELS = [
        'emerg' => 'EMERGENCY',
        'alert' => 'ALERT',
        'crit' => 'CRITICAL',
        'error' => 'ERROR',
        'warn' => 'WARNING',
        'notice' => 'NOTICE',
        'info' => 'INFO',
        'debug' => 'DEBUG',
    ];

    /**
     * Memoised so one request globs the log directory once.
     *
     * @var array<string, array{path: string, source: string}>|null
     */
    private ?array $sources = null;

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
        $meta = $selected === null ? null : $this->metaFor($selected);

        abort_if($meta === null, 404, 'No log file available.');

        return response()->download($meta['path']);
    }

    /**
     * Every log this controller may open, keyed by the name shown in the UI.
     *
     * This is the allow-list: resolveSelected() only ever returns a key from
     * here and metaFor() only ever returns a value from here, so a request can
     * name a file but can never supply a path.
     *
     * @return array<string, array{path: string, source: string}>
     */
    private function sources(): array
    {
        if ($this->sources !== null) {
            return $this->sources;
        }

        $paths = glob(storage_path('logs').DIRECTORY_SEPARATOR.'*.log') ?: [];

        // Newest first: the file someone wants is almost always the current one.
        usort($paths, fn (string $a, string $b) => filemtime($b) <=> filemtime($a));

        $sources = [];

        foreach ($paths as $path) {
            $sources[basename($path)] = ['path' => $path, 'source' => self::SOURCE_APP];
        }

        // Nginx is added last and never overwrites an application log of the
        // same name.
        foreach ($this->nginxPaths() as $path) {
            $sources[basename($path)] ??= ['path' => $path, 'source' => self::SOURCE_NGINX];
        }

        return $this->sources = $sources;
    }

    /**
     * The nginx error log and its rotated history, newest first.
     *
     * Matched as siblings of the configured filename — "nginx-error.log*" —
     * rather than by listing the directory. That distinction is deliberate:
     * globbing the directory would sweep in access.log, which was left out on
     * purpose because it is large and records every visitor's IP and full URL.
     * A dated sibling is more of the same error log; a neighbouring file is not.
     *
     * @return array<int, string>
     */
    private function nginxPaths(): array
    {
        $configured = config('logging.nginx_error_path');

        if (! is_string($configured) || $configured === '') {
            return [];
        }

        $paths = array_filter(
            glob($configured.'*') ?: [],
            // Readable, because /var/log/nginx/error.log is root:adm 640 out of
            // the box and www-data cannot open it — listing it anyway would hand
            // the user a viewer that is permanently empty.
            //
            // Uncompressed, because this whole page rests on tail() seeking to
            // the last TAIL_BYTES so file size never matters. A gzip stream
            // cannot be seeked, and decompressing whole archives is precisely
            // what a 1 GB droplet cannot afford. `nocompress` in the logrotate
            // rule keeps the kept history readable; an error log is kilobytes.
            fn (string $path) => is_file($path)
                && is_readable($path)
                && ! preg_match('/\.(gz|bz2|xz|zst)$/i', $path),
        );

        usort($paths, fn (string $a, string $b) => filemtime($b) <=> filemtime($a));

        return $paths;
    }

    /**
     * @return array{path: string, source: string}|null
     */
    private function metaFor(string $name): ?array
    {
        return $this->sources()[$name] ?? null;
    }

    /**
     * Log files available to read, newest first.
     *
     * @return array<int, array<string, mixed>>
     */
    private function availableFiles(): array
    {
        $files = [];

        foreach ($this->sources() as $name => $meta) {
            $files[] = [
                'name' => $name,
                // Lets the UI label which server wrote the file, so a bare
                // "error.log" is not mistaken for the application's own.
                'source' => $meta['source'],
                'size' => filesize($meta['path']) ?: 0,
                'modifiedAt' => Carbon::createFromTimestamp(filemtime($meta['path']) ?: 0)
                    ->setTimezone('Asia/Manila')
                    ->toIso8601String(),
            ];
        }

        return $files;
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

    /**
     * @return array<string, mixed>
     */
    private function read(?string $name, string $level, string $search): array
    {
        $empty = ['entries' => [], 'truncated' => false, 'scannedBytes' => 0, 'totalBytes' => 0];

        if ($name === null) {
            return $empty;
        }

        $meta = $this->metaFor($name);

        if ($meta === null || ! is_readable($meta['path'])) {
            return $empty;
        }

        [$content, $truncated, $scanned, $total] = $this->tail($meta['path']);

        return [
            'entries' => $meta['source'] === self::SOURCE_NGINX
                ? $this->parseNginx($content, $level, $search)
                : $this->parse($content, $level, $search),
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

    /**
     * Split an nginx error log into the same entry shape the Monolog parser
     * produces, so the console renders both without knowing the difference.
     *
     * Nginx writes one line per error with no stack trace, but the tail after
     * ", client:" is request context — which URL, which upstream, which visitor
     * — rather than the error itself. Splitting it off keeps the row scannable
     * and puts the detail behind the same expand affordance a trace uses.
     *
     * @return array<int, array<string, mixed>>
     */
    private function parseNginx(string $content, string $level, string $search): array
    {
        if (! preg_match_all(self::NGINX_ENTRY, $content, $matches, PREG_SET_ORDER)) {
            return [];
        }

        $entries = [];

        foreach ($matches as $i => $match) {
            // Unknown severities read as ERROR rather than being dropped: an
            // unrecognised line in an error log is still worth showing.
            $entryLevel = self::NGINX_LEVELS[strtolower($match[2])] ?? 'ERROR';
            $message = trim($match[3]);
            $context = '';

            if (($split = strpos($message, ', client:')) !== false) {
                $context = trim(substr($message, $split + 2));
                $message = trim(substr($message, 0, $split));
            }

            if (! $this->matchesLevel($entryLevel, $level)) {
                continue;
            }

            if ($search !== '' && ! $this->matchesSearch($search, $message, $context)) {
                continue;
            }

            $entries[] = [
                'id' => $i,
                'level' => $entryLevel,
                'environment' => self::SOURCE_NGINX,
                'loggedAt' => $this->nginxTime($match[1]),
                'message' => mb_strimwidth($message, 0, self::MESSAGE_CHARS, '…'),
                'trace' => mb_strimwidth($context, 0, self::TRACE_CHARS, '…'),
                'hasTrace' => $context !== '',
            ];
        }

        // Newest last, matching the application log so the console reads the
        // same way whichever file is selected.
        return array_slice($entries, -self::MAX_ENTRIES);
    }

    /**
     * Nginx stamps its lines in the server's own local time, which on this
     * droplet is UTC — the same basis config('app.timezone') already describes,
     * so the two logs line up rather than sitting hours apart.
     */
    private function nginxTime(string $timestamp): ?string
    {
        try {
            return Carbon::createFromFormat('Y/m/d H:i:s', $timestamp, config('app.timezone'))
                ->setTimezone('Asia/Manila')
                ->toIso8601String();
        } catch (\Throwable) {
            return null;
        }
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
