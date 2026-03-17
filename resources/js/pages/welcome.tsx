import { dashboard, login } from '@/routes';
import { type SharedData } from '@/types';
import { useAppearance } from '@/hooks/use-appearance';
import { Head, Link, usePage } from '@inertiajs/react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';

export default function Welcome() {
    const { auth } = usePage<SharedData>().props;
    const { appearance, updateAppearance } = useAppearance();
    const [init, setInit] = useState(false);
    const [themeMenuOpen, setThemeMenuOpen] = useState(false);

    useEffect(() => {
        initParticlesEngine(async (engine) => {
            await loadSlim(engine);
        }).then(() => {
            setInit(true);
        });
    }, []);

    // Close theme menu on outside click
    useEffect(() => {
        if (!themeMenuOpen) return;
        const close = () => setThemeMenuOpen(false);
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [themeMenuOpen]);

    const particlesOptions = useMemo(
        () => ({
            background: { color: { value: 'transparent' } },
            fpsLimit: 120,
            interactivity: {
                events: {
                    onClick: { enable: true, mode: 'push' as const },
                    onHover: { enable: true, mode: 'repulse' as const },
                },
                modes: {
                    push: { quantity: 4 },
                    repulse: { distance: 80, duration: 0.4 },
                },
            },
            particles: {
                color: { value: appearance === 'dark' ? '#555555' : '#c0c0c0' },
                links: {
                    color: appearance === 'dark' ? '#444444' : '#d0d0d0',
                    distance: 140,
                    enable: true,
                    opacity: 0.4,
                    width: 1,
                },
                move: {
                    enable: true,
                    speed: 1,
                    direction: 'none' as const,
                    outModes: { default: 'bounce' as const },
                    random: true,
                    straight: false,
                },
                number: {
                    density: { enable: true },
                    value: 50,
                },
                opacity: {
                    value: 0.5,
                    animation: { enable: true, speed: 0.8, minimumValue: 0.2 },
                },
                shape: { type: 'circle' },
                size: {
                    value: { min: 1, max: 3 },
                    animation: { enable: true, speed: 2, minimumValue: 0.5 },
                },
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
                .anim-logos    { animation: fadeSlideLeft 1s   cubic-bezier(.25,.46,.45,.94) both; }
                .anim-region   { animation: fadeSlideUp   1s   cubic-bezier(.25,.46,.45,.94) 0.15s both; }
                .anim-title    { animation: fadeSlideUp   1.1s cubic-bezier(.25,.46,.45,.94) 0.3s  both; }
                .anim-subtitle { animation: fadeSlideUp   1.1s cubic-bezier(.25,.46,.45,.94) 0.5s  both; }
                .anim-line     { animation: fadeSlideUp   1s   cubic-bezier(.25,.46,.45,.94) 0.55s both; }
                .anim-desc     { animation: fadeSlideUp   1.1s cubic-bezier(.25,.46,.45,.94) 0.7s  both; }
                .anim-cta      { animation: fadeSlideUp   1.1s cubic-bezier(.25,.46,.45,.94) 0.9s  both; }
                .anim-nav      { animation: fadeIn        0.8s cubic-bezier(.25,.46,.45,.94) 0.3s  both; }
                .shimmer-line {
                    background: linear-gradient(
                        90deg,
                        transparent 0%,
                        currentColor 50%,
                        transparent 100%
                    );
                    background-size: 200% 100%;
                    animation: shimmer 3s ease-in-out infinite 2s;
                }
            `}</style>

            <div className="relative flex min-h-screen flex-col bg-background text-foreground overflow-hidden font-sans transition-colors duration-300">
                {/* Particles Background */}
                {init && (
                    <Particles
                        id="tsparticles"
                        key={appearance}
                        options={particlesOptions}
                        className="absolute inset-0 z-0 pointer-events-none"
                    />
                )}

                {/* Top-right theme toggle */}
                <div className="anim-nav absolute top-6 right-6 sm:right-10 z-20">
                    <div className="relative">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setThemeMenuOpen(!themeMenuOpen);
                            }}
                            className="flex items-center justify-center h-9 w-9 rounded-full border border-border bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                            title="Switch theme"
                        >
                            {appearance === 'light' && <Sun className="h-4 w-4" />}
                            {appearance === 'dark' && <Moon className="h-4 w-4" />}
                            {appearance === 'system' && <Monitor className="h-4 w-4" />}
                        </button>

                        {themeMenuOpen && (
                            <div
                                className="absolute right-0 top-11 w-36 rounded-lg border border-border bg-popover shadow-lg py-1 z-50"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {themeOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => {
                                            updateAppearance(option.value);
                                            setThemeMenuOpen(false);
                                        }}
                                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-popover-foreground hover:bg-accent transition-colors"
                                    >
                                        <option.icon className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span>{option.label}</span>
                                        {appearance === option.value && (
                                            <Check className="ml-auto h-3.5 w-3.5 text-foreground" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content Area */}
                <main className="relative z-10 flex flex-1 flex-col justify-center w-full px-6 sm:px-10 md:px-16 lg:px-32 xl:px-80">
                    <div className="space-y-6 sm:space-y-8 max-w-5xl">
                        {/* Logos */}
                        <div className="anim-logos flex items-center gap-3 sm:gap-4 md:gap-5">
                            <img
                                src="/assets/img/ched-logo.png"
                                alt="CHED Logo"
                                className="h-12 sm:h-16 md:h-18 lg:h-20 w-auto drop-shadow-sm"
                            />
                            <img
                                src="/assets/img/unifast.png"
                                alt="UniFAST Logo"
                                className="h-12 sm:h-15 md:h-17 lg:h-19 w-auto drop-shadow-sm"
                            />
                            <img
                                src="/assets/img/bagong-pilipinas.png"
                                alt="Bagong Pilipinas Logo"
                                className="h-12 sm:h-16 md:h-18 lg:h-20 w-auto drop-shadow-sm"
                            />
                            <img
                                src="/assets/img/achieve.png"
                                alt="ACHIEVE Logo"
                                className="h-15 sm:h-16 md:h-22 lg:h-29 w-auto drop-shadow-sm pt-5"
                            />
                        </div>

                        {/* Title Block */}
                        <div className="space-y-1 sm:space-y-2">
                            <p className="anim-region text-[10px] sm:text-xs font-semibold tracking-[0.35em] uppercase text-muted-foreground ps-1">
                                CHED Region XII — SOCCSKSARGEN
                            </p>
                            <h1
                                className="anim-title text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-light tracking-[0.08em] leading-none text-foreground"
                                style={{
                                    fontFamily:
                                        '"Copperplate Gothic", "Copperplate", "Copperplate Gothic Bold", serif',
                                }}
                            >
                                Liquidation
                            </h1>
                            <p
                                className="anim-subtitle text-3xl sm:text-3xl md:text-4xl lg:text-6xl font-normal italic tracking-[0.05em] leading-tight text-foreground/60"
                                style={{
                                    fontFamily: '"Canvas Sans", "Georgia", serif',
                                }}
                            >
                                Management System
                            </p>
                        </div>

                        {/* Accent line */}
                        <div className="anim-line">
                            <div className="h-px w-24 shimmer-line text-border" />
                        </div>

                        {/* Description */}
                        <p className="anim-desc max-w-xl text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed">
                            Streamlining financial transparency and accountability for higher
                            education resources.
                        </p>

                        {/* CTA Button */}
                        <div className="anim-cta pt-1">
                            <Link
                                href={auth.user ? dashboard() : login()}
                                className="group inline-flex items-center gap-2.5 rounded-lg bg-foreground px-6 sm:px-8 py-3 sm:py-3.5 text-xs sm:text-sm font-bold text-background shadow-sm transition-all hover:bg-foreground/90 active:scale-[0.97]"
                            >
                                <span className="tracking-[0.2em] uppercase">
                                    {auth.user ? 'Go to Dashboard' : 'Get Started'}
                                </span>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3.5 sm:h-4 w-3.5 sm:w-4 transition-transform group-hover:translate-x-1"
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
                        </div>
                    </div>
                </main>

                {/* Footer */}
                <footer className="relative z-10 w-full py-6 sm:py-8 px-6 text-center text-xs sm:text-sm font-medium text-muted-foreground/50">
                    &copy; {new Date().getFullYear()} Commission on Higher Education
                </footer>
            </div>
        </>
    );
}
