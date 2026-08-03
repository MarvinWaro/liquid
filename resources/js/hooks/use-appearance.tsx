import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

export type ResolvedAppearance = 'light' | 'dark';
export type Appearance = ResolvedAppearance | 'system';

/** Screen point (usually the click) the reveal circle grows from. */
export type ThemeTransitionOrigin = { x: number; y: number };

const listeners = new Set<() => void>();
let currentAppearance: Appearance = 'light';

const prefersDark = (): boolean => {
    if (typeof window === 'undefined') return false;

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const prefersReducedMotion = (): boolean => {
    if (typeof window === 'undefined') return false;

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const setCookie = (name: string, value: string, days = 365): void => {
    if (typeof document === 'undefined') return;
    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${value};path=/;max-age=${maxAge};SameSite=Lax`;
};

const getStoredAppearance = (): Appearance => {
    if (typeof window === 'undefined') return 'light';

    return (localStorage.getItem('appearance') as Appearance) || 'light';
};

const isDarkMode = (appearance: Appearance): boolean => {
    return appearance === 'dark' || (appearance === 'system' && prefersDark());
};

const applyTheme = (appearance: Appearance): void => {
    if (typeof document === 'undefined') return;

    const isDark = isDarkMode(appearance);

    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
};

const subscribe = (callback: () => void) => {
    listeners.add(callback);

    return () => listeners.delete(callback);
};

const notify = (): void => listeners.forEach((listener) => listener());

const mediaQuery = (): MediaQueryList | null => {
    if (typeof window === 'undefined') return null;

    return window.matchMedia('(prefers-color-scheme: dark)');
};

const handleSystemThemeChange = (): void => {
    applyTheme(currentAppearance);
    notify();
};

export function initializeTheme(): void {
    if (typeof window === 'undefined') return;

    if (!localStorage.getItem('appearance')) {
        localStorage.setItem('appearance', 'light');
        setCookie('appearance', 'light');
    }

    currentAppearance = getStoredAppearance();
    applyTheme(currentAppearance);

    // Set up system theme change listener
    mediaQuery()?.addEventListener('change', handleSystemThemeChange);
}

// Marks the document for the duration of the theme's view transition so
// `app.css` can disable the browser's default cross-fade without touching
// Inertia's own page-navigation transitions, which target the same root.
const THEME_TRANSITION_CLASS = 'theme-transition';

/**
 * Plays a "circle grows from the clicked point" reveal via the View
 * Transitions API, then applies the theme change inside it. Browsers without
 * support, and users who asked for reduced motion, get the instant switch.
 */
function runThemeTransition(apply: () => void, origin?: ThemeTransitionOrigin): void {
    if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function' || prefersReducedMotion()) {
        apply();
        return;
    }

    const { x, y } = origin ?? { x: window.innerWidth / 2, y: 0 };
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    document.documentElement.classList.add(THEME_TRANSITION_CLASS);

    // The DOM mutation must land before the browser captures the "after"
    // snapshot; flushSync forces the React-driven parts of it (e.g. the
    // toggle button's icon) to commit synchronously instead of on React's
    // own schedule.
    const transition = document.startViewTransition(() => flushSync(apply));

    transition.ready
        .then(() =>
            document.documentElement.animate(
                {
                    clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
                },
                {
                    duration: 500,
                    easing: 'ease-in-out',
                    pseudoElement: '::view-transition-new(root)',
                },
            ),
        )
        .catch(() => {});

    transition.finished.catch(() => {}).finally(() => {
        document.documentElement.classList.remove(THEME_TRANSITION_CLASS);
    });
}

export function useAppearance() {
    const appearance: Appearance = useSyncExternalStore(
        subscribe,
        () => currentAppearance,
        () => 'light',
    );

    const resolvedAppearance: ResolvedAppearance = useMemo(
        () => (isDarkMode(appearance) ? 'dark' : 'light'),
        [appearance],
    );

    const updateAppearance = useCallback((mode: Appearance, origin?: ThemeTransitionOrigin): void => {
        const apply = () => {
            currentAppearance = mode;

            // Store in localStorage for client-side persistence...
            localStorage.setItem('appearance', mode);

            // Store in cookie for SSR...
            setCookie('appearance', mode);

            applyTheme(mode);
            notify();
        };

        // Re-selecting the theme that's already showing (e.g. "system" while
        // the OS is already dark) has nothing to reveal — skip the animation.
        if (isDarkMode(mode) === isDarkMode(currentAppearance)) {
            apply();
            return;
        }

        runThemeTransition(apply, origin);
    }, []);

    return { appearance, resolvedAppearance, updateAppearance } as const;
}
