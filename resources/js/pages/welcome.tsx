import '../../css/welcome.css';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type Appearance, useAppearance } from '@/hooks/use-appearance';
import { dashboard, login } from '@/routes';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowUpRight, Monitor, Moon, Sun } from 'lucide-react';
import { useEffect } from 'react';

const themeOptions = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
] as const;

/**
 * Rendered as one bare row above the eyebrow - defined once, no containers.
 *
 * Heights are tuned per mark rather than shared, for two reasons.
 *
 * The files carry very different amounts of transparent padding - measured
 * against its own canvas the artwork fills 100% for UniFAST, 98% for Bagong
 * Pilipinas, 92% for CHED and only 59% tall for ACHIEVE - so one shared height
 * rendered ACHIEVE at about half the size of the rest.
 *
 * Matching the measured artwork then overcorrected, because equal height is not
 * equal presence: a circle reads smaller than a wide mark of the same height,
 * and ACHIEVE is a bold two-colour graphic against two fine, detailed seals. The
 * visible marks are therefore deliberately unequal - the round seals sit around
 * 50px, Bagong Pilipinas 44px and ACHIEVE 40px - which is what makes them look
 * the same size.
 *
 * Scaled here rather than by re-cropping the assets, which other pages share.
 */
const institutions = [
    { src: '/assets/img/ched-logo.png', name: 'Commission on Higher Education', size: 'h-[52px] sm:h-[68px]' },
    { src: '/assets/img/unifast.png', name: 'UniFAST', size: 'h-[48px] sm:h-[62px]' },
    { src: '/assets/img/bagong-pilipinas.png', name: 'Bagong Pilipinas', size: 'h-[44px] sm:h-[56px]' },
    { src: '/assets/img/achieve.png', name: 'ACHIEVE', size: 'h-[66px] sm:h-[85px]' },
];

/** Public entry point. Institution rankings and financial data remain private. */
export default function Welcome() {
    const { auth } = usePage<SharedData>().props;
    const { appearance, updateAppearance } = useAppearance();
    const ThemeIcon =
        themeOptions.find((option) => option.value === appearance)?.icon ??
        Monitor;

    useEffect(() => {
        const previous = window.history.scrollRestoration;
        window.history.scrollRestoration = 'manual';
        window.scrollTo(0, 0);
        return () => {
            window.history.scrollRestoration = previous;
        };
    }, []);

    return (
        <>
            <Head title="Welcome">
                <meta
                    name="description"
                    content="The CHED Region XII portal for managing TES, TDP and STuFAPs scholarship fund liquidations."
                />
            </Head>
            <div className="landing-page relative isolate flex min-h-svh flex-col overflow-x-clip bg-background font-sans text-foreground">
                <a
                    href="#landing-content"
                    className="sr-only z-50 rounded-md bg-background px-4 py-2 text-foreground focus:not-sr-only focus:absolute focus:top-4 focus:left-4"
                >
                    Skip to content
                </a>
                <div className="absolute top-5 right-5 z-20 sm:top-7 sm:right-8">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                aria-label="Change color theme"
                                title="Change color theme"
                                className="inline-flex size-10 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
                            >
                                <ThemeIcon
                                    className="size-4"
                                    aria-hidden="true"
                                />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuRadioGroup
                                value={appearance}
                                onValueChange={(value) =>
                                    updateAppearance(value as Appearance)
                                }
                            >
                                {themeOptions.map((option) => (
                                    <DropdownMenuRadioItem
                                        key={option.value}
                                        value={option.value}
                                    >
                                        <option.icon
                                            className="size-4"
                                            aria-hidden="true"
                                        />
                                        {option.label}
                                    </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <main
                    id="landing-content"
                    tabIndex={-1}
                    className="landing-main relative flex flex-1 items-center justify-center px-6 outline-none sm:px-10"
                >
                    <div
                        aria-hidden="true"
                        className="landing-grid pointer-events-none absolute inset-0 -z-10"
                    />
                    <div className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
                        {/* Sized by height with w-auto so each seal keeps its own
                            aspect ratio - they are not square, and a fixed box
                            would letterbox the wider marks. */}
                        <div className="landing-enter mb-7 flex flex-wrap items-center justify-center gap-4 sm:mb-9 sm:gap-6">
                            {institutions.map((institution) => (
                                <img
                                    key={institution.src}
                                    src={institution.src}
                                    alt={institution.name}
                                    className={`w-auto object-contain ${institution.size}`}
                                />
                            ))}
                        </div>
                        <p className="landing-enter landing-eyebrow mb-5 text-[10px] leading-relaxed font-medium tracking-[0.18em] uppercase sm:mb-6 sm:text-[11px] sm:tracking-[0.22em]">
                            CHED Region XII
                            <span
                                aria-hidden="true"
                                className="mx-2.5 opacity-50"
                            >
                                /
                            </span>
                            SOCCSKSARGEN
                        </p>
                        <h1 className="landing-enter landing-heading">
                            <span className="landing-title block">
                                Liquidation
                            </span>
                            <span className="landing-subtitle block">
                                Management System
                            </span>
                        </h1>
                        <p className="landing-enter landing-description mt-6 max-w-[620px] text-[15px] leading-[1.8] text-pretty sm:text-base">
                            The official portal for{' '}
                            <span className="font-medium text-foreground">
                                TES, TDP and STuFAPs
                            </span>{' '}
                            scholarship fund liquidations. Supporting higher
                            education institutions across Region&nbsp;XII, from
                            submission to review.
                        </p>
                        <div className="landing-enter landing-actions mt-7 flex flex-col items-center sm:mt-8">
                            <Button
                                asChild
                                size="lg"
                                className="landing-portal group h-12 gap-5 rounded-lg text-sm font-semibold shadow-sm has-[>svg]:px-6"
                            >
                                <Link href={auth.user ? dashboard() : login()}>
                                    {auth.user
                                        ? 'Go to Dashboard'
                                        : 'Access Portal'}
                                    <ArrowUpRight
                                        className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
                                        aria-hidden="true"
                                    />
                                </Link>
                            </Button>
                            <p className="landing-description mt-3 text-xs leading-relaxed">
                                {auth.user
                                    ? 'Continue to your dashboard.'
                                    : "Sign in to manage your institution's liquidations."}
                            </p>
                        </div>
                    </div>
                </main>
                <footer className="px-6 pb-6 sm:px-10 sm:pb-7 lg:px-16">
                    <div className="landing-description mx-auto flex max-w-6xl flex-col items-center gap-2 border-t border-border/60 pt-5 text-center text-[11px] leading-relaxed sm:flex-row sm:justify-between sm:text-xs">
                        <p>
                            &copy; {new Date().getFullYear()} Commission on
                            Higher Education
                        </p>
                        <p>CHED Regional Office XII</p>
                    </div>
                </footer>
            </div>
        </>
    );
}
