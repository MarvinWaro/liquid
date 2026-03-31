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
import { Pencil, Save, RotateCcw } from 'lucide-react';
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
    userRole?: string;
    runningDataTotalLiquidated: number;
    totalDisbursements: number;
    latestRcNote?: string;
    isStufapsProgram?: boolean;
}

/** Read-only display value — replaces disabled <Input> for Vercel-clean look */
function DisplayValue({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <p className={`text-sm font-medium text-foreground truncate ${className}`}>
            {children}
        </p>
    );
}

/** Currency display with monospace numbers */
function CurrencyValue({ amount, className = '' }: { amount: number; className?: string }) {
    return (
        <p className={`text-sm font-semibold tabular-nums ${className}`}>
            ₱{amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
    );
}

export default function LiquidationDetailsCard({
    liquidation,
    canEditDetails,
    isHEIUser,
    userRole,
    runningDataTotalLiquidated,
    totalDisbursements,
    latestRcNote,
    isStufapsProgram = false,
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

    // Amount Liquidated always reflects running data total
    const effectiveLiquidated = runningDataTotalLiquidated;
    const remainingAmount = Math.max(0, totalDisbursements - effectiveLiquidated);

    // Remaining amount is allocated based on latest RC Note:
    // - For Compliance → goes to For Compliance
    // - For Endorsement → goes to For Endorsement
    // - Otherwise (Partially/Fully Endorsed, For Review, etc.) → goes to Unliquidated
    const isForCompliance = latestRcNote === 'For Compliance';
    const isForEndorsement = latestRcNote === 'For Endorsement';

    const forComplianceAmount = isForCompliance ? remainingAmount : 0;
    const forEndorsementAmount = isForEndorsement ? remainingAmount : 0;
    const unliquidated = (!isForCompliance && !isForEndorsement) ? remainingAmount : 0;
    // TES: (Liquidated + For Endorsement) / Disbursed
    // STuFAPs: Liquidated / Disbursed
    const percentageNumerator = isStufapsProgram
        ? effectiveLiquidated
        : effectiveLiquidated + forEndorsementAmount;
    const percentage = totalDisbursements > 0 ? ((percentageNumerator / totalDisbursements) * 100) : 0;

    const editInputClass = 'h-9 text-sm border-ring/30 bg-background focus:border-ring';

    return (
        <Card className="flex-1">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base">Liquidation Details</CardTitle>
                        <CardDescription>Financial and document information</CardDescription>
                    </div>
                    {!isEditing && canEditDetails && !isHEIUser && (
                        <Button variant="outline" size="sm" onClick={handleStartEdit} className="h-8 text-xs px-3 gap-1.5">
                            <Pencil className="h-3.5 w-3.5" />
                            Edit Details
                        </Button>
                    )}
                    {isEditing && (
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={handleCancelEdit} disabled={isSaving} className="h-8 text-xs px-3">
                                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleSaveDetails} disabled={isSaving} className="h-8 text-xs px-3">
                                <Save className="h-3.5 w-3.5 mr-1" />
                                {isSaving ? 'Saving...' : 'Save'}
                            </Button>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pb-5">
                <ContextMenu>
                    <ContextMenuTrigger asChild disabled={!canEditDetails || isHEIUser}>
                        <div className={`${canEditDetails && !isHEIUser && !isEditing ? 'cursor-context-menu' : ''} ${isEditing ? 'ring-1 ring-ring/20 rounded-lg p-4 -m-4 bg-muted/30' : ''}`}>

                            {/* General Info */}
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">General Info</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 mb-6">
                                <FieldBlock label="Academic Year">
                                    {isEditing ? (
                                        <Input value={editForm.academic_year} onChange={(e) => updateField('academic_year', e.target.value)} className={editInputClass} />
                                    ) : (
                                        <DisplayValue>{liquidation.academic_year}</DisplayValue>
                                    )}
                                </FieldBlock>
                                <FieldBlock label="Semester">
                                    {isEditing ? (
                                        <Input value={editForm.semester} onChange={(e) => updateField('semester', e.target.value)} className={editInputClass} />
                                    ) : (
                                        <DisplayValue>{liquidation.semester}</DisplayValue>
                                    )}
                                </FieldBlock>
                                <FieldBlock label="Batch No.">
                                    {isEditing ? (
                                        <Input value={editForm.batch_no} onChange={(e) => updateField('batch_no', e.target.value)} className={editInputClass} />
                                    ) : (
                                        <DisplayValue>{liquidation.batch_no || 'N/A'}</DisplayValue>
                                    )}
                                </FieldBlock>
                                <FieldBlock label="Control No.">
                                    <DisplayValue className="font-mono-nums">{liquidation.dv_control_no}</DisplayValue>
                                </FieldBlock>
                                <FieldBlock label="Date of Fund Release">
                                    {isEditing ? (
                                        <Input type="date" value={editForm.date_fund_released} onChange={(e) => updateField('date_fund_released', e.target.value)} className={editInputClass} />
                                    ) : (
                                        <DisplayValue>{liquidation.date_fund_released ? new Date(liquidation.date_fund_released + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'N/A'}</DisplayValue>
                                    )}
                                </FieldBlock>
                                <FieldBlock label="Due Date">
                                    {isEditing ? (
                                        <Input type="date" value={editForm.due_date} onChange={(e) => updateField('due_date', e.target.value)} className={editInputClass} />
                                    ) : (
                                        <DisplayValue>{liquidation.due_date ? new Date(liquidation.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'N/A'}</DisplayValue>
                                    )}
                                </FieldBlock>
                            </div>

                            {/* Financial Summary */}
                            <div className="border-t pt-5 mb-6">
                                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Financial Summary</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                                    <FieldBlock label="No. of Grantees">
                                        {isEditing ? (
                                            <Input type="number" value={editForm.number_of_grantees} onChange={(e) => updateField('number_of_grantees', e.target.value)} className={editInputClass} />
                                        ) : (
                                            <DisplayValue className="tabular-nums">{liquidation.number_of_grantees || liquidation.beneficiaries.length}</DisplayValue>
                                        )}
                                    </FieldBlock>
                                    <FieldBlock label="Total Disbursements">
                                        {isEditing ? (
                                            <AmountInput
                                                value={editForm.amount_received ? Number(editForm.amount_received) : null}
                                                onValueChange={(val) => updateField('amount_received', val !== null ? String(val) : '')}
                                                className={`h-9 text-sm ${editInputClass}`}
                                            />
                                        ) : (
                                            <CurrencyValue amount={Number(liquidation.amount_received)} />
                                        )}
                                    </FieldBlock>
                                    <FieldBlock label="Amount Liquidated" hint="Auto-computed from Running Data">
                                        <CurrencyValue amount={effectiveLiquidated} className="text-foreground" />
                                    </FieldBlock>
                                    <FieldBlock label="Unliquidated">
                                        <CurrencyValue amount={unliquidated} className={unliquidated > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'} />
                                    </FieldBlock>
                                    <FieldBlock label="For Compliance">
                                        <CurrencyValue amount={forComplianceAmount} className={forComplianceAmount > 0 ? 'text-violet-600 dark:text-violet-400' : 'text-foreground'} />
                                    </FieldBlock>
                                    <FieldBlock label="For Endorsement">
                                        <CurrencyValue amount={forEndorsementAmount} className={forEndorsementAmount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'} />
                                    </FieldBlock>
                                    <FieldBlock label="Document Status">
                                        {isEditing ? (
                                            <Select value={editForm.document_status} onValueChange={(value) => updateField('document_status', value)}>
                                                <SelectTrigger className={`h-9 text-sm ${editInputClass}`}>
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="No Submission">No Submission</SelectItem>
                                                    <SelectItem value="Partial Submission">Partial Submission</SelectItem>
                                                    <SelectItem value="Complete Submission">Complete Submission</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Badge className={`${getDocumentStatusColor(liquidation.document_status || '')} shadow-none border font-normal text-xs px-2 py-0.5`}>
                                                {liquidation.document_status || 'N/A'}
                                            </Badge>
                                        )}
                                    </FieldBlock>
                                    <FieldBlock label="Liquidation Status">
                                        {isEditing ? (
                                            <Select value={editForm.liquidation_status} onValueChange={(value) => updateField('liquidation_status', value)}>
                                                <SelectTrigger className={`h-9 text-sm ${editInputClass}`}>
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Unliquidated">Unliquidated</SelectItem>
                                                    <SelectItem value="Partially Liquidated">Partially Liquidated</SelectItem>
                                                    <SelectItem value="Fully Liquidated">Fully Liquidated</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Badge className={`${getLiquidationStatusColor(liquidation.liquidation_status || '')} shadow-none border font-normal text-xs px-2 py-0.5`}>
                                                {liquidation.liquidation_status || 'N/A'}
                                            </Badge>
                                        )}
                                    </FieldBlock>
                                </div>
                            </div>

                            {/* Status & Notes */}
                            <div className="border-t pt-5">
                                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Status & Notes</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                                    <FieldBlock label="% Liquidation">
                                        <DisplayValue className={`tabular-nums ${percentage >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                                            {percentage.toFixed(2)}%
                                        </DisplayValue>
                                    </FieldBlock>
                                    <FieldBlock label="Lapsing (Days)">
                                        <DisplayValue className={`tabular-nums ${(liquidation.lapsing_period || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                                            {liquidation.lapsing_period || 0}
                                        </DisplayValue>
                                    </FieldBlock>
                                    {liquidation.reviewed_by_name && (
                                        <>
                                            <FieldBlock label="Reviewed By">
                                                <DisplayValue>{liquidation.reviewed_by_name}</DisplayValue>
                                            </FieldBlock>
                                            <FieldBlock label="Date Reviewed">
                                                <DisplayValue>{liquidation.reviewed_at ? new Date(liquidation.reviewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</DisplayValue>
                                            </FieldBlock>
                                        </>
                                    )}
                                    {(latestRcNote || liquidation.review_remarks || isEditing) && (
                                        <FieldBlock label="Regional Coordinator's Note">
                                            {isEditing ? (
                                                <Select value={editForm.review_remarks} onValueChange={(value) => updateField('review_remarks', value)}>
                                                    <SelectTrigger className={`h-9 text-sm ${editInputClass}`}>
                                                        <SelectValue placeholder="Select note (optional)" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {RC_NOTES_OPTIONS.map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <DisplayValue>{latestRcNote || liquidation.review_remarks || ''}</DisplayValue>
                                            )}
                                        </FieldBlock>
                                    )}
                                </div>

                                {/* Accountant sees RC → Accountant endorsement info */}
                                {userRole === 'Accountant' && liquidation.reviewed_by_name && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 mt-4 pt-4 border-t border-dashed">
                                        <FieldBlock label="Endorsed to Accounting By">
                                            <DisplayValue>{liquidation.reviewed_by_name}</DisplayValue>
                                        </FieldBlock>
                                        <FieldBlock label="Date Endorsed to Accounting">
                                            <DisplayValue>{liquidation.reviewed_at ? new Date(liquidation.reviewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</DisplayValue>
                                        </FieldBlock>
                                        {liquidation.rc_endorsement_remarks && (
                                            <FieldBlock label="RC Remarks">
                                                <p className="text-sm text-foreground italic">{liquidation.rc_endorsement_remarks}</p>
                                            </FieldBlock>
                                        )}
                                    </div>
                                )}

                                {/* COA / Admin sees Accountant → COA endorsement info */}
                                {['COA', 'Admin', 'Super Admin'].includes(userRole ?? '') && liquidation.accountant_reviewed_by_name && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 mt-4 pt-4 border-t border-dashed">
                                        <FieldBlock label="Endorsed to COA By">
                                            <DisplayValue>{liquidation.accountant_reviewed_by_name}</DisplayValue>
                                        </FieldBlock>
                                        <FieldBlock label="Date Endorsed to COA">
                                            <DisplayValue>{liquidation.accountant_reviewed_at ? new Date(liquidation.accountant_reviewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</DisplayValue>
                                        </FieldBlock>
                                        {liquidation.accountant_endorsement_remarks && (
                                            <FieldBlock label="Accountant Remarks">
                                                <p className="text-sm text-foreground italic">{liquidation.accountant_endorsement_remarks}</p>
                                            </FieldBlock>
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

/** Reusable field layout: label + value */
function FieldBlock({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground block">{label}</Label>
            {children}
            {hint && <span className="text-[10px] text-muted-foreground italic">{hint}</span>}
        </div>
    );
}
