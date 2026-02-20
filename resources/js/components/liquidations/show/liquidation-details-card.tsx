import { useState, useCallback } from 'react';
import { router } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Building2, Pencil, Save, RotateCcw } from 'lucide-react';
import AmountInput from './amount-input';
import {
    type Liquidation,
    RC_NOTES_OPTIONS,
    getDocumentStatusColor,
    getLiquidationStatusColor,
} from '@/types/liquidation';

interface LiquidationDetailsCardProps {
    liquidation: Liquidation;
    canEditDetails: boolean;
    isHEIUser: boolean;
    runningDataTotalLiquidated: number;
    totalDisbursements: number;
}

export default function LiquidationDetailsCard({
    liquidation,
    canEditDetails,
    isHEIUser,
    runningDataTotalLiquidated,
    totalDisbursements,
}: LiquidationDetailsCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editForm, setEditForm] = useState({
        academic_year: liquidation.academic_year ?? '',
        semester: liquidation.semester ?? '',
        batch_no: liquidation.batch_no ?? '',
        date_fund_released: liquidation.date_fund_released ?? '',
        due_date: liquidation.due_date ?? '',
        number_of_grantees: String(liquidation.number_of_grantees ?? liquidation.beneficiaries?.length ?? 0),
        total_disbursed: String(liquidation.total_disbursed ?? 0),
        amount_received: String(liquidation.amount_received ?? 0),
        document_status: liquidation.document_status ?? '',
        liquidation_status: liquidation.liquidation_status ?? '',
        review_remarks: liquidation.review_remarks ?? '',
    });

    const updateField = useCallback((field: keyof typeof editForm, value: string) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
    }, []);

    const handleStartEdit = useCallback(() => {
        setEditForm({
            academic_year: liquidation.academic_year ?? '',
            semester: liquidation.semester ?? '',
            batch_no: liquidation.batch_no ?? '',
            date_fund_released: liquidation.date_fund_released ?? '',
            due_date: liquidation.due_date ?? '',
            number_of_grantees: String(liquidation.number_of_grantees ?? liquidation.beneficiaries?.length ?? 0),
            total_disbursed: String(liquidation.total_disbursed ?? 0),
            amount_received: String(liquidation.amount_received ?? 0),
            document_status: liquidation.document_status ?? '',
            liquidation_status: liquidation.liquidation_status ?? '',
            review_remarks: liquidation.review_remarks ?? '',
        });
        setIsEditing(true);
    }, [liquidation]);

    const handleCancelEdit = useCallback(() => setIsEditing(false), []);

    const handleSaveDetails = useCallback(() => {
        setIsSaving(true);
        router.put(route('liquidation.update', liquidation.id), {
            academic_year: editForm.academic_year || null,
            semester: editForm.semester || null,
            batch_no: editForm.batch_no || null,
            date_fund_released: editForm.date_fund_released || null,
            due_date: editForm.due_date || null,
            number_of_grantees: editForm.number_of_grantees ? parseInt(editForm.number_of_grantees) : null,
            amount_received: parseFloat(editForm.amount_received),
            document_status: editForm.document_status,
            liquidation_status: editForm.liquidation_status,
            review_remarks: editForm.review_remarks || null,
        }, {
            onSuccess: () => {
                setIsSaving(false);
                setIsEditing(false);
            },
            onError: () => setIsSaving(false),
            preserveScroll: true,
        });
    }, [liquidation.id, editForm]);

    const editingClass = isEditing ? 'border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900' : '';

    return (
        <Card className="flex-1">
            <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm font-semibold">Liquidation Details</CardTitle>
                <CardDescription className="text-xs">Financial and document information</CardDescription>
            </CardHeader>
            <CardContent className="pb-3">
                <ContextMenu>
                    <ContextMenuTrigger asChild disabled={!canEditDetails || isHEIUser}>
                        <div className={`${canEditDetails && !isHEIUser && !isEditing ? 'cursor-context-menu' : ''} ${isEditing ? 'ring-2 ring-blue-200 dark:ring-blue-700 rounded-lg p-3 -m-3 bg-blue-50/30 dark:bg-blue-950/20' : ''}`}>
                            {/* Section Header */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Liquidation Details</h3>
                                    {isEditing && (
                                        <Badge className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 shadow-none text-[10px] px-1.5 py-0">Editing</Badge>
                                    )}
                                    {!isEditing && canEditDetails && !isHEIUser && (
                                        <span className="text-[10px] text-muted-foreground italic">Right-click to edit</span>
                                    )}
                                </div>
                                {isEditing && (
                                    <div className="flex items-center gap-1.5">
                                        <Button variant="ghost" size="sm" onClick={handleCancelEdit} disabled={isSaving} className="h-7 text-xs px-2">
                                            <RotateCcw className="h-3 w-3 mr-1" />
                                            Cancel
                                        </Button>
                                        <Button size="sm" onClick={handleSaveDetails} disabled={isSaving} className="h-7 text-xs px-3">
                                            <Save className="h-3 w-3 mr-1" />
                                            {isSaving ? 'Saving...' : 'Save'}
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* General Info */}
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 mt-1">General Info</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-3 mb-4">
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Academic Year</Label>
                                    <Input
                                        value={isEditing ? editForm.academic_year : liquidation.academic_year}
                                        onChange={(e) => updateField('academic_year', e.target.value)}
                                        disabled={!isEditing}
                                        className={`h-8 text-xs disabled:opacity-100 disabled:cursor-default ${editingClass}`}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Semester</Label>
                                    <Input
                                        value={isEditing ? editForm.semester : liquidation.semester}
                                        onChange={(e) => updateField('semester', e.target.value)}
                                        disabled={!isEditing}
                                        className={`h-8 text-xs disabled:opacity-100 disabled:cursor-default ${editingClass}`}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Batch No.</Label>
                                    <Input
                                        value={isEditing ? editForm.batch_no : (liquidation.batch_no || 'N/A')}
                                        onChange={(e) => updateField('batch_no', e.target.value)}
                                        disabled={!isEditing}
                                        className={`h-8 text-xs disabled:opacity-100 disabled:cursor-default ${editingClass}`}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">DV Control No.</Label>
                                    <Input value={liquidation.dv_control_no} disabled className="h-8 text-xs disabled:opacity-100 disabled:cursor-default" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Date of Fund Release</Label>
                                    <Input
                                        type="date"
                                        value={isEditing ? editForm.date_fund_released : (liquidation.date_fund_released || '')}
                                        onChange={(e) => updateField('date_fund_released', e.target.value)}
                                        disabled={!isEditing}
                                        className={`h-8 text-xs disabled:opacity-100 disabled:cursor-default ${editingClass}`}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Due Date</Label>
                                    <Input
                                        type="date"
                                        value={isEditing ? editForm.due_date : (liquidation.due_date || '')}
                                        onChange={(e) => updateField('due_date', e.target.value)}
                                        disabled={!isEditing}
                                        className={`h-8 text-xs disabled:opacity-100 disabled:cursor-default ${editingClass}`}
                                    />
                                </div>
                            </div>

                            {/* Financial Summary */}
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Financial Summary</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-3 mb-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">No. of Grantees</Label>
                                    <Input
                                        type={isEditing ? 'number' : 'text'}
                                        value={isEditing ? editForm.number_of_grantees : (liquidation.number_of_grantees || liquidation.beneficiaries.length)}
                                        onChange={(e) => updateField('number_of_grantees', e.target.value)}
                                        disabled={!isEditing}
                                        className={`h-8 text-xs disabled:opacity-100 disabled:cursor-default ${editingClass}`}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Total Disbursements</Label>
                                    {isEditing ? (
                                        <AmountInput
                                            value={editForm.amount_received ? Number(editForm.amount_received) : null}
                                            onValueChange={(val) => updateField('amount_received', val !== null ? String(val) : '')}
                                            className="h-8 text-xs font-semibold border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900"
                                        />
                                    ) : (
                                        <Input
                                            type="text"
                                            value={`₱${Number(liquidation.amount_received).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                                            disabled
                                            className="h-8 text-xs font-semibold disabled:opacity-100 disabled:cursor-default"
                                        />
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Amount Liquidated</Label>
                                    <Input
                                        value={`₱${runningDataTotalLiquidated.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                                        disabled
                                        className="h-8 text-xs font-semibold text-blue-600 dark:text-blue-400 disabled:opacity-100 disabled:cursor-default"
                                    />
                                    <span className="text-[9px] text-muted-foreground italic">Auto-computed from Running Data</span>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Unliquidated</Label>
                                    <Input
                                        value={`₱${Math.max(0, totalDisbursements - runningDataTotalLiquidated).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                                        disabled
                                        className="h-8 text-xs font-semibold text-orange-600 disabled:opacity-100 disabled:cursor-default"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Document Status</Label>
                                    {isEditing ? (
                                        <Select value={editForm.document_status} onValueChange={(value) => updateField('document_status', value)}>
                                            <SelectTrigger className={`h-8 text-xs ${editingClass}`}>
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="No Submission" className="text-xs">No Submission</SelectItem>
                                                <SelectItem value="Partial Submission" className="text-xs">Partial Submission</SelectItem>
                                                <SelectItem value="Complete Submission" className="text-xs">Complete Submission</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <div className="h-8 flex items-center">
                                            <Badge className={`${getDocumentStatusColor(liquidation.document_status || '')} shadow-none border font-normal text-[10px] px-1.5 py-0`}>
                                                {liquidation.document_status || 'N/A'}
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Liquidation Status</Label>
                                    {isEditing ? (
                                        <Select value={editForm.liquidation_status} onValueChange={(value) => updateField('liquidation_status', value)}>
                                            <SelectTrigger className={`h-8 text-xs ${editingClass}`}>
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Unliquidated" className="text-xs">Unliquidated</SelectItem>
                                                <SelectItem value="Partially Liquidated" className="text-xs">Partially Liquidated</SelectItem>
                                                <SelectItem value="Fully Liquidated" className="text-xs">Fully Liquidated</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <div className="h-8 flex items-center">
                                            <Badge className={`${getLiquidationStatusColor(liquidation.liquidation_status || '')} shadow-none border font-normal text-[10px] px-1.5 py-0`}>
                                                {liquidation.liquidation_status || 'N/A'}
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Status & Notes */}
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Status & Notes</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-3">
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">% Liquidation</Label>
                                    <Input value={`${(totalDisbursements > 0 ? ((runningDataTotalLiquidated / totalDisbursements) * 100) : 0).toFixed(2)}%`} disabled className="h-8 text-xs font-semibold text-green-600 disabled:opacity-100 disabled:cursor-default" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Lapsing (Days)</Label>
                                    <Input value={liquidation.lapsing_period || 0} disabled className={`h-8 text-xs font-semibold disabled:opacity-100 disabled:cursor-default ${(liquidation.lapsing_period || 0) > 0 ? 'text-red-600' : 'text-green-600'}`} />
                                </div>
                                {liquidation.reviewed_by_name && (
                                    <>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Reviewed By</Label>
                                            <Input value={liquidation.reviewed_by_name} disabled className="h-8 text-xs disabled:opacity-100 disabled:cursor-default" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Date Reviewed</Label>
                                            <Input value={liquidation.reviewed_at ? new Date(liquidation.reviewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'} disabled className="h-8 text-xs disabled:opacity-100 disabled:cursor-default" />
                                        </div>
                                    </>
                                )}
                                {(liquidation.review_remarks || isEditing) && (
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Regional Coordinator's Note</Label>
                                        {isEditing ? (
                                            <Select value={editForm.review_remarks} onValueChange={(value) => updateField('review_remarks', value)}>
                                                <SelectTrigger className={`h-8 text-xs ${editingClass}`}>
                                                    <SelectValue placeholder="Select note (optional)" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {RC_NOTES_OPTIONS.map((option) => (
                                                        <SelectItem key={option.value} value={option.value} className="text-xs">
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input value={liquidation.review_remarks || ''} disabled className="h-8 text-xs disabled:opacity-100 disabled:cursor-default" />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                        {!isEditing ? (
                            <ContextMenuItem onClick={handleStartEdit} className="text-xs">
                                <Pencil className="h-3.5 w-3.5 mr-2" />
                                Edit Details
                            </ContextMenuItem>
                        ) : (
                            <>
                                <ContextMenuItem onClick={handleSaveDetails} disabled={isSaving} className="text-xs">
                                    <Save className="h-3.5 w-3.5 mr-2" />
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem onClick={handleCancelEdit} disabled={isSaving} className="text-xs text-destructive">
                                    <RotateCcw className="h-3.5 w-3.5 mr-2" />
                                    Cancel Editing
                                </ContextMenuItem>
                            </>
                        )}
                    </ContextMenuContent>
                </ContextMenu>
            </CardContent>
        </Card>
    );
}
