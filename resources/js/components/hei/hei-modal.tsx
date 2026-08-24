import {
    HEIRegionTransferPanel,
    type HEIRegionTransfer,
    type RegionSummary,
} from '@/components/hei/hei-region-transfer-panel';
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
import React, { useEffect } from 'react';

interface HEI {
    id: string;
    uii: string;
    name: string;
    type: string;
    code?: string;
    region_id?: string | null;
    region?: RegionSummary | null;
    region_transfers?: HEIRegionTransfer[];
    status: string;
}

interface HEIModalProps {
    isOpen: boolean;
    onClose: () => void;
    hei: HEI | null;
    regions: RegionSummary[];
    canTransfer: boolean;
}

export function HEIModal({
    isOpen,
    onClose,
    hei,
    regions,
    canTransfer,
}: HEIModalProps) {
    const { data, setData, post, put, processing, errors, reset, clearErrors } =
        useForm({
            uii: '',
            name: '',
            type: '',
            region_id: '',
            status: 'active',
            transfer_effective_date: '',
            transfer_reason: '',
            transfer_memo_reference: '',
        });

    useEffect(() => {
        clearErrors();
        if (hei) {
            setData({
                uii: hei.uii || '',
                name: (hei.name || '').toUpperCase(),
                type: hei.type || '',
                region_id: hei.region_id || '',
                status: hei.status || 'active',
                transfer_effective_date: '',
                transfer_reason: '',
                transfer_memo_reference: '',
            });
        } else {
            reset();
        }
    }, [hei, isOpen, clearErrors, reset, setData]);

    const handleClose = () => {
        clearErrors();
        reset();
        onClose();
    };

    const isRegionTransfer = Boolean(
        hei && (hei.region_id || '') !== data.region_id,
    );
    const selectedRegion = regions.find(
        (region) => region.id === data.region_id,
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (hei) {
            put(route('hei.update', hei.id), {
                preserveScroll: true,
                onSuccess: () => {
                    handleClose();
                },
            });
        } else {
            post(route('hei.store'), {
                preserveScroll: true,
                onSuccess: () => {
                    handleClose();
                },
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {hei ? 'Edit HEI' : 'Add New HEI'}
                    </DialogTitle>
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
                                <p className="mt-1 text-sm text-red-500">
                                    {errors.uii}
                                </p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="name">HEI Name *</Label>
                            <Input
                                id="name"
                                value={data.name}
                                onChange={(e) =>
                                    setData(
                                        'name',
                                        e.target.value.toUpperCase(),
                                    )
                                }
                                placeholder="Enter HEI name"
                                className={errors.name ? 'border-red-500' : ''}
                            />
                            {errors.name && (
                                <p className="mt-1 text-sm text-red-500">
                                    {errors.name}
                                </p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="type">Type *</Label>
                            <Select
                                value={data.type}
                                onValueChange={(value) =>
                                    setData('type', value)
                                }
                            >
                                <SelectTrigger
                                    className={
                                        errors.type ? 'border-red-500' : ''
                                    }
                                >
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Private">
                                        Private
                                    </SelectItem>
                                    <SelectItem value="SUC">
                                        State University Colleges (SUC)
                                    </SelectItem>
                                    <SelectItem value="LUC">
                                        Local University Colleges (LUC)
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.type && (
                                <p className="mt-1 text-sm text-red-500">
                                    {errors.type}
                                </p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="region_id">Region</Label>
                            <Select
                                value={data.region_id || undefined}
                                onValueChange={(value) => {
                                    clearErrors('region_id');
                                    setData('region_id', value);
                                }}
                                disabled={Boolean(hei) && !canTransfer}
                            >
                                <SelectTrigger
                                    id="region_id"
                                    aria-invalid={Boolean(errors.region_id)}
                                    aria-describedby={
                                        errors.region_id
                                            ? 'region_id-error'
                                            : undefined
                                    }
                                    className={
                                        errors.region_id ? 'border-red-500' : ''
                                    }
                                >
                                    <SelectValue placeholder="Select region" />
                                </SelectTrigger>
                                <SelectContent>
                                    {regions.map((region) => (
                                        <SelectItem
                                            key={region.id}
                                            value={region.id}
                                        >
                                            {region.name} ({region.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.region_id && (
                                <p
                                    id="region_id-error"
                                    className="mt-1 text-sm text-red-500"
                                >
                                    {errors.region_id}
                                </p>
                            )}
                            {hei && !canTransfer && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Region transfers require Admin or Super
                                    Admin permission.
                                </p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="status">Status *</Label>
                            <Select
                                value={data.status}
                                onValueChange={(value) =>
                                    setData('status', value)
                                }
                            >
                                <SelectTrigger
                                    className={
                                        errors.status ? 'border-red-500' : ''
                                    }
                                >
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">
                                        Active
                                    </SelectItem>
                                    <SelectItem value="inactive">
                                        Inactive
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Inactive institutions are hidden from pickers
                                and dashboard counts. This does not sign out
                                their user accounts.
                            </p>
                            {errors.status && (
                                <p className="mt-1 text-sm text-red-500">
                                    {errors.status}
                                </p>
                            )}
                        </div>
                    </div>

                    {hei &&
                        (canTransfer || hei.region_transfers !== undefined) && (
                            <HEIRegionTransferPanel
                                showTransferForm={
                                    isRegionTransfer && canTransfer
                                }
                                currentRegion={hei.region}
                                targetRegion={selectedRegion}
                                effectiveDate={data.transfer_effective_date}
                                reason={data.transfer_reason}
                                memoReference={data.transfer_memo_reference}
                                errors={errors}
                                transfers={hei.region_transfers ?? []}
                                onEffectiveDateChange={(value) => {
                                    clearErrors('transfer_effective_date');
                                    setData('transfer_effective_date', value);
                                }}
                                onReasonChange={(value) => {
                                    clearErrors('transfer_reason');
                                    setData('transfer_reason', value);
                                }}
                                onMemoReferenceChange={(value) => {
                                    clearErrors('transfer_memo_reference');
                                    setData('transfer_memo_reference', value);
                                }}
                            />
                        )}

                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={processing}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing
                                ? 'Saving...'
                                : isRegionTransfer
                                  ? 'Transfer and update HEI'
                                  : hei
                                    ? 'Update HEI'
                                    : 'Create HEI'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
