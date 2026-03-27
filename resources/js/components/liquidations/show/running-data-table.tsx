import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BarChart3, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from '@/lib/toast';
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
    latestLiquidationStatus?: string;
    onTotalLiquidatedChange: (total: number) => void;
    updatedAt?: string | null;
}

interface ComputedTotals {
    totalAmtLiquidated: number;
    totalUnliquidated: number;
    percentage: number;
    remainingGrantees: number;
    remainingDisbursements: number;
}

export default function RunningDataTable({
    liquidationId,
    initialEntries,
    totalDisbursements,
    totalGrantees,
    isHEIUser,
    latestLiquidationStatus,
    onTotalLiquidatedChange,
    updatedAt,
}: RunningDataTableProps) {
    // Hide "Add Entry" when latest tracking entry's liquidation status is "Unliquidated"
    const isDisabled = latestLiquidationStatus === 'Unliquidated';
    const [entries, setEntries] = useState<RunningDataEntry[]>(
        initialEntries.length > 0 ? initialEntries : [createEmptyRunningDataEntry()]
    );
    const [isSaving, setIsSaving] = useState(false);
    const prevDisabled = useRef(isDisabled);

    // Remove empty unsaved rows when switching to "Unliquidated"
    useEffect(() => {
        if (isDisabled && !prevDisabled.current) {
            setEntries(prev => {
                const filled = prev.filter(e => e.id || isRunningDataEntryFilled(e));
                return filled.length > 0 ? filled : prev.slice(0, 1);
            });
        }
        prevDisabled.current = isDisabled;
    }, [isDisabled]);

    const updateEntries = useCallback((updater: (prev: RunningDataEntry[]) => RunningDataEntry[]) => {
        setEntries(prev => {
            const next = updater(prev);
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

    const computeRunningTotals = useMemo((): ComputedTotals[] => {
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
            expected_updated_at: updatedAt,
        }, {
            onSuccess: () => setIsSaving(false),
            onError: (errors) => {
                setIsSaving(false);
                if (errors.conflict) {
                    toast.error(errors.conflict, {
                        action: {
                            label: 'Refresh',
                            onClick: () => window.location.reload(),
                        },
                        duration: 10000,
                    });
                } else {
                    toast.error('Failed to save running data. Please check your inputs.');
                }
            },
            preserveScroll: true,
        });
    }, [liquidationId, entries, totalDisbursements, totalGrantees, updatedAt]);

    const canDelete = entries.length > 1;

    return (
        <div id="running-data" className="mb-6">
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-md bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                                <BarChart3 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                            </div>
                            <div>
                                <CardTitle className="text-base font-semibold">Running Data</CardTitle>
                                <CardDescription className="text-xs">Liquidation running financial data and transmittal references</CardDescription>
                            </div>
                        </div>
                        {!isHEIUser && (
                            <Button size="sm" onClick={save} disabled={isSaving} className="h-8 text-xs px-3 bg-foreground text-background hover:bg-foreground/90">
                                <Save className="h-3.5 w-3.5 mr-1.5" />
                                {isSaving ? 'Saving...' : 'Save'}
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="pb-5">
                    <div className="overflow-x-auto -mx-6">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40">
                                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">Disbursements</th>
                                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">Grantees</th>
                                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">Liquidated</th>
                                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">Amt w/ Docs</th>
                                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">Refunded</th>
                                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">Refund OR</th>
                                    <th className="text-right font-medium text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">Total Liq.</th>
                                    <th className="text-right font-medium text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">Unliquidated</th>
                                    <th className="text-right font-medium text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">%</th>
                                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">Transmittal Ref</th>
                                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">Group Ref</th>
                                    {!isHEIUser && <th className="px-3 py-2.5 w-8"></th>}
                                </tr>
                            </thead>
                            <tbody className={isHEIUser ? 'pointer-events-none opacity-60' : ''}>
                                {entries.map((entry, index) => {
                                    return (
                                        <RunningDataRow
                                            key={entry.id || `new-${index}`}
                                            entry={entry}
                                            index={index}
                                            computed={computeRunningTotals[index]}
                                            isFirstEntry={index === 0}
                                            totalGrantees={totalGrantees}
                                            totalDisbursements={totalDisbursements}
                                            entries={entries}
                                            isHEIUser={isHEIUser}
                                            canDelete={canDelete}
                                            updateField={updateField}
                                            removeEntry={removeEntry}
                                        />
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {!isHEIUser && !isDisabled && (
                        <Button size="sm" onClick={addEntry} className="mt-4 h-8 text-xs px-3 bg-foreground text-background hover:bg-foreground/90">
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            Add Entry
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

/* ── Memoized Row ── */

const fmt = (n: number) => n.toLocaleString('en-PH', { minimumFractionDigits: 2 });

interface RunningDataRowProps {
    entry: RunningDataEntry;
    index: number;
    computed: ComputedTotals;
    isFirstEntry: boolean;
    totalGrantees: number;
    totalDisbursements: number;
    entries: RunningDataEntry[];
    isHEIUser: boolean;
    canDelete: boolean;
    updateField: (index: number, field: keyof RunningDataEntry, value: string | number | null) => void;
    removeEntry: (index: number) => void;
}

const RunningDataRow = React.memo(function RunningDataRow({
    entry,
    index,
    computed,
    isFirstEntry,
    totalGrantees,
    totalDisbursements,
    entries,
    isHEIUser,
    canDelete,
    updateField,
    removeEntry,
}: RunningDataRowProps) {
    return (
        <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
            <td className="px-3 py-2">
                <span className="text-sm tabular-nums text-muted-foreground">
                    {fmt(computed.remainingDisbursements)}
                </span>
            </td>
            <td className="px-3 py-2">
                <span className="text-sm tabular-nums text-muted-foreground">
                    {isFirstEntry ? totalGrantees : computed.remainingGrantees}
                </span>
            </td>
            <td className="px-3 py-2">
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
                    className="h-8 text-xs min-w-[70px]"
                    placeholder="0"
                />
            </td>
            <td className="px-3 py-2">
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
                            const maxAllowed = Math.max(0, totalDisbursements - otherEntriesTotal - refunded);
                            if (val > maxAllowed) {
                                toast.error(`Cannot exceed remaining amount. Only ${fmt(maxAllowed)} remaining.`);
                            }
                            const clamped = Math.min(val, maxAllowed);
                            updateField(index, 'amount_complete_docs', clamped);
                            return;
                        }
                        updateField(index, 'amount_complete_docs', val);
                    }}
                    className="h-8 text-xs min-w-[100px]"
                />
            </td>
            <td className="px-3 py-2">
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
                            const maxAllowed = Math.max(0, totalDisbursements - otherEntriesTotal - completeDocs);
                            if (val > maxAllowed) {
                                toast.error(`Cannot exceed remaining amount. Only ${fmt(maxAllowed)} remaining.`);
                            }
                            const clamped = Math.min(val, maxAllowed);
                            updateField(index, 'amount_refunded', clamped);
                            return;
                        }
                        updateField(index, 'amount_refunded', val);
                    }}
                    className="h-8 text-xs min-w-[100px]"
                />
            </td>
            <td className="px-3 py-2">
                <Input type="text" value={entry.refund_or_no ?? ''} onChange={(e) => updateField(index, 'refund_or_no', e.target.value)} className="h-8 text-xs min-w-[80px]" placeholder="OR No." />
            </td>
            <td className="px-3 py-2 text-right">
                <span className="text-sm font-medium tabular-nums text-foreground">
                    {fmt(computed.totalAmtLiquidated)}
                </span>
            </td>
            <td className="px-3 py-2 text-right">
                <span className={`text-sm font-medium tabular-nums ${computed.totalUnliquidated > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'}`}>
                    {fmt(computed.totalUnliquidated)}
                </span>
            </td>
            <td className="px-3 py-2 text-right">
                <span className="text-sm font-medium tabular-nums text-foreground">{computed.percentage.toFixed(2)}%</span>
            </td>
            <td className="px-3 py-2">
                <Input type="text" value={entry.transmittal_ref_no ?? ''} onChange={(e) => updateField(index, 'transmittal_ref_no', e.target.value)} className="h-8 text-xs min-w-[90px]" placeholder="Ref No." />
            </td>
            <td className="px-3 py-2">
                <Input type="text" value={entry.group_transmittal_ref_no ?? ''} onChange={(e) => updateField(index, 'group_transmittal_ref_no', e.target.value)} className="h-8 text-xs min-w-[90px]" placeholder="Group Ref" />
            </td>
            {!isHEIUser && (
                <td className="px-3 py-2">
                    {canDelete && (
                        <DeleteRowButton isFilled={isRunningDataEntryFilled(entry)} onDelete={() => removeEntry(index)} />
                    )}
                </td>
            )}
        </tr>
    );
});

/* ── Sub-components ── */

const DeleteRowButton = React.memo(function DeleteRowButton({ isFilled, onDelete }: { isFilled: boolean; onDelete: () => void }) {
    if (!isFilled) {
        return (
            <Button variant="ghost" size="sm" onClick={onDelete} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
            </Button>
        );
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
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
});
