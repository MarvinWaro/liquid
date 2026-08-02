import { useIsMobile } from '@/hooks/use-mobile';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { useEffect, useRef } from 'react';

/**
 * The page backdrop: the artwork, and the light shaping on top of it.
 *
 * Deliberately few layers. An earlier pass stacked five decorative systems here
 * — photo illustration, horizon silhouette, node network, floating icons, wash —
 * and the result was muddy: each layer competed with the others and with the
 * heading. One well-executed idea is what reads as premium.
 *
 * The artwork used to be generated at runtime: a canvas engine stroking 156
 * bezier strands every animation frame, forever. It was replaced by a static
 * image of the same composition because the animation was never actually the
 * point — the field reads as still at a glance — and rebuilding it 60 times a
 * second cost real main-thread time on every visitor's device for motion almost
 * nobody noticed. The wash that used to sit under the strands is baked into the
 * artwork, so layer 1 covers both.
 *
 * The layers above it are shaping, not decoration. A vignette pulls the eye
 * inward and keeps the brightest part of the field off the page edges; a scrim
 * sits only under the hero column so the type has contrast without flattening
 * the artwork everywhere; grain breaks up banding in the large gradients, which
 * is most of the difference between "gradient" and "finished".
 *
 * ── Tuning ───────────────────────────────────────────────────────────────────
 * Parallax travel is PARALLAX_STRENGTH below. The artwork itself is
 * public/assets/img/{light,dark}.webp.
 */

/** Max px the artwork shifts at full pointer deflection. */
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
            {/* 1 — The artwork. Scaled slightly so parallax translation never
                   exposes an edge.

                   A flat colour sits underneath matching each theme's artwork:
                   it is what shows during the image's first paint and behind the
                   crop on very tall viewports, so it has to be the artwork's own
                   ground rather than the page background, or the seam shows. */}
            <div
                className="parallax-layer absolute inset-0"
                style={{ backgroundColor: isDark ? '#0b1026' : '#fdfaf7' }}
            >
                <img
                    src={isDark ? '/assets/img/dark.webp' : '/assets/img/light.webp'}
                    alt=""
                    width={1672}
                    height={941}
                    // Decoded off the main thread, and fetched early: this is the
                    // largest thing on screen, so letting it arrive late is what
                    // would read as a flash of empty background.
                    decoding="async"
                    fetchPriority="high"
                    draggable={false}
                    // `cover` keeps only a narrow vertical slice of this 16:9
                    // artwork on a phone. That is fine here: at that width the
                    // hero and the boards cover almost the whole viewport, so
                    // the backdrop reads as a soft ground either way — biasing
                    // the crop was tried and changed nothing visible.
                    className="h-full w-full object-cover"
                />
            </div>

            {/* 2 — Vignette. Darkens (light: cools) the edges so the field's
                   brightest passages read as interior light rather than as
                   artwork running off the page. */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_86%_at_50%_32%,transparent_42%,rgba(170,150,125,0.18)_100%)] dark:bg-[radial-gradient(ellipse_125%_92%_at_50%_34%,transparent_48%,rgba(2,4,14,0.44)_100%)]" />

            {/* 3 — Readability scrim, sized and placed to sit under the hero
                   column only. An earlier pass used a viewport-wide blur that
                   also fell across the artwork and desaturated it; the type needs
                   contrast in one place, not everywhere. */}
            <div
                className="absolute inset-0 bg-[radial-gradient(ellipse_44%_32%_at_50%_var(--scrim-y),rgba(255,255,255,0.82),transparent_72%)] dark:bg-[radial-gradient(ellipse_46%_34%_at_50%_var(--scrim-y),rgba(7,11,26,0.62),transparent_72%)]"
                style={{ opacity: scrimOpacity }}
            />

            {/* 4 — Grain. */}
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
