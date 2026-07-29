import { useIsMobile } from '@/hooks/use-mobile';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { useEffect, useRef } from 'react';
import { FlowingLines } from './flowing-lines';

/**
 * The page backdrop: a wash, one flowing line field, and the light shaping on
 * top of it.
 *
 * Deliberately few layers. An earlier pass stacked five decorative systems here
 * — photo illustration, horizon silhouette, node network, floating icons, wash —
 * and the result was muddy: each layer competed with the others and with the
 * heading. One well-executed idea is what reads as premium.
 *
 * The layers above the ribbon are shaping, not decoration. A vignette pulls the
 * eye inward and keeps the brightest part of the field off the page edges; a
 * scrim sits only under the hero column so the type has contrast without
 * flattening the artwork everywhere; grain breaks up banding in the large
 * gradients, which is most of the difference between "gradient" and "finished".
 *
 * ── Tuning ───────────────────────────────────────────────────────────────────
 * Line behaviour lives in flowing-lines.tsx. Parallax travel is
 * PARALLAX_STRENGTH below. The wash is the gradient stops on layer 1.
 */

/** Max px the line field shifts at full pointer deflection. */
const PARALLAX_STRENGTH = 12;

/**
 * Fractal-noise tile as a data URI — no network request, no image asset to keep
 * in sync. Blended at a few percent it is invisible as texture but kills the
 * stepped bands an 8-bit display produces across a full-viewport gradient.
 */
const GRAIN =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function HeroBackdrop({
    isDark,
    /**
     * Where the readability scrim centres, as a vertical percentage. It exists to
     * back the page's primary content block, so it has to move when that block
     * does: the landing hero sits near the top, the login card is centred.
     */
    scrimY = '25%',
    /**
     * Scales the scrim down for pages whose content already carries its own
     * background. A login card supplies its own contrast, so a full-strength
     * scrim behind it only flattens the artwork around it.
     */
    scrimOpacity = 1,
}: {
    isDark: boolean;
    scrimY?: string;
    scrimOpacity?: number;
}) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const isMobile = useIsMobile();
    const prefersReducedMotion = usePrefersReducedMotion();

    const parallaxEnabled = !isMobile && !prefersReducedMotion;

    useEffect(() => {
        const el = rootRef.current;
        if (!el || !parallaxEnabled) return;

        let raf = 0;
        let x = 0;
        let y = 0;

        const apply = () => {
            raf = 0;
            el.style.setProperty('--parallax-x', `${x}px`);
            el.style.setProperty('--parallax-y', `${y}px`);
        };

        const onPointerMove = (event: PointerEvent) => {
            // Inverted so the field drifts against the cursor — that's what reads
            // as depth. Written to CSS custom properties rather than React state:
            // a setState here would re-render the hero on every mouse event.
            x =
                -((event.clientX / window.innerWidth) * 2 - 1) *
                PARALLAX_STRENGTH;
            y =
                -((event.clientY / window.innerHeight) * 2 - 1) *
                PARALLAX_STRENGTH;
            if (!raf) raf = requestAnimationFrame(apply);
        };

        window.addEventListener('pointermove', onPointerMove, {
            passive: true,
        });

        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            if (raf) cancelAnimationFrame(raf);
            el.style.removeProperty('--parallax-x');
            el.style.removeProperty('--parallax-y');
        };
    }, [parallaxEnabled]);

    return (
        <div
            ref={rootRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
            style={{
                ['--parallax-x' as string]: '0px',
                ['--parallax-y' as string]: '0px',
                ['--scrim-y' as string]: scrimY,
            }}
        >
            {/* 1 — Wash. Cool tint low on the page for the ribbon to sit in,
                   resolving to plain white (or plain dark) behind the hero. */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_8%,rgba(254,215,170,0.7),transparent_34%),linear-gradient(145deg,#ffffff_0%,#fdfaf7_58%,#fff4e8_100%)] dark:hidden" />
            {/* Deep navy, and it has to stay deep. The bands composite
                additively, so this ground is a floor under every strand: at a
                mid navy its blue channel survives into the warm strands and
                pulls them to a peachy tan (~0.39 saturation), while at this
                depth they hold as orange (~0.63). It still reads as navy — the
                hue is blue, it is simply dark. The 52% mid-stop is the value
                that governs it; darken that first if the orange looks washed.

                The radial is warm on purpose: it puts a source of light in the
                composition, which is what keeps a flat ground from reading as
                a black rectangle. */}
            <div className="absolute inset-0 hidden bg-[radial-gradient(circle_at_72%_6%,rgba(190,95,30,0.18),transparent_38%),linear-gradient(150deg,#060a18_0%,#0b1026_52%,#050814_100%)] dark:block" />

            {/* 2 — The ribbon. Scaled slightly so parallax translation never
                   exposes an edge. */}
            <div className="parallax-layer absolute inset-0">
                <FlowingLines isDark={isDark} />
            </div>

            {/* 3 — Vignette. Darkens (light: cools) the edges so the field's
                   brightest passages read as interior light rather than as
                   artwork running off the page. */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_86%_at_50%_32%,transparent_42%,rgba(170,150,125,0.18)_100%)] dark:bg-[radial-gradient(ellipse_125%_92%_at_50%_34%,transparent_48%,rgba(2,4,14,0.44)_100%)]" />

            {/* 4 — Readability scrim, sized and placed to sit under the hero
                   column only. The previous pass used a viewport-wide blur that
                   also fell across the largest ribbon and desaturated it; the
                   type needs contrast in one place, not everywhere. */}
            <div
                className="absolute inset-0 bg-[radial-gradient(ellipse_44%_32%_at_50%_var(--scrim-y),rgba(255,255,255,0.82),transparent_72%)] dark:bg-[radial-gradient(ellipse_46%_34%_at_50%_var(--scrim-y),rgba(7,11,26,0.62),transparent_72%)]"
                style={{ opacity: scrimOpacity }}
            />

            {/* 5 — Grain. */}
            <div
                className="absolute inset-0 opacity-[0.035] mix-blend-overlay dark:opacity-[0.05]"
                style={{ backgroundImage: GRAIN }}
            />

            <style>{`
                .parallax-layer {
                    transform: translate3d(var(--parallax-x), var(--parallax-y), 0) scale(1.06);
                    transition: transform 500ms cubic-bezier(.22,.61,.36,1);
                    will-change: transform;
                }

                @media (prefers-reduced-motion: reduce) {
                    .parallax-layer {
                        transform: scale(1.06);
                        transition: none;
                        will-change: auto;
                    }
                }
            `}</style>
        </div>
    );
}
