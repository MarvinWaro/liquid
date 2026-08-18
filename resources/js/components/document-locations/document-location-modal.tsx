import { Button } from '@/components/ui/button';
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
import { useForm } from '@inertiajs/react';
import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

interface DocumentLocation {
    id: string;
    name: string;
    sort_order: number;
    is_active: boolean;
    transmittals_count: number;
    tracking_entries_count: number;
}

interface DocumentLocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    location: DocumentLocation | null;
}

export function DocumentLocationModal({
    isOpen,
    onClose,
    location,
}: DocumentLocationModalProps) {
    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: '',
        sort_order: 0,
        is_active: true,
    });

    useEffect(() => {
        if (location) {
            setData({
                name: location.name || '',
                sort_order: location.sort_order ?? 0,
                is_active: location.is_active ?? true,
            });
        } else {
            reset();
        }
        // reset/setData come from Inertia's useForm; adding them would loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location, isOpen]);

    const inUse = location
        ? location.transmittals_count + location.tracking_entries_count
        : 0;

    // Renaming rewrites the location name recorded in every transmittal's filing
    // history, so it is worth saying out loud before they save.
    const renaming = Boolean(location) && data.name !== location?.name;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (location) {
            put(route('document-locations.update', location.id), {
                preserveScroll: true,
                onSuccess: () => {
                    onClose();
                    reset();
                },
            });
        } else {
            post(route('document-locations.store'), {
                preserveScroll: true,
                onSuccess: () => {
                    onClose();
                    reset();
                },
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {location ? 'Edit Location' : 'Add New Location'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="name">Name *</Label>
                        <Input
                            id="name"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder="e.g., Shelf 1-A-R1"
                            className={errors.name ? 'border-red-500' : ''}
                        />
                        {errors.name && (
                            <p className="mt-1 text-sm text-red-500">
                                {errors.name}
                            </p>
                        )}
                    </div>

                    {renaming && inUse > 0 && (
                        <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-950/40">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                            <p className="text-xs text-amber-800 dark:text-amber-300">
                                {inUse} record{inUse === 1 ? ' is' : 's are'}{' '}
                                filed here. Saving also updates the filing
                                history on
                                {inUse === 1 ? ' it' : ' them'}, so past entries
                                will show the new name.
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="sort_order">Sort Order *</Label>
                            <Input
                                id="sort_order"
                                type="number"
                                min={0}
                                value={data.sort_order}
                                onChange={(e) =>
                                    setData(
                                        'sort_order',
                                        parseInt(e.target.value) || 0,
                                    )
                                }
                                placeholder="e.g., 1"
                                className={
                                    errors.sort_order ? 'border-red-500' : ''
                                }
                            />
                            {errors.sort_order && (
                                <p className="mt-1 text-sm text-red-500">
                                    {errors.sort_order}
                                </p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="is_active">Status *</Label>
                            <Select
                                value={data.is_active ? 'true' : 'false'}
                                onValueChange={(value) =>
                                    setData('is_active', value === 'true')
                                }
                            >
                                <SelectTrigger
                                    className={
                                        errors.is_active ? 'border-red-500' : ''
                                    }
                                >
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="true">Active</SelectItem>
                                    <SelectItem value="false">
                                        Archived
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.is_active && (
                                <p className="mt-1 text-sm text-red-500">
                                    {errors.is_active}
                                </p>
                            )}
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                        Archived locations stay on the records already filed
                        there but are no longer offered when filing something
                        new.
                    </p>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={processing}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing
                                ? 'Saving...'
                                : location
                                  ? 'Update Location'
                                  : 'Create Location'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
