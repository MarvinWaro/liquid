import { useCallback, useSyncExternalStore } from 'react';

export type ResolvedAppearance = 'light' | 'dark';
export type Appearance = ResolvedAppearance | 'system';

const listeners = new Set<() => void>();
let currentAppearance: Appearance = 'light';

interface ThemeViewTransition {
    ready: Promise<void>;
    finished: Promise<void>;
    skipTransition: () => void;
}

type ViewTransitionDocument = Document & {
    startViewTransition?: (
        callback: () => void | Promise<void>,
    ) => ThemeViewTransition;
};

let activeThemeTransition: ThemeViewTransition | null = null;

const prefersDark = (): boolean => {
    if (typeof window === 'undefined') return false;

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const prefersReducedMotion = (): boolean => {
    if (typeof window === 'undefined') return true;

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

type AppearanceSnapshot = `${Appearance}:${ResolvedAppearance}`;

const getAppearanceSnapshot = (): AppearanceSnapshot =>
    `${currentAppearance}:${isDarkMode(currentAppearance) ? 'dark' : 'light'}`;

const commitAppearance = (mode: Appearance): void => {
    currentAppearance = mode;

    // Store in localStorage for client-side persistence...
    localStorage.setItem('appearance', mode);

    // Store in cookie for SSR...
    setCookie('appearance', mode);

    applyTheme(mode);
    notify();
};

/**
 * Start the reveal where the user interacted. Theme controls are buttons/menu
 * items, so the focused element is a reliable origin without coupling this
 * shared hook to every individual control.
 */
const getTransitionOrigin = (): { x: number; y: number } => {
    const activeElement = document.activeElement;

    if (
        activeElement instanceof HTMLElement &&
        activeElement !== document.body
    ) {
        const rect = activeElement.getBoundingClientRect();

        if (rect.width > 0 && rect.height > 0) {
            return {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
            };
        }
    }

    // Header theme controls live at the top-right in both authenticated layouts.
    return { x: window.innerWidth - 32, y: 32 };
};

const animateAppearanceChange = (mode: Appearance): void => {
    const transitionDocument = document as ViewTransitionDocument;
    const oldIsDark = isDarkMode(currentAppearance);
    const newIsDark = isDarkMode(mode);

    // Persist mode-only changes too (for example dark -> system while the OS is
    // dark), but do not animate when the rendered colors will stay the same.
    if (
        oldIsDark === newIsDark ||
        prefersReducedMotion() ||
        !transitionDocument.startViewTransition
    ) {
        activeThemeTransition?.skipTransition();
        commitAppearance(mode);
        return;
    }

    const { x, y } = getTransitionOrigin();
    const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
    );

    activeThemeTransition?.skipTransition();
    document.documentElement.classList.add('theme-transition');

    let transition: ThemeViewTransition;

    try {
        transition = transitionDocument.startViewTransition(() => {
            commitAppearance(mode);
        });
    } catch {
        document.documentElement.classList.remove('theme-transition');
        commitAppearance(mode);
        return;
    }

    activeThemeTransition = transition;

    void transition.ready
        .then(() => {
            document.documentElement.animate(
                {
                    clipPath: [
                        `circle(0px at ${x}px ${y}px)`,
                        `circle(${radius}px at ${x}px ${y}px)`,
                    ],
                },
                {
                    duration: 700,
                    easing: 'cubic-bezier(0.76, 0, 0.24, 1)',
                    fill: 'both',
                    pseudoElement: '::view-transition-new(root)',
                } as KeyframeAnimationOptions,
            );
        })
        .catch(() => {
            // The theme has already been applied; an interrupted animation only
            // needs to fall back to the final state.
        });

    void transition.finished.then(
        () => {
            if (activeThemeTransition === transition) {
                activeThemeTransition = null;
                document.documentElement.classList.remove('theme-transition');
            }
        },
        () => {
            if (activeThemeTransition === transition) {
                activeThemeTransition = null;
                document.documentElement.classList.remove('theme-transition');
            }
        },
    );
};

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

export function useAppearance() {
    const snapshot = useSyncExternalStore(
        subscribe,
        getAppearanceSnapshot,
        () => 'light:light' as AppearanceSnapshot,
    );

    const [appearance, resolvedAppearance] = snapshot.split(':') as [
        Appearance,
        ResolvedAppearance,
    ];

    const updateAppearance = useCallback((mode: Appearance): void => {
        if (typeof document === 'undefined') return;

        animateAppearanceChange(mode);
    }, []);

    return { appearance, resolvedAppearance, updateAppearance } as const;
}
