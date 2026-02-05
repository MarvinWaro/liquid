import React, { useState, useEffect, useCallback } from 'react';
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
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

interface Program {
    id: string;
    name: string;
    code: string;
}

interface HEILookup {
    id: string;
    uii: string;
    name: string;
    code: string | null;
    type: string;
}

interface CreateLiquidationModalProps {
    isOpen: boolean;
    onClose: () => void;
    programs: Program[];
    onSuccess: () => void;
}

const SEMESTERS = [
    { value: '1st Semester', label: '1st Semester' },
    { value: '2nd Semester', label: '2nd Semester' },
    { value: 'Summer', label: 'Summer' },
];

export function CreateLiquidationModal({
    isOpen,
    onClose,
    programs,
    onSuccess,
}: CreateLiquidationModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [heiLookup, setHeiLookup] = useState<HEILookup | null>(null);
    const [lookupError, setLookupError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        program_id: '',
        uii: '',
        date_fund_released: '',
        due_date: '',
        academic_year: '',
        semester: '',
        batch_no: '',
        dv_control_no: '',
        number_of_grantees: '',
        total_disbursements: '',
    });

    // Reset form when modal closes
    useEffect(() => {
        if (!isOpen) {
            setFormData({
                program_id: '',
                uii: '',
                date_fund_released: '',
                due_date: '',
                academic_year: '',
                semester: '',
                batch_no: '',
                dv_control_no: '',
                number_of_grantees: '',
                total_disbursements: '',
            });
            setHeiLookup(null);
            setLookupError(null);
        }
    }, [isOpen]);

    // Debounced UII lookup
    const lookupHEI = useCallback(async (uii: string) => {
        if (!uii || uii.length < 2) {
            setHeiLookup(null);
            setLookupError(null);
            return;
        }

        setIsLookingUp(true);
        setLookupError(null);

        try {
            const response = await axios.get(route('liquidation.lookup-hei'), {
                params: { uii }
            });

            if (response.data.found) {
                setHeiLookup(response.data.hei);
                setLookupError(null);
            } else {
                setHeiLookup(null);
                setLookupError(response.data.message || 'HEI not found');
            }
        } catch (error) {
            setHeiLookup(null);
            setLookupError('Failed to lookup HEI');
        } finally {
            setIsLookingUp(false);
        }
    }, []);

    // Debounce UII input
    useEffect(() => {
        const timer = setTimeout(() => {
            if (formData.uii) {
                lookupHEI(formData.uii);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [formData.uii, lookupHEI]);

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!heiLookup) {
            toast.error('Please enter a valid UII');
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await axios.post(route('liquidation.store'), formData);

            if (response.data.success) {
                toast.success('Liquidation created successfully');
                onSuccess();
                onClose();
            }
        } catch (error: any) {
            const message = error.response?.data?.message || 'Failed to create liquidation';
            toast.error(message);

            if (error.response?.data?.errors) {
                Object.values(error.response.data.errors).flat().forEach((err: any) => {
                    toast.error(err);
                });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create Liquidation Report</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Program */}
                        <div className="space-y-2">
                            <Label htmlFor="program_id">Program *</Label>
                            <Select
                                value={formData.program_id}
                                onValueChange={(value) => handleInputChange('program_id', value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select program" />
                                </SelectTrigger>
                                <SelectContent>
                                    {programs.map((program) => (
                                        <SelectItem key={program.id} value={program.id}>
                                            {program.code} - {program.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* UII with auto-fill */}
                        <div className="space-y-2">
                            <Label htmlFor="uii">UII (Unique Institutional Identifier) *</Label>
                            <div className="relative">
                                <Input
                                    id="uii"
                                    value={formData.uii}
                                    onChange={(e) => handleInputChange('uii', e.target.value)}
                                    placeholder="Enter UII"
                                    className={`pr-10 ${heiLookup ? 'border-green-500' : lookupError ? 'border-red-500' : ''}`}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    {isLookingUp && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                    {!isLookingUp && heiLookup && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                    {!isLookingUp && lookupError && <XCircle className="h-4 w-4 text-red-500" />}
                                </div>
                            </div>
                            {lookupError && (
                                <p className="text-sm text-red-500">{lookupError}</p>
                            )}
                        </div>

                        {/* HEI Name (auto-filled, disabled) */}
                        <div className="space-y-2">
                            <Label htmlFor="hei_name">HEI Name</Label>
                            <Input
                                id="hei_name"
                                value={heiLookup?.name || ''}
                                disabled
                                placeholder="Auto-filled from UII"
                                className={`bg-muted ${heiLookup ? 'border-green-500 text-foreground' : ''}`}
                            />
                        </div>

                        {/* Date of Fund Released */}
                        <div className="space-y-2">
                            <Label htmlFor="date_fund_released">Date of Fund Released *</Label>
                            <Input
                                id="date_fund_released"
                                type="date"
                                value={formData.date_fund_released}
                                onChange={(e) => handleInputChange('date_fund_released', e.target.value)}
                            />
                        </div>

                        {/* Due Date */}
                        <div className="space-y-2">
                            <Label htmlFor="due_date">Due Date</Label>
                            <Input
                                id="due_date"
                                type="date"
                                value={formData.due_date}
                                onChange={(e) => handleInputChange('due_date', e.target.value)}
                            />
                        </div>

                        {/* Academic Year */}
                        <div className="space-y-2">
                            <Label htmlFor="academic_year">Academic Year *</Label>
                            <Input
                                id="academic_year"
                                value={formData.academic_year}
                                onChange={(e) => handleInputChange('academic_year', e.target.value)}
                                placeholder="e.g., 2024-2025"
                            />
                        </div>

                        {/* Semester */}
                        <div className="space-y-2">
                            <Label htmlFor="semester">Semester *</Label>
                            <Select
                                value={formData.semester}
                                onValueChange={(value) => handleInputChange('semester', value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select semester" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SEMESTERS.map((sem) => (
                                        <SelectItem key={sem.value} value={sem.value}>
                                            {sem.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Batch No */}
                        <div className="space-y-2">
                            <Label htmlFor="batch_no">Batch No.</Label>
                            <Input
                                id="batch_no"
                                value={formData.batch_no}
                                onChange={(e) => handleInputChange('batch_no', e.target.value)}
                                placeholder="e.g., Batch 1"
                            />
                        </div>

                        {/* DV Control No */}
                        <div className="space-y-2">
                            <Label htmlFor="dv_control_no">DV Control No. *</Label>
                            <Input
                                id="dv_control_no"
                                value={formData.dv_control_no}
                                onChange={(e) => handleInputChange('dv_control_no', e.target.value)}
                                placeholder="e.g., 2025-0001"
                            />
                        </div>

                        {/* Number of Grantees */}
                        <div className="space-y-2">
                            <Label htmlFor="number_of_grantees">Number of Grantees</Label>
                            <Input
                                id="number_of_grantees"
                                type="number"
                                min="0"
                                value={formData.number_of_grantees}
                                onChange={(e) => handleInputChange('number_of_grantees', e.target.value)}
                                placeholder="Enter number"
                            />
                        </div>

                        {/* Total Disbursements */}
                        <div className="space-y-2">
                            <Label htmlFor="total_disbursements">Total Disbursements *</Label>
                            <Input
                                id="total_disbursements"
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.total_disbursements}
                                onChange={(e) => handleInputChange('total_disbursements', e.target.value)}
                                placeholder="Enter amount"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || !heiLookup}
                        >
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Liquidation
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
