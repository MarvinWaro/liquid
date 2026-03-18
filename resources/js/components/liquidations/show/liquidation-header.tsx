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
        <div className="mb-6">
            <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2 text-muted-foreground hover:text-foreground">
                <Link href={route('liquidation.index')}>
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Back to List
                </Link>
            </Button>

            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight font-mono-nums">{liquidation.control_no}</h1>
                    <p className="text-sm text-muted-foreground mt-1">{liquidation.hei_name}</p>
                </div>
                {canEdit && !isHEIUser && (
                    <Button variant="outline" size="sm" onClick={onEditClick} className="h-8 text-xs">
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Edit
                    </Button>
                )}
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Badge className="bg-foreground text-background hover:bg-foreground/90 border-transparent px-2.5 py-0.5 text-xs font-medium">
                    {liquidation.program_name}
                </Badge>
                <Badge variant="outline" className="text-muted-foreground px-2.5 py-0.5 text-xs font-normal">
                    AY {liquidation.academic_year}
                </Badge>
                <Badge variant="outline" className="text-muted-foreground px-2.5 py-0.5 text-xs font-normal">
                    {liquidation.semester}
                </Badge>
                <Badge variant="outline" className="text-muted-foreground px-2.5 py-0.5 text-xs font-normal">
                    {liquidation.number_of_grantees || liquidation.beneficiaries.length} Grantees
                </Badge>
            </div>
        </div>
    );
}
