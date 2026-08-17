import { Deferred, Head, router, usePage } from '@inertiajs/react';
import {
    ArrowDownWideNarrow,
    ArrowUpNarrowWide,
    Check,
    ChevronRight,
    Copy,
    Download,
    FileText,
    List,
    RefreshCw,
    Search,
    Terminal,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { formatManilaDateTime } from '@/lib/date';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem, type SharedData } from '@/types';

interface LogFile {
    name: string;
    /** Which server wrote it: 'app' (Laravel) or 'nginx'. */
    source: string;
    size: number;
    modifiedAt: string;
}

interface LogEntry {
    id: number;
    level: string;
    environment: string;
    loggedAt: string | null;
    message: string;
    trace: string;
    hasTrace: boolean;
}

interface LogPayload {
    entries: LogEntry[];
    truncated: boolean;
    scannedBytes: number;
    totalBytes: number;
}

interface Filters {
    file: string | null;
    level: string;
    search: string;
}

interface ServerLogsProps {
    files: LogFile[];
    filters: Filters;
    log?: LogPayload;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Server Logs', href: '/settings/server-logs' },
];

const LEVELS = [
    'ALL',
    'EMERGENCY',
    'ALERT',
    'CRITICAL',
    'ERROR',
    'WARNING',
    'NOTICE',
    'INFO',
    'DEBUG',
] as const;

/**
 * Console colours. Deliberately fixed rather than theme-aware: the log panel is a
 * terminal, and it stays dark in both light and dark mode the way an embedded
 * console does everywhere else.
 */
const LEVEL_STYLES: Record<string, string> = {
    EMERGENCY: 'bg-red-500/15 text-red-300 ring-red-500/30',
    ALERT: 'bg-red-500/15 text-red-300 ring-red-500/30',
    CRITICAL: 'bg-red-500/15 text-red-300 ring-red-500/30',
    ERROR: 'bg-red-500/15 text-red-300 ring-red-500/30',
    WARNING: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
    NOTICE: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
    INFO: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
    DEBUG: 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30',
};

function formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const power = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1,
    );
    const value = bytes / 1024 ** power;

    return `${value < 10 && power > 0 ? value.toFixed(1) : Math.round(value)} ${units[power]}`;
}

/**
 * Console view is a single-hue green phosphor terminal. Levels stay readable
 * through brightness and weight rather than hue, so an ERROR still jumps out
 * without breaking the all-green look.
 */
const CONSOLE_LEVEL_TEXT: Record<string, string> = {
    EMERGENCY: 'text-green-300 font-bold',
    ALERT: 'text-green-300 font-bold',
    CRITICAL: 'text-green-300 font-bold',
    ERROR: 'text-green-300 font-bold',
    WARNING: 'text-green-400',
    NOTICE: 'text-green-500',
    INFO: 'text-green-500',
    DEBUG: 'text-green-700',
};

type ViewMode = 'rows' | 'console';

/** Newest first is the default: an admin opens this to see what just broke. */
type SortOrder = 'newest' | 'oldest';

/**
 * Rebuild the original log text for an entry, so what lands on the clipboard is
 * what was in the file rather than what the screen happened to render.
 */
function toRawText(entry: LogEntry): string {
    const head = `[${formatManilaDateTime(entry.loggedAt, 'unknown time')}] ${entry.environment}.${entry.level}: ${entry.message}`;

    return entry.hasTrace ? `${head}\n${entry.trace}` : head;
}

async function copyText(text: string, label: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);

        return true;
    } catch {
        // Clipboard access needs a secure context. Fails on plain http over a
        // LAN address, so say what happened instead of appearing to do nothing.
        toast.error('Could not copy — try selecting the text manually');

        return false;
    }
}

/**
 * Expanding on click and selecting text to copy are the same gesture as far as
 * the browser is concerned. When a selection exists, the drag was a copy, so the
 * row must not toggle underneath it.
 */
function selectionActive(): boolean {
    return (window.getSelection()?.toString().length ?? 0) > 0;
}

/** Copy control for one entry. Appears on hover so it stays out of the way. */
function CopyEntryButton({ entry, tone }: { entry: LogEntry; tone: string }) {
    const [copied, setCopied] = useState(false);

    const handle = async (event: React.MouseEvent) => {
        event.stopPropagation();

        if (await copyText(toRawText(entry), 'Log entry')) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        }
    };

    return (
        <button
            type="button"
            onClick={handle}
            aria-label="Copy this log entry"
            className={cn(
                'shrink-0 rounded p-1 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100',
                tone,
            )}
        >
            {copied ? (
                <Check className="h-3 w-3" />
            ) : (
                <Copy className="h-3 w-3" />
            )}
        </button>
    );
}

const SKELETON_WIDTHS = ['w-11/12', 'w-4/5', 'w-3/4', 'w-2/3', 'w-1/2'];

function ConsoleSkeleton() {
    return (
        <div className="space-y-2 p-4">
            {SKELETON_WIDTHS.map((width) => (
                <Skeleton
                    key={width}
                    className={cn('h-4 bg-zinc-800', width)}
                />
            ))}
        </div>
    );
}

/**
 * One log line. Collapsed to a single row; the stack trace opens on click.
 *
 * This is a div rather than a button on purpose. Text inside a <button> cannot be
 * drag-selected, which made the whole log impossible to copy out — the one thing
 * someone reading an error actually wants to do with it.
 */
function LogRow({ entry }: { entry: LogEntry }) {
    const [open, setOpen] = useState(false);
    const levelStyle = LEVEL_STYLES[entry.level] ?? LEVEL_STYLES.DEBUG;

    const toggle = () => {
        if (!entry.hasTrace || selectionActive()) {
            return;
        }

        setOpen((prev) => !prev);
    };

    return (
        <div className="group border-b border-zinc-800/70 last:border-0">
            <div
                onClick={toggle}
                onKeyDown={(event) => {
                    if (
                        entry.hasTrace &&
                        (event.key === 'Enter' || event.key === ' ')
                    ) {
                        event.preventDefault();
                        setOpen((prev) => !prev);
                    }
                }}
                role={entry.hasTrace ? 'button' : undefined}
                tabIndex={entry.hasTrace ? 0 : undefined}
                aria-expanded={entry.hasTrace ? open : undefined}
                className={cn(
                    'flex w-full items-start gap-3 px-3 py-2 text-left transition-colors select-text',
                    entry.hasTrace && 'cursor-pointer hover:bg-zinc-800/50',
                )}
            >
                <ChevronRight
                    className={cn(
                        'mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600 transition-transform',
                        open && 'rotate-90',
                        !entry.hasTrace && 'invisible',
                    )}
                />

                <span className="mt-0.5 shrink-0 text-[11px] whitespace-nowrap text-zinc-500 tabular-nums">
                    {formatManilaDateTime(entry.loggedAt, '—')}
                </span>

                <span
                    className={cn(
                        'mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset',
                        levelStyle,
                    )}
                >
                    {entry.level}
                </span>

                <span className="min-w-0 flex-1 text-xs break-words text-zinc-200">
                    {entry.message}
                </span>

                <CopyEntryButton
                    entry={entry}
                    tone="text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                />
            </div>

            {open && entry.hasTrace && (
                <pre className="overflow-x-auto border-t border-zinc-800/70 bg-black/40 px-3 py-2 text-[11px] leading-relaxed text-zinc-400 select-text">
                    {entry.trace}
                </pre>
            )}
        </div>
    );
}

/**
 * One line of raw `tail` output, rendered as green phosphor terminal text.
 *
 * Same div-not-button reasoning as LogRow: the text has to stay selectable.
 */
function ConsoleLine({ entry }: { entry: LogEntry }) {
    const [open, setOpen] = useState(false);
    const levelColor =
        CONSOLE_LEVEL_TEXT[entry.level] ?? CONSOLE_LEVEL_TEXT.DEBUG;

    const toggle = () => {
        if (!entry.hasTrace || selectionActive()) {
            return;
        }

        setOpen((prev) => !prev);
    };

    return (
        <div className="group">
            <div
                onClick={toggle}
                onKeyDown={(event) => {
                    if (
                        entry.hasTrace &&
                        (event.key === 'Enter' || event.key === ' ')
                    ) {
                        event.preventDefault();
                        setOpen((prev) => !prev);
                    }
                }}
                role={entry.hasTrace ? 'button' : undefined}
                tabIndex={entry.hasTrace ? 0 : undefined}
                aria-expanded={entry.hasTrace ? open : undefined}
                className={cn(
                    'flex w-full items-start gap-2 px-3 py-0.5 text-left text-xs leading-relaxed select-text',
                    entry.hasTrace && 'cursor-pointer hover:bg-green-500/5',
                )}
            >
                <span className="min-w-0 flex-1 break-words">
                    <span className="text-green-700">
                        [{formatManilaDateTime(entry.loggedAt, '—')}]
                    </span>{' '}
                    <span className={levelColor}>
                        {entry.environment}.{entry.level}:
                    </span>{' '}
                    <span className="text-green-400">{entry.message}</span>
                    {entry.hasTrace && (
                        <span className="ml-1 text-green-800">
                            {open ? '▾' : '▸'}
                        </span>
                    )}
                </span>

                <CopyEntryButton
                    entry={entry}
                    tone="text-green-700 hover:bg-green-500/10 hover:text-green-300"
                />
            </div>

            {open && entry.hasTrace && (
                <pre className="overflow-x-auto px-3 pb-1 pl-6 text-[11px] leading-relaxed text-green-800 select-text">
                    {entry.trace}
                </pre>
            )}
        </div>
    );
}

export default function ServerLogs({ files, filters, log }: ServerLogsProps) {
    const { can } = usePage<SharedData>().props;
    const [search, setSearch] = useState(filters.search);
    // Purely rendering choices — the entries are already in the browser, so
    // switching view or order costs no request and no server work.
    const [view, setView] = useState<ViewMode>('rows');
    const [order, setOrder] = useState<SortOrder>('newest');

    const selectedFile = useMemo(
        () => files.find((file) => file.name === filters.file) ?? null,
        [files, filters.file],
    );

    // The server sends entries oldest-first, the order they sit in the file.
    // Reversing here is a 150-item array copy — cheaper than asking the server.
    const entries = useMemo(() => {
        const rows = log?.entries ?? [];

        return order === 'newest' ? [...rows].reverse() : rows;
    }, [log?.entries, order]);

    // Belt and braces: the controller already refuses non-Super-Admins, but the
    // nav item is ability-gated too, so a direct visit should not render a shell.
    if (!can?.canViewServerLogs) {
        return null;
    }

    /**
     * One partial reload per change. `only: ['log']` means the file list and the
     * layout are not re-sent — the request costs a log read and nothing else,
     * which is what keeps this affordable on a 1 GB droplet.
     */
    const apply = (next: Partial<Filters>) => {
        router.get(
            '/settings/server-logs',
            {
                file: next.file ?? filters.file ?? undefined,
                level: next.level ?? filters.level,
                search: next.search ?? search,
            },
            {
                preserveState: true,
                preserveScroll: true,
                only: ['log', 'filters'],
                replace: true,
            },
        );
    };

    const downloadUrl = `/settings/server-logs/download${filters.file ? `?file=${encodeURIComponent(filters.file)}` : ''}`;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Server Logs" />

            <SettingsLayout wide>
                <div className="space-y-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <HeadingSmall
                            title="Server Logs"
                            description="The application log, read-only. Click a line for its stack trace, or select any text to copy it."
                        />

                        <div className="flex items-center gap-2">
                            {/* Labelled, because a bare "5.6 MB" reads as a
                                mystery number. This is the file on disk, which is
                                also why the console header says it is showing only
                                the most recent slice of it. */}
                            {selectedFile && (
                                <Badge
                                    variant="outline"
                                    className="font-mono text-xs"
                                    title="Total size of this log file on disk"
                                >
                                    {formatBytes(selectedFile.size)} on disk
                                </Badge>
                            )}

                            {/* Copies every entry currently on screen, filters and
                                order included — the whole point is pasting a real
                                error somewhere else. */}
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                disabled={entries.length === 0}
                                onClick={() =>
                                    copyText(
                                        entries.map(toRawText).join('\n\n'),
                                        `${entries.length} log ${entries.length === 1 ? 'entry' : 'entries'}`,
                                    )
                                }
                            >
                                <Copy className="h-3.5 w-3.5" />
                                Copy all
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                asChild
                            >
                                <a href={downloadUrl}>
                                    <Download className="h-3.5 w-3.5" />
                                    Download
                                </a>
                            </Button>

                            {/* Manual by design. An auto-refresh left running in a
                                forgotten tab is a steady drip of full Laravel boots
                                on a 1 vCPU box. */}
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => router.reload({ only: ['log'] })}
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Select
                            value={filters.file ?? undefined}
                            onValueChange={(file) => apply({ file })}
                        >
                            <SelectTrigger className="w-full sm:w-64">
                                <SelectValue placeholder="Select a log file" />
                            </SelectTrigger>
                            <SelectContent>
                                {files.map((file) => (
                                    <SelectItem
                                        key={file.name}
                                        value={file.name}
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="font-mono text-xs">
                                                {file.name}
                                            </span>
                                            {/* "error.log" alone would read as
                                                the app's own log. */}
                                            {file.source === 'nginx' && (
                                                <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground uppercase">
                                                    nginx
                                                </span>
                                            )}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={filters.level}
                            onValueChange={(level) => apply({ level })}
                        >
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {LEVELS.map((level) => (
                                    <SelectItem key={level} value={level}>
                                        {level === 'ALL' ? 'All levels' : level}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <form
                            className="relative flex-1 sm:min-w-56"
                            onSubmit={(event) => {
                                event.preventDefault();
                                apply({ search });
                            }}
                        >
                            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search messages, then press Enter"
                                className="pl-8"
                            />
                        </form>

                        <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() =>
                                setOrder((prev) =>
                                    prev === 'newest' ? 'oldest' : 'newest',
                                )
                            }
                        >
                            {order === 'newest' ? (
                                <ArrowDownWideNarrow className="h-3.5 w-3.5" />
                            ) : (
                                <ArrowUpNarrowWide className="h-3.5 w-3.5" />
                            )}
                            {order === 'newest'
                                ? 'Newest first'
                                : 'Oldest first'}
                        </Button>

                        <ToggleGroup
                            type="single"
                            variant="outline"
                            value={view}
                            // Radix returns '' when the active item is clicked
                            // again; ignoring that keeps a view always selected.
                            onValueChange={(next) =>
                                next && setView(next as ViewMode)
                            }
                            aria-label="Log display style"
                        >
                            <ToggleGroupItem value="rows" aria-label="Row view">
                                <List className="h-3.5 w-3.5" />
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="console"
                                aria-label="Console view"
                            >
                                <Terminal className="h-3.5 w-3.5" />
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>

                    {/* Console */}
                    <div
                        className={cn(
                            'overflow-hidden rounded-md border font-mono',
                            view === 'console'
                                ? 'border-green-900/60 bg-black'
                                : 'border-zinc-800 bg-zinc-950',
                        )}
                    >
                        <div
                            className={cn(
                                'flex items-center gap-2 border-b px-3 py-2',
                                view === 'console'
                                    ? 'border-green-900/60 bg-green-950/20'
                                    : 'border-zinc-800 bg-zinc-900/60',
                            )}
                        >
                            <Terminal
                                className={cn(
                                    'h-3.5 w-3.5',
                                    view === 'console'
                                        ? 'text-green-500'
                                        : 'text-zinc-500',
                                )}
                            />
                            <span
                                className={cn(
                                    'truncate text-xs',
                                    view === 'console'
                                        ? 'text-green-400'
                                        : 'text-zinc-400',
                                )}
                            >
                                {filters.file ?? 'No log file'}
                            </span>
                            {log?.truncated && (
                                <span
                                    className={cn(
                                        'ml-auto shrink-0 text-[11px]',
                                        view === 'console'
                                            ? 'text-green-700'
                                            : 'text-zinc-500',
                                    )}
                                >
                                    showing the most recent{' '}
                                    {formatBytes(log.scannedBytes)} of{' '}
                                    {formatBytes(log.totalBytes)}
                                </span>
                            )}
                        </div>

                        <Deferred data="log" fallback={<ConsoleSkeleton />}>
                            {!log || log.entries.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                                    <FileText className="h-7 w-7 text-zinc-700" />
                                    <p className="text-sm font-medium text-zinc-300">
                                        {files.length === 0
                                            ? 'No log files found'
                                            : 'Nothing to show'}
                                    </p>
                                    <p className="max-w-sm text-xs text-zinc-500">
                                        {files.length === 0
                                            ? 'The server has not written a log file yet.'
                                            : 'No entries match this filter in the most recent part of the log.'}
                                    </p>
                                </div>
                            ) : view === 'console' ? (
                                <div className="max-h-[32rem] overflow-y-auto py-2">
                                    {/* Prompt line, purely for the terminal feel.
                                        `tac` is the real command for reversing a
                                        file, so the line stays honest about the
                                        order being shown. */}
                                    <p className="px-3 pb-1 text-xs text-green-800">
                                        <span className="text-green-500">
                                            $
                                        </span>{' '}
                                        tail -n {entries.length}{' '}
                                        {selectedFile?.source === 'nginx'
                                            ? '/var/log/nginx/'
                                            : 'storage/logs/'}
                                        {filters.file}
                                        {order === 'newest' && ' | tac'}
                                    </p>
                                    {entries.map((entry) => (
                                        <ConsoleLine
                                            key={entry.id}
                                            entry={entry}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="max-h-[32rem] overflow-y-auto">
                                    {entries.map((entry) => (
                                        <LogRow key={entry.id} entry={entry} />
                                    ))}
                                </div>
                            )}
                        </Deferred>
                    </div>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
