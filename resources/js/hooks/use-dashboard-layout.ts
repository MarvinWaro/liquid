import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface CardState {
    visible: boolean;
    /** 0 = normal, 1 = double width, 2 = full width */
    expandLevel: number;
}

interface StoredLayout {
    order: string[];
    cards: Record<string, CardState>;
}

interface LayoutState {
    order: string[];
    cards: Record<string, CardState>;
}

const DEFAULT_CARD: CardState = { visible: true, expandLevel: 0 };

/** Migrate old boolean `expanded` to numeric `expandLevel` */
function migrateCard(raw: Record<string, unknown>): CardState {
    if (typeof raw.expandLevel === 'number') return raw as unknown as CardState;
    return {
        visible: (raw.visible as boolean) ?? true,
        expandLevel: raw.expanded ? 1 : 0,
    };
}

export function useDashboardLayout(availableCardIds: string[], storageKey: string = 'dashboard-layout') {
    const [stored, setStored] = useState<StoredLayout>(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                // Migrate cards from old format
                const cards: Record<string, CardState> = {};
                for (const [id, val] of Object.entries(parsed.cards || {})) {
                    cards[id] = migrateCard(val as Record<string, unknown>);
                }
                return { order: parsed.order || [], cards };
            }
        } catch {
            // ignore
        }
        return { order: [], cards: {} };
    });

    // Merge stored state with currently available cards
    const layout = useMemo<LayoutState>(() => {
        const availableSet = new Set(availableCardIds);

        // Keep stored order for cards that still exist
        const existingOrder = stored.order.filter((id) => availableSet.has(id));
        // Append any new cards that weren't stored yet
        const newCards = availableCardIds.filter((id) => !existingOrder.includes(id));
        const order = [...existingOrder, ...newCards];

        const cards: Record<string, CardState> = {};
        for (const id of order) {
            cards[id] = stored.cards[id] ?? DEFAULT_CARD;
        }

        return { order, cards };
    }, [availableCardIds, stored]);

    // Persist to localStorage only when the serialized layout actually changes
    const lastWrittenRef = useRef<string>('');
    useEffect(() => {
        const serialized = JSON.stringify({ order: layout.order, cards: layout.cards });
        if (serialized !== lastWrittenRef.current) {
            localStorage.setItem(storageKey, serialized);
            lastWrittenRef.current = serialized;
        }
    }, [layout, storageKey]);

    const updateOrder = useCallback((newOrder: string[]) => {
        setStored((prev) => ({ ...prev, order: newOrder }));
    }, []);

    const toggleVisibility = useCallback((id: string) => {
        setStored((prev) => ({
            ...prev,
            cards: {
                ...prev.cards,
                [id]: {
                    ...(prev.cards[id] ?? DEFAULT_CARD),
                    visible: !(prev.cards[id]?.visible ?? true),
                },
            },
        }));
    }, []);

    /** Cycle expand: 0 → 1 → 2 → 0 */
    const cycleExpand = useCallback((id: string) => {
        setStored((prev) => {
            const current = prev.cards[id] ?? DEFAULT_CARD;
            return {
                ...prev,
                cards: {
                    ...prev.cards,
                    [id]: {
                        ...current,
                        expandLevel: (current.expandLevel + 1) % 3,
                    },
                },
            };
        });
    }, []);

    const showCard = useCallback((id: string) => {
        setStored((prev) => ({
            ...prev,
            cards: {
                ...prev.cards,
                [id]: { ...(prev.cards[id] ?? DEFAULT_CARD), visible: true },
            },
        }));
    }, []);

    const resetLayout = useCallback(() => {
        setStored({
            order: availableCardIds,
            cards: Object.fromEntries(availableCardIds.map((id) => [id, { ...DEFAULT_CARD }])),
        });
    }, [availableCardIds]);

    const hiddenCardIds = useMemo(
        () => layout.order.filter((id) => !layout.cards[id]?.visible),
        [layout],
    );

    return { layout, updateOrder, toggleVisibility, cycleExpand, showCard, resetLayout, hiddenCardIds };
}
