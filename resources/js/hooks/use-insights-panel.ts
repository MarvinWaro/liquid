import { useCallback, useSyncExternalStore } from 'react';

/**
 * Whether the Insights panel on the Activity Logs page is expanded.
 *
 * Persisted per browser so someone who only ever wants the table can collapse it
 * once and never see it again. Follows the same useSyncExternalStore shape as
 * use-layout-preference.tsx so multiple mounts stay in sync.
 */

const STORAGE_KEY = 'activity-logs-insights-open';

const listeners = new Set<() => void>();

// Default to open: the panel is the new thing, and it should be seen at least once.
let isOpen = true;

const subscribe = (callback: () => void) => {
    listeners.add(callback);

    return () => listeners.delete(callback);
};

const notify = (): void => listeners.forEach((l) => l());

export function initializeInsightsPanel(): void {
    if (typeof window === 'undefined') return;
    isOpen = localStorage.getItem(STORAGE_KEY) !== 'false';
}

export function useInsightsPanel() {
    const open = useSyncExternalStore(
        subscribe,
        () => isOpen,
        () => true,
    );

    const setOpen = useCallback((value: boolean): void => {
        isOpen = value;
        localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
        notify();
    }, []);

    const toggle = useCallback((): void => setOpen(!isOpen), [setOpen]);

    return { open, setOpen, toggle } as const;
}
