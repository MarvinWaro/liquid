import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Pencil } from 'lucide-react';
import type { Liquidation } from '@/types/liquidation';

interface LiquidationHeaderProps {
    liquidation: Liquidation;
    isHEIUser: boolean;
    canEdit: boolean;
    onEditClick: () => void;
}

export default function LiquidationHeader({ liquidation, isHEIUser, canEdit, onEditClick }: LiquidationHeaderProps) {
    return (
        <div className="mb-3">
            <Button variant="ghost" size="sm" asChild className="mb-2">
                <Link href={route('liquidation.index')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to List
                </Link>
            </Button>

            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{liquidation.control_no}</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">{liquidation.hei_name}</p>
                </div>
                {canEdit && !isHEIUser && (
                    <Button variant="outline" size="sm" onClick={onEditClick}>
                        <Pencil className="h-3.5 w-3.5 mr-2" />
                        Edit
                    </Button>
                )}
            </div>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-0.5 text-xs font-semibold border-0">
                    {liquidation.program_name}
                </Badge>
                <Badge variant="outline" className="border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 px-2.5 py-0.5 text-xs">
                    AY {liquidation.academic_year}
                </Badge>
                <Badge variant="outline" className="border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 px-2.5 py-0.5 text-xs">
                    {liquidation.semester}
                </Badge>
                <Badge variant="outline" className="border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 text-xs font-medium">
                    {liquidation.number_of_grantees || liquidation.beneficiaries.length} Grantees
                </Badge>
            </div>
        </div>
    );
}
