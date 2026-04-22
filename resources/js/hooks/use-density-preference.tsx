import { useCallback, useSyncExternalStore } from 'react';

export type DensityPreference = 'comfortable' | 'compact';

const STORAGE_KEY = 'density-preference';
const DENSITY_CLASSES: Record<DensityPreference, string> = {
    comfortable: 'density-comfortable',
    compact: 'density-compact',
};

const listeners = new Set<() => void>();
let currentDensity: DensityPreference = 'comfortable';

const getStoredDensity = (): DensityPreference => {
    if (typeof window === 'undefined') return 'comfortable';
    const stored = localStorage.getItem(STORAGE_KEY) as DensityPreference | null;
    return stored && stored in DENSITY_CLASSES ? stored : 'comfortable';
};

const applyDensity = (density: DensityPreference): void => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    Object.values(DENSITY_CLASSES).forEach((cls) => root.classList.remove(cls));
    root.classList.add(DENSITY_CLASSES[density]);
};

const subscribe = (callback: () => void) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
};

const notify = (): void => listeners.forEach((l) => l());

export function initializeDensity(): void {
    if (typeof window === 'undefined') return;
    currentDensity = getStoredDensity();
    applyDensity(currentDensity);
}

export function useDensityPreference() {
    const density: DensityPreference = useSyncExternalStore(
        subscribe,
        () => currentDensity,
        () => 'comfortable' as DensityPreference,
    );

    const setDensity = useCallback((value: DensityPreference): void => {
        currentDensity = value;
        localStorage.setItem(STORAGE_KEY, value);
        applyDensity(value);
        notify();
    }, []);

    return { density, setDensity } as const;
}
