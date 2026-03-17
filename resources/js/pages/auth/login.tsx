import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useAppearance } from '@/hooks/use-appearance';
import { store } from '@/routes/login';
import { Form, Head } from '@inertiajs/react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
}

export default function Login({ status, canResetPassword }: LoginProps) {
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
                    push: { quantity: 3 },
                    repulse: { distance: 80, duration: 0.4 },
                },
            },
            particles: {
                color: { value: appearance === 'dark' ? '#444444' : '#c0c0c0' },
                links: {
                    color: appearance === 'dark' ? '#333333' : '#d4d4d4',
                    distance: 140,
                    enable: true,
                    opacity: 0.35,
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
                    value: 40,
                },
                opacity: {
                    value: 0.4,
                    animation: { enable: true, speed: 0.8, minimumValue: 0.15 },
                },
                shape: { type: 'circle' },
                size: {
                    value: { min: 1, max: 2.5 },
                    animation: { enable: true, speed: 1.5, minimumValue: 0.5 },
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
        <div className="relative min-h-svh flex flex-col items-center justify-center p-6 md:p-10 overflow-hidden bg-background transition-colors duration-300">
            <Head title="Log in" />

            <style>{`
                @keyframes fadeSlideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                .anim-card   { animation: fadeSlideUp 0.8s cubic-bezier(.25,.46,.45,.94) both; }
                .anim-logos  { animation: fadeIn      0.6s cubic-bezier(.25,.46,.45,.94) 0.2s both; }
                .anim-header { animation: fadeSlideUp 0.7s cubic-bezier(.25,.46,.45,.94) 0.3s both; }
                .anim-form   { animation: fadeSlideUp 0.7s cubic-bezier(.25,.46,.45,.94) 0.5s both; }
            `}</style>

            {/* Particles Background */}
            {init && (
                <Particles
                    id="tsparticles-login"
                    key={appearance}
                    options={particlesOptions}
                    className="absolute inset-0 z-0 pointer-events-none"
                />
            )}

            {/* Theme toggle — top right */}
            <div className="absolute top-6 right-6 z-50">
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

            {/* Login Card */}
            <div className="anim-card relative z-10 w-full max-w-sm md:max-w-4xl">
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl dark:shadow-none">
                    <div className="grid md:grid-cols-2 h-full">

                        {/* LEFT SIDE: Brand image */}
                        <div
                            className="relative hidden md:flex flex-col justify-end bg-cover bg-center overflow-hidden m-4 rounded-xl"
                            style={{ backgroundImage: `url('/assets/img/unifastbg.jpg')` }}
                        >
                            <div className="absolute inset-0 bg-black/20 dark:bg-black/40 z-0" />
                        </div>

                        {/* RIGHT SIDE: Login form */}
                        <div className="flex flex-col justify-center p-8 md:p-12">

                            {/* Logos */}
                            <div className="anim-logos flex justify-center items-center gap-3 mb-8">
                                <img src="/assets/img/ched-logo.png" alt="CHED" className="h-10 w-auto" />
                                <img src="/assets/img/unifast.png" alt="UniFAST" className="h-9 w-auto" />
                                <img src="/assets/img/bagong-pilipinas.png" alt="Bagong Pilipinas" className="h-10 w-auto" />
                                <img src="/assets/img/achieve.png" alt="ACHIEVE" className="h-12 w-auto" />
                            </div>

                            {/* Header text */}
                            <div className="anim-header flex flex-col items-center gap-1 text-center mb-6">
                                <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-muted-foreground pb-2">
                                    CHED Region XII — SOCCSKSARGEN
                                </p>
                                <h1 className="text-sm font-bold tracking-wide text-foreground">
                                    Liquidation Management System
                                </h1>
                                <div className="h-px w-12 bg-border my-3" />
                                <h2 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                                    User Login
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    Enter your email and password to continue
                                </p>
                            </div>

                            {/* Form */}
                            <div className="anim-form">
                                <Form
                                    {...store.form()}
                                    resetOnSuccess={['password']}
                                    className="flex flex-col gap-5"
                                >
                                    {({ processing, errors }) => (
                                        <>
                                            <div className="grid gap-2">
                                                <Label
                                                    htmlFor="email"
                                                    className="text-xs uppercase font-medium text-muted-foreground"
                                                >
                                                    Email address
                                                </Label>
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    name="email"
                                                    required
                                                    autoFocus
                                                    tabIndex={1}
                                                    autoComplete="email"
                                                    placeholder="email@example.com"
                                                    className="bg-muted/50 border-border"
                                                />
                                                <InputError message={errors.email} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label
                                                    htmlFor="password"
                                                    className="text-xs uppercase font-medium text-muted-foreground"
                                                >
                                                    Password
                                                </Label>
                                                <Input
                                                    id="password"
                                                    type="password"
                                                    name="password"
                                                    required
                                                    tabIndex={2}
                                                    autoComplete="current-password"
                                                    placeholder="Password"
                                                    className="bg-muted/50 border-border"
                                                />
                                                <InputError message={errors.password} />
                                            </div>

                                            <Button
                                                type="submit"
                                                className="w-full mt-2 bg-foreground hover:bg-foreground/90 text-background rounded-md"
                                                tabIndex={4}
                                                disabled={processing}
                                            >
                                                {processing && <Spinner className="mr-2" />}
                                                Log in
                                            </Button>
                                        </>
                                    )}
                                </Form>

                                {status && (
                                    <div className="mt-4 text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                        {status}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <p className="relative z-10 mt-8 text-xs text-muted-foreground/50">
                &copy; {new Date().getFullYear()} Commission on Higher Education
            </p>
        </div>
    );
}
