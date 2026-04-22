import { dashboard, login } from '@/routes';
import { type SharedData } from '@/types';
import { useAppearance } from '@/hooks/use-appearance';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle, Check, CheckCircle2, Filter, Monitor, Moon,
    Search, Sun, TrendingDown, Trophy,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import {
    Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select';

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
            r => r.hei_name.toLowerCase().includes(q) || r.hei_uii?.toLowerCase().includes(q),
        );
    }, [items, search]);

    const isSearching = search.trim().length > 0;

    // Only auto-scroll when items genuinely overflow the visible area
    const overflows = containerH > 0 && filtered.length * ROW_HEIGHT_EST > containerH;
    const shouldAutoScroll = overflows && !isSearching && filtered.length > 0;
    const copies = shouldAutoScroll ? 2 : 1;
    const copiesRef = useRef(copies);
    copiesRef.current = copies;

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
            if (last === 0) { last = now; }
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;
            accum += AUTO_SCROLL_SPEED * dt;
            el.scrollTop = accum;

            if (copiesRef.current > 1) {
                const half = el.scrollHeight / copiesRef.current;
                if (half > 0 && accum >= half) {
                    accum -= half;
                    el.scrollTop = accum;
                }
            }
            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [hovered, shouldAutoScroll, items]);

    // ── Styles ──

    const panelCls = isHonor
        ? 'border-emerald-200/70 dark:border-emerald-700/30 bg-emerald-50/70 dark:bg-emerald-950/30'
        : 'border-red-200/70 dark:border-red-700/30 bg-red-50/70 dark:bg-red-950/30';
    const headerBorderCls = isHonor
        ? 'border-emerald-200/70 dark:border-emerald-700/30'
        : 'border-red-200/70 dark:border-red-700/30';
    const iconCls  = isHonor ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';
    const titleCls = isHonor ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300';
    const countCls = isHonor ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';
    const rowBorderCls = isHonor
        ? 'border-b border-emerald-100/70 dark:border-emerald-800/30'
        : 'border-b border-red-100/70 dark:border-red-800/30';
    const pctCls = isHonor ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
    const fadeFrom = isHonor
        ? 'from-[#ecfdf5b3] dark:from-[#022c2299]'
        : 'from-[#fef2f2b3] dark:from-[#450a0a99]';
    const searchBorderCls = isHonor
        ? 'border-emerald-200/60 dark:border-emerald-700/40 focus:border-emerald-400 dark:focus:border-emerald-600'
        : 'border-red-200/60 dark:border-red-700/40 focus:border-red-400 dark:focus:border-red-600';

    const RowIcon   = isHonor ? CheckCircle2 : TrendingDown;
    const EmptyIcon = isHonor ? Trophy : AlertTriangle;

    return (
        <div className={`board-panel flex-1 flex flex-col rounded-xl border overflow-hidden backdrop-blur-sm min-h-0 min-w-0 ${panelCls}`}>
            {/* Header */}
            <div className={`px-3 py-2 border-b shrink-0 space-y-1.5 ${headerBorderCls}`}>
                <div className="flex items-center gap-2">
                    {isHonor
                        ? <Trophy className={`h-3.5 w-3.5 shrink-0 ${iconCls}`} />
                        : <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${iconCls}`} />}
                    <span className={`text-[11px] font-semibold tracking-wide ${titleCls}`}>{title}</span>
                    <span className={`ml-auto text-[10px] font-medium tabular-nums ${countCls}`}>
                        {filtered.length} {filtered.length === 1 ? 'HEI' : 'HEIs'}
                    </span>
                </div>
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        placeholder="SEARCH HEI name or UII..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className={`w-full pl-7 pr-2 py-1 text-[11px] rounded-md border bg-white/60 dark:bg-black/20 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 transition-colors ${searchBorderCls}`}
                    />
                </div>
            </div>

            {/* Body */}
            {filtered.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground py-6">
                    <EmptyIcon className="h-5 w-5 opacity-20" />
                    <p className="text-[10px] text-center px-4">
                        {isSearching ? 'No matching HEIs found.' : emptyLabel}
                    </p>
                </div>
            ) : (
                <div className="relative flex-1 min-h-0">
                    {shouldAutoScroll && (
                        <>
                            <div className={`absolute top-0 inset-x-0 h-4 bg-gradient-to-b ${fadeFrom} to-transparent z-10 pointer-events-none`} />
                            <div className={`absolute bottom-0 inset-x-0 h-4 bg-gradient-to-t ${fadeFrom} to-transparent z-10 pointer-events-none`} />
                        </>
                    )}
                    <div
                        ref={setScrollEl}
                        className="h-full overflow-y-auto"
                        onMouseEnter={() => setHovered(true)}
                        onMouseLeave={() => setHovered(false)}
                        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(120,120,120,0.25) transparent' }}
                    >
                        {displayItems.map((item, i) => (
                            <div key={`${item.hei_id}-${i}`} className={`flex items-center gap-2 px-3 py-2 ${rowBorderCls}`}>
                                <RowIcon className={`h-3 w-3 shrink-0 ${iconCls}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-[11px] font-medium leading-tight truncate">{item.hei_name}</div>
                                    {item.hei_uii && (
                                        <div className="text-[9px] text-muted-foreground font-mono leading-tight">{item.hei_uii}</div>
                                    )}
                                </div>
                                <span className={`text-[10px] font-bold font-mono shrink-0 ${pctCls}`}>
                                    {isHonor ? '100%' : `${Number(item.pct_liquidation).toFixed(1)}%`}
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
    const [init, setInit] = useState(false);
    const [themeMenuOpen, setThemeMenuOpen] = useState(false);

    useEffect(() => {
        initParticlesEngine(async (engine) => {
            await loadSlim(engine);
        }).then(() => setInit(true));
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
            router.get('/', params, { preserveState: true, preserveScroll: true });
        },
        [filters],
    );

    const hasActiveFilter = Boolean(filters.region || filters.program);

    // Group programs into UniFAST (TES/TDP) and STuFAPs (everything else) for the dropdown.
    const { unifastPrograms, stufapsParents, stufapsChildrenByParent } = useMemo(() => {
        const unifastCodes = new Set(['TES', 'TDP']);
        const parents = programs.filter(p => !p.parent_id);
        const children = programs.filter(p => p.parent_id);

        const childrenByParent = new Map<string, FilterOption[]>();
        children.forEach(c => {
            const list = childrenByParent.get(c.parent_id!) ?? [];
            list.push(c);
            childrenByParent.set(c.parent_id!, list);
        });

        return {
            unifastPrograms: parents.filter(p => unifastCodes.has((p.code ?? '').toUpperCase())),
            stufapsParents: parents.filter(p => !unifastCodes.has((p.code ?? '').toUpperCase())),
            stufapsChildrenByParent: childrenByParent,
        };
    }, [programs]);

    const clearFilters = useCallback(() => {
        router.get('/', {}, { preserveState: true, preserveScroll: true });
    }, []);

    // ── Particles ──

    const particlesOptions = useMemo(
        () => ({
            background: { color: { value: 'transparent' } },
            fpsLimit: 120,
            interactivity: {
                events: {
                    onClick: { enable: true, mode: 'push' as const },
                    onHover: { enable: true, mode: 'repulse' as const },
                },
                modes: { push: { quantity: 4 }, repulse: { distance: 80, duration: 0.4 } },
            },
            particles: {
                color: { value: appearance === 'dark' ? '#555555' : '#c0c0c0' },
                links: { color: appearance === 'dark' ? '#444444' : '#d0d0d0', distance: 140, enable: true, opacity: 0.4, width: 1 },
                move: { enable: true, speed: 1, direction: 'none' as const, outModes: { default: 'bounce' as const }, random: true, straight: false },
                number: { density: { enable: true }, value: 50 },
                opacity: { value: 0.5, animation: { enable: true, speed: 0.8, minimumValue: 0.2 } },
                shape: { type: 'circle' },
                size: { value: { min: 1, max: 3 }, animation: { enable: true, speed: 2, minimumValue: 0.5 } },
            },
            detectRetina: true,
        }),
        [appearance],
    );

    const themeOptions = [
        { value: 'light' as const, icon: Sun, label: 'Light' },
        { value: 'dark' as const, icon: Moon, label: 'Dark' },
        { value: 'system' as const, icon: Monitor, label: 'System' },
    ];

    return (
        <>
            <Head title="Welcome">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600" rel="stylesheet" />
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

            <div className="relative flex min-h-screen flex-col bg-background text-foreground overflow-hidden font-sans transition-colors duration-300">
                {init && (
                    <Particles id="tsparticles" key={appearance} options={particlesOptions} className="absolute inset-0 z-0 pointer-events-none" />
                )}

                {/* Theme toggle */}
                <div className="anim-nav absolute top-6 right-6 sm:right-10 z-20">
                    <div className="relative">
                        <button
                            onClick={e => { e.stopPropagation(); setThemeMenuOpen(!themeMenuOpen); }}
                            className="flex items-center justify-center h-9 w-9 rounded-full border border-border bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                            title="Switch theme"
                        >
                            {appearance === 'light' && <Sun className="h-4 w-4" />}
                            {appearance === 'dark' && <Moon className="h-4 w-4" />}
                            {appearance === 'system' && <Monitor className="h-4 w-4" />}
                        </button>
                        {themeMenuOpen && (
                            <div className="absolute right-0 top-11 w-36 rounded-lg border border-border bg-popover shadow-lg py-1 z-50" onClick={e => e.stopPropagation()}>
                                {themeOptions.map(opt => (
                                    <button key={opt.value} onClick={() => { updateAppearance(opt.value); setThemeMenuOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-popover-foreground hover:bg-accent transition-colors">
                                        <opt.icon className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span>{opt.label}</span>
                                        {appearance === opt.value && <Check className="ml-auto h-3.5 w-3.5 text-foreground" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Main: hero on top, boards below (shadcn-style stacked layout) ── */}
                <main className="relative z-10 flex flex-1 flex-col items-center w-full max-w-7xl mx-auto px-6 sm:px-10 md:px-14 pt-24 sm:pt-24 md:pt-24 xl:pt-16 pb-12 sm:pb-14 gap-10 sm:gap-12">

                    {/* Hero — centered above the boards */}
                    <div className="w-full max-w-2xl flex flex-col items-center text-center space-y-5 sm:space-y-6">

                        <div className="anim-logos flex items-center justify-center gap-2.5 sm:gap-3">
                            <img src="/assets/img/ched-logo.png"        alt="CHED"            className="h-9 sm:h-11 xl:h-12 w-auto drop-shadow-sm" />
                            <img src="/assets/img/unifast.png"          alt="UniFAST"         className="h-9 sm:h-10 xl:h-11 w-auto drop-shadow-sm" />
                            <img src="/assets/img/bagong-pilipinas.png" alt="Bagong Pilipinas" className="h-9 sm:h-11 xl:h-12 w-auto drop-shadow-sm" />
                            <img src="/assets/img/achieve.png"          alt="ACHIEVE"          className="h-11 sm:h-13 xl:h-16 w-auto drop-shadow-sm pt-2" />
                        </div>

                        <div className="space-y-1">
                            <p className="anim-region text-[9px] sm:text-[10px] font-semibold tracking-[0.35em] uppercase text-muted-foreground">
                                CHED Region XII — SOCCSKSARGEN
                            </p>
                            <h1
                                className="anim-title text-3xl sm:text-4xl xl:text-[2.75rem] font-light tracking-[0.08em] leading-none text-foreground"
                                style={{ fontFamily: '"Copperplate Gothic", "Copperplate", "Copperplate Gothic Bold", serif' }}
                            >
                                Liquidation
                            </h1>
                            <p
                                className="anim-subtitle text-xl sm:text-2xl xl:text-[1.75rem] font-normal italic tracking-[0.05em] leading-tight text-foreground/60"
                                style={{ fontFamily: '"Canvas Sans", "Georgia", serif' }}
                            >
                                Management System
                            </p>
                        </div>

                        <div className="anim-line">
                            <div className="h-px w-20 shimmer-line text-border mx-auto" />
                        </div>

                        <div className="anim-cta me-3">
                            <Link
                                href={auth.user ? dashboard() : login()}
                                className="group inline-flex items-center gap-2 rounded-lg bg-foreground px-5 sm:px-6 py-2.5 sm:py-3 text-[11px] sm:text-xs font-bold text-background shadow-sm transition-all hover:bg-foreground/90 active:scale-[0.97]"
                            >
                                <span className="tracking-[0.2em] uppercase">
                                    {auth.user ? 'Go to Dashboard' : 'Get Started'}
                                </span>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 sm:h-3.5 w-3 sm:w-3.5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </Link>
                        </div>
                    </div>

                    {/* Boards — below hero, full width with max cap for ultra-wide screens */}
                    <div
                        className="anim-boards flex flex-col gap-2 w-full min-w-0"
                        style={{ height: 'min(480px, calc(100vh - 20rem))' }}
                    >
                        {/* Filters */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <Select
                                value={filters.region ?? ALL}
                                onValueChange={v => onFilterChange('region', v)}
                            >
                                <SelectTrigger className="h-7 w-auto min-w-[130px] text-[11px] gap-1 border-border/60 bg-background/70 backdrop-blur-sm shadow-none">
                                    <SelectValue placeholder="All Regions" />
                                </SelectTrigger>
                                <SelectContent className="text-xs max-h-60">
                                    <SelectItem value={ALL} className="text-xs">All Regions</SelectItem>
                                    {regions.map(r => (
                                        <SelectItem key={r.id} value={r.id} className="text-xs">{r.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={filters.program ?? ALL}
                                onValueChange={v => onFilterChange('program', v)}
                            >
                                <SelectTrigger className="h-7 w-auto min-w-[130px] text-[11px] gap-1 border-border/60 bg-background/70 backdrop-blur-sm shadow-none">
                                    <SelectValue placeholder="All Programs" />
                                </SelectTrigger>
                                <SelectContent className="text-xs max-h-72">
                                    <SelectItem value={ALL} className="text-xs">All Programs</SelectItem>
                                    <SelectSeparator />
                                    <SelectGroup>
                                        <SelectLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">UniFAST</SelectLabel>
                                        <SelectItem value="unifast" className="text-xs">All UniFAST</SelectItem>
                                        {unifastPrograms.map(p => (
                                            <SelectItem key={p.id} value={p.id} className="text-xs pl-6">{p.code}</SelectItem>
                                        ))}
                                    </SelectGroup>
                                    <SelectSeparator />
                                    <SelectGroup>
                                        <SelectLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">STuFAPs</SelectLabel>
                                        <SelectItem value="stufaps" className="text-xs">All STuFAPs</SelectItem>
                                        {stufapsParents.map(parent => {
                                            const children = stufapsChildrenByParent.get(parent.id) ?? [];
                                            if (children.length > 0) {
                                                return (
                                                    <Fragment key={parent.id}>
                                                        <SelectItem value={parent.id} className="text-xs pl-6 font-medium">{parent.code}</SelectItem>
                                                        {children.map(child => (
                                                            <SelectItem key={child.id} value={child.id} className="text-[11px] pl-10">{child.code}</SelectItem>
                                                        ))}
                                                    </Fragment>
                                                );
                                            }
                                            return <SelectItem key={parent.id} value={parent.id} className="text-xs pl-6">{parent.code}</SelectItem>;
                                        })}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            {hasActiveFilter && (
                                <button onClick={clearFilters} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
                                    Clear
                                </button>
                            )}
                        </div>

                        {/* Panels — stack on mobile, side-by-side with hover-expand on sm+ */}
                        <div className="board-panels-row flex flex-col sm:flex-row gap-3 flex-1 min-h-0">
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

                <footer className="relative z-10 w-full py-6 sm:py-8 px-6 text-center text-xs sm:text-sm font-medium text-muted-foreground/50">
                    &copy; {new Date().getFullYear()} Commission on Higher Education
                </footer>
            </div>
        </>
    );
}
