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

interface AcademicYear {
    id: string;
    code: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    sort_order: number;
    is_active: boolean;
}

interface AcademicYearModalProps {
    isOpen: boolean;
    onClose: () => void;
    academicYear: AcademicYear | null;
}

function parseStartYear(code: string): number {
    const parts = code.split('-');
    return parseInt(parts[0], 10) || new Date().getFullYear();
}

export function AcademicYearModal({ isOpen, onClose, academicYear }: AcademicYearModalProps) {
    const { data, setData, post, put, processing, errors, reset } = useForm({
        start_year: new Date().getFullYear(),
        start_date: '',
        end_date: '',
        sort_order: 0,
        is_active: true,
    });

    useEffect(() => {
        if (academicYear) {
            setData({
                start_year: parseStartYear(academicYear.code),
                start_date: academicYear.start_date ?? '',
                end_date: academicYear.end_date ?? '',
                sort_order: academicYear.sort_order ?? 0,
                is_active: academicYear.is_active ?? true,
            });
        } else {
            reset();
        }
    }, [academicYear, isOpen]);

    const generatedCode = `${data.start_year}-${data.start_year + 1}`;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (academicYear) {
            put(route('academic-years.update', academicYear.id), {
                preserveScroll: true,
                onSuccess: () => { onClose(); reset(); },
            });
        } else {
            post(route('academic-years.store'), {
                preserveScroll: true,
                onSuccess: () => { onClose(); reset(); },
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{academicYear ? 'Edit Academic Year' : 'Add New Academic Year'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="start_year">Start Year *</Label>
                            <Input
                                id="start_year"
                                type="number"
                                min={2000}
                                max={2100}
                                value={data.start_year}
                                onChange={(e) => setData('start_year', parseInt(e.target.value) || 0)}
                                placeholder="e.g., 2024"
                                className={errors.start_year ? 'border-red-500' : ''}
                            />
                            {errors.start_year && (
                                <p className="text-sm text-red-500 mt-1">{errors.start_year}</p>
                            )}
                        </div>

                        <div>
                            <Label>Generated Code</Label>
                            <Input
                                value={generatedCode}
                                disabled
                                className="bg-muted font-mono font-semibold"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Auto-generated from start year</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="start_date">Start Date</Label>
                            <Input
                                id="start_date"
                                type="date"
                                value={data.start_date}
                                onChange={(e) => setData('start_date', e.target.value)}
                                className={errors.start_date ? 'border-red-500' : ''}
                            />
                            {errors.start_date && (
                                <p className="text-sm text-red-500 mt-1">{errors.start_date}</p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="end_date">End Date</Label>
                            <Input
                                id="end_date"
                                type="date"
                                value={data.end_date}
                                onChange={(e) => setData('end_date', e.target.value)}
                                className={errors.end_date ? 'border-red-500' : ''}
                            />
                            {errors.end_date && (
                                <p className="text-sm text-red-500 mt-1">{errors.end_date}</p>
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
                            {processing ? 'Saving...' : academicYear ? 'Update Academic Year' : 'Create Academic Year'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
