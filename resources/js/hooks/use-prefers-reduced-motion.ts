import { useSyncExternalStore } from 'react';

/**
 * Tracks the OS "reduce motion" accessibility setting.
 *
 * CSS handles decorative keyframes on its own via a
 * `@media (prefers-reduced-motion: reduce)` block, but animation driven from JS —
 * the particle engine, the boards' requestAnimationFrame auto-scroll — has to ask.
 *
 * Mirrors the store pattern in `use-mobile.tsx`: one module-level MediaQueryList
 * shared by every consumer, and a server snapshot so SSR renders the calm variant
 * rather than assuming motion is wanted.
 */

const QUERY = '(prefers-reduced-motion: reduce)';

const mql = typeof window === 'undefined' ? undefined : window.matchMedia(QUERY);

function subscribe(callback: () => void) {
    if (!mql) {
        return () => {};
    }

    mql.addEventListener('change', callback);

    return () => {
        mql.removeEventListener('change', callback);
    };
}

function getSnapshot(): boolean {
    return mql?.matches ?? false;
}

function getServerSnapshot(): boolean {
    // Assume reduced on the server: rendering static first and enabling motion on
    // hydration is the safe direction, since the reverse would animate briefly for
    // someone who asked not to see it.
    return true;
}

export function usePrefersReducedMotion(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
