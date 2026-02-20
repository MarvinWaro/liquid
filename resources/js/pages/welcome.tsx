import { dashboard, login } from '@/routes';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

export default function Welcome() {
    const { auth } = usePage<SharedData>().props;
    const [init, setInit] = useState(false);

    useEffect(() => {
        initParticlesEngine(async (engine) => {
            await loadSlim(engine);
        }).then(() => {
            setInit(true);
        });
    }, []);

    const particlesOptions = useMemo(() => ({
        background: { color: { value: "transparent" } },
        fpsLimit: 120,
        interactivity: {
            events: {
                onClick: { enable: true, mode: "push" },
                onHover: { enable: true, mode: "repulse" },
            },
            modes: {
                push: { quantity: 6 },
                repulse: { distance: 100, duration: 0.4 },
            },
        },
        particles: {
            color: { value: "#4a90e2" },
            links: {
                color: "#4a90e2",
                distance: 150,
                enable: true,
                opacity: 0.3,
                width: 1.5,
            },
            move: {
                enable: true,
                speed: 2,
                direction: "none" as const,
                outModes: { default: "bounce" as const },
                random: true,
                straight: false,
                attract: {
                    enable: true,
                    rotateX: 600,
                    rotateY: 1200,
                },
            },
            number: {
                density: { enable: true },
                value: 80
            },
            opacity: {
                value: 0.6,
                animation: {
                    enable: true,
                    speed: 1,
                    minimumValue: 0.3,
                }
            },
            shape: { type: "circle" },
            size: {
                value: { min: 1, max: 4 },
                animation: {
                    enable: true,
                    speed: 3,
                    minimumValue: 0.5,
                }
            },
        },
        detectRetina: true,
    }), []);

    return (
        <>
            <Head title="Welcome">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600" rel="stylesheet" />
            </Head>

            <style>{`
                @keyframes fadeSlideUp {
                    from { opacity: 0; transform: translateY(24px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeSlideLeft {
                    from { opacity: 0; transform: translateX(-20px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                @keyframes ctaPulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(65, 105, 225, 0.35); }
                    60%      { box-shadow: 0 0 0 10px rgba(65, 105, 225, 0); }
                }
                .anim-logos       { animation: fadeSlideLeft 1s   cubic-bezier(.25,.46,.45,.94) both; }
                .anim-title       { animation: fadeSlideUp   1.1s cubic-bezier(.25,.46,.45,.94) 0.2s  both; }
                .anim-subtitle    { animation: fadeSlideUp   1.1s cubic-bezier(.25,.46,.45,.94) 0.4s  both; }
                .anim-desc        { animation: fadeSlideUp   1.1s cubic-bezier(.25,.46,.45,.94) 0.6s  both; }
                .anim-cta         { animation: fadeSlideUp   1.1s cubic-bezier(.25,.46,.45,.94) 0.8s  both; }
                .cta-pulse        { animation: ctaPulse 2.4s ease-in-out infinite 1.8s; }
            `}</style>

            <div className="relative flex min-h-screen flex-col bg-white text-[#1b1b18] overflow-hidden font-sans selection:bg-red-100 selection:text-red-900">

                {/* Particles Background */}
                {init && (
                    <Particles
                        id="tsparticles"
                        options={particlesOptions}
                        className="absolute inset-0 z-0 pointer-events-none"
                    />
                )}

                {/* Main Content Area */}
                <main className="relative z-10 flex flex-1 flex-col justify-center w-full px-6 sm:px-10 md:px-16 lg:px-32 xl:px-80">
                    <div className="space-y-6 sm:space-y-8 max-w-5xl">

                        {/* Logos */}
                        <div className="anim-logos flex items-center gap-3 sm:gap-4 md:gap-6">
                            <img
                                src="/assets/img/ched-logo.png"
                                alt="CHED Logo"
                                className="h-12 sm:h-16 md:h-18 lg:h-20 w-auto drop-shadow-sm"
                            />
                            <img
                                src="/assets/img/unifast.png"
                                alt="UniFAST Logo"
                                className="h-12 sm:h-16 md:h-18 lg:h-20 w-auto drop-shadow-sm"
                            />
                            <img
                                src="/assets/img/bagong-pilipinas.png"
                                alt="Bagong Pilipinas Logo"
                                className="h-12 sm:h-16 md:h-18 lg:h-20 w-auto drop-shadow-sm"
                            />
                        </div>

                        {/* Title Block */}
                        <div className="space-y-1 sm:space-y-2">
                            <h1
                                className="anim-title text-3xl sm:text-6xl md:text-7xl lg:text-8xl font-light tracking-[0.3em] leading-none text-[#494444]"
                                style={{ fontFamily: '"Copperplate Gothic", "Copperplate", "Copperplate Gothic Bold", serif' }}
                            >
                                Liquidation
                            </h1>
                            <p
                                className="anim-subtitle text-3xl sm:text-3xl md:text-4xl lg:text-7xl font-normal italic text-[#0253ff] tracking-[0.05em] leading-tight"
                                style={{ fontFamily: '"Canvas Sans", "Georgia", serif' }}
                            >
                                Management System
                            </p>
                        </div>

                        {/* Description */}
                        <p
                            className="anim-desc max-w-2xl text-base sm:text-lg md:text-xl text-[#344054] leading-relaxed font-normal"
                        >
                            Streamlining financial transparency and accountability for higher education resources.
                        </p>

                        {/* CTA Button */}
                        <div className="anim-cta pt-1">
                            <Link
                                href={auth.user ? dashboard() : login()}
                                className="cta-pulse group inline-flex items-center gap-2 rounded-lg bg-[#4169E1] px-6 sm:px-8 py-3 sm:py-3.5 text-xs sm:text-sm font-bold text-white shadow-sm transition-all hover:bg-[#3457b8] active:scale-95"
                                style={{ fontFamily: '"Helvetica Now", sans-serif' }}
                            >
                                <span className="tracking-widest uppercase">
                                    {auth.user ? 'Go to Dashboard' : 'Get Started'}
                                </span>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3.5 sm:h-4 w-3.5 sm:w-4 transition-transform group-hover:translate-x-1"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </Link>
                        </div>
                    </div>
                </main>

                {/* Footer */}
                <footer className="relative z-10 w-full py-6 sm:py-8 px-6 text-center text-xs sm:text-sm font-medium text-gray-400 opacity-60">
                    © {new Date().getFullYear()} Commission on Higher Education
                </footer>
            </div>
        </>
    );
}
