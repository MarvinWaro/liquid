import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DeletePopover } from '@/components/ui/delete-popover';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { router, useForm } from '@inertiajs/react';
import { CalendarClock, Pencil, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AcademicYear {
    id: string;
    code: string;
    name: string;
}

interface DueDateRule {
    id: string;
    program_id: string;
    academic_year_id: string | null;
    due_date_days: number;
    academic_year?: AcademicYear | null;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    programId: string;
    programCode: string;
    programName: string;
    rules: DueDateRule[];
    academicYears: AcademicYear[];
    canEdit: boolean;
}

export function DueDateRulesDialog({
    isOpen,
    onClose,
    programId,
    programCode,
    programName,
    rules,
    academicYears,
    canEdit,
}: Props) {
    const [isAdding, setIsAdding] = useState(false);
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

    // Add form: multi-select AYs
    const [addDays, setAddDays] = useState('');
    const [addIsDefault, setAddIsDefault] = useState(false);
    const [addSelectedAYs, setAddSelectedAYs] = useState<string[]>([]);
    const [addProcessing, setAddProcessing] = useState(false);
    const [addError, setAddError] = useState('');

    const editForm = useForm({
        academic_year_id: '' as string,
        due_date_days: '' as string,
    });

    // Reset forms when dialog opens/closes
    useEffect(() => {
        if (!isOpen) {
            setIsAdding(false);
            setEditingRuleId(null);
            resetAddForm();
            editForm.reset();
        }
    }, [isOpen]);

    const resetAddForm = () => {
        setAddDays('');
        setAddIsDefault(false);
        setAddSelectedAYs([]);
        setAddError('');
    };

    // AY options that are not yet used by existing rules (except when editing)
    const getAvailableAYs = (excludeRuleId?: string) => {
        const usedAYIds = rules
            .filter((r) => r.id !== excludeRuleId && r.academic_year_id)
            .map((r) => r.academic_year_id);
        return academicYears.filter((ay) => !usedAYIds.includes(ay.id));
    };

    const hasDefaultRule = rules.some((r) => !r.academic_year_id);

    const toggleAY = (ayId: string) => {
        setAddSelectedAYs((prev) =>
            prev.includes(ayId) ? prev.filter((id) => id !== ayId) : [...prev, ayId],
        );
    };

    const selectAllAYs = () => {
        const available = getAvailableAYs();
        if (addSelectedAYs.length === available.length) {
            setAddSelectedAYs([]);
        } else {
            setAddSelectedAYs(available.map((ay) => ay.id));
        }
    };

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();

        if (!addDays || parseInt(addDays) < 1) {
            setAddError('Days is required (min 1).');
            return;
        }
        if (!addIsDefault && addSelectedAYs.length === 0) {
            setAddError('Select at least one academic year or set as default.');
            return;
        }

        setAddError('');
        setAddProcessing(true);

        router.post(
            route('programs.due-date-rules.store', programId),
            {
                is_default: addIsDefault,
                academic_year_ids: addSelectedAYs,
                due_date_days: parseInt(addDays),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsAdding(false);
                    resetAddForm();
                },
                onFinish: () => setAddProcessing(false),
            },
        );
    };

    const handleStartEdit = (rule: DueDateRule) => {
        setEditingRuleId(rule.id);
        editForm.setData({
            academic_year_id: rule.academic_year_id || '',
            due_date_days: String(rule.due_date_days),
        });
    };

    const handleUpdate = (e: React.FormEvent, ruleId: string) => {
        e.preventDefault();
        editForm.put(route('programs.due-date-rules.update', [programId, ruleId]), {
            preserveScroll: true,
            onSuccess: () => {
                setEditingRuleId(null);
                editForm.reset();
            },
        });
    };

    const handleDelete = (ruleId: string) => {
        router.delete(route('programs.due-date-rules.destroy', [programId, ruleId]), {
            preserveScroll: true,
        });
    };

    // Sort: default rule first, then by AY code descending (newest first)
    const sortedRules = [...rules].sort((a, b) => {
        if (!a.academic_year_id) return -1;
        if (!b.academic_year_id) return 1;
        return (b.academic_year?.code || '').localeCompare(a.academic_year?.code || '');
    });

    const availableAYsForAdd = getAvailableAYs();

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarClock className="h-5 w-5" />
                        Due Date Rules — {programCode}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">{programName}</p>
                </DialogHeader>

                <div className="space-y-3">
                    {/* Explanation */}
                    <p className="text-xs text-muted-foreground">
                        Set how many calendar days after fund release the liquidation is due. An
                        AY-specific rule takes priority over the default. If no rule is set, the
                        system falls back to 90 days (parent) / 30 days (sub-program).
                    </p>

                    {/* Existing rules */}
                    {sortedRules.length === 0 && !isAdding && (
                        <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                            No due date rules configured. Using system default.
                        </div>
                    )}

                    {sortedRules.map((rule) => {
                        const isEditing = editingRuleId === rule.id;

                        if (isEditing) {
                            return (
                                <form
                                    key={rule.id}
                                    onSubmit={(e) => handleUpdate(e, rule.id)}
                                    className="rounded-md border bg-muted/30 p-3 space-y-3"
                                >
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-xs">Academic Year</Label>
                                            <Select
                                                value={editForm.data.academic_year_id || '_default'}
                                                onValueChange={(v) =>
                                                    editForm.setData(
                                                        'academic_year_id',
                                                        v === '_default' ? '' : v,
                                                    )
                                                }
                                            >
                                                <SelectTrigger className="h-9">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(!hasDefaultRule || !rule.academic_year_id) && (
                                                        <SelectItem value="_default">
                                                            Default (All AYs)
                                                        </SelectItem>
                                                    )}
                                                    {getAvailableAYs(rule.id).map((ay) => (
                                                        <SelectItem key={ay.id} value={ay.id}>
                                                            {ay.code}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label className="text-xs">Days</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={365}
                                                className="h-9"
                                                value={editForm.data.due_date_days}
                                                onChange={(e) =>
                                                    editForm.setData('due_date_days', e.target.value)
                                                }
                                            />
                                        </div>
                                    </div>
                                    {editForm.errors.due_date_days && (
                                        <p className="text-xs text-red-500">
                                            {editForm.errors.due_date_days}
                                        </p>
                                    )}
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setEditingRuleId(null)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            size="sm"
                                            disabled={editForm.processing}
                                        >
                                            Save
                                        </Button>
                                    </div>
                                </form>
                            );
                        }

                        return (
                            <div
                                key={rule.id}
                                className="flex items-center justify-between rounded-md border px-3 py-2"
                            >
                                <div className="flex items-center gap-2">
                                    {rule.academic_year_id ? (
                                        <Badge variant="outline" className="text-xs">
                                            {rule.academic_year?.code || 'Unknown AY'}
                                        </Badge>
                                    ) : (
                                        <Badge className="bg-primary/10 text-primary border-primary/20 text-xs shadow-none">
                                            Default (All AYs)
                                        </Badge>
                                    )}
                                    <span className="text-sm font-medium">
                                        {rule.due_date_days} day
                                        {rule.due_date_days !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                {canEdit && (
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                            onClick={() => handleStartEdit(rule)}
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <DeletePopover
                                            itemName="this rule"
                                            onConfirm={() => handleDelete(rule.id)}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Add new rule form — multi-select */}
                    {isAdding && (
                        <form
                            onSubmit={handleAdd}
                            className="rounded-md border bg-muted/30 p-3 space-y-3"
                        >
                            <div>
                                <Label className="text-xs">Days after fund release</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={365}
                                    className="h-9 mt-1"
                                    placeholder="e.g., 30"
                                    value={addDays}
                                    onChange={(e) => setAddDays(e.target.value)}
                                />
                            </div>

                            <div>
                                <Label className="text-xs mb-2 block">Apply to</Label>

                                {/* Default checkbox */}
                                {!hasDefaultRule && (
                                    <label className="flex items-center gap-2 rounded-md border px-3 py-2 mb-2 cursor-pointer hover:bg-muted/50">
                                        <Checkbox
                                            checked={addIsDefault}
                                            onCheckedChange={(v) => setAddIsDefault(!!v)}
                                        />
                                        <span className="text-sm font-medium">
                                            Default (All AYs)
                                        </span>
                                        <span className="text-xs text-muted-foreground ml-auto">
                                            Fallback for AYs without a specific rule
                                        </span>
                                    </label>
                                )}

                                {/* AY checkboxes */}
                                {availableAYsForAdd.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-muted-foreground">
                                                Academic Years
                                            </span>
                                            <button
                                                type="button"
                                                className="text-xs text-primary hover:underline"
                                                onClick={selectAllAYs}
                                            >
                                                {addSelectedAYs.length ===
                                                availableAYsForAdd.length
                                                    ? 'Deselect all'
                                                    : 'Select all'}
                                            </button>
                                        </div>
                                        <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
                                            {availableAYsForAdd.map((ay) => (
                                                <label
                                                    key={ay.id}
                                                    className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/50"
                                                >
                                                    <Checkbox
                                                        checked={addSelectedAYs.includes(ay.id)}
                                                        onCheckedChange={() => toggleAY(ay.id)}
                                                    />
                                                    <span className="text-sm">{ay.code}</span>
                                                </label>
                                            ))}
                                        </div>
                                        {addSelectedAYs.length > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                                {addSelectedAYs.length} selected
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {addError && <p className="text-xs text-red-500">{addError}</p>}

                            <div className="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setIsAdding(false);
                                        resetAddForm();
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" size="sm" disabled={addProcessing}>
                                    {addProcessing
                                        ? 'Adding...'
                                        : `Add Rule${addSelectedAYs.length + (addIsDefault ? 1 : 0) > 1 ? 's' : ''}`}
                                </Button>
                            </div>
                        </form>
                    )}

                    {/* Add button */}
                    {canEdit && !isAdding && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => setIsAdding(true)}
                        >
                            <Plus className="mr-2 h-3.5 w-3.5" />
                            Add Due Date Rule
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
