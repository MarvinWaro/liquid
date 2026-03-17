import { ClipboardList } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import AvatarStack from './avatar-stack';
import { type TrackingEntry, type LiquidationUser, formatDate, parseNames, joinNames } from '@/types/liquidation';

interface LatestTrackingSummaryProps {
    trackingEntries: TrackingEntry[];
    avatarMap: Record<string, string>;
    regionalCoordinators?: LiquidationUser[];
}

export default function LatestTrackingSummary({ trackingEntries, avatarMap, regionalCoordinators }: LatestTrackingSummaryProps) {
    const filledEntries = trackingEntries.filter(e =>
        e.document_status || e.received_by || e.date_received || e.liquidation_status
    );
    if (filledEntries.length === 0) return null;

    const latest = filledEntries[filledEntries.length - 1];
    const entryIndex = trackingEntries.indexOf(latest) + 1;
    const knownNames = regionalCoordinators?.map(rc => rc.name) ?? [];

    const allReceivers = [
        ...new Set(
            filledEntries.flatMap(e => parseNames(e.received_by, knownNames))
        )
    ];
    const allReviewers = [
        ...new Set(
            filledEntries.flatMap(e => parseNames(e.reviewed_by, knownNames))
        )
    ];

    const documentLocations = (latest.document_location || '').split(',').filter(Boolean).map(s => s.trim());
    const visibleLocs = documentLocations.slice(0, 3);
    const restLocs = documentLocations.slice(3);

    return (
        <div className="mb-6">
            <div className="bg-muted/50 dark:bg-muted/30 border rounded-lg px-5 py-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Latest Document Tracking</span>
                    </div>
                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                        Entry {entryIndex} of {trackingEntries.length}
                    </Badge>
                </div>

                {/* Fields */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
                    {/* Row 1 */}
                    <div>
                        <p className="text-xs text-muted-foreground mb-1.5">Received by</p>
                        {allReceivers.length > 0
                            ? <AvatarStack namesStr={joinNames(allReceivers)} avatarMap={avatarMap} knownNames={knownNames} />
                            : <p className="text-sm font-medium text-foreground">—</p>
                        }
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1.5">Date Received</p>
                        <p className="text-sm font-medium text-foreground">{formatDate(latest.date_received)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1.5">Reviewed by</p>
                        {allReviewers.length > 0
                            ? <AvatarStack namesStr={joinNames(allReviewers)} avatarMap={avatarMap} knownNames={knownNames} />
                            : <p className="text-sm font-medium text-foreground">—</p>
                        }
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1.5">Date Reviewed</p>
                        <p className="text-sm font-medium text-foreground">{formatDate(latest.date_reviewed)}</p>
                    </div>

                    {/* Row 2 */}
                    <div>
                        <p className="text-xs text-muted-foreground mb-1.5">Document Location</p>
                        {documentLocations.length === 0 ? (
                            <p className="text-sm font-medium text-foreground">—</p>
                        ) : (
                            <div className="flex flex-wrap gap-1">
                                {visibleLocs.map((loc, i) => (
                                    <Badge key={i} variant="outline" className="text-[11px] font-normal px-1.5 py-0">{loc}</Badge>
                                ))}
                                {restLocs.length > 0 && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Badge variant="outline" className="text-[11px] font-normal px-1.5 py-0 cursor-help">+{restLocs.length} more</Badge>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="p-2 max-w-[220px]">
                                                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                                                    {restLocs.map((loc, i) => <p key={i} className="text-xs">{loc}</p>)}
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                            </div>
                        )}
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1.5">RC Note</p>
                        <p className="text-sm font-medium text-foreground">{latest.rc_note || '—'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1.5">Date of Endorsement</p>
                        <p className="text-sm font-medium text-foreground">{formatDate(latest.date_endorsement)}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
