import React from 'react';
import { useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface HEI {
    id: number;
    name: string;
    code: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    heis: HEI[];
}

export function LiquidationCreateModal({ isOpen, onClose, heis }: Props) {
    const { data, setData, post, processing, errors, reset } = useForm({
        hei_id: '',
        disbursed_amount: '',
        disbursement_date: '',
        fund_source: '',
        liquidated_amount: '',
        purpose: '',
        remarks: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('liquidation.store'), {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onClose();
            },
        });
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create New Liquidation</DialogTitle>
                    <DialogDescription>
                        Enter the liquidation details for the disbursed funds
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="hei_id">HEI (Higher Education Institution) *</Label>
                            <Select
                                value={data.hei_id}
                                onValueChange={(value) => setData('hei_id', value)}
                            >
                                <SelectTrigger id="hei_id">
                                    <SelectValue placeholder="Select HEI" />
                                </SelectTrigger>
                                <SelectContent>
                                    {heis.map((hei) => (
                                        <SelectItem key={hei.id} value={hei.id.toString()}>
                                            {hei.name} ({hei.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.hei_id && (
                                <p className="text-sm text-destructive">{errors.hei_id}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="disbursed_amount">Disbursed Amount *</Label>
                                <Input
                                    id="disbursed_amount"
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={data.disbursed_amount}
                                    onChange={(e) => setData('disbursed_amount', e.target.value)}
                                />
                                {errors.disbursed_amount && (
                                    <p className="text-sm text-destructive">{errors.disbursed_amount}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="disbursement_date">Disbursement Date</Label>
                                <Input
                                    id="disbursement_date"
                                    type="date"
                                    value={data.disbursement_date}
                                    onChange={(e) => setData('disbursement_date', e.target.value)}
                                />
                                {errors.disbursement_date && (
                                    <p className="text-sm text-destructive">{errors.disbursement_date}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="fund_source">Fund Source</Label>
                                <Input
                                    id="fund_source"
                                    placeholder="e.g., CHED, External Grant"
                                    value={data.fund_source}
                                    onChange={(e) => setData('fund_source', e.target.value)}
                                />
                                {errors.fund_source && (
                                    <p className="text-sm text-destructive">{errors.fund_source}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="liquidated_amount">Liquidated Amount</Label>
                                <Input
                                    id="liquidated_amount"
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={data.liquidated_amount}
                                    onChange={(e) => setData('liquidated_amount', e.target.value)}
                                />
                                {errors.liquidated_amount && (
                                    <p className="text-sm text-destructive">{errors.liquidated_amount}</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="purpose">Purpose of Fund</Label>
                            <Textarea
                                id="purpose"
                                placeholder="Describe the purpose of the disbursed fund..."
                                value={data.purpose}
                                onChange={(e) => setData('purpose', e.target.value)}
                                rows={3}
                            />
                            {errors.purpose && (
                                <p className="text-sm text-destructive">{errors.purpose}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="remarks">Remarks</Label>
                            <Textarea
                                id="remarks"
                                placeholder="Any additional notes or remarks..."
                                value={data.remarks}
                                onChange={(e) => setData('remarks', e.target.value)}
                                rows={2}
                            />
                            {errors.remarks && (
                                <p className="text-sm text-destructive">{errors.remarks}</p>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={processing}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Creating...' : 'Create Liquidation'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
