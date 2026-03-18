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
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Summary', href: '#' },
    { title: 'Per HEI', href: '/summary/hei' },
];

interface HEISummary {
    hei_id: string;
    hei: {
        id: string;
        name: string;
    };
    total_disbursements: number;
    total_amount_liquidated: number;
    for_endorsement: number;
    unliquidated_amount: number;
    for_compliance: number;
    percentage_liquidation: number;
    percentage_submission: number;
}

interface Props {
    summaryPerHEI: HEISummary[];
}

export default function SummaryPerHEI({ summaryPerHEI }: Props) {
    const [searchQuery, setSearchQuery] = useState<string>('');

    const filtered = summaryPerHEI.filter(item => {
        if (!searchQuery.trim()) return true;
        return item.hei?.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

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
            <Head title="Summary per HEI" />
            <div className="py-8 w-full">
                <div className="w-full max-w-[100%] mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold tracking-tight">Summary per HEI</h2>
                            <p className="text-sm text-muted-foreground">
                                Overview of liquidation data grouped by Higher Education Institution.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search HEI..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-[250px] h-9 text-xs"
                            />
                        </div>
                    </div>

                    <div className="rounded-lg border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-b hover:bg-transparent">
                                    <TableHead className="h-9 pl-6 text-xs font-medium tracking-wider text-muted-foreground uppercase">No.</TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Name of HEI</TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Total Disbursements</TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Total Amount Liquidated</TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">For Endorsement</TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Unliquidated Amount</TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">For Compliance</TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">% Age of Liquidation</TableHead>
                                    <TableHead className="h-9 pr-6 text-xs font-medium tracking-wider text-muted-foreground uppercase">% Age of Submission</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                                            {searchQuery ? 'No matching HEIs found.' : 'No data available.'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtered.map((row, index) => (
                                        <TableRow key={row.hei_id}>
                                            <TableCell className="pl-6 font-medium">{index + 1}</TableCell>
                                            <TableCell className="font-medium">{row.hei?.name || 'N/A'}</TableCell>
                                            <TableCell className="font-mono">{formatCurrency(row.total_disbursements)}</TableCell>
                                            <TableCell className="font-mono">{formatCurrency(row.total_amount_liquidated)}</TableCell>
                                            <TableCell className="font-mono">{formatCurrency(row.for_endorsement)}</TableCell>
                                            <TableCell className="font-mono">{formatCurrency(row.unliquidated_amount)}</TableCell>
                                            <TableCell className="font-mono">{formatCurrency(row.for_compliance)}</TableCell>
                                            <TableCell>{formatPercentage(row.percentage_liquidation)}</TableCell>
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
