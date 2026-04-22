import { useCallback, useSyncExternalStore } from 'react';

export type FontPreference = 'inter' | 'plex' | 'jetbrains';

const STORAGE_KEY = 'font-preference';
const FONT_CLASSES: Record<FontPreference, string> = {
    inter: 'font-pref-inter',
    plex: 'font-pref-plex',
    jetbrains: 'font-pref-jetbrains',
};

const listeners = new Set<() => void>();
let currentFont: FontPreference = 'inter';

const getStoredFont = (): FontPreference => {
    if (typeof window === 'undefined') return 'inter';
    const stored = localStorage.getItem(STORAGE_KEY) as FontPreference | null;
    return stored && stored in FONT_CLASSES ? stored : 'inter';
};

const applyFont = (font: FontPreference): void => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    Object.values(FONT_CLASSES).forEach((cls) => root.classList.remove(cls));
    root.classList.add(FONT_CLASSES[font]);
};

const subscribe = (callback: () => void) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
};

const notify = (): void => listeners.forEach((l) => l());

export function initializeFont(): void {
    if (typeof window === 'undefined') return;
    currentFont = getStoredFont();
    applyFont(currentFont);
}

export function useFontPreference() {
    const font: FontPreference = useSyncExternalStore(
        subscribe,
        () => currentFont,
        () => 'inter' as FontPreference,
    );

    const setFont = useCallback((value: FontPreference): void => {
        currentFont = value;
        localStorage.setItem(STORAGE_KEY, value);
        applyFont(value);
        notify();
    }, []);

    return { font, setFont } as const;
}
