import { HeroBackdrop } from '@/components/landing/hero-backdrop';
import { HeroContent } from '@/components/landing/hero-content';
import {
    LiquidationStatusPanel,
    type HEIBoardItem,
} from '@/components/landing/liquidation-status-panel';
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
import { type SharedData } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Check, Filter, Monitor, Moon, Sun } from 'lucide-react';
import {
    Fragment,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

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

const PAGE_DESCRIPTION =
    'Public transparency dashboard tracking TES, TDP and STuFAPs fund liquidation across higher education institutions in CHED Region XII — SOCCSKSARGEN.';

// ─── Welcome Page ─────────────────────────────────────────────────────────────

export default function Welcome({
    honorBoard = [],
    shameBoard = [],
    regions = [],
    programs = [],
    filters = {},
}: Props) {
    const { auth } = usePage<SharedData>().props;
    const { appearance, resolvedAppearance, updateAppearance } =
        useAppearance();
    const [themeMenuOpen, setThemeMenuOpen] = useState(false);
    const themeButtonRef = useRef<HTMLButtonElement | null>(null);

    const isDark = resolvedAppearance === 'dark';

    // Always land on the hero on (re)load. Modern browsers preserve scroll
    // position on F5; for a single-screen landing page we want a fresh top.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }
        window.scrollTo(0, 0);
    }, []);

    // Click-outside and Escape both dismiss. Escape was missing: a keyboard user
    // who opened the menu could only close it by tabbing through every item.
    useEffect(() => {
        if (!themeMenuOpen) return;
        const close = () => setThemeMenuOpen(false);
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setThemeMenuOpen(false);
                themeButtonRef.current?.focus();
            }
        };
        document.addEventListener('click', close);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('click', close);
            document.removeEventListener('keydown', onKeyDown);
        };
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
            {/* "Welcome" was the browser-tab label and the search-result title
                for a public transparency site. It should say what the site is. */}
            <Head title="Liquidation Management System">
                <meta name="description" content={PAGE_DESCRIPTION} />
                <meta
                    property="og:title"
                    content="CHED Region XII — Liquidation Management System"
                />
                <meta property="og:description" content={PAGE_DESCRIPTION} />
                <meta property="og:type" content="website" />
                <meta name="twitter:card" content="summary" />
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    rel="preconnect"
                    href="https://fonts.bunny.net"
                    crossOrigin=""
                />
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
                /* Boards sizing.
                   Mobile stacks the two panels vertically, so a single fixed
                   height has to be split between them and each list ends up a
                   few rows tall. Below sm the stack is left to grow and each
                   panel gets a floor instead.
                   From sm up the panels sit side by side and a bounded height
                   keeps the page to one screen. clamp() rather than min(): the
                   old min(480px, 100vh - 20rem) goes to zero (and below) on a
                   short window, collapsing the boards entirely. */
                .board-stack { height: auto; }
                .board-stack .board-panel { min-height: 17.5rem; }

                @media (min-width: 640px) {
                    .board-stack {
                        height: clamp(20rem, calc(100vh - 20rem), 30rem);
                    }
                    .board-stack .board-panel {
                        min-height: 0;
                        /* Hover expand: hovered panel grows, sibling shrinks. */
                        transition: flex-grow 500ms cubic-bezier(.25,.46,.45,.94);
                    }
                    .board-panels-row .board-panel:hover {
                        flex-grow: 2;
                    }
                }

                /* Someone who asked for less motion still gets the full page —
                   entrance animations resolve to their final state rather than
                   being skipped, so nothing is left invisible. */
                @media (prefers-reduced-motion: reduce) {
                    .anim-logos, .anim-region, .anim-title, .anim-subtitle,
                    .anim-line, .anim-desc, .anim-cta, .anim-nav, .anim-boards {
                        animation: none !important;
                        opacity: 1;
                        transform: none;
                    }
                    .shimmer-line {
                        animation: none;
                        background: currentColor;
                        opacity: 0.35;
                    }
                    /* Matches the specificity of the sm+ rule above, which would
                       otherwise reinstate the transition. */
                    .board-stack .board-panel { transition: none; }
                    /* The live-data pulse is decorative and loops forever. */
                    .animate-ping { animation: none; }
                }
            `}</style>

            <div className="relative flex min-h-screen flex-col overflow-hidden bg-background font-sans text-foreground transition-colors duration-300">
                {/* All decorative layers: artwork, wash, horizon, network, glyphs. */}
                <HeroBackdrop isDark={isDark} />

                {/* Theme toggle */}
                <div className="anim-nav absolute top-6 right-6 z-20 sm:right-10">
                    <div className="relative">
                        <button
                            ref={themeButtonRef}
                            onClick={(e) => {
                                e.stopPropagation();
                                setThemeMenuOpen(!themeMenuOpen);
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground backdrop-blur-sm transition-all hover:border-foreground/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
                            aria-label={`Switch theme (currently ${appearance})`}
                            aria-haspopup="menu"
                            aria-expanded={themeMenuOpen}
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
                                role="menu"
                                aria-label="Theme"
                                className="absolute top-11 right-0 z-50 w-36 rounded-lg border border-border bg-popover py-1 shadow-lg"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {themeOptions.map((opt) => (
                                    <button
                                        key={opt.value}
                                        role="menuitemradio"
                                        aria-checked={appearance === opt.value}
                                        onClick={() => {
                                            updateAppearance(opt.value);
                                            setThemeMenuOpen(false);
                                            themeButtonRef.current?.focus();
                                        }}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-popover-foreground transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
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
                    {/* Hero — centred above the boards */}
                    <HeroContent isAuthenticated={Boolean(auth.user)} />

                    {/* Boards — below hero, full width with max cap for ultra-wide screens */}
                    <div className="anim-boards board-stack flex w-full min-w-0 flex-col gap-2">
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
                            <LiquidationStatusPanel
                                title="Honor Roll — Fully Liquidated"
                                items={honorBoard}
                                variant="honor"
                                emptyLabel="No HEIs have reached 100% liquidation yet."
                            />
                            <LiquidationStatusPanel
                                title="For Action — Unliquidated"
                                items={shameBoard}
                                variant="shame"
                                emptyLabel="All HEIs are fully compliant!"
                            />
                        </div>
                    </div>
                </main>

                {/* /50 on an already-muted token lands under 4.5:1 on both
                    themes; /75 keeps the recessive feel and stays legible. */}
                <footer className="relative z-10 w-full px-6 py-6 text-center text-xs font-medium text-muted-foreground/75 sm:py-8 sm:text-sm">
                    &copy; {new Date().getFullYear()} Commission on Higher
                    Education
                </footer>
            </div>
        </>
    );
}
