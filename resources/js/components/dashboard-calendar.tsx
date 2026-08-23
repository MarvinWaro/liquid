import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { manilaToday } from '@/lib/date';

export interface CalendarDueDate {
    id: string;
    control_no: string;
    due_date: string;
    amount_received: number;
    hei_name: string | null;
    program_code: string | null;
    academic_year: string | null;
    status: string;
    fund_source: 'unifast' | 'stufaps';
}

interface Props {
    dueDates: CalendarDueDate[];
    /**
     * Today's date in Philippine time ("YYYY-MM-DD"), supplied by the server.
     *
     * Overdue is a business decision, so it must not depend on the viewer's machine:
     * a laptop in another timezone — or with a wrong clock — would otherwise mark a
     * liquidation "Due today" while Manila already counts it late. Falls back to the
     * browser's Manila date only if the prop is missing.
     */
    today?: string;
}

const COMPLETED_STATUSES = ['fully liquidated', 'voided'];

export const DashboardCalendar = memo(function DashboardCalendar({ dueDates, today }: Props) {
    const todayStr = useMemo(() => today ?? manilaToday(), [today]);

    const [calendarDate, setCalendarDate] = useState(() => {
        // Open on the month that contains the server's today, not the laptop's.
        const [year, month] = todayStr.split('-');
        return { year: Number(year), month: Number(month) - 1 };
    });
    const [dueListSearch, setDueListSearch] = useState('');
    // Defer the search value so typing stays instant; filter/render runs at low priority.
    const deferredDueListSearch = useDeferredValue(dueListSearch);

    const DUE_LIST_PAGE_SIZE = 20;
    const [visibleCount, setVisibleCount] = useState(DUE_LIST_PAGE_SIZE);
    const [dueTab, setDueTab] = useState<'overdue' | 'upcoming'>('overdue');
    // Reset page whenever the effective (deferred) search changes.
    useEffect(() => {
        // Paging back to the first page when the search term changes. Deliberate: the
        // old offset is meaningless against a different result set.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVisibleCount(DUE_LIST_PAGE_SIZE);
    }, [deferredDueListSearch]);

    const navigateMonth = useCallback((dir: -1 | 1) => {
        setCalendarDate(prev => {
            let m = prev.month + dir;
            let y = prev.year;
            if (m < 0) { m = 11; y--; }
            if (m > 11) { m = 0; y++; }
            return { year: y, month: m };
        });
    }, []);

    const calendarGrid = useMemo(() => {
        const { year, month } = calendarDate;
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days: (number | null)[] = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let d = 1; d <= daysInMonth; d++) days.push(d);
        return days;
    }, [calendarDate]);

    const dueDatesByDay = useMemo(() => {
        const map: Record<string, CalendarDueDate[]> = {};
        for (const item of dueDates) {
            if (!map[item.due_date]) map[item.due_date] = [];
            map[item.due_date].push(item);
        }
        return map;
    }, [dueDates]);

    const sortedDueDates = useMemo(() => {
        return [...dueDates]
            .filter(d => !COMPLETED_STATUSES.includes(d.status.toLowerCase()))
            .sort((a, b) => {
                const aOverdue = a.due_date < todayStr;
                const bOverdue = b.due_date < todayStr;
                if (aOverdue && !bOverdue) return -1;
                if (!aOverdue && bOverdue) return 1;
                return a.due_date.localeCompare(b.due_date);
            });
    }, [dueDates, todayStr]);

    const filteredDueDates = useMemo(() => {
        const q = deferredDueListSearch.trim().toLowerCase();
        if (!q) return sortedDueDates;
        return sortedDueDates.filter(item =>
            item.control_no.toLowerCase().includes(q) ||
            (item.hei_name ?? '').toLowerCase().includes(q) ||
            (item.program_code ?? '').toLowerCase().includes(q)
        );
    }, [sortedDueDates, deferredDueListSearch]);

    /**
     * Past due, using the same comparison the row badge below renders with.
     *
     * They have to agree: split the list on a different rule and an item lands
     * under Upcoming while showing an overdue badge. Anchored to the server's
     * today, never the viewer's clock.
     */
    const isOverdueItem = useCallback(
        (item: CalendarDueDate) => item.due_date <= todayStr,
        [todayStr],
    );

    const overdueDueDates = useMemo(
        () => filteredDueDates.filter(isOverdueItem),
        [filteredDueDates, isOverdueItem],
    );
    const upcomingDueDates = useMemo(
        () => filteredDueDates.filter(item => !isOverdueItem(item)),
        [filteredDueDates, isOverdueItem],
    );

    const activeDueDates = dueTab === 'overdue' ? overdueDueDates : upcomingDueDates;

    const visibleDueDates = useMemo(
        () => activeDueDates.slice(0, visibleCount),
        [activeDueDates, visibleCount],
    );
    const hasMore = activeDueDates.length > visibleCount;

    const { year, month } = calendarDate;
    const monthName = new Date(year, month).toLocaleString('en-US', { month: 'long', year: 'numeric' });

    return (
        <TooltipProvider delayDuration={200}>
        <div className="flex flex-col h-full">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(-1)}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold tracking-tight">{monthName}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(1)}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">{d}</div>
                ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
                {calendarGrid.map((day, idx) => {
                    if (day === null) return <div key={`e-${idx}`} className="h-10" />;
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dues = dueDatesByDay[dateStr];
                    const count = dues?.length || 0;
                    const isToday = dateStr === todayStr;
                    const hasDue = count > 0;
                    const isOverdue = hasDue && dateStr <= todayStr && dues!.some(d => !COMPLETED_STATUSES.includes(d.status.toLowerCase()));

                    return (
                        <Tooltip key={dateStr}>
                            <TooltipTrigger asChild>
                                <div className={`h-10 w-full flex items-center justify-center rounded-lg text-sm font-medium transition-all cursor-default
                                    ${isToday && !hasDue ? 'ring-2 ring-primary font-bold' : ''}
                                    ${hasDue
                                        ? isOverdue
                                            ? 'bg-red-500 text-white font-bold shadow-sm'
                                            : 'bg-red-100 text-red-700 font-bold dark:bg-red-900/50 dark:text-red-300'
                                        : 'text-foreground hover:bg-muted/50'
                                    }
                                    ${isToday && hasDue ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}
                                `}>
                                    {day}
                                </div>
                            </TooltipTrigger>
                            {count > 0 && (
                                <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                                    <p className="font-semibold">{count} due date{count > 1 ? 's' : ''}</p>
                                    {dues!.slice(0, 3).map(d => (
                                        <p key={d.id} className="text-muted-foreground">{d.program_code} — {d.control_no}</p>
                                    ))}
                                    {count > 3 && <p className="text-muted-foreground">+{count - 3} more</p>}
                                </TooltipContent>
                            )}
                        </Tooltip>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-500" /> Overdue</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-100 dark:bg-red-900/50" /> Upcoming</span>
            </div>

            {/* Due dates list */}
            {sortedDueDates.length > 0 && (
                <div className="mt-4 border-t pt-4">
                    {/* Overdue first: it is the half that needs chasing, and it
                        was previously buried in one undifferentiated scroll. */}
                    <div className="flex items-center gap-1 mb-3">
                        {([
                            { key: 'overdue' as const, label: 'Overdue', count: overdueDueDates.length },
                            { key: 'upcoming' as const, label: 'Upcoming', count: upcomingDueDates.length },
                        ]).map(tab => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => { setDueTab(tab.key); setVisibleCount(DUE_LIST_PAGE_SIZE); }}
                                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                                    dueTab === tab.key
                                        ? tab.key === 'overdue'
                                            ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                            : 'bg-muted text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {tab.label}
                                <span className="tabular-nums opacity-70">{tab.count}</span>
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative mb-3">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                            value={dueListSearch}
                            onChange={e => setDueListSearch(e.target.value)}
                            placeholder="Search by program, HEI, or control no..."
                            className="pl-8 pr-8 h-8 text-xs"
                        />
                        {dueListSearch && (
                            <button
                                onClick={() => setDueListSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {filteredDueDates.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">
                                {dueListSearch
                                    ? 'No matching due dates.'
                                    : dueTab === 'overdue'
                                      ? 'Nothing overdue.'
                                      : 'Nothing upcoming.'}
                            </p>
                        ) : (
                            <>
                                {visibleDueDates.map(item => {
                                    const isOverdue = item.due_date <= todayStr;
                                    const dueDate = new Date(item.due_date + 'T00:00:00');
                                    const diffDays = Math.ceil((dueDate.getTime() - new Date(todayStr + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));
                                    const urgencyLabel = isOverdue
                                        ? `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`
                                        : diffDays === 0 ? 'Due today'
                                        : `${diffDays} day${diffDays !== 1 ? 's' : ''} left`;

                                    return (
                                        <div key={item.id} className={`rounded-lg border p-2.5 text-xs transition-colors ${isOverdue ? 'border-red-200 bg-red-50/50 dark:border-red-800/40 dark:bg-red-950/20' : ''}`}>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-mono font-bold text-foreground">{item.control_no}</span>
                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isOverdue ? 'bg-red-500 text-white' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'}`}>
                                                    {urgencyLabel}
                                                </span>
                                            </div>
                                            <p className="text-muted-foreground truncate">{item.program_code} — {item.hei_name || 'N/A'}</p>
                                            <p className="text-muted-foreground/70 text-[10px]">
                                                Due: {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                {item.academic_year && ` • ${item.academic_year}`}
                                            </p>
                                        </div>
                                    );
                                })}
                                {hasMore && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full h-8 text-xs"
                                        onClick={() => setVisibleCount(c => c + DUE_LIST_PAGE_SIZE)}
                                    >
                                        Show more ({filteredDueDates.length - visibleCount} remaining)
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
        </TooltipProvider>
    );
});
