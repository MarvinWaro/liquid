import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Filter } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Summary', href: '#' },
    { title: 'Per Academic Year', href: '/summary/academic-year' },
];

interface AYSummary {
    academic_year: string;
    total_disbursements: number;
    liquidated_amount: number;
    unliquidated_amount: number;
    for_endorsement: number;
    for_compliance: number;
    percentage_liquidation: number;
    percentage_compliance: number;
    percentage_submission: number;
}

interface Props {
    summaryPerAY: AYSummary[];
}

export default function SummaryPerAcademicYear({ summaryPerAY }: Props) {
    const [ayFilter, setAYFilter] = useState<string>('all');

    const academicYears = ['all', ...Array.from(new Set(summaryPerAY.map(item => item.academic_year)))];

    const filtered = ayFilter === 'all'
        ? summaryPerAY
        : summaryPerAY.filter(item => item.academic_year === ayFilter);

    const formatCurrency = (amount: number | null | undefined) => {
        const value = amount ?? 0;
        return `₱${parseFloat(value.toString()).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    const formatPercentage = (percentage: number | null) => {
        if (percentage === null || isNaN(percentage)) return '0.00%';
        return `${parseFloat(percentage.toString()).toFixed(2)}%`;
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Summary per Academic Year" />
            <div className="py-8 w-full">
                <div className="w-full max-w-[100%] mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold tracking-tight">Summary per Academic Year</h2>
                            <p className="text-sm text-muted-foreground">
                                Overview of liquidation data grouped by academic year.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <Select value={ayFilter} onValueChange={setAYFilter}>
                                <SelectTrigger className="w-[180px] h-9 text-xs">
                                    <SelectValue placeholder="Filter by year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {academicYears.map(year => (
                                        <SelectItem key={year} value={year} className="text-xs">
                                            {year === 'all' ? 'All Years' : year}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="rounded-lg border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-b hover:bg-transparent">
                                    <TableHead className="h-9 pl-6 text-xs font-medium tracking-wider text-muted-foreground uppercase">Academic Year</TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Total Disbursements</TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Liquidated Amount</TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Unliquidated Amount</TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">For Endorsement</TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">For Compliance</TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">% Age of Liquidation</TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">% Age for Compliance</TableHead>
                                    <TableHead className="h-9 pr-6 text-xs font-medium tracking-wider text-muted-foreground uppercase">% Age of Submission</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                                            No data available.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtered.map((row) => (
                                        <TableRow key={row.academic_year}>
                                            <TableCell className="pl-6 font-medium">{row.academic_year}</TableCell>
                                            <TableCell className="font-mono">{formatCurrency(row.total_disbursements)}</TableCell>
                                            <TableCell className="font-mono">{formatCurrency(row.liquidated_amount)}</TableCell>
                                            <TableCell className="font-mono">{formatCurrency(row.unliquidated_amount)}</TableCell>
                                            <TableCell className="font-mono">{formatCurrency(row.for_endorsement)}</TableCell>
                                            <TableCell className="font-mono">{formatCurrency(row.for_compliance)}</TableCell>
                                            <TableCell>{formatPercentage(row.percentage_liquidation)}</TableCell>
                                            <TableCell>{formatPercentage(row.percentage_compliance)}</TableCell>
                                            <TableCell className="pr-6">{formatPercentage(row.percentage_submission)}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
