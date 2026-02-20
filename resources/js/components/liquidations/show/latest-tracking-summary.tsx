import { ClipboardList } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AvatarStack from './avatar-stack';
import { type TrackingEntry, formatDate } from '@/types/liquidation';

interface LatestTrackingSummaryProps {
    trackingEntries: TrackingEntry[];
    avatarMap: Record<string, string>;
}

export default function LatestTrackingSummary({ trackingEntries, avatarMap }: LatestTrackingSummaryProps) {
    const filledEntries = trackingEntries.filter(e =>
        e.document_status || e.received_by || e.date_received || e.liquidation_status
    );
    if (filledEntries.length === 0) return null;

    const latest = filledEntries[filledEntries.length - 1];
    const entryIndex = trackingEntries.indexOf(latest) + 1;

    const allReceivers = [
        ...new Set(
            filledEntries.flatMap(e => (e.received_by || '').split(',').filter(Boolean).map(s => s.trim()))
        )
    ];
    const allReviewers = [
        ...new Set(
            filledEntries.flatMap(e => (e.reviewed_by || '').split(',').filter(Boolean).map(s => s.trim()))
        )
    ];

    const documentLocations = (latest.document_location || '').split(',').filter(Boolean).map(s => s.trim());
    const visibleLocs = documentLocations.slice(0, 3);
    const restLocs = documentLocations.slice(3);

    return (
        <div className="mb-3">
            <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-800 rounded-lg px-4 py-3">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                        <ClipboardList className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Latest Document Tracking</span>
                    </div>
                    <span className="text-[10px] text-blue-500 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full font-medium">
                        Entry {entryIndex} of {trackingEntries.length}
                    </span>
                </div>

                {/* Fields */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3">
                    {/* Row 1 */}
                    <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Received by</p>
                        {allReceivers.length > 0
                            ? <AvatarStack namesStr={allReceivers.join(',')} avatarMap={avatarMap} />
                            : <p className="text-xs font-medium text-foreground">—</p>
                        }
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Date Received</p>
                        <p className="text-xs font-medium text-foreground">{formatDate(latest.date_received)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Reviewed by</p>
                        {allReviewers.length > 0
                            ? <AvatarStack namesStr={allReviewers.join(',')} avatarMap={avatarMap} />
                            : <p className="text-xs font-medium text-foreground">—</p>
                        }
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Date Reviewed</p>
                        <p className="text-xs font-medium text-foreground">{formatDate(latest.date_reviewed)}</p>
                    </div>

                    {/* Row 2 */}
                    <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Document Location</p>
                        {documentLocations.length === 0 ? (
                            <p className="text-xs font-medium text-foreground">—</p>
                        ) : (
                            <div className="flex flex-wrap gap-1">
                                {visibleLocs.map((loc, i) => (
                                    <span key={i} className="inline-flex items-center text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-medium">{loc}</span>
                                ))}
                                {restLocs.length > 0 && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="inline-flex items-center text-[10px] bg-blue-200 dark:bg-blue-800 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded font-medium cursor-help">+{restLocs.length} more</span>
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
                        <p className="text-[10px] text-muted-foreground mb-1">RC Note</p>
                        <p className="text-xs font-medium text-foreground">{latest.rc_note || '—'}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Date of Endorsement</p>
                        <p className="text-xs font-medium text-foreground">{formatDate(latest.date_endorsement)}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
