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
}

const COMPLETED_STATUSES = ['fully liquidated', 'voided'];

const todayString = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const DashboardCalendar = memo(function DashboardCalendar({ dueDates }: Props) {
    const todayStr = useMemo(todayString, []);

    const [calendarDate, setCalendarDate] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });
    const [dueListSearch, setDueListSearch] = useState('');
    // Defer the search value so typing stays instant; filter/render runs at low priority.
    const deferredDueListSearch = useDeferredValue(dueListSearch);

    const DUE_LIST_PAGE_SIZE = 20;
    const [visibleCount, setVisibleCount] = useState(DUE_LIST_PAGE_SIZE);
    // Reset page whenever the effective (deferred) search changes.
    useEffect(() => {
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

    const visibleDueDates = useMemo(
        () => filteredDueDates.slice(0, visibleCount),
        [filteredDueDates, visibleCount],
    );
    const hasMore = filteredDueDates.length > visibleCount;

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
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Upcoming Due Dates
                            {dueListSearch && (
                                <span className="ml-1.5 font-normal normal-case">
                                    ({filteredDueDates.length} of {sortedDueDates.length})
                                </span>
                            )}
                        </p>
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
                            <p className="text-xs text-muted-foreground text-center py-4">No matching due dates.</p>
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
