import { useCallback, useState } from 'react';
import { router } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Plus, Save, Trash2 } from 'lucide-react';
import AvatarStack from './avatar-stack';
import {
    type TrackingEntry,
    type LiquidationUser,
    RC_NOTES_OPTIONS,
    createEmptyTrackingEntry,
    isTrackingEntryFilled,
} from '@/types/liquidation';

interface DocumentTrackingTableProps {
    liquidationId: number;
    initialEntries: TrackingEntry[];
    isHEIUser: boolean;
    regionalCoordinators: LiquidationUser[];
    documentLocations: string[];
    avatarMap: Record<string, string>;
    onEntriesChange: (entries: TrackingEntry[]) => void;
}

export default function DocumentTrackingTable({
    liquidationId,
    initialEntries,
    isHEIUser,
    regionalCoordinators,
    documentLocations,
    avatarMap,
    onEntriesChange,
}: DocumentTrackingTableProps) {
    const [entries, setEntries] = useState<TrackingEntry[]>(
        initialEntries.length > 0 ? initialEntries : [createEmptyTrackingEntry()]
    );
    const [isSaving, setIsSaving] = useState(false);

    const updateEntries = useCallback((updater: (prev: TrackingEntry[]) => TrackingEntry[]) => {
        setEntries(prev => {
            const next = updater(prev);
            onEntriesChange(next);
            return next;
        });
    }, [onEntriesChange]);

    const addEntry = useCallback(() => {
        updateEntries(prev => [...prev, createEmptyTrackingEntry()]);
    }, [updateEntries]);

    const removeEntry = useCallback((index: number) => {
        updateEntries(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
    }, [updateEntries]);

    const updateField = useCallback((index: number, field: keyof TrackingEntry, value: string) => {
        updateEntries(prev => prev.map((entry, i) => i === index ? { ...entry, [field]: value } : entry));
    }, [updateEntries]);

    const save = useCallback(() => {
        setIsSaving(true);
        router.post(route('liquidation.save-tracking-entries', liquidationId), {
            entries: entries as any,
        }, {
            onSuccess: () => setIsSaving(false),
            onError: () => setIsSaving(false),
            preserveScroll: true,
        });
    }, [liquidationId, entries]);

    return (
        <div className="mb-3">
            <Card>
                <CardHeader className="pb-2 pt-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-sm font-semibold">Document Tracking</CardTitle>
                            <CardDescription className="text-xs">Track document submissions and review status</CardDescription>
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
                        <table className="w-full text-xs min-w-[900px]">
                            <thead>
                                <tr className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-800">
                                    <th className="text-left font-semibold text-blue-700 dark:text-blue-300 px-2 py-2 text-xs">Status of Documents</th>
                                    <th className="text-left font-semibold text-blue-700 dark:text-blue-300 px-2 py-2 text-xs">Received by</th>
                                    <th className="text-left font-semibold text-blue-700 dark:text-blue-300 px-2 py-2 text-xs">Date Received</th>
                                    <th className="text-left font-semibold text-blue-700 dark:text-blue-300 px-2 py-2 text-xs">Document Location</th>
                                    <th className="text-left font-semibold text-blue-700 dark:text-blue-300 px-2 py-2 text-xs">Reviewed by</th>
                                    <th className="text-left font-semibold text-blue-700 dark:text-blue-300 px-2 py-2 text-xs">Date Reviewed</th>
                                    <th className="text-left font-semibold text-blue-700 dark:text-blue-300 px-2 py-2 text-xs">RC Note</th>
                                    <th className="text-left font-semibold text-blue-700 dark:text-blue-300 px-2 py-2 text-xs">Date of Endorsement</th>
                                    <th className="text-left font-semibold text-blue-700 dark:text-blue-300 px-2 py-2 text-xs">Status of Liquidation</th>
                                    <th className="px-2 py-2 w-8 bg-blue-50 dark:bg-blue-950/30"></th>
                                </tr>
                            </thead>
                            <tbody className={isHEIUser ? 'pointer-events-none opacity-75' : ''}>
                                {entries.map((entry, index) => (
                                    <tr key={entry.id || index} className="border-b last:border-0 hover:bg-blue-50/50 dark:hover:bg-blue-950/20">
                                        {/* Document Status */}
                                        <td className="px-2 py-1.5">
                                            <Select value={entry.document_status} onValueChange={(v) => updateField(index, 'document_status', v)}>
                                                <SelectTrigger className="h-7 text-xs min-w-[130px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="No Submission" className="text-xs">No Submission</SelectItem>
                                                    <SelectItem value="Partial Submission" className="text-xs">Partial Submission</SelectItem>
                                                    <SelectItem value="Complete Submission" className="text-xs">Complete Submission</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>

                                        {/* Received By */}
                                        <td className="px-2 py-1.5">
                                            <RCMultiSelect
                                                value={entry.received_by}
                                                users={regionalCoordinators}
                                                avatarMap={avatarMap}
                                                onChange={(v) => updateField(index, 'received_by', v)}
                                            />
                                        </td>

                                        {/* Date Received */}
                                        <td className="px-2 py-1.5">
                                            <Input type="date" value={entry.date_received ?? ''} onChange={(e) => updateField(index, 'date_received', e.target.value)} className="h-7 text-xs min-w-[120px]" />
                                        </td>

                                        {/* Document Location */}
                                        <td className="px-2 py-1.5">
                                            <LocationMultiSelect
                                                value={entry.document_location}
                                                locations={documentLocations}
                                                onChange={(v) => updateField(index, 'document_location', v)}
                                            />
                                        </td>

                                        {/* Reviewed By */}
                                        <td className="px-2 py-1.5">
                                            <RCMultiSelect
                                                value={entry.reviewed_by}
                                                users={regionalCoordinators}
                                                avatarMap={avatarMap}
                                                onChange={(v) => updateField(index, 'reviewed_by', v)}
                                            />
                                        </td>

                                        {/* Date Reviewed */}
                                        <td className="px-2 py-1.5">
                                            <Input type="date" value={entry.date_reviewed ?? ''} onChange={(e) => updateField(index, 'date_reviewed', e.target.value)} className="h-7 text-xs min-w-[120px]" />
                                        </td>

                                        {/* RC Note */}
                                        <td className="px-2 py-1.5">
                                            <Select value={entry.rc_note || ''} onValueChange={(v) => updateField(index, 'rc_note', v)}>
                                                <SelectTrigger className="h-7 text-xs min-w-[130px]">
                                                    <SelectValue placeholder="Select note" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {RC_NOTES_OPTIONS.map((opt) => (
                                                        <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </td>

                                        {/* Date of Endorsement */}
                                        <td className="px-2 py-1.5">
                                            <Input type="date" value={entry.date_endorsement ?? ''} onChange={(e) => updateField(index, 'date_endorsement', e.target.value)} className="h-7 text-xs min-w-[120px]" />
                                        </td>

                                        {/* Liquidation Status */}
                                        <td className="px-2 py-1.5">
                                            <Select value={entry.liquidation_status} onValueChange={(v) => updateField(index, 'liquidation_status', v)}>
                                                <SelectTrigger className="h-7 text-xs min-w-[130px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Unliquidated" className="text-xs">Unliquidated</SelectItem>
                                                    <SelectItem value="Partially Liquidated" className="text-xs">Partially Liquidated</SelectItem>
                                                    <SelectItem value="Fully Liquidated" className="text-xs">Fully Liquidated</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>

                                        {/* Delete */}
                                        <td className="px-2 py-1.5">
                                            {!isHEIUser && entries.length > 1 && (
                                                <DeleteRowButton isFilled={isTrackingEntryFilled(entry)} onDelete={() => removeEntry(index)} />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {!isHEIUser && (
                        <Button size="sm" onClick={addEntry} className="mt-3 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 shadow-sm">
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            Add Entry
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

/* ── Sub-components ── */

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

function RCMultiSelect({ value, users, avatarMap, onChange }: {
    value: string;
    users: LiquidationUser[];
    avatarMap: Record<string, string>;
    onChange: (val: string) => void;
}) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-auto min-h-[28px] text-xs min-w-[130px] justify-between font-normal py-1">
                    {value
                        ? <AvatarStack namesStr={value} avatarMap={avatarMap} />
                        : <span className="text-muted-foreground">Select RC</span>
                    }
                    <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50 ml-1" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-2" align="start">
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {users.map((rc) => {
                        const selected = (value || '').split(',').filter(Boolean);
                        const isChecked = selected.includes(rc.name);
                        return (
                            <label key={rc.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-xs">
                                <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                        const current = (value || '').split(',').filter(Boolean);
                                        const updated = checked
                                            ? [...current, rc.name]
                                            : current.filter(n => n !== rc.name);
                                        onChange(updated.join(','));
                                    }}
                                />
                                {rc.name}
                            </label>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}

function LocationMultiSelect({ value, locations, onChange }: {
    value: string;
    locations: string[];
    onChange: (val: string) => void;
}) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs min-w-[140px] justify-between font-normal">
                    <span className="truncate">
                        {value ? value.split(',').length + ' selected' : 'Select location'}
                    </span>
                    <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search shelf..." className="h-8 text-xs" />
                    <CommandList className="max-h-[300px] overflow-y-auto">
                        <CommandEmpty className="text-xs p-2">No location found.</CommandEmpty>
                        <CommandGroup>
                            {locations.map((loc) => {
                                const selectedLocs = (value || '').split(',').filter(Boolean);
                                const isChecked = selectedLocs.includes(loc);
                                return (
                                    <CommandItem
                                        key={loc}
                                        value={loc}
                                        onSelect={() => {
                                            const current = (value || '').split(',').filter(Boolean);
                                            const updated = isChecked
                                                ? current.filter(l => l !== loc)
                                                : [...current, loc];
                                            onChange(updated.join(','));
                                        }}
                                        className="text-xs"
                                    >
                                        <Check className={`h-3 w-3 mr-1.5 ${isChecked ? 'opacity-100' : 'opacity-0'}`} />
                                        {loc}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
