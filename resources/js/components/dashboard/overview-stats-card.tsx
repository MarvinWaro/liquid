import { memo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Users, FileText } from 'lucide-react';

interface ProgramStat {
    code: string;
    name: string;
    grantees: number;
    liquidation_count: number;
}

export interface OverviewStats {
    total_heis: number;
    total_grantees: number;
    unifast: {
        grantees: number;
        programs: ProgramStat[];
    };
    stufaps: {
        grantees: number;
        programs: ProgramStat[];
    };
}

interface Props {
    data: OverviewStats | undefined;
    totalLiquidations: number;
}

export const OverviewStatsCard = memo(function OverviewStatsCard({ data, totalLiquidations }: Props) {
    if (!data) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
                </div>
                <Skeleton className="h-28 rounded-lg" />
                <Skeleton className="h-28 rounded-lg" />
            </div>
        );
    }

    const { total_heis, total_grantees, unifast, stufaps } = data;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
                    <Building2 className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{total_heis.toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground">HEIs</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
                    <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{total_grantees.toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground">Total Grantees</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
                    <FileText className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{totalLiquidations.toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground">Liquidations</p>
                </div>
            </div>

            <div className="rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">UniFAST</h4>
                    <span className="text-sm font-bold">{unifast.grantees.toLocaleString()} grantees</span>
                </div>
                <div className="space-y-1.5">
                    {unifast.programs.map(p => (
                        <div key={p.code} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                <span className="text-muted-foreground">{p.code}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                                <span className="text-muted-foreground">{p.liquidation_count} reports</span>
                                <span className="font-semibold w-20 text-right">{p.grantees.toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                    {unifast.programs.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">No data yet</p>
                    )}
                </div>
            </div>

            <div className="rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">STuFAPs</h4>
                    <span className="text-sm font-bold">{stufaps.grantees.toLocaleString()} grantees</span>
                </div>
                <div className="space-y-1.5">
                    {stufaps.programs.map(p => (
                        <div key={p.code} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-violet-500" />
                                <span className="text-muted-foreground">{p.code}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                                <span className="text-muted-foreground">{p.liquidation_count} reports</span>
                                <span className="font-semibold w-20 text-right">{p.grantees.toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                    {stufaps.programs.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">No data yet</p>
                    )}
                </div>
            </div>
        </div>
    );
});
