import React, { useEffect } from 'react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Program {
    id: number;
    code: string;
    name: string;
}

interface HEI {
    id: number;
    name: string;
    code: string;
    uii: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    programs: Program[];
    userHei: HEI;
}

// Generate academic years from 2020-2021 to current year + 1
const generateAcademicYears = () => {
    const years = [];
    const currentYear = new Date().getFullYear();
    const endYear = currentYear + 1;

    for (let year = 2020; year <= endYear; year++) {
        years.push(`${year}-${year + 1}`);
    }

    return years;
};

const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer'];

export function CreateLiquidationModalHEI({ isOpen, onClose, programs, userHei }: Props) {
    const { data, setData, post, processing, errors, reset } = useForm({
        hei_id: userHei?.id.toString() || '',
        program_id: '',
        academic_year: '',
        semester: '',
        batch_no: '',
        amount_received: '',
    });

    const [controlNumber, setControlNumber] = React.useState('');

    // Generate control number when program is selected
    useEffect(() => {
        if (data.program_id) {
            const selectedProgram = programs.find(p => p.id.toString() === data.program_id);
            if (selectedProgram) {
                const year = new Date().getFullYear();
                const programCode = selectedProgram.code; // TES or TDP
                // Show placeholder - actual number will be generated on server
                setControlNumber(`${programCode}-${year}-[Auto-generated]`);
            }
        } else {
            setControlNumber('');
        }
    }, [data.program_id, programs]);

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
        setControlNumber('');
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="w-[80vw] max-w-[1200px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create New Liquidation Report</DialogTitle>
                    <DialogDescription>
                        Submit a new liquidation report for funds disbursed by CHED
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        {/* HEI Information Card */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Institution Information</CardTitle>
                                <CardDescription className="text-sm">Your institution details</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-sm">Institution Name</Label>
                                        <Input
                                            value={userHei?.name || ''}
                                            disabled
                                            className="bg-muted"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-sm">UII (Unified Institution Identifier)</Label>
                                        <Input
                                            value={userHei?.uii || 'Not Set'}
                                            disabled
                                            className="bg-muted"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Reference Information Card */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Reference Information</CardTitle>
                                <CardDescription className="text-sm">Control number and program details</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-sm" htmlFor="program_id">Program Fund *</Label>
                                        <Select
                                            value={data.program_id}
                                            onValueChange={(value) => setData('program_id', value)}
                                        >
                                            <SelectTrigger id="program_id">
                                                <SelectValue placeholder="Select Program" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {programs.map((program) => (
                                                    <SelectItem key={program.id} value={program.id.toString()}>
                                                        {program.code} - {program.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors.program_id && (
                                            <p className="text-sm text-destructive">{errors.program_id}</p>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-sm">Control Number</Label>
                                        <Input
                                            value={controlNumber || 'Select a program first'}
                                            disabled
                                            className="bg-muted font-mono"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Auto-generated based on program selection
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-sm" htmlFor="batch_no">Batch Number *</Label>
                                    <Input
                                        id="batch_no"
                                        placeholder="e.g., Batch 1, Batch 2"
                                        value={data.batch_no}
                                        onChange={(e) => setData('batch_no', e.target.value)}
                                    />
                                    {errors.batch_no && (
                                        <p className="text-sm text-destructive">{errors.batch_no}</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Fund Details Card */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Fund Details</CardTitle>
                                <CardDescription className="text-sm">Academic period and fund amount</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-sm" htmlFor="academic_year">Academic Year *</Label>
                                        <Select
                                            value={data.academic_year}
                                            onValueChange={(value) => setData('academic_year', value)}
                                        >
                                            <SelectTrigger id="academic_year">
                                                <SelectValue placeholder="Select Academic Year" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {generateAcademicYears().map((year) => (
                                                    <SelectItem key={year} value={year}>
                                                        {year}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors.academic_year && (
                                            <p className="text-sm text-destructive">{errors.academic_year}</p>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-sm" htmlFor="semester">Semester *</Label>
                                        <Select
                                            value={data.semester}
                                            onValueChange={(value) => setData('semester', value)}
                                        >
                                            <SelectTrigger id="semester">
                                                <SelectValue placeholder="Select Semester" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {SEMESTERS.map((sem) => (
                                                    <SelectItem key={sem} value={sem}>
                                                        {sem}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors.semester && (
                                            <p className="text-sm text-destructive">{errors.semester}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-sm" htmlFor="amount_received">Amount Received from CHED *</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-muted-foreground">₱</span>
                                        <Input
                                            id="amount_received"
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={data.amount_received}
                                            onChange={(e) => setData('amount_received', e.target.value)}
                                            className="pl-8"
                                        />
                                    </div>
                                    {errors.amount_received && (
                                        <p className="text-sm text-destructive">{errors.amount_received}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        Total amount disbursed by CHED to your institution
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
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
