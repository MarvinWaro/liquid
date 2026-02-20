import { useCallback, useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AmountInput from './amount-input';
import {
    type RunningDataEntry,
    createEmptyRunningDataEntry,
    isRunningDataEntryFilled,
} from '@/types/liquidation';

interface RunningDataTableProps {
    liquidationId: number;
    initialEntries: RunningDataEntry[];
    totalDisbursements: number;
    totalGrantees: number;
    isHEIUser: boolean;
    onTotalLiquidatedChange: (total: number) => void;
}

export default function RunningDataTable({
    liquidationId,
    initialEntries,
    totalDisbursements,
    totalGrantees,
    isHEIUser,
    onTotalLiquidatedChange,
}: RunningDataTableProps) {
    const [entries, setEntries] = useState<RunningDataEntry[]>(
        initialEntries.length > 0 ? initialEntries : [createEmptyRunningDataEntry()]
    );
    const [isSaving, setIsSaving] = useState(false);

    const updateEntries = useCallback((updater: (prev: RunningDataEntry[]) => RunningDataEntry[]) => {
        setEntries(prev => {
            const next = updater(prev);
            // Notify parent of total liquidated change
            const total = next.reduce((sum, entry) =>
                sum + Number(entry.amount_complete_docs ?? 0) + Number(entry.amount_refunded ?? 0), 0);
            onTotalLiquidatedChange(total);
            return next;
        });
    }, [onTotalLiquidatedChange]);

    const addEntry = useCallback(() => {
        updateEntries(prev => [...prev, createEmptyRunningDataEntry()]);
    }, [updateEntries]);

    const removeEntry = useCallback((index: number) => {
        updateEntries(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
    }, [updateEntries]);

    const updateField = useCallback((index: number, field: keyof RunningDataEntry, value: string | number | null) => {
        updateEntries(prev => prev.map((entry, i) => i === index ? { ...entry, [field]: value } : entry));
    }, [updateEntries]);

    const computeRunningTotals = useMemo(() => {
        return entries.map((entry, index) => {
            const totalAmtLiquidated = Number(entry.amount_complete_docs ?? 0) + Number(entry.amount_refunded ?? 0);

            let cumulativeLiquidated = 0;
            for (let i = 0; i <= index; i++) {
                cumulativeLiquidated += Number(entries[i].amount_complete_docs ?? 0) + Number(entries[i].amount_refunded ?? 0);
            }
            const totalUnliquidated = totalDisbursements - cumulativeLiquidated;

            const percentage = totalDisbursements > 0 ? ((cumulativeLiquidated / totalDisbursements) * 100) : 0;

            let previousGrantees = 0;
            for (let i = 0; i < index; i++) {
                previousGrantees += Number(entries[i].grantees_liquidated ?? 0);
            }
            const remainingGrantees = totalGrantees - previousGrantees;

            let previousLiquidated = 0;
            for (let i = 0; i < index; i++) {
                previousLiquidated += Number(entries[i].amount_complete_docs ?? 0) + Number(entries[i].amount_refunded ?? 0);
            }
            const remainingDisbursements = Math.max(0, totalDisbursements - previousLiquidated);

            return {
                totalAmtLiquidated,
                totalUnliquidated: Math.max(0, totalUnliquidated),
                percentage: Math.min(100, Math.max(0, percentage)),
                remainingGrantees: Math.max(0, remainingGrantees),
                remainingDisbursements,
            };
        });
    }, [entries, totalDisbursements, totalGrantees]);

    const save = useCallback(() => {
        let totalGranteesUsed = 0;
        let totalAmtLiquidated = 0;
        for (const entry of entries) {
            totalGranteesUsed += Number(entry.grantees_liquidated ?? 0);
            totalAmtLiquidated += Number(entry.amount_complete_docs ?? 0) + Number(entry.amount_refunded ?? 0);
        }

        if (totalGranteesUsed > totalGrantees) {
            toast.error(`Total grantees liquidated (${totalGranteesUsed}) exceeds total grantees (${totalGrantees}).`);
            return;
        }
        if (totalAmtLiquidated > totalDisbursements) {
            toast.error(`Total amount liquidated (${totalAmtLiquidated.toLocaleString('en-PH', { minimumFractionDigits: 2 })}) exceeds total disbursements (${totalDisbursements.toLocaleString('en-PH', { minimumFractionDigits: 2 })}).`);
            return;
        }

        setIsSaving(true);
        const entriesWithComputed = entries.map(entry => ({
            ...entry,
            total_amount_liquidated: Number(entry.amount_complete_docs ?? 0) + Number(entry.amount_refunded ?? 0),
        }));
        router.post(route('liquidation.save-running-data', liquidationId), {
            entries: entriesWithComputed,
        }, {
            onSuccess: () => setIsSaving(false),
            onError: () => {
                setIsSaving(false);
                toast.error('Failed to save running data. Please check your inputs.');
            },
            preserveScroll: true,
        });
    }, [liquidationId, entries, totalDisbursements, totalGrantees]);

    return (
        <div className="mb-3">
            <Card>
                <CardHeader className="pb-2 pt-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-sm font-semibold">Running Data</CardTitle>
                            <CardDescription className="text-xs">Liquidation running financial data and transmittal references</CardDescription>
                        </div>
                        {!isHEIUser && (
                            <Button size="sm" onClick={save} disabled={isSaving} className="h-7 text-xs px-3">
                                <Save className="h-3 w-3 mr-1" />
                                {isSaving ? 'Saving...' : 'Save'}
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="pb-3">
                    <div className="overflow-x-auto -mx-3">
                        <table className="w-full text-xs min-w-[1400px]">
                            <thead>
                                <tr className="bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-800">
                                    <th className="text-left font-semibold text-emerald-700 dark:text-emerald-300 px-2 py-2 text-xs">Total Disbursements</th>
                                    <th className="text-left font-semibold text-emerald-700 dark:text-emerald-300 px-2 py-2 text-xs">Total Grantees</th>
                                    <th className="text-left font-semibold text-emerald-700 dark:text-emerald-300 px-2 py-2 text-xs">No. of Grantees Liquidated</th>
                                    <th className="text-left font-semibold text-emerald-700 dark:text-emerald-300 px-2 py-2 text-xs">Amt w/ Complete Docs</th>
                                    <th className="text-left font-semibold text-emerald-700 dark:text-emerald-300 px-2 py-2 text-xs">Amt Refunded</th>
                                    <th className="text-left font-semibold text-emerald-700 dark:text-emerald-300 px-2 py-2 text-xs">Refund OR No.</th>
                                    <th className="text-left font-semibold text-emerald-700 dark:text-emerald-300 px-2 py-2 text-xs">Total Amt Liquidated</th>
                                    <th className="text-left font-semibold text-emerald-700 dark:text-emerald-300 px-2 py-2 text-xs">Total Unliquidated Amt</th>
                                    <th className="text-left font-semibold text-emerald-700 dark:text-emerald-300 px-2 py-2 text-xs">% of Liquidation</th>
                                    <th className="text-left font-semibold text-emerald-700 dark:text-emerald-300 px-2 py-2 text-xs">Transmittal Ref No.</th>
                                    <th className="text-left font-semibold text-emerald-700 dark:text-emerald-300 px-2 py-2 text-xs">Group Transmittal Ref No.</th>
                                    <th className="px-2 py-2 w-8 bg-emerald-50 dark:bg-emerald-950/30"></th>
                                </tr>
                            </thead>
                            <tbody className={isHEIUser ? 'pointer-events-none opacity-75' : ''}>
                                {entries.map((entry, index) => {
                                    const computed = computeRunningTotals[index];
                                    return (
                                        <tr key={entry.id || index} className="border-b last:border-0 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20">
                                            {/* Total Disbursements (running) */}
                                            <td className="px-2 py-1.5">
                                                <span className="font-medium text-xs">
                                                    {computed.remainingDisbursements.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                            {/* Total Grantees (running) */}
                                            <td className="px-2 py-1.5">
                                                <span className="font-medium text-xs">
                                                    {index === 0 ? totalGrantees : computed.remainingGrantees}
                                                </span>
                                            </td>
                                            {/* No. of Grantees Liquidated */}
                                            <td className="px-2 py-1.5">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={entry.grantees_liquidated ?? ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value ? parseInt(e.target.value) : null;
                                                        if (val !== null && val > computed.remainingGrantees) {
                                                            toast.error(`Cannot exceed remaining grantees. Only ${computed.remainingGrantees} grantee(s) remaining.`);
                                                        }
                                                        if (val !== null && val < 0) {
                                                            toast.error('Grantees liquidated cannot be negative.');
                                                        }
                                                        const clamped = val !== null ? Math.min(Math.max(0, val), computed.remainingGrantees) : null;
                                                        updateField(index, 'grantees_liquidated', clamped);
                                                    }}
                                                    className="h-7 text-xs min-w-[90px]"
                                                    placeholder="0"
                                                />
                                            </td>
                                            {/* Amt w/ Complete Docs */}
                                            <td className="px-2 py-1.5">
                                                <AmountInput
                                                    value={entry.amount_complete_docs}
                                                    onValueChange={(val) => {
                                                        if (val !== null && val < 0) {
                                                            toast.error('Amount with Complete Docs cannot be negative.');
                                                            return;
                                                        }
                                                        if (val !== null) {
                                                            const refunded = Number(entry.amount_refunded ?? 0);
                                                            let otherEntriesTotal = 0;
                                                            entries.forEach((e, i) => {
                                                                if (i !== index) otherEntriesTotal += Number(e.amount_complete_docs ?? 0) + Number(e.amount_refunded ?? 0);
                                                            });
                                                            const newCumulative = otherEntriesTotal + val + refunded;
                                                            if (newCumulative > totalDisbursements) {
                                                                toast.error(`Total amount liquidated across all entries (${newCumulative.toLocaleString('en-PH', { minimumFractionDigits: 2 })}) would exceed total disbursements (${totalDisbursements.toLocaleString('en-PH', { minimumFractionDigits: 2 })}).`);
                                                            }
                                                        }
                                                        updateField(index, 'amount_complete_docs', val);
                                                    }}
                                                    className="h-7 text-xs min-w-[120px]"
                                                />
                                            </td>
                                            {/* Amt Refunded */}
                                            <td className="px-2 py-1.5">
                                                <AmountInput
                                                    value={entry.amount_refunded}
                                                    onValueChange={(val) => {
                                                        if (val !== null && val < 0) {
                                                            toast.error('Amount Refunded cannot be negative.');
                                                            return;
                                                        }
                                                        if (val !== null) {
                                                            const completeDocs = Number(entry.amount_complete_docs ?? 0);
                                                            let otherEntriesTotal = 0;
                                                            entries.forEach((e, i) => {
                                                                if (i !== index) otherEntriesTotal += Number(e.amount_complete_docs ?? 0) + Number(e.amount_refunded ?? 0);
                                                            });
                                                            const newCumulative = otherEntriesTotal + completeDocs + val;
                                                            if (newCumulative > totalDisbursements) {
                                                                toast.error(`Total amount liquidated across all entries (${newCumulative.toLocaleString('en-PH', { minimumFractionDigits: 2 })}) would exceed total disbursements (${totalDisbursements.toLocaleString('en-PH', { minimumFractionDigits: 2 })}).`);
                                                            }
                                                        }
                                                        updateField(index, 'amount_refunded', val);
                                                    }}
                                                    className="h-7 text-xs min-w-[120px]"
                                                />
                                            </td>
                                            {/* Refund OR No. */}
                                            <td className="px-2 py-1.5">
                                                <Input type="text" value={entry.refund_or_no ?? ''} onChange={(e) => updateField(index, 'refund_or_no', e.target.value)} className="h-7 text-xs min-w-[100px]" placeholder="OR No." />
                                            </td>
                                            {/* Total Amt Liquidated (computed) */}
                                            <td className="px-2 py-1.5">
                                                <span className="font-medium text-xs text-green-700">
                                                    {computed.totalAmtLiquidated.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                            {/* Total Unliquidated (computed) */}
                                            <td className="px-2 py-1.5">
                                                <span className="font-medium text-xs text-orange-600">
                                                    {computed.totalUnliquidated.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                            {/* % of Liquidation (computed) */}
                                            <td className="px-2 py-1.5">
                                                <span className="font-medium text-xs">{computed.percentage.toFixed(2)}%</span>
                                            </td>
                                            {/* Transmittal Ref No. */}
                                            <td className="px-2 py-1.5">
                                                <Input type="text" value={entry.transmittal_ref_no ?? ''} onChange={(e) => updateField(index, 'transmittal_ref_no', e.target.value)} className="h-7 text-xs min-w-[120px]" placeholder="Ref No." />
                                            </td>
                                            {/* Group Transmittal Ref No. */}
                                            <td className="px-2 py-1.5">
                                                <Input type="text" value={entry.group_transmittal_ref_no ?? ''} onChange={(e) => updateField(index, 'group_transmittal_ref_no', e.target.value)} className="h-7 text-xs min-w-[120px]" placeholder="Group Ref No." />
                                            </td>
                                            {/* Delete */}
                                            <td className="px-2 py-1.5">
                                                {!isHEIUser && entries.length > 1 && (
                                                    <DeleteRowButton isFilled={isRunningDataEntryFilled(entry)} onDelete={() => removeEntry(index)} />
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {!isHEIUser && (
                        <Button size="sm" onClick={addEntry} className="mt-3 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 shadow-sm">
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            Add Entry
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function DeleteRowButton({ isFilled, onDelete }: { isFilled: boolean; onDelete: () => void }) {
    if (!isFilled) {
        return (
            <Button variant="ghost" size="sm" onClick={onDelete} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
            </Button>
        );
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" side="left" align="center">
                <p className="text-sm font-medium mb-1">Delete this row?</p>
                <p className="text-xs text-muted-foreground mb-3">This row has existing data.</p>
                <div className="flex justify-end gap-2">
                    <PopoverClose asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs px-2">Cancel</Button>
                    </PopoverClose>
                    <PopoverClose asChild>
                        <Button variant="destructive" size="sm" className="h-7 text-xs px-2" onClick={onDelete}>Delete</Button>
                    </PopoverClose>
                </div>
            </PopoverContent>
        </Popover>
    );
}
