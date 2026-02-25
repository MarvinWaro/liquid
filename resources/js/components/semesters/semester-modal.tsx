import { useEffect } from 'react';
import { useForm } from '@inertiajs/react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface Semester {
    id: string;
    code: string;
    name: string;
    sort_order: number;
    is_active: boolean;
}

interface SemesterModalProps {
    isOpen: boolean;
    onClose: () => void;
    semester: Semester | null;
}

export function SemesterModal({ isOpen, onClose, semester }: SemesterModalProps) {
    const { data, setData, post, put, processing, errors, reset } = useForm({
        code: '',
        name: '',
        sort_order: 0,
        is_active: true,
    });

    useEffect(() => {
        if (semester) {
            setData({
                code: semester.code || '',
                name: semester.name || '',
                sort_order: semester.sort_order ?? 0,
                is_active: semester.is_active ?? true,
            });
        } else {
            reset();
        }
    }, [semester, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (semester) {
            put(route('semesters.update', semester.id), {
                preserveScroll: true,
                onSuccess: () => { onClose(); reset(); },
            });
        } else {
            post(route('semesters.store'), {
                preserveScroll: true,
                onSuccess: () => { onClose(); reset(); },
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{semester ? 'Edit Semester' : 'Add New Semester'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="code">Code *</Label>
                            <Input
                                id="code"
                                value={data.code}
                                onChange={(e) => setData('code', e.target.value.toUpperCase())}
                                placeholder="e.g., 1ST"
                                className={errors.code ? 'border-red-500' : ''}
                            />
                            {errors.code && (
                                <p className="text-sm text-red-500 mt-1">{errors.code}</p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder="e.g., 1st Semester"
                                className={errors.name ? 'border-red-500' : ''}
                            />
                            {errors.name && (
                                <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="sort_order">Sort Order *</Label>
                            <Input
                                id="sort_order"
                                type="number"
                                min={0}
                                value={data.sort_order}
                                onChange={(e) => setData('sort_order', parseInt(e.target.value) || 0)}
                                placeholder="e.g., 1"
                                className={errors.sort_order ? 'border-red-500' : ''}
                            />
                            {errors.sort_order && (
                                <p className="text-sm text-red-500 mt-1">{errors.sort_order}</p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="is_active">Status *</Label>
                            <Select
                                value={data.is_active ? 'true' : 'false'}
                                onValueChange={(value) => setData('is_active', value === 'true')}
                            >
                                <SelectTrigger className={errors.is_active ? 'border-red-500' : ''}>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="true">Active</SelectItem>
                                    <SelectItem value="false">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.is_active && (
                                <p className="text-sm text-red-500 mt-1">{errors.is_active}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={processing}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Saving...' : semester ? 'Update Semester' : 'Create Semester'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
