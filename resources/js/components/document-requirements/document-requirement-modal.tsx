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
}

interface DocumentRequirement {
    id: string;
    program_id: string;
    code: string;
    name: string;
    description: string | null;
    sort_order: number;
    is_required: boolean;
    is_active: boolean;
}

interface DocumentRequirementModalProps {
    isOpen: boolean;
    onClose: () => void;
    requirement: DocumentRequirement | null;
    programs: Program[];
    defaultProgramId?: string;
}

export function DocumentRequirementModal({
    isOpen,
    onClose,
    requirement,
    programs,
    defaultProgramId,
}: DocumentRequirementModalProps) {
    const { data, setData, post, put, processing, errors, reset } = useForm<{
        program_id: string;
        code: string;
        name: string;
        description: string;
        sort_order: number;
        is_required: boolean;
        is_active: boolean;
    }>({
        program_id: '',
        code: '',
        name: '',
        description: '',
        sort_order: 0,
        is_required: true,
        is_active: true,
    });

    useEffect(() => {
        if (requirement) {
            setData({
                program_id: requirement.program_id || '',
                code: requirement.code || '',
                name: requirement.name || '',
                description: requirement.description || '',
                sort_order: requirement.sort_order ?? 0,
                is_required: requirement.is_required,
                is_active: requirement.is_active,
            });
        } else {
            reset();
            if (defaultProgramId) {
                setData('program_id', defaultProgramId);
            }
        }
    }, [requirement, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (requirement) {
            put(route('document-requirements.update', requirement.id), {
                preserveScroll: true,
                onSuccess: () => { onClose(); reset(); },
            });
        } else {
            post(route('document-requirements.store'), {
                preserveScroll: true,
                onSuccess: () => { onClose(); reset(); },
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {requirement ? 'Edit Document Requirement' : 'Add Document Requirement'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Program */}
                    <div>
                        <Label htmlFor="program_id">Program *</Label>
                        <Select
                            value={data.program_id}
                            onValueChange={(value) => setData('program_id', value)}
                        >
                            <SelectTrigger className={errors.program_id ? 'border-red-500' : ''}>
                                <SelectValue placeholder="Select program" />
                            </SelectTrigger>
                            <SelectContent>
                                {programs.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.code} — {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.program_id && (
                            <p className="text-sm text-red-500 mt-1">{errors.program_id}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Code */}
                        <div>
                            <Label htmlFor="code">Code *</Label>
                            <Input
                                id="code"
                                value={data.code}
                                onChange={(e) => setData('code', e.target.value.toUpperCase())}
                                placeholder="e.g., TRANSMITTAL"
                                className={errors.code ? 'border-red-500' : ''}
                            />
                            {errors.code && (
                                <p className="text-sm text-red-500 mt-1">{errors.code}</p>
                            )}
                        </div>

                        {/* Sort Order */}
                        <div>
                            <Label htmlFor="sort_order">Sort Order</Label>
                            <Input
                                id="sort_order"
                                type="number"
                                min="0"
                                value={data.sort_order}
                                onChange={(e) => setData('sort_order', parseInt(e.target.value) || 0)}
                                className={errors.sort_order ? 'border-red-500' : ''}
                            />
                            {errors.sort_order && (
                                <p className="text-sm text-red-500 mt-1">{errors.sort_order}</p>
                            )}
                        </div>
                    </div>

                    {/* Name */}
                    <div>
                        <Label htmlFor="name">Requirement Name *</Label>
                        <Input
                            id="name"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder="e.g., Fund Utilization Report"
                            className={errors.name ? 'border-red-500' : ''}
                        />
                        {errors.name && (
                            <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            placeholder="Help text shown to HEI users"
                            rows={2}
                            className={errors.description ? 'border-red-500' : ''}
                        />
                        {errors.description && (
                            <p className="text-sm text-red-500 mt-1">{errors.description}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Is Required */}
                        <div>
                            <Label>Required</Label>
                            <Select
                                value={data.is_required ? 'true' : 'false'}
                                onValueChange={(value) => setData('is_required', value === 'true')}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="true">Required</SelectItem>
                                    <SelectItem value="false">Optional</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Is Active */}
                        <div>
                            <Label>Status</Label>
                            <Select
                                value={data.is_active ? 'true' : 'false'}
                                onValueChange={(value) => setData('is_active', value === 'true')}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="true">Active</SelectItem>
                                    <SelectItem value="false">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={processing}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Saving...' : requirement ? 'Update' : 'Create'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
