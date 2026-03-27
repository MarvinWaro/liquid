import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

const SKELETON_ROWS = 8;

export function LiquidationTableSkeleton() {
    return (
        <>
            <div className="overflow-hidden rounded-t-lg border border-b-0 overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="border-b hover:bg-transparent">
                            <TableHead className="h-9 w-[50px] pl-4 text-xs font-medium tracking-wider text-muted-foreground uppercase">SEQ</TableHead>
                            <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Program</TableHead>
                            <TableHead className="h-9 max-w-[300px] text-xs font-medium tracking-wider text-muted-foreground uppercase">HEI</TableHead>
                            <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Period</TableHead>
                            <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Dates</TableHead>
                            <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Batch</TableHead>
                            <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Control No.</TableHead>
                            <TableHead className="h-9 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">Grantees</TableHead>
                            <TableHead className="h-9 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">Disbursements</TableHead>
                            <TableHead className="h-9 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">Liquidated</TableHead>
                            <TableHead className="h-9 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">Unliquidated</TableHead>
                            <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Documents Status</TableHead>
                            <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">RC Notes</TableHead>
                            <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">Liquidation Status</TableHead>
                            <TableHead className="h-9 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">%</TableHead>
                            <TableHead className="h-9 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">Lapsing</TableHead>
                            <TableHead className="h-9 text-right pr-4 text-xs font-medium tracking-wider text-muted-foreground uppercase">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                            <TableRow key={i} className="hover:bg-transparent">
                                <TableCell className="pl-4 py-3"><Skeleton className="h-4 w-6 mx-auto" /></TableCell>
                                <TableCell className="py-3"><Skeleton className="h-5 w-12 rounded-full" /></TableCell>
                                <TableCell className="py-3">
                                    <Skeleton className="h-4 w-36 mb-1" />
                                    <Skeleton className="h-3 w-24" />
                                </TableCell>
                                <TableCell className="py-3">
                                    <Skeleton className="h-4 w-20 mb-1" />
                                    <Skeleton className="h-3 w-12" />
                                </TableCell>
                                <TableCell className="py-3">
                                    <Skeleton className="h-4 w-20 mb-1" />
                                    <Skeleton className="h-3 w-16" />
                                </TableCell>
                                <TableCell className="py-3"><Skeleton className="h-4 w-10" /></TableCell>
                                <TableCell className="py-3"><Skeleton className="h-4 w-24" /></TableCell>
                                <TableCell className="py-3"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                                <TableCell className="py-3"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                                <TableCell className="py-3"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                                <TableCell className="py-3"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                                <TableCell className="py-3"><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                                <TableCell className="py-3"><Skeleton className="h-3 w-20" /></TableCell>
                                <TableCell className="py-3"><Skeleton className="h-5 w-28 rounded-full" /></TableCell>
                                <TableCell className="py-3"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                                <TableCell className="py-3"><Skeleton className="h-4 w-6 ml-auto" /></TableCell>
                                <TableCell className="pr-4 py-3"><Skeleton className="h-8 w-8 ml-auto rounded" /></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            {/* Skeleton pagination footer */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border rounded-b-lg">
                <Skeleton className="h-4 w-48" />
                <div className="flex items-center gap-1">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                </div>
            </div>
        </>
    );
}
