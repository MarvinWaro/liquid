import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useAppearance } from '@/hooks/use-appearance';
import { home } from '@/routes';
import { store } from '@/routes/login';
import { Form, Head, Link } from '@inertiajs/react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import {
    ArrowLeft,
    Check,
    CircleAlert,
    Monitor,
    Moon,
    Sun,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface LoginProps {
    status?: string;
    googleAuthError?: string;
    canResetPassword: boolean;
    turnstile?: {
        enabled: boolean;
        siteKey?: string | null;
    };
}

type TurnstileRenderTheme = 'light' | 'dark' | 'auto';

interface TurnstileRenderOptions {
    sitekey: string;
    theme: TurnstileRenderTheme;
    size: 'normal' | 'compact' | 'flexible';
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
}

interface TurnstileApi {
    render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
    reset: (widgetId?: string) => void;
    remove: (widgetId?: string) => void;
}

declare global {
    interface Window {
        turnstile?: TurnstileApi;
    }
}

const TURNSTILE_SCRIPT_ID = 'cloudflare-turnstile-script';
const TURNSTILE_SCRIPT_SRC =
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export default function Login({
    status,
    googleAuthError,
    canResetPassword,
    turnstile = { enabled: false, siteKey: null },
}: LoginProps) {
    const { appearance, updateAppearance } = useAppearance();
    const [init, setInit] = useState(false);
    const [themeMenuOpen, setThemeMenuOpen] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState('');
    const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);

    const turnstileEnabled = turnstile.enabled;
    const turnstileSiteKey = turnstile.siteKey ?? '';
    const isTurnstileReady = !turnstileEnabled || Boolean(turnstileToken);

    const clearTurnstileToken = useCallback(() => {
        setTurnstileToken('');
    }, []);

    const resetTurnstile = useCallback(() => {
        setTurnstileToken('');
        setTurnstileResetSignal((value) => value + 1);
    }, []);

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
        <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background p-6 transition-colors duration-300 md:p-10">
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
                    className="pointer-events-none absolute inset-0 z-0"
                />
            )}

            {/* Back to landing — top left (mirrors theme toggle on the right) */}
            <div className="absolute top-6 left-6 z-50">
                <Link
                    href={home()}
                    aria-label="Back to landing page"
                    title="Back to landing page"
                    className="group inline-flex h-9 items-center gap-2 rounded-full border border-border bg-background/80 px-3 text-muted-foreground backdrop-blur-sm transition-all hover:border-foreground/30 hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                    <span className="hidden text-xs font-medium tracking-wide sm:inline">
                        Back
                    </span>
                </Link>
            </div>

            {/* Theme toggle — top right */}
            <div className="absolute top-6 right-6 z-50">
                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setThemeMenuOpen(!themeMenuOpen);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground backdrop-blur-sm transition-all hover:border-foreground/30 hover:text-foreground"
                        title="Switch theme"
                    >
                        {appearance === 'light' && <Sun className="h-4 w-4" />}
                        {appearance === 'dark' && <Moon className="h-4 w-4" />}
                        {appearance === 'system' && (
                            <Monitor className="h-4 w-4" />
                        )}
                    </button>

                    {themeMenuOpen && (
                        <div
                            className="absolute top-11 right-0 z-50 w-36 rounded-lg border border-border bg-popover py-1 shadow-lg"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {themeOptions.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        updateAppearance(option.value);
                                        setThemeMenuOpen(false);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-popover-foreground transition-colors hover:bg-accent"
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
            <div className="anim-card relative z-10 w-full max-w-md">
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl dark:shadow-none">
                    <div className="flex flex-col justify-center p-8 sm:p-10">
                        {/* Logos — also act as a home link */}
                        <Link
                            href={home()}
                            aria-label="Back to landing page"
                            title="Back to landing page"
                            className="anim-logos mb-8 flex items-center justify-center gap-3 rounded-md transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
                        >
                            <img
                                src="/assets/img/ched-logo.png"
                                alt="CHED"
                                className="h-10 w-auto"
                            />
                            <img
                                src="/assets/img/unifast.png"
                                alt="UniFAST"
                                className="h-9 w-auto"
                            />
                            <img
                                src="/assets/img/bagong-pilipinas.png"
                                alt="Bagong Pilipinas"
                                className="h-10 w-auto"
                            />
                            <img
                                src="/assets/img/achieve.png"
                                alt="ACHIEVE"
                                className="h-12 w-auto"
                            />
                        </Link>

                        {/* Header text */}
                        <div className="anim-header mb-6 flex flex-col items-center gap-1 text-center">
                            <p className="pb-2 text-[10px] font-semibold tracking-[0.25em] text-muted-foreground uppercase">
                                CHED Region XII — SOCCSKSARGEN
                            </p>
                            <h1 className="text-sm font-bold tracking-wide text-foreground">
                                Liquidation Management System
                            </h1>
                            <div className="my-3 h-px w-12 bg-border" />
                            <h2 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                                User Login
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                Enter your email and password to continue
                            </p>
                        </div>

                        {/* Form */}
                        <div className="anim-form">
                            {googleAuthError && (
                                <div
                                    role="alert"
                                    className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                                >
                                    <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                    <span>{googleAuthError}</span>
                                </div>
                            )}

                            <Form
                                {...store.form()}
                                resetOnSuccess={['password']}
                                onError={resetTurnstile}
                                onCancel={resetTurnstile}
                                className="flex flex-col gap-2"
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <div className="grid gap-2">
                                            <Label
                                                htmlFor="email"
                                                className="text-xs font-medium text-muted-foreground uppercase"
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
                                                className="border-border bg-muted/50"
                                            />
                                            <InputError
                                                message={errors.email}
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label
                                                htmlFor="password"
                                                className="text-xs font-medium text-muted-foreground uppercase"
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
                                                className="border-border bg-muted/50"
                                            />
                                            <InputError
                                                message={errors.password}
                                            />
                                        </div>

                                        {turnstileEnabled && (
                                            <div className="grid gap-2">
                                                {turnstileSiteKey ? (
                                                    <TurnstileWidget
                                                        siteKey={
                                                            turnstileSiteKey
                                                        }
                                                        appearance={appearance}
                                                        resetSignal={
                                                            turnstileResetSignal
                                                        }
                                                        onVerify={
                                                            setTurnstileToken
                                                        }
                                                        onExpire={
                                                            clearTurnstileToken
                                                        }
                                                    />
                                                ) : (
                                                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                                                        Security check is not
                                                        configured.
                                                    </div>
                                                )}
                                                <input
                                                    type="hidden"
                                                    name="cf-turnstile-response"
                                                    value={turnstileToken}
                                                />
                                                <InputError
                                                    message={
                                                        errors[
                                                            'cf-turnstile-response'
                                                        ]
                                                    }
                                                />
                                            </div>
                                        )}

                                        <Button
                                            type="submit"
                                            className="mt-2 w-full rounded-md bg-foreground text-background hover:bg-foreground/90"
                                            tabIndex={4}
                                            disabled={
                                                processing || !isTurnstileReady
                                            }
                                        >
                                            {processing && (
                                                <Spinner className="mr-2" />
                                            )}
                                            Log in
                                        </Button>

                                        <div className="flex items-center gap-3">
                                            <div className="h-px flex-1 bg-border" />
                                            <span className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
                                                or
                                            </span>
                                            <div className="h-px flex-1 bg-border" />
                                        </div>

                                        <Button
                                            variant="outline"
                                            className="w-full border-border bg-background text-foreground hover:bg-accent"
                                            asChild
                                        >
                                            <a
                                                href="/auth/google/redirect"
                                                aria-label="Sign in with Google"
                                            >
                                                <GoogleMark className="h-4 w-4" />
                                                Sign in with Google
                                            </a>
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

            {/* Footer */}
            <p className="relative z-10 mt-8 text-xs text-muted-foreground/50">
                &copy; {new Date().getFullYear()} Commission on Higher Education
            </p>
        </div>
    );
}

function GoogleMark({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
        >
            <path
                fill="#4285F4"
                d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.25c1.9-1.75 2.97-4.33 2.97-7.44z"
            />
            <path
                fill="#34A853"
                d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.25-2.52c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.05v2.6A10 10 0 0 0 12 22z"
            />
            <path
                fill="#FBBC05"
                d="M6.41 13.89A6 6 0 0 1 6.1 12c0-.66.11-1.3.31-1.89v-2.6H3.05a10 10 0 0 0 0 8.98l3.36-2.6z"
            />
            <path
                fill="#EA4335"
                d="M12 5.99c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.61 9.61 0 0 0 12 2 10 10 0 0 0 3.05 7.51l3.36 2.6C7.2 7.75 9.4 5.99 12 5.99z"
            />
        </svg>
    );
}

function TurnstileWidget({
    siteKey,
    appearance,
    resetSignal,
    onVerify,
    onExpire,
}: {
    siteKey: string;
    appearance: string;
    resetSignal: number;
    onVerify: (token: string) => void;
    onExpire: () => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const hasMountedRef = useRef(false);
    const [scriptReady, setScriptReady] = useState(
        () => typeof window !== 'undefined' && Boolean(window.turnstile),
    );
    const [loadFailed, setLoadFailed] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        if (window.turnstile) {
            setScriptReady(true);
            return;
        }

        const existingScript = document.getElementById(
            TURNSTILE_SCRIPT_ID,
        ) as HTMLScriptElement | null;
        const script = existingScript ?? document.createElement('script');

        const handleLoad = () => {
            setLoadFailed(false);
            setScriptReady(true);
        };

        const handleError = () => {
            setLoadFailed(true);
            onExpire();
        };

        script.addEventListener('load', handleLoad);
        script.addEventListener('error', handleError);

        if (!existingScript) {
            script.id = TURNSTILE_SCRIPT_ID;
            script.src = TURNSTILE_SCRIPT_SRC;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        }

        return () => {
            script.removeEventListener('load', handleLoad);
            script.removeEventListener('error', handleError);
        };
    }, [onExpire]);

    useEffect(() => {
        if (
            !scriptReady ||
            !containerRef.current ||
            !window.turnstile ||
            widgetIdRef.current
        ) {
            return;
        }

        const theme: TurnstileRenderTheme =
            appearance === 'dark'
                ? 'dark'
                : appearance === 'light'
                  ? 'light'
                  : 'auto';

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme,
            size: 'flexible',
            callback: onVerify,
            'expired-callback': onExpire,
            'error-callback': onExpire,
        });

        return () => {
            if (widgetIdRef.current && window.turnstile) {
                window.turnstile.remove(widgetIdRef.current);
                widgetIdRef.current = null;
            }
        };
    }, [appearance, onExpire, onVerify, scriptReady, siteKey]);

    useEffect(() => {
        if (!hasMountedRef.current) {
            hasMountedRef.current = true;
            return;
        }

        if (widgetIdRef.current && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current);
            onExpire();
        }
    }, [onExpire, resetSignal]);

    return (
        <div className="min-h-[65px] leading-none">
            <div ref={containerRef} />
            {loadFailed && (
                <p className="mt-2 text-xs text-destructive">
                    Security check could not load. Refresh the page and try
                    again.
                </p>
            )}
        </div>
    );
}
