import React from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, useForm, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';

interface HEI {
    id: number;
    name: string;
    code: string;
}

interface Props {
    auth: {
        user: any;
    };
    heis: HEI[];
}

export default function Create({ auth, heis }: Props) {
    const { data, setData, post, processing, errors } = useForm({
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
        post(route('liquidation.store'));
    };

    return (
        <AppLayout>
            <Head title="Create Liquidation" />

            <div className="py-8 w-full">
                <div className="w-full max-w-4xl mx-auto">
                    <div className="mb-6">
                        <Button
                            variant="ghost"
                            onClick={() => router.visit(route('liquidation.index'))}
                            className="mb-4"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Liquidations
                        </Button>
                        <h1 className="text-3xl font-bold tracking-tight">Create New Liquidation</h1>
                        <p className="text-muted-foreground mt-1">
                            Enter the liquidation details for the disbursed funds
                        </p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <Card>
                            <CardHeader>
                                <CardTitle>Liquidation Details</CardTitle>
                                <CardDescription>
                                    Fill in the information about the disbursed funds
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
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

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            </CardContent>
                        </Card>

                        <div className="mt-6 flex justify-end gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.visit(route('liquidation.index'))}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={processing}>
                                {processing ? 'Creating...' : 'Create Liquidation'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}
