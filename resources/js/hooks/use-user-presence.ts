import axios from 'axios';
import { useEffect, useRef, useState } from 'react';

export type PresenceStatus = 'online' | 'recently_active' | 'offline';

export interface UserPresence {
    id: number;
    status: PresenceStatus;
    last_active_at: string | null;
}

interface Options {
    /** Polling interval in ms. Default 45_000 (45s). */
    pollIntervalMs?: number;
    /** User idle threshold in ms before pausing polling. Default 5 minutes. */
    idleTimeoutMs?: number;
    /** Disable the hook (e.g. when user lacks permission). Default true. */
    enabled?: boolean;
}

const DEFAULT_POLL_INTERVAL_MS = 45_000;
const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Polls the server for user online status with smart pauses.
 *
 * Pauses polling when:
 *  - the browser tab is hidden (`document.hidden`)
 *  - the user has not interacted with the page for `idleTimeoutMs`
 *
 * Resumes immediately when the tab is refocused or the user moves the mouse.
 * In-flight requests are aborted on unmount or when a new poll starts.
 */
export function useUserPresence({
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
    enabled = true,
}: Options = {}): Record<number, UserPresence> {
    const [presences, setPresences] = useState<Record<number, UserPresence>>({});
    const lastActivityRef = useRef<number>(0);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!enabled) return;

        // Seeded here, not in the useRef initialiser: Date.now() during render is
        // impure and was being re-evaluated on every render only to be discarded.
        // Nothing reads this before the effect runs — the idle check below lives in
        // this same effect.
        lastActivityRef.current = Date.now();

        let timer: ReturnType<typeof setTimeout> | null = null;
        let cancelled = false;

        const markActivity = () => {
            lastActivityRef.current = Date.now();
        };

        const fetchPresences = async () => {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            try {
                const { data } = await axios.get<{ users: UserPresence[] }>(
                    route('users.online-status'),
                    { signal: controller.signal },
                );
                if (cancelled) return;
                // Reuse existing object references when a user's status is unchanged.
                // This lets React.memo'd cells skip re-rendering — cheap shallow
                // equality keeps the 200-row table fast.
                setPresences((prev) => {
                    const next: Record<number, UserPresence> = {};
                    let changed = data.users.length !== Object.keys(prev).length;
                    for (const p of data.users) {
                        const existing = prev[p.id];
                        if (
                            existing &&
                            existing.status === p.status &&
                            existing.last_active_at === p.last_active_at
                        ) {
                            next[p.id] = existing;
                        } else {
                            next[p.id] = p;
                            changed = true;
                        }
                    }
                    return changed ? next : prev;
                });
            } catch {
                // Silent on cancel/network errors — next tick will retry.
            }
        };

        const tick = () => {
            const isHidden = typeof document !== 'undefined' && document.hidden;
            const isIdle = Date.now() - lastActivityRef.current > idleTimeoutMs;
            if (!isHidden && !isIdle) {
                fetchPresences();
            }
            timer = setTimeout(tick, pollIntervalMs);
        };

        // Initial fetch + schedule
        fetchPresences();
        timer = setTimeout(tick, pollIntervalMs);

        window.addEventListener('mousemove', markActivity);
        window.addEventListener('keydown', markActivity);
        window.addEventListener('scroll', markActivity, true);
        window.addEventListener('touchstart', markActivity);

        const onVisibilityChange = () => {
            if (!document.hidden) {
                markActivity();
                fetchPresences();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            abortRef.current?.abort();
            window.removeEventListener('mousemove', markActivity);
            window.removeEventListener('keydown', markActivity);
            window.removeEventListener('scroll', markActivity, true);
            window.removeEventListener('touchstart', markActivity);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [pollIntervalMs, idleTimeoutMs, enabled]);

    return presences;
}

/** Short relative-time string for "last seen" labels. */
export function formatLastSeen(iso: string | null): string {
    if (!iso) return 'Never';
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return 'Unknown';
    const diff = Date.now() - t;
    if (diff < 60_000) return 'Just now';
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
