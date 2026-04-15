import React, { useCallback, useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, FileSearch, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import AvatarStack from './avatar-stack';
import {
    type TrackingEntry,
    type LiquidationUser,
    RC_NOTES_OPTIONS,
    createEmptyTrackingEntry,
    isTrackingEntryFilled,
    parseNames,
    joinNames,
} from '@/types/liquidation';

interface DocumentTrackingTableProps {
    liquidationId: number;
    initialEntries: TrackingEntry[];
    isHEIUser: boolean;
    readOnly?: boolean;
    regionalCoordinators: LiquidationUser[];
    documentLocations: string[];
    avatarMap: Record<string, string>;
    onEntriesChange: (entries: TrackingEntry[]) => void;
    updatedAt?: string | null;
    isStufapsProgram?: boolean;
}

export default function DocumentTrackingTable({
    liquidationId,
    initialEntries,
    isHEIUser,
    readOnly = false,
    regionalCoordinators,
    documentLocations,
    avatarMap,
    onEntriesChange,
    updatedAt,
    isStufapsProgram = false,
}: DocumentTrackingTableProps) {
    const canModify = !isHEIUser && !readOnly;
    const [entries, setEntries] = useState<TrackingEntry[]>(
        initialEntries.length > 0 ? initialEntries : [createEmptyTrackingEntry()]
    );
    const [isSaving, setIsSaving] = useState(false);
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        onEntriesChange(entries);
    }, [entries, onEntriesChange]);

    const updateEntries = useCallback((updater: (prev: TrackingEntry[]) => TrackingEntry[]) => {
        setEntries(updater);
    }, []);

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
                }
            },
            preserveScroll: true,
        });
    }, [liquidationId, entries, updatedAt]);

    const canDelete = entries.length > 1;

    return (
        <div id="document-tracking" className="mb-6">
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-md bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                                <FileSearch className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                            </div>
                            <div>
                                <CardTitle className="text-base font-semibold">Document Tracking</CardTitle>
                                <CardDescription className="text-xs">Track document submissions and review status</CardDescription>
                            </div>
                        </div>
                        {canModify && (
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
                                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">Status</th>
                                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">Received by</th>
                                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">Date Received</th>
                                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">Location</th>
                                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">Reviewed by</th>
                                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">Date Reviewed</th>
                                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">RC Note</th>
                                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">Date of Endorsement</th>
                                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">Status of Liquidation</th>
                                    {canModify && <th className="px-3 py-2.5 w-8"></th>}
                                </tr>
                            </thead>
                            <tbody className={!canModify ? 'pointer-events-none opacity-60' : ''}>
                                {entries.map((entry, index) => {
                                    return (
                                        <TrackingRow
                                            key={entry.id || `new-${index}`}
                                            entry={entry}
                                            index={index}
                                            readOnly={!canModify}
                                            canDelete={canDelete}
                                            regionalCoordinators={regionalCoordinators}
                                            documentLocations={documentLocations}
                                            avatarMap={avatarMap}
                                            updateField={updateField}
                                            removeEntry={removeEntry}
                                            isStufapsProgram={isStufapsProgram}
                                        />
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {canModify && (
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

interface TrackingRowProps {
    entry: TrackingEntry;
    index: number;
    readOnly: boolean;
    canDelete: boolean;
    regionalCoordinators: LiquidationUser[];
    documentLocations: string[];
    avatarMap: Record<string, string>;
    updateField: (index: number, field: keyof TrackingEntry, value: string) => void;
    removeEntry: (index: number) => void;
    isStufapsProgram?: boolean;
}

const TrackingRow = React.memo(function TrackingRow({
    entry,
    index,
    readOnly,
    canDelete,
    regionalCoordinators,
    documentLocations,
    avatarMap,
    updateField,
    removeEntry,
    isStufapsProgram = false,
}: TrackingRowProps) {
    return (
        <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
            <td className="px-3 py-2">
                <Select value={entry.document_status} onValueChange={(v) => updateField(index, 'document_status', v)}>
                    <SelectTrigger className="h-8 text-xs min-w-[120px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="No Submission">No Submission</SelectItem>
                        <SelectItem value="Partial Submission">Partial Submission</SelectItem>
                        <SelectItem value="Complete Submission">Complete Submission</SelectItem>
                    </SelectContent>
                </Select>
            </td>
            <td className="px-3 py-2">
                <RCMultiSelect value={entry.received_by} users={regionalCoordinators} avatarMap={avatarMap} onChange={(v) => updateField(index, 'received_by', v)} placeholder={isStufapsProgram ? 'Select Focal' : 'Select RC'} />
            </td>
            <td className="px-3 py-2">
                <Input type="date" value={entry.date_received ?? ''} onChange={(e) => updateField(index, 'date_received', e.target.value)} className="h-8 text-xs min-w-[110px]" />
            </td>
            <td className="px-3 py-2">
                <LocationMultiSelect value={entry.document_location} locations={documentLocations} onChange={(v) => updateField(index, 'document_location', v)} />
            </td>
            <td className="px-3 py-2">
                <RCMultiSelect value={entry.reviewed_by} users={regionalCoordinators} avatarMap={avatarMap} onChange={(v) => updateField(index, 'reviewed_by', v)} placeholder={isStufapsProgram ? 'Select Focal' : 'Select RC'} />
            </td>
            <td className="px-3 py-2">
                <Input type="date" value={entry.date_reviewed ?? ''} onChange={(e) => updateField(index, 'date_reviewed', e.target.value)} className="h-8 text-xs min-w-[110px]" />
            </td>
            <td className="px-3 py-2">
                <Select value={entry.rc_note || ''} onValueChange={(v) => updateField(index, 'rc_note', v)}>
                    <SelectTrigger className="h-8 text-xs min-w-[120px]">
                        <SelectValue placeholder="Select note" />
                    </SelectTrigger>
                    <SelectContent>
                        {RC_NOTES_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </td>
            <td className="px-3 py-2">
                <Input type="date" value={entry.date_endorsement ?? ''} onChange={(e) => updateField(index, 'date_endorsement', e.target.value)} className="h-8 text-xs min-w-[110px]" />
            </td>
            <td className="px-3 py-2">
                <Select value={entry.liquidation_status} onValueChange={(v) => updateField(index, 'liquidation_status', v)}>
                    <SelectTrigger className="h-8 text-xs min-w-[120px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Unliquidated">Unliquidated</SelectItem>
                        <SelectItem value="Partially Liquidated">Partially Liquidated</SelectItem>
                        <SelectItem value="Fully Liquidated">Fully Liquidated</SelectItem>
                    </SelectContent>
                </Select>
            </td>
            {!readOnly && (
                <td className="px-3 py-2">
                    {canDelete && (
                        <DeleteRowButton isFilled={isTrackingEntryFilled(entry)} onDelete={() => removeEntry(index)} />
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

const RCMultiSelect = React.memo(function RCMultiSelect({ value, users, avatarMap, onChange, placeholder = 'Select RC' }: {
    value: string;
    users: LiquidationUser[];
    avatarMap: Record<string, string>;
    onChange: (val: string) => void;
    placeholder?: string;
}) {
    const knownNames = users.map(u => u.name);
    const selected = parseNames(value, knownNames);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-auto min-h-[32px] text-xs min-w-[110px] justify-between font-normal py-1">
                    {value
                        ? <AvatarStack namesStr={value} avatarMap={avatarMap} knownNames={knownNames} disableTooltip />
                        : <span className="text-muted-foreground">{placeholder}</span>
                    }
                    <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50 ml-1" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-2" align="start">
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {users.map((rc) => {
                        const isChecked = selected.includes(rc.name);
                        return (
                            <label key={rc.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-xs">
                                <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                        const updated = checked
                                            ? [...selected, rc.name]
                                            : selected.filter(n => n !== rc.name);
                                        onChange(joinNames(updated));
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
});

const LocationMultiSelect = React.memo(function LocationMultiSelect({ value, locations, onChange }: {
    value: string;
    locations: string[];
    onChange: (val: string) => void;
}) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs min-w-[110px] justify-between font-normal">
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
});
