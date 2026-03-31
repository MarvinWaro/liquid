import React, { useState } from 'react';
import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Eye, Ban, RotateCcw, Send } from 'lucide-react';
import type { Liquidation } from './types';
import { getDocumentStatusColor, getLiquidationStatusColor } from './types';

interface LiquidationTableRowProps {
    liquidation: Liquidation;
    index: number;
    canVoid: boolean;
    canReview: boolean;
    isSelected: boolean;
    onSelect: (id: number, checked: boolean) => void;
    onVoid: (liquidation: Liquidation) => void;
    onRestore: (liquidation: Liquidation) => void;
    onEndorse: (liquidation: Liquidation) => void;
}

export const LiquidationTableRow = React.memo(function LiquidationTableRow({
    liquidation,
    index,
    canVoid,
    canReview,
    isSelected,
    onSelect,
    onVoid,
    onRestore,
    onEndorse,
}: LiquidationTableRowProps) {
    const [voidConfirmInput, setVoidConfirmInput] = useState('');
    const [voidPopoverOpen, setVoidPopoverOpen] = useState(false);
    const [restoreConfirmInput, setRestoreConfirmInput] = useState('');
    const [restorePopoverOpen, setRestorePopoverOpen] = useState(false);

    return (
        <TableRow className={`transition-colors hover:bg-muted/50 ${liquidation.is_voided ? 'opacity-50' : ''} ${isSelected ? 'bg-muted/30' : ''}`}>
            <TableCell className="pl-4 py-3 w-[40px]">
                {!liquidation.is_voided && !liquidation.is_endorsed && canReview && (
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => onSelect(liquidation.id, !!checked)}
                        aria-label={`Select ${liquidation.dv_control_no}`}
                    />
                )}
            </TableCell>
            <TableCell className="py-3">
                {liquidation.program ? (
                    <Badge variant="outline" className="font-normal">
                        {liquidation.program.code || liquidation.program.name}
                    </Badge>
                ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                )}
            </TableCell>
            {/* Combined: HEI Name + UII */}
            <TableCell className="max-w-[250px] py-3">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="font-medium text-sm truncate cursor-default">
                            {liquidation.hei_name}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                        {liquidation.hei_name}
                    </TooltipContent>
                </Tooltip>
                <div className="text-xs text-muted-foreground font-mono">{liquidation.uii}</div>
            </TableCell>
            {/* Combined: Academic Year + Semester */}
            <TableCell className="py-3">
                <div className="text-sm">{liquidation.academic_year || '-'}</div>
                <div className="text-xs text-muted-foreground">{liquidation.semester || '-'}</div>
            </TableCell>
            {/* Combined: Fund Released + Due Date */}
            <TableCell className="py-3">
                <div className="text-sm">{liquidation.date_fund_released || '-'}</div>
                <div className="text-xs text-muted-foreground">Due: {liquidation.due_date || '-'}</div>
            </TableCell>
            <TableCell className="py-3">
                {liquidation.batch_no || <span className="text-muted-foreground">-</span>}
            </TableCell>
            <TableCell className={`font-medium text-sm py-3 ${liquidation.is_voided ? 'line-through' : ''}`}>
                {liquidation.dv_control_no}
            </TableCell>
            <TableCell className="text-right py-3">
                {liquidation.number_of_grantees ?? <span className="text-muted-foreground">-</span>}
            </TableCell>
            <TableCell className="text-right font-medium py-3">
                ₱{liquidation.total_disbursements}
            </TableCell>
            <TableCell className="text-right font-medium py-3">
                ₱{liquidation.total_amount_liquidated ?? '0.00'}
            </TableCell>
            <TableCell className="text-right font-medium py-3">
                ₱{liquidation.total_unliquidated_amount ?? '0.00'}
            </TableCell>
            <TableCell className="py-3">
                <Badge className={`${getDocumentStatusColor(liquidation.document_status)} shadow-none border font-normal text-xs`}>
                    {liquidation.document_status}
                </Badge>
            </TableCell>
            <TableCell className="max-w-[200px] py-3">
                {liquidation.rc_notes ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="text-xs truncate block cursor-default" title={liquidation.rc_notes}>
                                {liquidation.rc_notes}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs whitespace-pre-wrap">
                            {liquidation.rc_notes}
                        </TooltipContent>
                    </Tooltip>
                ) : (
                    <span className="text-muted-foreground">-</span>
                )}
            </TableCell>
            <TableCell className="py-3">
                <Badge className={`${getLiquidationStatusColor(liquidation.liquidation_status)} shadow-none border font-normal text-xs whitespace-nowrap`}>
                    {liquidation.liquidation_status}
                </Badge>
            </TableCell>
            <TableCell className="text-right font-medium py-3">
                {(liquidation.percentage_liquidation ?? 0).toFixed(0)}%
            </TableCell>
            <TableCell className="text-right py-3">
                {(liquidation.lapsing_period ?? 0) > 0 ? (
                    <span className="text-red-600 dark:text-red-400 font-medium">{liquidation.lapsing_period}</span>
                ) : (
                    <span className="text-muted-foreground font-medium">0</span>
                )}
            </TableCell>
            <TableCell className="text-right pr-4 py-3">
                <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                asChild
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            >
                                <Link href={route('liquidation.show', liquidation.id)}>
                                    <Eye className="h-4 w-4" />
                                </Link>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>View details</TooltipContent>
                    </Tooltip>
                    {canReview && !liquidation.is_voided && !liquidation.is_endorsed && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    onClick={() => onEndorse(liquidation)}
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Endorse to Accounting</TooltipContent>
                        </Tooltip>
                    )}
                    {canVoid && !liquidation.is_voided && (
                        <Popover
                            open={voidPopoverOpen}
                            onOpenChange={(open) => {
                                setVoidPopoverOpen(open);
                                if (!open) setVoidConfirmInput('');
                            }}
                        >
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        >
                                            <Ban className="h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                </TooltipTrigger>
                                <TooltipContent>Void liquidation</TooltipContent>
                            </Tooltip>
                            <PopoverContent align="end" className="w-80">
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <h4 className="font-medium text-sm">Void Liquidation</h4>
                                        <p className="text-sm text-muted-foreground">
                                            This record will be excluded from all consolidation reports and marked as voided.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`void-confirm-${liquidation.id}`} className="text-sm">
                                            Type <strong>{liquidation.dv_control_no}</strong> to confirm
                                        </Label>
                                        <Input
                                            id={`void-confirm-${liquidation.id}`}
                                            value={voidConfirmInput}
                                            onChange={(e) => setVoidConfirmInput(e.target.value)}
                                            placeholder={liquidation.dv_control_no}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="w-full"
                                        disabled={voidConfirmInput !== liquidation.dv_control_no}
                                        onClick={() => {
                                            onVoid(liquidation);
                                            setVoidPopoverOpen(false);
                                            setVoidConfirmInput('');
                                        }}
                                    >
                                        Void this liquidation
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                    {canVoid && liquidation.is_voided && (
                        <Popover
                            open={restorePopoverOpen}
                            onOpenChange={(open) => {
                                setRestorePopoverOpen(open);
                                if (!open) setRestoreConfirmInput('');
                            }}
                        >
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-emerald-600"
                                        >
                                            <RotateCcw className="h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                </TooltipTrigger>
                                <TooltipContent>Restore liquidation</TooltipContent>
                            </Tooltip>
                            <PopoverContent align="end" className="w-80">
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <h4 className="font-medium text-sm">Restore Liquidation</h4>
                                        <p className="text-sm text-muted-foreground">
                                            This record will be included back in consolidation reports.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`restore-confirm-${liquidation.id}`} className="text-sm">
                                            Type <strong>{liquidation.dv_control_no}</strong> to confirm
                                        </Label>
                                        <Input
                                            id={`restore-confirm-${liquidation.id}`}
                                            value={restoreConfirmInput}
                                            onChange={(e) => setRestoreConfirmInput(e.target.value)}
                                            placeholder={liquidation.dv_control_no}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <Button
                                        size="sm"
                                        className="w-full"
                                        disabled={restoreConfirmInput !== liquidation.dv_control_no}
                                        onClick={() => {
                                            onRestore(liquidation);
                                            setRestorePopoverOpen(false);
                                            setRestoreConfirmInput('');
                                        }}
                                    >
                                        Restore this liquidation
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                </div>
            </TableCell>
        </TableRow>
    );
});
