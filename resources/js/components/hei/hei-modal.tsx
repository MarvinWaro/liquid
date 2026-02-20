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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface HEI {
    id: string;
    uii: string;
    name: string;
    type: string;
    code?: string;
    region_id?: string | null;
    region?: {
        id: string;
        code: string;
        name: string;
    } | null;
    status: string;
}

interface Region {
    id: string;
    code: string;
    name: string;
}

interface HEIModalProps {
    isOpen: boolean;
    onClose: () => void;
    hei: HEI | null;
    regions: Region[];
}

export function HEIModal({ isOpen, onClose, hei, regions }: HEIModalProps) {
    const { data, setData, post, put, processing, errors, reset } = useForm({
        uii: '',
        name: '',
        type: '',
        region_id: '',
        status: 'active',
    });

    useEffect(() => {
        if (hei) {
            setData({
                uii: hei.uii || '',
                name: (hei.name || '').toUpperCase(),
                type: hei.type || '',
                region_id: hei.region_id || '',
                status: hei.status || 'active',
            });
        } else {
            reset();
        }
    }, [hei, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (hei) {
            put(route('hei.update', hei.id), {
                preserveScroll: true,
                onSuccess: () => {
                    onClose();
                    reset();
                },
            });
        } else {
            post(route('hei.store'), {
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{hei ? 'Edit HEI' : 'Add New HEI'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="uii">UII *</Label>
                            <Input
                                id="uii"
                                value={data.uii}
                                onChange={(e) => setData('uii', e.target.value)}
                                placeholder="e.g., HEI-R12-0001"
                                className={errors.uii ? 'border-red-500' : ''}
                            />
                            {errors.uii && (
                                <p className="text-sm text-red-500 mt-1">{errors.uii}</p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="name">HEI Name *</Label>
                            <Input
                                id="name"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value.toUpperCase())}
                                placeholder="Enter HEI name"
                                className={errors.name ? 'border-red-500' : ''}
                            />
                            {errors.name && (
                                <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="type">Type *</Label>
                            <Select
                                value={data.type}
                                onValueChange={(value) => setData('type', value)}
                            >
                                <SelectTrigger className={errors.type ? 'border-red-500' : ''}>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Private">Private</SelectItem>
                                    <SelectItem value="SUC">State University Colleges (SUC)</SelectItem>
                                    <SelectItem value="LUC">Local University Colleges (LUC)</SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.type && (
                                <p className="text-sm text-red-500 mt-1">{errors.type}</p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="region_id">Region</Label>
                            <Select
                                value={data.region_id || undefined}
                                onValueChange={(value) => setData('region_id', value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select region" />
                                </SelectTrigger>
                                <SelectContent>
                                    {regions.map((region) => (
                                        <SelectItem key={region.id} value={region.id}>
                                            {region.name} ({region.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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

                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={processing}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Saving...' : hei ? 'Update HEI' : 'Create HEI'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
