import { memo, useMemo, useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';

export interface RecentLiquidation {
    id: number;
    control_no: string;
    hei?: {
        id: number;
        name: string;
    };
    academic_year: string;
    semester: string;
    amount_received: number;
    status: string;
    created_at: string;
}

const formatCurrency = (amount: number | null | undefined) => {
    const value = amount ?? 0;
    return `₱${parseFloat(value.toString()).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

const getStatusColor = (status: string) => {
    switch (status) {
        case 'draft':
        case 'Draft':
            return 'bg-muted text-muted-foreground border-border';
        case 'for_initial_review':
            return 'bg-foreground text-background border-foreground';
        case 'endorsed_to_accounting':
            return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800/60';
        case 'endorsed_to_coa':
        case 'Endorsed to COA':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60';
        case 'returned_to_hei':
        case 'returned_to_rc':
        case 'Returned':
            return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60';
        case 'Submitted':
            return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/60';
        case 'Verified':
            return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60';
        case 'Cleared':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60';
        default:
            return 'bg-muted text-muted-foreground border-border';
    }
};

interface Props {
    data: RecentLiquidation[] | undefined;
}

export const RecentLiquidationsTable = memo(function RecentLiquidationsTable({ data }: Props) {
    const [search, setSearch] = useState('');

    if (!data) {
        return (
            <div>
                <div className="flex gap-4 px-6 py-2 border-b">
                    {[28, 0, 20, 24, 16, 20].map((w, i) => (
                        <Skeleton key={i} className={`h-3 ${w ? `w-${w}` : 'flex-1'}`} />
                    ))}
                </div>
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex gap-4 px-6 py-3.5 border-b last:border-0">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <Skeleton className="h-4 w-20" />
                    </div>
                ))}
            </div>
        );
    }

    const filtered = useMemo(() => {
        if (!search.trim()) return data;
        const q = search.toLowerCase();
        return data.filter(item =>
            item.control_no.toLowerCase().includes(q) ||
            item.hei?.name.toLowerCase().includes(q) ||
            item.academic_year.toLowerCase().includes(q) ||
            item.semester.toLowerCase().includes(q) ||
            item.status.toLowerCase().includes(q),
        );
    }, [data, search]);

    return (
        <div>
            <div className="flex items-center gap-2 px-6 pb-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search liquidations..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-[250px] h-9 text-xs"
                />
            </div>
            <Table>
                <TableHeader>
                    <TableRow className="border-b hover:bg-transparent">
                        <TableHead className="h-9 pl-6 text-xs font-medium tracking-wider text-muted-foreground uppercase">Control / Ledger No.</TableHead>
                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">HEI</TableHead>
                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Academic Year</TableHead>
                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Total Disbursements</TableHead>
                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Status</TableHead>
                        <TableHead className="h-9 pr-6 text-xs font-medium tracking-wider text-muted-foreground uppercase">Date</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filtered.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                {search ? 'No matching liquidations found.' : 'No data available.'}
                            </TableCell>
                        </TableRow>
                    ) : (
                        filtered.map((liq) => (
                            <TableRow key={liq.id}>
                                <TableCell className="pl-6 font-medium font-mono text-sm">
                                    {liq.control_no}
                                </TableCell>
                                <TableCell>{liq.hei?.name || 'N/A'}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="text-sm">{liq.academic_year}</span>
                                        <span className="text-xs text-muted-foreground">{liq.semester}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                    {formatCurrency(liq.amount_received)}
                                </TableCell>
                                <TableCell>
                                    <Badge className={`${getStatusColor(liq.status)} shadow-none border font-normal text-xs`}>
                                        {liq.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="pr-6 text-sm text-muted-foreground">
                                    {new Date(liq.created_at).toLocaleDateString()}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
});
