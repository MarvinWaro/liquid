import React, { useEffect, useState } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Save, Loader2, FileText, Banknote } from 'lucide-react';

interface Program {
    id: number;
    name: string;
}

interface School {
    id: number;
    name: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    nextSequence: string; // ✅ Receive sequence (e.g., "00001")
    currentYear: string;  // ✅ Receive year (e.g., "2026")
    programs: Program[];
    schools: School[];
}

export function CreateLiquidationModal({ isOpen, onClose, nextSequence, currentYear, programs, schools }: Props) {
    const { auth } = usePage().props as any;

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        batch_no: '', // ✅ Added Batch No
        hei_id: '',
        program_id: '',
        academic_year: '',
        semester: '',
        amount_received: '',
    });

    const [previewControlNo, setPreviewControlNo] = useState("Select Program...");

    // ✅ Effect: Dynamically update Control No Preview based on Program Selection
    useEffect(() => {
        if (isOpen) {
            let prefix = "---";
            // Assuming 1 = TES, 2 = TDP. Adjust if your DB IDs differ.
            if (data.program_id === '1') prefix = "TES";
            if (data.program_id === '2') prefix = "TDP";

            if (data.program_id) {
                setPreviewControlNo(`${prefix}-${currentYear}-${nextSequence}`);
            } else {
                setPreviewControlNo("Select Program...");
            }
        } else {
            reset();
            clearErrors();
        }
    }, [isOpen, data.program_id, nextSequence, currentYear]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        post(route('liquidations.store'), {
            onSuccess: () => {
                reset();
                onClose();
            },
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-4xl w-full max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-5 pb-4 border-b">
                    <DialogTitle className="text-xl font-semibold">New Liquidation Report</DialogTitle>
                    <DialogDescription className="text-sm">
                        Initialize a new fund utilization report for CHED verification.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto bg-muted/30 p-5">
                    <form id="create-liquidation-form" onSubmit={handleSubmit} className="h-full">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 h-full">

                            {/* LEFT COLUMN: Reference Info */}
                            <div className="md:col-span-4 space-y-4">
                                <Card className="border-l-4 border-l-primary shadow-sm h-full">
                                    <CardHeader className="p-4 pb-2">
                                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-primary" />
                                            Reference Info
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 space-y-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-bold">Control Number</Label>
                                            {/* ✅ Dynamic Preview */}
                                            <div className={`font-mono text-sm font-bold py-2 px-3 rounded border text-center ${data.program_id ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted text-muted-foreground'}`}>
                                                {previewControlNo}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground text-center">
                                                Auto-generated based on Program & Year
                                            </p>
                                        </div>

                                        {/* ✅ BATCH NO INPUT */}
                                        <div className="space-y-1.5">
                                            <Label htmlFor="batch_no" className="text-xs font-semibold">Batch No. (Optional)</Label>
                                            <Input
                                                id="batch_no"
                                                placeholder="e.g., Batch 1"
                                                value={data.batch_no}
                                                onChange={(e) => setData('batch_no', e.target.value)}
                                                className={`h-9 text-sm ${errors.batch_no ? 'border-destructive' : ''}`}
                                            />
                                            {errors.batch_no && <p className="text-xs text-destructive">{errors.batch_no}</p>}
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="hei_id" className="text-xs font-semibold">Select HEI / School *</Label>
                                            <Select
                                                value={data.hei_id}
                                                onValueChange={(val) => setData('hei_id', val)}
                                            >
                                                <SelectTrigger className={`h-9 text-sm ${errors.hei_id ? 'border-destructive' : ''}`}>
                                                    <SelectValue placeholder="Select Institution..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {schools.map((school) => (
                                                        <SelectItem key={school.id} value={school.id.toString()} className="text-sm">
                                                            {school.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {errors.hei_id && <p className="text-xs text-destructive">{errors.hei_id}</p>}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* RIGHT COLUMN: Report Details */}
                            <div className="md:col-span-8">
                                <Card className="shadow-sm h-full flex flex-col">
                                    <CardHeader className="p-4 pb-2 border-b bg-background">
                                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                            <Banknote className="h-4 w-4 text-green-600" />
                                            Fund Details
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 space-y-5 flex-1">

                                        <div className="space-y-1.5">
                                            <Label htmlFor="program_id" className="text-sm">Program Fund *</Label>
                                            <Select
                                                value={data.program_id}
                                                onValueChange={(val) => setData('program_id', val)}
                                            >
                                                <SelectTrigger className={errors.program_id ? 'border-destructive' : ''}>
                                                    <SelectValue placeholder="Select Program..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {programs.map((p) => (
                                                        <SelectItem key={p.id} value={p.id.toString()}>
                                                            {p.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {errors.program_id && <p className="text-xs text-destructive">{errors.program_id}</p>}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="academic_year" className="text-sm">Academic Year *</Label>
                                                <Input
                                                    id="academic_year"
                                                    placeholder="e.g., 2024-2025"
                                                    value={data.academic_year}
                                                    onChange={(e) => setData('academic_year', e.target.value)}
                                                    className={errors.academic_year ? 'border-destructive' : ''}
                                                />
                                                {errors.academic_year && <p className="text-xs text-destructive">{errors.academic_year}</p>}
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="semester" className="text-sm">Semester *</Label>
                                                <Select
                                                    value={data.semester}
                                                    onValueChange={(val) => setData('semester', val)}
                                                >
                                                    <SelectTrigger className={errors.semester ? 'border-destructive' : ''}>
                                                        <SelectValue placeholder="Select Semester" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="1st Semester">1st Semester</SelectItem>
                                                        <SelectItem value="2nd Semester">2nd Semester</SelectItem>
                                                        <SelectItem value="Summer">Summer</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                {errors.semester && <p className="text-xs text-destructive">{errors.semester}</p>}
                                            </div>
                                        </div>

                                        <div className="pt-2 mt-auto">
                                            <div className="bg-green-50/50 p-4 rounded-lg border border-green-100">
                                                <Label htmlFor="amount_received" className="text-sm font-semibold text-green-900">
                                                    Total Amount Received (PHP) *
                                                </Label>
                                                <div className="relative mt-2">
                                                    <span className="absolute left-3 top-2.5 text-green-600 font-bold text-lg">₱</span>
                                                    <Input
                                                        id="amount_received"
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="0.00"
                                                        className={`pl-8 h-12 text-lg font-mono font-bold bg-white text-green-700 ${errors.amount_received ? 'border-destructive' : 'border-green-200 focus-visible:ring-green-500'}`}
                                                        value={data.amount_received}
                                                        onChange={(e) => setData('amount_received', e.target.value)}
                                                    />
                                                </div>
                                                {errors.amount_received && <p className="text-xs text-destructive mt-1">{errors.amount_received}</p>}
                                            </div>
                                        </div>

                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </form>
                </div>

                <DialogFooter className="p-4 border-t bg-background">
                    <Button variant="outline" type="button" onClick={onClose} className="mr-2">
                        Cancel
                    </Button>
                    <Button type="submit" form="create-liquidation-form" disabled={processing} className="bg-primary hover:bg-primary/90">
                        {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Create Report
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
