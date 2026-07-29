import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import {
    AlertTriangle,
    CheckCircle2,
    Search,
    TrendingDown,
    Trophy,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Honor Roll / For Action board.
 *
 * Moved out of welcome.tsx during the hero redesign. The scroll, search and
 * measurement logic below is carried over unchanged — only presentation was
 * restyled, plus one behavioural addition: auto-scroll now yields to
 * prefers-reduced-motion.
 */

export interface HEIBoardItem {
    hei_id: string;
    hei_name: string;
    hei_uii: string;
    region_name?: string;
    total_disbursements: number;
    total_liquidated: number;
    pct_liquidation: number;
    liquidation_count: number;
}

const ROW_HEIGHT_EST = 44;
const AUTO_SCROLL_SPEED = 18;

export function LiquidationStatusPanel({
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
    const prefersReducedMotion = usePrefersReducedMotion();
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
    const shouldAutoScroll =
        overflows &&
        !isSearching &&
        filtered.length > 0 &&
        !prefersReducedMotion;
    // `copies` is derived entirely from `shouldAutoScroll`, which the scroll
    // effect below already depends on — so the effect can close over it directly.
    // The ref this replaced was written during render, which React's lint rules
    // reject and which would go stale against a concurrent re-render anyway.
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
        ? 'border-emerald-200/60 dark:border-emerald-700/30 bg-white/65 dark:bg-emerald-950/30'
        : 'border-rose-200/60 dark:border-red-700/30 bg-white/65 dark:bg-red-950/30';
    const headerBorderCls = isHonor
        ? 'border-emerald-200/60 dark:border-emerald-700/30'
        : 'border-rose-200/60 dark:border-red-700/30';
    const headerTintCls = isHonor
        ? 'bg-emerald-50/60 dark:bg-transparent'
        : 'bg-rose-50/60 dark:bg-transparent';
    const iconCls = isHonor
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-rose-500 dark:text-red-400';
    const titleCls = isHonor
        ? 'text-emerald-900 dark:text-emerald-300'
        : 'text-rose-900 dark:text-red-300';
    const countCls = isHonor
        ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-rose-600 dark:text-red-400';
    const rowBorderCls = isHonor
        ? 'border-b border-emerald-100/70 dark:border-emerald-800/30'
        : 'border-b border-rose-100/70 dark:border-red-800/30';
    const rowHoverCls = isHonor
        ? 'hover:bg-emerald-50/70 dark:hover:bg-emerald-900/20'
        : 'hover:bg-rose-50/70 dark:hover:bg-red-900/20';
    const pctCls = isHonor
        ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-rose-600 dark:text-red-400';
    const fadeFrom = isHonor
        ? 'from-white dark:from-[#022c2299]'
        : 'from-white dark:from-[#450a0a99]';
    const searchBorderCls = isHonor
        ? 'border-emerald-200/70 dark:border-emerald-700/40 focus:border-emerald-400 dark:focus:border-emerald-600 focus-visible:ring-emerald-400/40'
        : 'border-rose-200/70 dark:border-red-700/40 focus:border-rose-400 dark:focus:border-red-600 focus-visible:ring-rose-400/40';

    const RowIcon = isHonor ? CheckCircle2 : TrendingDown;
    const EmptyIcon = isHonor ? Trophy : AlertTriangle;

    return (
        <section
            aria-label={title}
            className={`board-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border shadow-sm ring-1 ring-black/[0.03] backdrop-blur-md dark:ring-0 ${panelCls}`}
        >
            {/* Header */}
            <div
                className={`shrink-0 space-y-2 border-b px-4 py-3 ${headerBorderCls} ${headerTintCls}`}
            >
                <div className="flex items-center gap-2">
                    {isHonor ? (
                        <Trophy className={`h-4 w-4 shrink-0 ${iconCls}`} />
                    ) : (
                        <AlertTriangle
                            className={`h-4 w-4 shrink-0 ${iconCls}`}
                        />
                    )}
                    <h2
                        className={`text-xs font-semibold tracking-wide ${titleCls}`}
                    >
                        {title}
                    </h2>
                    <span
                        className={`ml-auto text-[11px] font-medium tabular-nums ${countCls}`}
                    >
                        {filtered.length}{' '}
                        {filtered.length === 1 ? 'HEI' : 'HEIs'}
                    </span>
                </div>
                <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        aria-label={`Search ${title} by HEI name or UII`}
                        placeholder="Search HEI name or UII..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={`w-full rounded-lg border bg-white/80 py-1.5 pr-2.5 pl-8 text-[11px] transition-colors placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 dark:bg-black/20 ${searchBorderCls}`}
                    />
                </div>
            </div>

            {/* Body */}
            {filtered.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                    <EmptyIcon className="h-6 w-6 opacity-20" />
                    <p className="px-6 text-center text-[11px]">
                        {isSearching ? 'No matching HEIs found.' : emptyLabel}
                    </p>
                </div>
            ) : (
                <div className="relative min-h-0 flex-1">
                    {shouldAutoScroll && (
                        <>
                            <div
                                className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b ${fadeFrom} to-transparent`}
                            />
                            <div
                                className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 bg-gradient-to-t ${fadeFrom} to-transparent`}
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
                                className={`flex items-center gap-2.5 px-4 py-2.5 transition-colors ${rowBorderCls} ${rowHoverCls}`}
                            >
                                <RowIcon
                                    className={`h-3.5 w-3.5 shrink-0 ${iconCls}`}
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-[11px] leading-tight font-medium">
                                        {item.hei_name}
                                    </div>
                                    {item.hei_uii && (
                                        <div className="font-mono text-[10px] leading-tight text-muted-foreground">
                                            {item.hei_uii}
                                        </div>
                                    )}
                                </div>
                                <span
                                    className={`shrink-0 font-mono text-[11px] font-bold tabular-nums ${pctCls}`}
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
        </section>
    );
}
