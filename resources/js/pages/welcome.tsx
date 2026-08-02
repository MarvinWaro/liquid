import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAppearance } from '@/hooks/use-appearance';
import { dashboard, login } from '@/routes';
import { type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    Check,
    CheckCircle2,
    Filter,
    Monitor,
    Moon,
    Search,
    Sun,
    TrendingDown,
    Trophy,
} from 'lucide-react';
import {
    Fragment,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HEIBoardItem {
    hei_id: string;
    hei_name: string;
    hei_uii: string;
    region_name?: string;
    total_disbursements: number;
    total_liquidated: number;
    pct_liquidation: number;
    liquidation_count: number;
}

interface FilterOption {
    id: string;
    name: string;
    code: string;
    parent_id?: string | null;
}

interface Props {
    honorBoard?: HEIBoardItem[];
    shameBoard?: HEIBoardItem[];
    regions?: FilterOption[];
    programs?: FilterOption[];
    filters?: { region?: string; program?: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL = '__all__';
const ROW_HEIGHT_EST = 44;
const AUTO_SCROLL_SPEED = 18;

// ─── Board Panel ──────────────────────────────────────────────────────────────

function BoardPanel({
    title,
    items,
    variant,
    emptyLabel,
}: {
    title: string;
    items: HEIBoardItem[];
    variant: 'honor' | 'shame';
    emptyLabel: string;
}) {
    const [search, setSearch] = useState('');
    const [hovered, setHovered] = useState(false);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [containerH, setContainerH] = useState(0);
    const isHonor = variant === 'honor';

    // Callback ref: re-runs whenever the scrollable div mounts/unmounts, so the
    // ResizeObserver always tracks the current DOM node. A single `[]`-dep effect
    // would stop observing after the empty-state branch swaps the element out —
    // leaving `containerH` stale and auto-scroll permanently disabled.
    const observerRef = useRef<ResizeObserver | null>(null);
    const setScrollEl = useCallback((el: HTMLDivElement | null) => {
        observerRef.current?.disconnect();
        observerRef.current = null;
        scrollRef.current = el;

        if (!el) {
            setContainerH(0);
            return;
        }
        setContainerH(el.clientHeight);
        const ro = new ResizeObserver(() => setContainerH(el.clientHeight));
        ro.observe(el);
        observerRef.current = ro;
    }, []);

    // Search filter
    const filtered = useMemo(() => {
        if (!search.trim()) return items;
        const q = search.toLowerCase();
        return items.filter(
            (r) =>
                r.hei_name.toLowerCase().includes(q) ||
                r.hei_uii?.toLowerCase().includes(q),
        );
    }, [items, search]);

    const isSearching = search.trim().length > 0;

    // Only auto-scroll when items genuinely overflow the visible area
    const overflows =
        containerH > 0 && filtered.length * ROW_HEIGHT_EST > containerH;
    const shouldAutoScroll = overflows && !isSearching && filtered.length > 0;
    const copies = shouldAutoScroll ? 2 : 1;

    const displayItems = useMemo(() => {
        if (filtered.length === 0) return [];
        const arr: HEIBoardItem[] = [];
        for (let i = 0; i < copies; i++) arr.push(...filtered);
        return arr;
    }, [filtered, copies]);

    // Reset scroll when data or search changes
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }, [items, search]);

    // Smooth auto-scroll via rAF — restarts when items change (e.g. after filter)
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || hovered || !shouldAutoScroll) return;

        let accum = 0;
        let raf: number;
        let last = 0;

        const tick = (now: number) => {
            if (last === 0) {
                last = now;
            }
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;
            accum += AUTO_SCROLL_SPEED * dt;
            el.scrollTop = accum;

            if (copies > 1) {
                const half = el.scrollHeight / copies;
                if (half > 0 && accum >= half) {
                    accum -= half;
                    el.scrollTop = accum;
                }
            }
            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [hovered, shouldAutoScroll, copies, items]);

    // ── Styles ──

    const panelCls = isHonor
        ? 'border-emerald-200/70 dark:border-emerald-700/30 bg-emerald-50/70 dark:bg-emerald-950/30'
        : 'border-red-200/70 dark:border-red-700/30 bg-red-50/70 dark:bg-red-950/30';
    const headerBorderCls = isHonor
        ? 'border-emerald-200/70 dark:border-emerald-700/30'
        : 'border-red-200/70 dark:border-red-700/30';
    const iconCls = isHonor
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-500 dark:text-red-400';
    const titleCls = isHonor
        ? 'text-emerald-800 dark:text-emerald-300'
        : 'text-red-800 dark:text-red-300';
    const countCls = isHonor
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-500 dark:text-red-400';
    const rowBorderCls = isHonor
        ? 'border-b border-emerald-100/70 dark:border-emerald-800/30'
        : 'border-b border-red-100/70 dark:border-red-800/30';
    const pctCls = isHonor
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400';
    const fadeFrom = isHonor
        ? 'from-[#ecfdf5b3] dark:from-[#022c2299]'
        : 'from-[#fef2f2b3] dark:from-[#450a0a99]';
    const searchBorderCls = isHonor
        ? 'border-emerald-200/60 dark:border-emerald-700/40 focus:border-emerald-400 dark:focus:border-emerald-600'
        : 'border-red-200/60 dark:border-red-700/40 focus:border-red-400 dark:focus:border-red-600';

    const RowIcon = isHonor ? CheckCircle2 : TrendingDown;
    const EmptyIcon = isHonor ? Trophy : AlertTriangle;

    return (
        <div
            className={`board-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border backdrop-blur-sm ${panelCls}`}
        >
            {/* Header */}
            <div
                className={`shrink-0 space-y-1.5 border-b px-3 py-2 ${headerBorderCls}`}
            >
                <div className="flex items-center gap-2">
                    {isHonor ? (
                        <Trophy className={`h-3.5 w-3.5 shrink-0 ${iconCls}`} />
                    ) : (
                        <AlertTriangle
                            className={`h-3.5 w-3.5 shrink-0 ${iconCls}`}
                        />
                    )}
                    <span
                        className={`text-[11px] font-semibold tracking-wide ${titleCls}`}
                    >
                        {title}
                    </span>
                    <span
                        className={`ml-auto text-[10px] font-medium tabular-nums ${countCls}`}
                    >
                        {filtered.length}{' '}
                        {filtered.length === 1 ? 'HEI' : 'HEIs'}
                    </span>
                </div>
                <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="SEARCH HEI name or UII..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={`w-full rounded-md border bg-white/60 py-1 pr-2 pl-7 text-[11px] transition-colors placeholder:text-muted-foreground/60 focus:ring-0 focus:outline-none dark:bg-black/20 ${searchBorderCls}`}
                    />
                </div>
            </div>

            {/* Body */}
            {filtered.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
                    <EmptyIcon className="h-5 w-5 opacity-20" />
                    <p className="px-4 text-center text-[10px]">
                        {isSearching ? 'No matching HEIs found.' : emptyLabel}
                    </p>
                </div>
            ) : (
                <div className="relative min-h-0 flex-1">
                    {shouldAutoScroll && (
                        <>
                            <div
                                className={`absolute inset-x-0 top-0 h-4 bg-gradient-to-b ${fadeFrom} pointer-events-none z-10 to-transparent`}
                            />
                            <div
                                className={`absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t ${fadeFrom} pointer-events-none z-10 to-transparent`}
                            />
                        </>
                    )}
                    <div
                        ref={setScrollEl}
                        className="h-full overflow-y-auto"
                        onMouseEnter={() => setHovered(true)}
                        onMouseLeave={() => setHovered(false)}
                        style={{
                            scrollbarWidth: 'thin',
                            scrollbarColor:
                                'rgba(120,120,120,0.25) transparent',
                        }}
                    >
                        {displayItems.map((item, i) => (
                            <div
                                key={`${item.hei_id}-${i}`}
                                className={`flex items-center gap-2 px-3 py-2 ${rowBorderCls}`}
                            >
                                <RowIcon
                                    className={`h-3 w-3 shrink-0 ${iconCls}`}
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-[11px] leading-tight font-medium">
                                        {item.hei_name}
                                    </div>
                                    {item.hei_uii && (
                                        <div className="font-mono text-[9px] leading-tight text-muted-foreground">
                                            {item.hei_uii}
                                        </div>
                                    )}
                                </div>
                                <span
                                    className={`shrink-0 font-mono text-[10px] font-bold ${pctCls}`}
                                >
                                    {isHonor
                                        ? '100%'
                                        : `${Number(item.pct_liquidation).toFixed(1)}%`}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Welcome Page ─────────────────────────────────────────────────────────────

export default function Welcome({
    honorBoard = [],
    shameBoard = [],
    regions = [],
    programs = [],
    filters = {},
}: Props) {
    const { auth } = usePage<SharedData>().props;
    const { appearance, updateAppearance } = useAppearance();
    const [themeMenuOpen, setThemeMenuOpen] = useState(false);

    // Always land on the hero on (re)load. Modern browsers preserve scroll
    // position on F5; for a single-screen landing page we want a fresh top.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        if (!themeMenuOpen) return;
        const close = () => setThemeMenuOpen(false);
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [themeMenuOpen]);

    // ── Filters ──

    const onFilterChange = useCallback(
        (key: 'region' | 'program', value: string) => {
            const params: Record<string, string> = {};
            const next = { ...filters, [key]: value === ALL ? '' : value };
            if (next.region) params.region = next.region;
            if (next.program) params.program = next.program;
            router.get('/', params, {
                preserveState: true,
                preserveScroll: true,
            });
        },
        [filters],
    );

    const hasActiveFilter = Boolean(filters.region || filters.program);

    // Group programs into UniFAST (TES/TDP) and STuFAPs (everything else) for the dropdown.
    const { unifastPrograms, stufapsParents, stufapsChildrenByParent } =
        useMemo(() => {
            const unifastCodes = new Set(['TES', 'TDP']);
            const parents = programs.filter((p) => !p.parent_id);
            const children = programs.filter((p) => p.parent_id);

            const childrenByParent = new Map<string, FilterOption[]>();
            children.forEach((c) => {
                const list = childrenByParent.get(c.parent_id!) ?? [];
                list.push(c);
                childrenByParent.set(c.parent_id!, list);
            });

            return {
                unifastPrograms: parents.filter((p) =>
                    unifastCodes.has((p.code ?? '').toUpperCase()),
                ),
                stufapsParents: parents.filter(
                    (p) => !unifastCodes.has((p.code ?? '').toUpperCase()),
                ),
                stufapsChildrenByParent: childrenByParent,
            };
        }, [programs]);

    const clearFilters = useCallback(() => {
        router.get('/', {}, { preserveState: true, preserveScroll: true });
    }, []);

    const themeOptions = [
        { value: 'light' as const, icon: Sun, label: 'Light' },
        { value: 'dark' as const, icon: Moon, label: 'Dark' },
        { value: 'system' as const, icon: Monitor, label: 'System' },
    ];

    return (
        <>
            <Head title="Welcome">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600"
                    rel="stylesheet"
                />
            </Head>

            <style>{`
                @keyframes fadeSlideUp {
                    from { opacity: 0; transform: translateY(28px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeSlideLeft {
                    from { opacity: 0; transform: translateX(-24px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes shimmer {
                    0%   { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                @keyframes fadeSlideRight {
                    from { opacity: 0; transform: translateX(24px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                .anim-logos    { animation: fadeSlideLeft  1s   cubic-bezier(.25,.46,.45,.94) both; }
                .anim-region   { animation: fadeSlideUp    1s   cubic-bezier(.25,.46,.45,.94) 0.15s both; }
                .anim-title    { animation: fadeSlideUp    1.1s cubic-bezier(.25,.46,.45,.94) 0.3s  both; }
                .anim-subtitle { animation: fadeSlideUp    1.1s cubic-bezier(.25,.46,.45,.94) 0.5s  both; }
                .anim-line     { animation: fadeSlideUp    1s   cubic-bezier(.25,.46,.45,.94) 0.55s both; }
                .anim-desc     { animation: fadeSlideUp    1.1s cubic-bezier(.25,.46,.45,.94) 0.7s  both; }
                .anim-cta      { animation: fadeSlideUp    1.1s cubic-bezier(.25,.46,.45,.94) 0.9s  both; }
                .anim-nav      { animation: fadeIn         0.8s cubic-bezier(.25,.46,.45,.94) 0.3s  both; }
                .anim-boards   { animation: fadeSlideUp    1.2s cubic-bezier(.25,.46,.45,.94) 0.6s  both; }
                .shimmer-line {
                    background: linear-gradient(90deg, transparent 0%, currentColor 50%, transparent 100%);
                    background-size: 200% 100%;
                    animation: shimmer 3s ease-in-out infinite 2s;
                }
                /* Side-by-side hover expand: hovered panel grows, sibling shrinks naturally.
                   Scoped to screens where panels sit in a row (sm and up). */
                @media (min-width: 640px) {
                    .board-panel {
                        transition: flex-grow 500ms cubic-bezier(.25,.46,.45,.94);
                    }
                    .board-panels-row .board-panel:hover {
                        flex-grow: 2;
                    }
                }
            `}</style>

            <div className="relative flex min-h-screen flex-col overflow-hidden bg-background font-sans text-foreground transition-colors duration-300">
                {/* Theme toggle */}
                <div className="anim-nav absolute top-6 right-6 z-20 sm:right-10">
                    <div className="relative">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setThemeMenuOpen(!themeMenuOpen);
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground backdrop-blur-sm transition-all hover:border-foreground/30 hover:text-foreground"
                            title="Switch theme"
                        >
                            {appearance === 'light' && (
                                <Sun className="h-4 w-4" />
                            )}
                            {appearance === 'dark' && (
                                <Moon className="h-4 w-4" />
                            )}
                            {appearance === 'system' && (
                                <Monitor className="h-4 w-4" />
                            )}
                        </button>
                        {themeMenuOpen && (
                            <div
                                className="absolute top-11 right-0 z-50 w-36 rounded-lg border border-border bg-popover py-1 shadow-lg"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {themeOptions.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => {
                                            updateAppearance(opt.value);
                                            setThemeMenuOpen(false);
                                        }}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-popover-foreground transition-colors hover:bg-accent"
                                    >
                                        <opt.icon className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span>{opt.label}</span>
                                        {appearance === opt.value && (
                                            <Check className="ml-auto h-3.5 w-3.5 text-foreground" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Main: hero on top, boards below (shadcn-style stacked layout) ── */}
                <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center gap-6 px-6 pt-12 pb-6 sm:gap-8 sm:px-10 sm:pt-14 sm:pb-8 md:px-14 md:pt-16 xl:pt-10">
                    {/* Hero — centered above the boards */}
                    <div className="flex w-full max-w-2xl flex-col items-center space-y-4 text-center sm:space-y-5">
                        <div className="anim-logos flex items-center justify-center gap-2.5 sm:gap-3">
                            <img
                                src="/assets/img/ched-logo.png"
                                alt="CHED"
                                className="h-9 w-auto drop-shadow-sm sm:h-11 xl:h-12"
                            />
                            <img
                                src="/assets/img/unifast.png"
                                alt="UniFAST"
                                className="h-9 w-auto drop-shadow-sm sm:h-10 xl:h-11"
                            />
                            <img
                                src="/assets/img/bagong-pilipinas.png"
                                alt="Bagong Pilipinas"
                                className="h-9 w-auto drop-shadow-sm sm:h-11 xl:h-12"
                            />
                            <img
                                src="/assets/img/achieve.png"
                                alt="ACHIEVE"
                                className="h-11 w-auto pt-2 drop-shadow-sm sm:h-13 xl:h-16"
                            />
                        </div>

                        <div className="space-y-1">
                            <p className="anim-region text-[9px] font-semibold tracking-[0.35em] text-muted-foreground uppercase sm:text-[10px]">
                                CHED Region XII — SOCCSKSARGEN
                            </p>
                            <h1
                                className="anim-title text-3xl leading-none font-light tracking-[0.08em] text-foreground sm:text-4xl xl:text-[2.75rem]"
                                style={{
                                    fontFamily:
                                        '"Copperplate Gothic", "Copperplate", "Copperplate Gothic Bold", serif',
                                }}
                            >
                                Liquidation
                            </h1>
                            <p
                                className="anim-subtitle text-xl leading-tight font-normal tracking-[0.05em] text-foreground/60 italic sm:text-2xl xl:text-[1.75rem]"
                                style={{
                                    fontFamily:
                                        '"Canvas Sans", "Georgia", serif',
                                }}
                            >
                                Management System
                            </p>
                        </div>

                        <p className="anim-desc mx-auto max-w-sm text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
                            Public transparency dashboard tracking{' '}
                            <span className="font-medium text-foreground/80">
                                TES, TDP &amp; STuFAPs
                            </span>{' '}
                            fund liquidation across HEIs in Region&nbsp;XII.
                        </p>

                        <div className="anim-line">
                            <div className="shimmer-line mx-auto h-px w-20 text-border" />
                        </div>

                        <div className="anim-cta me-3 flex flex-col items-center gap-1.5">
                            <Link
                                href={auth.user ? dashboard() : login()}
                                className="group inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-[11px] font-bold text-background shadow-sm transition-all hover:bg-foreground/90 active:scale-[0.97] sm:px-6 sm:py-3 sm:text-xs"
                            >
                                <span className="tracking-[0.2em] uppercase">
                                    {auth.user
                                        ? 'Go to Dashboard'
                                        : 'Get Started'}
                                </span>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3 w-3 transition-transform group-hover:translate-x-1 sm:h-3.5 sm:w-3.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                                    />
                                </svg>
                            </Link>
                            <p className="text-[10px] text-muted-foreground/80 sm:text-[11px]">
                                {auth.user
                                    ? 'Continue to your dashboard.'
                                    : "Sign in to manage your institution's liquidations."}
                            </p>
                        </div>
                    </div>

                    {/* Boards — below hero, full width with max cap for ultra-wide screens */}
                    <div
                        className="anim-boards flex w-full min-w-0 flex-col gap-2"
                        style={{ height: 'min(480px, calc(100vh - 20rem))' }}
                    >
                        {/* Filters */}
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <Select
                                value={filters.region ?? ALL}
                                onValueChange={(v) =>
                                    onFilterChange('region', v)
                                }
                            >
                                <SelectTrigger className="h-7 w-auto min-w-[130px] gap-1 border-border/60 bg-background/70 text-[11px] shadow-none backdrop-blur-sm">
                                    <SelectValue placeholder="All Regions" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60 text-xs">
                                    <SelectItem value={ALL} className="text-xs">
                                        All Regions
                                    </SelectItem>
                                    {regions.map((r) => (
                                        <SelectItem
                                            key={r.id}
                                            value={r.id}
                                            className="text-xs"
                                        >
                                            {r.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={filters.program ?? ALL}
                                onValueChange={(v) =>
                                    onFilterChange('program', v)
                                }
                            >
                                <SelectTrigger className="h-7 w-auto min-w-[130px] gap-1 border-border/60 bg-background/70 text-[11px] shadow-none backdrop-blur-sm">
                                    <SelectValue placeholder="All Programs" />
                                </SelectTrigger>
                                <SelectContent className="max-h-72 text-xs">
                                    <SelectItem value={ALL} className="text-xs">
                                        All Programs
                                    </SelectItem>
                                    <SelectSeparator />
                                    <SelectGroup>
                                        <SelectLabel className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                            UniFAST
                                        </SelectLabel>
                                        <SelectItem
                                            value="unifast"
                                            className="text-xs"
                                        >
                                            All UniFAST
                                        </SelectItem>
                                        {unifastPrograms.map((p) => (
                                            <SelectItem
                                                key={p.id}
                                                value={p.id}
                                                className="pl-6 text-xs"
                                            >
                                                {p.code}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                    <SelectSeparator />
                                    <SelectGroup>
                                        <SelectLabel className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                            STuFAPs
                                        </SelectLabel>
                                        <SelectItem
                                            value="stufaps"
                                            className="text-xs"
                                        >
                                            All STuFAPs
                                        </SelectItem>
                                        {stufapsParents.map((parent) => {
                                            const children =
                                                stufapsChildrenByParent.get(
                                                    parent.id,
                                                ) ?? [];
                                            if (children.length > 0) {
                                                return (
                                                    <Fragment key={parent.id}>
                                                        <SelectItem
                                                            value={parent.id}
                                                            className="pl-6 text-xs font-medium"
                                                        >
                                                            {parent.code}
                                                        </SelectItem>
                                                        {children.map(
                                                            (child) => (
                                                                <SelectItem
                                                                    key={
                                                                        child.id
                                                                    }
                                                                    value={
                                                                        child.id
                                                                    }
                                                                    className="pl-10 text-[11px]"
                                                                >
                                                                    {child.code}
                                                                </SelectItem>
                                                            ),
                                                        )}
                                                    </Fragment>
                                                );
                                            }
                                            return (
                                                <SelectItem
                                                    key={parent.id}
                                                    value={parent.id}
                                                    className="pl-6 text-xs"
                                                >
                                                    {parent.code}
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            {hasActiveFilter && (
                                <button
                                    onClick={clearFilters}
                                    className="text-[10px] text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
                                >
                                    Clear
                                </button>
                            )}

                            {/* Data-freshness indicator — right-aligned on wide screens, wraps under filters on mobile */}
                            <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <span className="relative inline-flex h-1.5 w-1.5">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                </span>
                                <span>
                                    Live data &middot; as of{' '}
                                    {new Date().toLocaleDateString(undefined, {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                    })}
                                </span>
                            </div>
                        </div>

                        {/* Panels — stack on mobile, side-by-side with hover-expand on sm+ */}
                        <div className="board-panels-row flex min-h-0 flex-1 flex-col gap-3 sm:flex-row">
                            <BoardPanel
                                title="Honor Roll — Fully Liquidated"
                                items={honorBoard}
                                variant="honor"
                                emptyLabel="No HEIs have reached 100% liquidation yet."
                            />
                            <BoardPanel
                                title="For Action — Unliquidated"
                                items={shameBoard}
                                variant="shame"
                                emptyLabel="All HEIs are fully compliant!"
                            />
                        </div>
                    </div>
                </main>

                <footer className="relative z-10 w-full px-6 py-6 text-center text-xs font-medium text-muted-foreground/50 sm:py-8 sm:text-sm">
                    &copy; {new Date().getFullYear()} Commission on Higher
                    Education
                </footer>
            </div>
        </>
    );
}
