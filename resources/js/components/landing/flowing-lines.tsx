import { useIsMobile } from '@/hooks/use-mobile';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { useEffect, useRef } from 'react';

type Point = readonly [number, number];
type Color = readonly [number, number, number];

interface Curve {
    start: Point;
    c1: Point;
    c2: Point;
    end: Point;
}

interface Ribbon {
    /** The two boundary curves. Every strand is an interpolation between them. */
    from: Curve;
    to: Curve;
    /**
     * Strand distribution across the blend. 1 spaces them evenly; above 1 crowds
     * them toward `from`, below 1 toward `to`. This is what gives each band a
     * dense edge that falls away to open spacing.
     */
    bias: number;
    /** Axis of the colour ramp, in canvas proportions. */
    gradient: readonly [Point, Point];
    opacity: number;
    phase: number;
}

interface Palette {
    far: Color;
    middle: Color;
    near: Color;
}

/**
 * The band model: each ribbon is a blend between two *different* bezier curves,
 * the way Illustrator's blend tool interpolates between two paths.
 *
 * This replaced an offset model — one centre curve, strands pushed out along its
 * normal — which could only ever produce parallel copies of a single shape.
 * Evenly spaced, mechanical, and flat. Blending two curves of different shape is
 * what produces the reference's actual character: strands crowd where the two
 * boundaries run close and open up where they diverge, and where a boundary
 * doubles back the band folds over itself and reads as a twisted surface. The
 * density variation isn't decoration on top of the geometry, it *is* the
 * geometry.
 *
 * Coordinates are canvas proportions, so the composition scales fluidly. Values
 * outside 0..1 are deliberate — bands should run off the canvas rather than
 * terminate inside it.
 *
 * Placement keeps the upper centre open for the hero and lets the bottom band
 * pass behind the boards, which are translucent and blur it.
 */
const RIBBONS: Ribbon[] = [
    // Left sweep — enters top-left, falls away through the lower left.
    {
        from: {
            start: [-0.18, 0.02],
            c1: [0.2, 0.14],
            c2: [-0.05, 0.62],
            end: [0.42, 1.14],
        },
        to: {
            start: [-0.18, 0.34],
            c1: [0.42, 0.26],
            c2: [0.14, 0.78],
            end: [0.72, 1.16],
        },
        bias: 1.6,
        gradient: [
            [0, 0.08],
            [0.5, 1],
        ],
        opacity: 1,
        phase: 0,
    },
    // Right fold — comes down the right edge and turns back on itself.
    {
        from: {
            start: [0.68, -0.12],
            c1: [1.06, 0.1],
            c2: [0.66, 0.44],
            end: [1.06, 0.72],
        },
        to: {
            start: [0.94, -0.12],
            c1: [1.32, 0.16],
            c2: [0.86, 0.54],
            end: [1.24, 0.84],
        },
        bias: 0.65,
        gradient: [
            [0.7, 0],
            [1.05, 0.8],
        ],
        opacity: 0.92,
        phase: 2.1,
    },
    // Bottom sweep — full width, low enough to read under the boards.
    {
        from: {
            start: [-0.12, 0.78],
            c1: [0.3, 1.02],
            c2: [0.66, 0.72],
            end: [1.12, 0.88],
        },
        to: {
            start: [-0.12, 1.06],
            c1: [0.36, 1.3],
            c2: [0.74, 0.96],
            end: [1.12, 1.14],
        },
        bias: 1.35,
        gradient: [
            [0, 0.95],
            [1, 0.78],
        ],
        opacity: 0.85,
        phase: 4,
    },
];

/**
 * Both ramps run deep rust → burnt orange → amber, so the hue rotates *and* lifts
 * along the band: dark and recessive where it enters, hot and luminous where it
 * exits. A ramp that only changed brightness would read as one flat colour
 * dimmed, which is the thing that makes gradient backdrops look cheap.
 *
 * Every dark stop is kept low in blue on purpose. Dark composites additively
 * (`lighter`), so a strand resolves to `ground + strand × alpha` and the navy
 * ground's blue channel acts as a floor under all of it. A pale gold near-stop
 * would add its own blue on top of that floor and the strands would come out
 * peach-tan rather than orange.
 *
 * Light is pushed deeper and more saturated than dark: it composites with
 * `multiply` on a near-white cream, where pale stops simply vanish.
 */
const LIGHT_PALETTE: Palette = {
    far: [124, 45, 18],
    middle: [204, 85, 16],
    near: [245, 140, 25],
};

const DARK_PALETTE: Palette = {
    far: [148, 42, 14],
    middle: [232, 112, 24],
    near: [255, 168, 48],
};

/**
 * The field reads as discrete combed strands: every strand keeps a visible dark
 * gap from its neighbours, even along a band's crowded edge.
 *
 * That constrains the parameters together. Strand count stays low enough that
 * the densest part of a band still leaves a gap; strokes are a full pixel so each
 * one is crisp rather than a grey smear; bloom is a faint halo only, because a
 * wide soft glow fills the gaps back in and undoes the effect.
 */
const LINE_COUNT = 52;
const LINE_COUNT_MOBILE = 30;
const SAMPLES = 76;
const SAMPLES_MOBILE = 46;
const CYCLE_SECONDS = 38;
/**
 * Stroke widths are a performance lever as much as a visual one: every stroke is
 * an anti-aliased fill, so widening these raises the per-frame cost roughly in
 * proportion. An attempt to damp dark-mode shimmer by widening the core to 1.3
 * was reverted for exactly that reason — it bought smoother strands at the price
 * of a visibly laggy page.
 *
 * There is exactly one stroke per strand, in both themes. Dark used to lay down
 * a second, wider "bloom" pass at ~5% alpha for a halo, which meant dark was
 * doing double light's rasterising for an effect that was barely visible. That
 * asymmetry is why dark felt heavier than light; the halo is gone and the two
 * themes now cost the same.
 */
const LINE_WIDTH_DARK = 1;
const LINE_WIDTH_LIGHT = 0.9;

/**
 * Motion is a slow travelling wave in the *blend* parameter, so bunched and open
 * regions drift along each band rather than the whole shape sliding around.
 *
 * BREATHE * LANE_WAVE must stay below 1. That product is the wave's contribution
 * to d(u)/d(strand); at 1 it cancels the even spacing and beyond it goes
 * negative, which reorders strands so they cross and the gaps go ragged.
 */
const BREATHE = 0.045;
const LANE_WAVE = 4.5;

const TAU = Math.PI * 2;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const rgb = ([red, green, blue]: Color) => `rgb(${red}, ${green}, ${blue})`;

function cubicPoint(a: number, b: number, c: number, d: number, t: number) {
    const inverse = 1 - t;
    return (
        inverse ** 3 * a +
        3 * inverse ** 2 * t * b +
        3 * inverse * t ** 2 * c +
        t ** 3 * d
    );
}

export function FlowingLines({ isDark }: { isDark: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const isMobile = useIsMobile();
    const prefersReducedMotion = usePrefersReducedMotion();

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return;

        const lineCount = isMobile ? LINE_COUNT_MOBILE : LINE_COUNT;
        const samples = isMobile ? SAMPLES_MOBILE : SAMPLES;
        const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

        // Each strand carries its own colour: they stay separated and almost
        // never stack, so accumulation can't do the brightening here.
        //
        // Dark runs hotter than light to offset the navy ground: under additive
        // compositing the ground is a fixed floor, so alpha is what buys
        // saturation back — lowering it lets the navy dominate and washes the
        // orange toward tan.
        const baseOpacity = isDark ? 0.72 : 0.34;

        // Neither mode may clip. That is the whole reason dark flickered while
        // light never did.
        //
        // `lighter` was expansive: strands crowd together where `bias` bunches
        // them, and two or three overlapping at 0.72 sum past 255, so red and
        // green clamped. A clamped channel stops responding to movement, so as
        // strands drifted sub-pixel those pixels popped between flat white-yellow
        // and orange — a hard threshold being crossed, concentrated along each
        // band's dense edge. `multiply` is contractive and cannot exceed either
        // input, which is precisely why light mode was smooth throughout.
        //
        // Plain `source-over` is bounded the same way: the result is a blend of
        // strand and ground, never beyond both. It also removes the navy blue
        // floor that additive imposed, so the orange comes out *more* saturated
        // (~0.75 against ~0.63) rather than less. What it gives up is the glow
        // where two bands cross — no loss on a design built from separated
        // strands that are not supposed to stack.
        const blendMode: GlobalCompositeOperation = isDark
            ? 'source-over'
            : 'multiply';

        let width = 0;
        let height = 0;
        let animationFrame = 0;

        const resize = () => {
            const bounds = canvas.getBoundingClientRect();
            const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

            width = bounds.width;
            height = bounds.height;

            const backingWidth = Math.max(1, Math.round(width * pixelRatio));
            const backingHeight = Math.max(1, Math.round(height * pixelRatio));
            canvas.width = backingWidth;
            canvas.height = backingHeight;

            // Scale by the ratio actually allocated, not the nominal one. The
            // backing store has to be a whole number of pixels while the CSS box
            // is fractional, so transforming by `pixelRatio` leaves the canvas
            // slightly mis-scaled against the box it is painted into and the
            // browser resamples the entire surface to fit. On hairlines that
            // resample is another source of shimmer, and it moves whenever the
            // viewport does.
            context.setTransform(
                backingWidth / width,
                0,
                0,
                backingHeight / height,
                0,
                0,
            );
            context.lineCap = 'round';
            context.lineJoin = 'round';
        };

        /**
         * The strand at blend position `t` between a ribbon's two boundary
         * curves.
         *
         * The blend is inlined as eight scalars rather than going through a
         * `Curve` of `Point` tuples. Building the intermediate object allocated
         * five short-lived objects per strand — some 780 per frame, tens of
         * thousands a second — purely to hand eight numbers to `cubicPoint`. The
         * arithmetic is identical; only the garbage is gone.
         */
        const buildStrand = ({ from, to }: Ribbon, t: number) => {
            const startX = lerp(from.start[0], to.start[0], t);
            const startY = lerp(from.start[1], to.start[1], t);
            const c1X = lerp(from.c1[0], to.c1[0], t);
            const c1Y = lerp(from.c1[1], to.c1[1], t);
            const c2X = lerp(from.c2[0], to.c2[0], t);
            const c2Y = lerp(from.c2[1], to.c2[1], t);
            const endX = lerp(from.end[0], to.end[0], t);
            const endY = lerp(from.end[1], to.end[1], t);

            const path = new Path2D();

            for (let sample = 0; sample <= samples; sample++) {
                const progress = sample / samples;
                const x = cubicPoint(startX, c1X, c2X, endX, progress) * width;
                const y = cubicPoint(startY, c1Y, c2Y, endY, progress) * height;

                if (sample === 0) path.moveTo(x, y);
                else path.lineTo(x, y);
            }

            return path;
        };

        const draw = (elapsedSeconds: number) => {
            // clearRect ignores globalCompositeOperation, so the blend mode below
            // can stay set for the lifetime of the frame.
            context.clearRect(0, 0, width, height);
            if (width === 0 || height === 0) return;

            context.globalCompositeOperation = blendMode;

            const motionPhase = (elapsedSeconds / CYCLE_SECONDS) * TAU;

            for (const ribbon of RIBBONS) {
                // One gradient per ribbon rather than a flat colour per strand:
                // in the reference the hue travels *along* each band — deep rust
                // where it enters, amber where it exits — which a per-strand
                // solid colour can't express. Strand-to-strand variation is
                // carried by alpha instead.
                const [gradFrom, gradTo] = ribbon.gradient;
                const gradient = context.createLinearGradient(
                    gradFrom[0] * width,
                    gradFrom[1] * height,
                    gradTo[0] * width,
                    gradTo[1] * height,
                );
                gradient.addColorStop(0, rgb(palette.far));
                gradient.addColorStop(0.55, rgb(palette.middle));
                gradient.addColorStop(1, rgb(palette.near));
                context.strokeStyle = gradient;

                for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
                    const linePosition = lineIndex / Math.max(1, lineCount - 1);
                    const biased = linePosition ** ribbon.bias;
                    const blend =
                        biased +
                        BREATHE *
                            Math.sin(
                                motionPhase + ribbon.phase + biased * LANE_WAVE,
                            );

                    const edgeFade = 0.45 + Math.sin(blend * Math.PI) * 0.55;
                    const alpha = baseOpacity * ribbon.opacity * edgeFade;
                    const path = buildStrand(ribbon, blend);

                    context.globalAlpha = alpha;
                    context.lineWidth = isDark
                        ? LINE_WIDTH_DARK
                        : LINE_WIDTH_LIGHT;
                    context.stroke(path);
                }
            }

            context.globalAlpha = 1;
        };

        resize();

        const resizeObserver = new ResizeObserver(() => {
            resize();
            if (prefersReducedMotion) draw(0);
        });
        resizeObserver.observe(canvas);

        if (prefersReducedMotion) {
            draw(0);
            return () => resizeObserver.disconnect();
        }

        const startedAt = performance.now();

        // Draws at display rate, deliberately unthrottled.
        //
        // An earlier pass capped this to ~30fps and it visibly flickered. The
        // cause was the throttle itself: it carried the remainder forward
        // (`last = time - since % interval`), which parks the marker up to a full
        // interval in the past, so the following frame sometimes already clears
        // the bar. Gaps alternated between one and two display frames — a 2x
        // swing in frame interval.
        //
        // That is invisible on most animation but brutal here. The blend drifts
        // roughly 0.04px per frame, far under one pixel, so the eye has nothing
        // to track except the *evenness* of the change; an irregular cadence is
        // the only thing it can see, and it reads as flicker. Sub-pixel motion
        // wants a metronome or nothing.
        //
        // A plain `last = time` reset would in fact be regular — 31ms is
        // unreachable in one 16.7ms frame, so it locks to every second frame —
        // but 30fps still doubles the per-frame step on motion this fine, so the
        // cap is gone rather than repaired. The cost is paid back by the other
        // optimisations, which all stay: Path2D reuse, zero per-frame
        // allocation, the IntersectionObserver pause, and mobile skipping bloom.
        const tick = (time: number) => {
            draw((time - startedAt) / 1000);
            animationFrame = requestAnimationFrame(tick);
        };

        // rAF already idles on a hidden tab, but not on a canvas that has merely
        // been scrolled past — and this is the most expensive thing on the page.
        const start = () => {
            if (!animationFrame) animationFrame = requestAnimationFrame(tick);
        };
        const stop = () => {
            if (animationFrame) cancelAnimationFrame(animationFrame);
            animationFrame = 0;
        };

        const visibilityObserver = new IntersectionObserver(([entry]) =>
            entry.isIntersecting ? start() : stop(),
        );
        visibilityObserver.observe(canvas);
        start();

        return () => {
            stop();
            visibilityObserver.disconnect();
            resizeObserver.disconnect();
        };
    }, [isDark, isMobile, prefersReducedMotion]);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="absolute inset-0 h-full w-full"
        />
    );
}
