import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { GripVertical, Maximize2, Minimize2, Plus, RotateCcw, Square, X } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import Sortable from 'sortablejs';

/* ------------------------------------------------------------------ */
/*  SortableDashboard – grid container with SortableJS                */
/* ------------------------------------------------------------------ */

interface SortableDashboardProps {
    children: ReactNode;
    onOrderChange: (newOrder: string[]) => void;
    className?: string;
}

export function SortableDashboard({ children, onOrderChange, className }: SortableDashboardProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const sortableRef = useRef<Sortable | null>(null);
    const cbRef = useRef(onOrderChange);
    cbRef.current = onOrderChange;

    useEffect(() => {
        if (!containerRef.current) return;

        sortableRef.current = Sortable.create(containerRef.current, {
            animation: 250,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
            onEnd: () => {
                if (!containerRef.current) return;
                const items = containerRef.current.querySelectorAll(':scope > [data-card-id]');
                const newOrder = Array.from(items).map((el) => el.getAttribute('data-card-id')!);
                cbRef.current(newOrder);
            },
        });

        return () => {
            sortableRef.current?.destroy();
        };
    }, []);

    return (
        <div ref={containerRef} className={cn('grid grid-cols-12 gap-4', className)}>
            {children}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  DashboardCard – sortable card wrapper                             */
/* ------------------------------------------------------------------ */

function getColClass(span: number) {
    switch (span) {
        case 3:
            return 'col-span-12 lg:col-span-3';
        case 4:
            return 'col-span-12 lg:col-span-4';
        case 6:
            return 'col-span-12 lg:col-span-6';
        case 8:
            return 'col-span-12 lg:col-span-8';
        default:
            return 'col-span-12';
    }
}

/** Compute effective span from base colSpan and expand level (0/1/2) */
function getEffectiveSpan(colSpan: number, expandLevel: number): number {
    switch (expandLevel) {
        case 1:
            return Math.min(colSpan * 2, 12);
        case 2:
            return 12;
        default:
            return colSpan;
    }
}

/** Icon & tooltip for the current expand level */
function ExpandIcon({ level }: { level: number }) {
    switch (level) {
        case 1:
            return <Maximize2 className="h-3.5 w-3.5" />;
        case 2:
            return <Minimize2 className="h-3.5 w-3.5" />;
        default:
            return <Maximize2 className="h-3.5 w-3.5" />;
    }
}

function expandTitle(level: number): string {
    switch (level) {
        case 0:
            return 'Expand';
        case 1:
            return 'Full width';
        case 2:
            return 'Minimize';
        default:
            return 'Expand';
    }
}

interface DashboardCardProps {
    id: string;
    title?: string;
    colSpan?: number;
    /** 0 = normal, 1 = double, 2 = full */
    expandLevel?: number;
    onCycleExpand?: () => void;
    onRemove?: () => void;
    headerActions?: ReactNode;
    children: ReactNode;
    noPadding?: boolean;
    /** 'card' wraps in a Card; 'transparent' uses a plain div with floating controls */
    variant?: 'card' | 'transparent';
    className?: string;
}

export function DashboardCard({
    id,
    title,
    colSpan = 12,
    expandLevel = 0,
    onCycleExpand,
    onRemove,
    headerActions,
    children,
    noPadding = false,
    variant = 'card',
    className,
}: DashboardCardProps) {
    const effectiveSpan = getEffectiveSpan(colSpan, expandLevel);

    /* ---- Transparent variant (for stats grids etc.) ---- */
    if (variant === 'transparent') {
        return (
            <div data-card-id={id} className={cn(getColClass(effectiveSpan), 'group/card relative', className)}>
                {/* Floating control bar — appears on hover */}
                <div className="absolute -top-2 right-2 z-10 flex items-center gap-0.5 rounded-lg border bg-background/90 px-1.5 py-0.5 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover/card:opacity-100">
                    <button
                        className="drag-handle cursor-grab p-1 text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
                        title="Drag to reorder"
                    >
                        <GripVertical className="h-3.5 w-3.5" />
                    </button>
                    {onCycleExpand && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCycleExpand} title={expandTitle(expandLevel)}>
                            <ExpandIcon level={expandLevel} />
                        </Button>
                    )}
                    {onRemove && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={onRemove}
                            title="Remove"
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    )}
                </div>
                {children}
            </div>
        );
    }

    /* ---- Card variant (default) ---- */
    return (
        <div data-card-id={id} className={cn(getColClass(effectiveSpan), className)}>
            <Card className="h-full border-border/50 shadow-sm">
                {(title || headerActions || onCycleExpand || onRemove) && (
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <button
                                    className="drag-handle cursor-grab text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
                                    title="Drag to reorder"
                                >
                                    <GripVertical className="h-4 w-4" />
                                </button>
                                {title && <CardTitle className="text-base">{title}</CardTitle>}
                            </div>
                            <div className="flex items-center gap-1">
                                {headerActions}
                                {onCycleExpand && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={onCycleExpand}
                                        title={expandTitle(expandLevel)}
                                    >
                                        <ExpandIcon level={expandLevel} />
                                    </Button>
                                )}
                                {onRemove && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                        onClick={onRemove}
                                        title="Remove card"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                )}
                <CardContent className={cn(noPadding && 'p-0')}>{children}</CardContent>
            </Card>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  DashboardToolbar – reset & re-add hidden cards                    */
/* ------------------------------------------------------------------ */

interface HiddenCardInfo {
    id: string;
    title: string;
}

interface DashboardToolbarProps {
    hiddenCards: HiddenCardInfo[];
    onShowCard: (id: string) => void;
    onResetLayout: () => void;
}

export function DashboardToolbar({ hiddenCards, onShowCard, onResetLayout }: DashboardToolbarProps) {
    return (
        <div className="flex items-center gap-2">
            {hiddenCards.length > 0 && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 gap-1.5">
                            <Plus className="h-3.5 w-3.5" />
                            Add Card
                            <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                                {hiddenCards.length}
                            </span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {hiddenCards.map((card) => (
                            <DropdownMenuItem key={card.id} onClick={() => onShowCard(card.id)} className="cursor-pointer">
                                <Plus className="mr-2 h-3.5 w-3.5" />
                                {card.title || card.id}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onResetLayout}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
            </Button>
        </div>
    );
}
