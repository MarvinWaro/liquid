import React, { useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface Program {
    id: string;
    code: string;
    name: string;
    description: string | null;
    status: string;
    parent_id: string | null;
}

interface ParentOption {
    id: string;
    code: string;
    name: string;
}

interface ProgramModalProps {
    isOpen: boolean;
    onClose: () => void;
    program: Program | null;
    parentOptions: ParentOption[];
}

export function ProgramModal({ isOpen, onClose, program, parentOptions }: ProgramModalProps) {
    const { data, setData, post, put, processing, errors, reset } = useForm({
        parent_id: '' as string,
        code: '',
        name: '',
        description: '',
        status: 'active',
    });

    useEffect(() => {
        if (program) {
            setData({
                parent_id: program.parent_id || '',
                code: program.code || '',
                name: program.name || '',
                description: program.description || '',
                status: program.status || 'active',
            });
        } else {
            reset();
        }
    }, [program, isOpen]);

    // Filter out the current program from parent options (can't be its own parent)
    const availableParents = parentOptions.filter((p) => p.id !== program?.id);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Send null instead of empty string for parent_id
        const payload = {
            ...data,
            parent_id: data.parent_id || null,
        };

        if (program) {
            put(route('programs.update', program.id), {
                preserveScroll: true,
                onSuccess: () => { onClose(); reset(); },
            });
        } else {
            post(route('programs.store'), {
                preserveScroll: true,
                onSuccess: () => { onClose(); reset(); },
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{program ? 'Edit Program' : 'Add New Program'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Parent Program (optional) */}
                    {availableParents.length > 0 && (
                        <div>
                            <Label htmlFor="parent_id">Parent Program</Label>
                            <Select
                                value={data.parent_id || '_none'}
                                onValueChange={(value) => setData('parent_id', value === '_none' ? '' : value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="None (top-level program)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="_none">None (top-level program)</SelectItem>
                                    {availableParents.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.code} — {p.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">
                                Select a parent to make this a sub-program (e.g., COSCHO under STUFAPs).
                            </p>
                            {errors.parent_id && (
                                <p className="text-sm text-red-500 mt-1">{errors.parent_id}</p>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="code">Code *</Label>
                            <Input
                                id="code"
                                value={data.code}
                                onChange={(e) => setData('code', e.target.value.toUpperCase())}
                                placeholder="e.g., TES"
                                className={errors.code ? 'border-red-500' : ''}
                            />
                            {errors.code && (
                                <p className="text-sm text-red-500 mt-1">{errors.code}</p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="status">Status *</Label>
                            <Select
                                value={data.status}
                                onValueChange={(value) => setData('status', value)}
                            >
                                <SelectTrigger className={errors.status ? 'border-red-500' : ''}>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.status && (
                                <p className="text-sm text-red-500 mt-1">{errors.status}</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="name">Program Name *</Label>
                        <Input
                            id="name"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder="e.g., Tertiary Education Subsidy"
                            className={errors.name ? 'border-red-500' : ''}
                        />
                        {errors.name && (
                            <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            placeholder="Optional description"
                            rows={3}
                            className={errors.description ? 'border-red-500' : ''}
                        />
                        {errors.description && (
                            <p className="text-sm text-red-500 mt-1">{errors.description}</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={processing}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Saving...' : program ? 'Update Program' : 'Create Program'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
