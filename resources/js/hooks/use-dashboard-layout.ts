import { useCallback, useEffect, useMemo, useState } from 'react';

interface CardState {
    visible: boolean;
    expanded: boolean;
}

interface StoredLayout {
    order: string[];
    cards: Record<string, CardState>;
}

interface LayoutState {
    order: string[];
    cards: Record<string, CardState>;
}

export function useDashboardLayout(availableCardIds: string[], storageKey: string = 'dashboard-layout') {
    const [stored, setStored] = useState<StoredLayout>(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) return JSON.parse(raw);
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
            cards[id] = stored.cards[id] ?? { visible: true, expanded: false };
        }

        return { order, cards };
    }, [availableCardIds, stored]);

    // Persist to localStorage whenever the effective layout changes
    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify({ order: layout.order, cards: layout.cards }));
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
                    ...(prev.cards[id] ?? { visible: true, expanded: false }),
                    visible: !(prev.cards[id]?.visible ?? true),
                },
            },
        }));
    }, []);

    const toggleExpanded = useCallback((id: string) => {
        setStored((prev) => ({
            ...prev,
            cards: {
                ...prev.cards,
                [id]: {
                    ...(prev.cards[id] ?? { visible: true, expanded: false }),
                    expanded: !(prev.cards[id]?.expanded ?? false),
                },
            },
        }));
    }, []);

    const showCard = useCallback((id: string) => {
        setStored((prev) => ({
            ...prev,
            cards: {
                ...prev.cards,
                [id]: { ...(prev.cards[id] ?? { visible: true, expanded: false }), visible: true },
            },
        }));
    }, []);

    const resetLayout = useCallback(() => {
        setStored({
            order: availableCardIds,
            cards: Object.fromEntries(availableCardIds.map((id) => [id, { visible: true, expanded: false }])),
        });
    }, [availableCardIds]);

    const hiddenCardIds = layout.order.filter((id) => !layout.cards[id]?.visible);

    return { layout, updateOrder, toggleVisibility, toggleExpanded, showCard, resetLayout, hiddenCardIds };
}
