import { dashboard, login } from '@/routes';
import { Link } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';

/**
 * The hero itself — logos, wordmark, description, call to action.
 *
 * Copy, logos and the auth-aware destination are carried over unchanged from the
 * original page; this exists to keep the composition out of welcome.tsx and to
 * hold the typographic treatment in one place.
 */

/**
 * Intrinsic dimensions are declared so the browser knows each logo's aspect
 * ratio before the file arrives. Height comes from `cls` and width is auto, so
 * without these the row has no measurable width until load and the whole
 * centred hero shifts sideways as the images pop in.
 */
const LOGOS = [
    {
        src: '/assets/img/ched-logo.png',
        alt: 'Commission on Higher Education',
        w: 756,
        h: 756,
        cls: 'h-9 sm:h-11 xl:h-12',
    },
    {
        src: '/assets/img/unifast.png',
        alt: 'UniFAST',
        w: 250,
        h: 250,
        cls: 'h-9 sm:h-10 xl:h-11',
    },
    {
        src: '/assets/img/bagong-pilipinas.png',
        alt: 'Bagong Pilipinas',
        w: 516,
        h: 483,
        cls: 'h-9 sm:h-11 xl:h-12',
    },
    {
        src: '/assets/img/achieve.png',
        alt: 'ACHIEVE',
        w: 3750,
        h: 3750,
        cls: 'h-11 sm:h-13 xl:h-16 pt-2',
    },
];

/**
 * "Copperplate Gothic" and "Canvas Sans" are not web fonts and are not loaded —
 * they render only for visitors who happen to have them installed. Everyone else
 * falls through the stack, so the fallbacks have to be faces that actually exist
 * on Windows/Android and that hold the same character: an engraved, wide-tracked
 * display for the wordmark, a humanist serif for the subtitle. Generic `serif`
 * resolves to Times New Roman, which at this size and tracking looks like a
 * mistake rather than a choice.
 *
 * The durable fix is self-hosting one display face; see the note in the PR.
 */
const DISPLAY_STACK =
    '"Copperplate Gothic Bold", "Copperplate Gothic Light", Copperplate, Optima, "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif';
const SUBTITLE_STACK =
    '"Canvas Sans", Georgia, "Palatino Linotype", "Book Antiqua", Palatino, serif';

export function HeroContent({ isAuthenticated }: { isAuthenticated: boolean }) {
    return (
        <div className="flex w-full max-w-2xl flex-col items-center space-y-5 text-center sm:space-y-6">
            <div className="anim-logos flex items-center justify-center gap-2.5 sm:gap-3">
                {LOGOS.map((logo) => (
                    <img
                        key={logo.src}
                        src={logo.src}
                        alt={logo.alt}
                        width={logo.w}
                        height={logo.h}
                        decoding="async"
                        draggable={false}
                        className={`w-auto drop-shadow-sm ${logo.cls}`}
                    />
                ))}
            </div>

            <div className="space-y-1.5">
                {/* Sits directly on the backdrop, so it follows the backdrop's
                    hue. The wordmark and CTA below stay CHED navy — the UniFAST
                    pairing is orange atmosphere over navy structure, and navy is
                    also what keeps the CTA reading as the primary action against
                    an orange field. */}
                <p className="anim-region text-[10px] font-semibold tracking-[0.35em] text-orange-900/70 uppercase sm:text-[11px] dark:text-orange-200/70">
                    CHED Region XII — SOCCSKSARGEN
                </p>
                <h1
                    className="anim-title text-4xl leading-none font-light tracking-[0.08em] text-blue-950 sm:text-5xl xl:text-[3.25rem] dark:text-foreground"
                    style={{ fontFamily: DISPLAY_STACK }}
                >
                    Liquidation
                </h1>
                <p
                    className="anim-subtitle text-xl leading-tight font-normal tracking-[0.05em] text-blue-900/55 italic sm:text-2xl xl:text-[1.85rem] dark:text-foreground/60"
                    style={{ fontFamily: SUBTITLE_STACK }}
                >
                    Management System
                </p>
            </div>

            <p className="anim-desc mx-auto max-w-md text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                Public transparency dashboard tracking{' '}
                <span className="font-medium text-foreground/80">
                    TES, TDP &amp; STuFAPs
                </span>{' '}
                fund liquidation across HEIs in Region&nbsp;XII.
            </p>

            <div className="anim-line">
                {/* Neutral, not gold. The gold rule worked as an accent because
                    it contrasted with the old backdrop; against an orange one it
                    is the same family and stops registering as a separate mark.
                    Neutral keeps it doing its actual job — separating — without
                    competing with the field behind it. */}
                <div className="shimmer-line mx-auto h-px w-24 text-foreground/25" />
            </div>

            <div className="anim-cta flex flex-col items-center gap-2">
                <Link
                    href={isAuthenticated ? dashboard() : login()}
                    /* Gradient + inset top highlight rather than a flat fill: on a
                       page whose backdrop is all soft light, a button with no
                       surface of its own reads as a coloured rectangle. The ring
                       offset is bound to the theme background — the default is
                       white, which halos the focus ring on the dark theme. */
                    className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-blue-900 to-blue-950 px-6 py-3 text-[11px] font-bold text-white shadow-md ring-1 shadow-blue-950/25 ring-white/10 transition-all ring-inset hover:-translate-y-px hover:from-blue-800 hover:to-blue-900 hover:shadow-lg hover:shadow-blue-950/30 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none active:translate-y-0 active:scale-[0.97] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:px-7 sm:text-xs dark:from-foreground dark:to-foreground/85 dark:text-background dark:shadow-none dark:ring-black/10 dark:hover:from-foreground dark:hover:to-foreground/70"
                >
                    <span className="tracking-[0.2em] uppercase">
                        {isAuthenticated ? 'Go to Dashboard' : 'Get Started'}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
                <p className="text-[11px] text-muted-foreground/80">
                    {isAuthenticated
                        ? 'Continue to your dashboard.'
                        : "Sign in to manage your institution's liquidations."}
                </p>
            </div>
        </div>
    );
}
