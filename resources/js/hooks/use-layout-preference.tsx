import { useCallback, useSyncExternalStore } from 'react';

export type LayoutPreference = 'header' | 'sidebar';

const STORAGE_KEY = 'layout-preference';
const listeners = new Set<() => void>();
let currentLayout: LayoutPreference = 'header';

const getStoredLayout = (): LayoutPreference => {
    if (typeof window === 'undefined') return 'header';
    return (localStorage.getItem(STORAGE_KEY) as LayoutPreference) || 'header';
};

const subscribe = (callback: () => void) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
};

const notify = (): void => listeners.forEach((l) => l());

export function initializeLayout(): void {
    if (typeof window === 'undefined') return;
    currentLayout = getStoredLayout();
}

export function useLayoutPreference() {
    const layout: LayoutPreference = useSyncExternalStore(
        subscribe,
        () => currentLayout,
        () => 'header' as LayoutPreference,
    );

    const setLayout = useCallback((value: LayoutPreference): void => {
        currentLayout = value;
        localStorage.setItem(STORAGE_KEY, value);
        notify();
    }, []);

    const toggleLayout = useCallback((): void => {
        setLayout(currentLayout === 'header' ? 'sidebar' : 'header');
    }, [setLayout]);

    return { layout, setLayout, toggleLayout } as const;
}
