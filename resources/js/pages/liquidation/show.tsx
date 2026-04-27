import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Deferred, Head, router, usePage } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { type ShowPageProps, type TrackingEntry, type RunningDataEntry, parseNames, joinNames } from '@/types/liquidation';

// Section components
import LiquidationHeader from '@/components/liquidations/show/liquidation-header';
import LiquidationDetailsCard from '@/components/liquidations/show/liquidation-details-card';
import WorkflowProgressCard from '@/components/liquidations/show/workflow-progress-card';
import LatestTrackingSummary from '@/components/liquidations/show/latest-tracking-summary';
import DocumentTrackingTable from '@/components/liquidations/show/document-tracking-table';
import RunningDataTable from '@/components/liquidations/show/running-data-table';
import HeiDocumentUpload from '@/components/liquidations/show/hei-document-upload';
import RcLetterUpload from '@/components/liquidations/show/rc-letter-upload';
import { useAvatarMap } from '@/components/liquidations/show/avatar-stack';

// Endorsement modals
import {
    EndorseToAccountingModal,
    ReturnToHEIModal,
    SubmitForReviewModal,
    EndorseToCOAModal,
    ReturnToRCModal,
    EditLiquidationModal,
} from '@/components/liquidations/endorsement-modals';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Liquidation Management', href: route('liquidation.index') },
    { title: 'Details', href: '#' },
];

export default function Show({
    liquidation,
    userHei,
    regionalCoordinators,
    accountants,
    documentLocations,
    documentRequirements,
    permissions,
    userRole,
    isStufapsProgram,
    commentCounts,
}: ShowPageProps) {
    const { auth } = usePage<SharedData>().props;
    const initialHash = typeof window !== 'undefined' ? window.location.hash : '';

    // Reactive state so late hash changes (Inertia onFinish) trigger re-render
    const [focusDocuments, setFocusDocuments] = useState(
        initialHash === '#document-requirements' || initialHash.startsWith('#doc-comment-'),
    );
    const [focusRequirementId, setFocusRequirementId] = useState<string | null>(
        initialHash.startsWith('#doc-comment-') ? initialHash.slice('#doc-comment-'.length) : null,
    );

    // ── Scroll to the relevant section and highlight when navigating from a notification ──
    useEffect(() => {
        const highlight = (el: HTMLElement) => {
            el.classList.add('notification-highlight');
            el.addEventListener('animationend', () => {
                el.classList.remove('notification-highlight');
            }, { once: true });
        };

        // Poll for an element to become visible (not inside a hidden parent), then scroll + highlight
        const waitAndScroll = (id: string) => {
            let attempts = 0;
            const maxAttempts = 30; // 30 × 100ms = 3s max
            const interval = setInterval(() => {
                attempts++;
                const el = document.getElementById(id);
                if (el && el.offsetParent !== null) {
                    clearInterval(interval);
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => highlight(el), 600);
                } else if (attempts >= maxAttempts) {
                    clearInterval(interval);
                }
            }, 100);
        };

        const scrollAndHighlight = (hash: string) => {
            if (!hash) return;
            const isDocComment = hash.startsWith('#doc-comment-');
            const isDocFocus = hash === '#document-requirements' || isDocComment;
            const sectionId = isDocFocus ? 'document-requirements' : hash.slice(1);
            const specificId = isDocComment ? hash.slice(1) : null;

            // Update reactive state so HeiDocumentUpload expands & comment thread opens
            if (isDocFocus) setFocusDocuments(true);
            if (isDocComment) setFocusRequirementId(hash.slice('#doc-comment-'.length));

            // Start from top so the scroll animation is visible
            window.scrollTo(0, 0);

            setTimeout(() => {
                const el = document.getElementById(sectionId);
                if (!el) return;

                if (specificId) {
                    // First scroll to the section, then poll for the specific item
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    waitAndScroll(specificId);
                } else {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const card = el.querySelector(':scope > [data-slot="card"]') as HTMLElement | null;
                    setTimeout(() => highlight(card ?? el), 600);
                }
            }, 200);
        };

        // Handle hash present on initial load
        if (initialHash) {
            scrollAndHighlight(initialHash);
        }

        // Handle hash set after Inertia navigation (onFinish sets it late)
        const onHashChange = () => scrollAndHighlight(window.location.hash);
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    // ── Modal state ──
    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEndorseModalOpen, setIsEndorseModalOpen] = useState(false);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isEndorseToCOAModalOpen, setIsEndorseToCOAModalOpen] = useState(false);
    const [isReturnToRCModalOpen, setIsReturnToRCModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // ── Derived values ──
    const isHEIUser = userRole === 'HEI';
    const isAccountant = userRole === 'Accountant';
    const isCOA = userRole === 'COA';
    const isViewOnly = isAccountant || isCOA;
    const canSubmit = permissions.submit;
    const canReview = permissions.review;
    const canEditDetails = (permissions.edit || permissions.review) && !isViewOnly;
    const canEdit = canSubmit;
    const hasBeenReturned = (liquidation.review_history?.length ?? 0) > 0;

    const totalDisbursements = Number(liquidation.amount_received ?? 0);
    const totalGrantees = Number(liquidation.number_of_grantees ?? 0);

    // ── Avatar map for avatar stacks ──
    const avatarMap = useAvatarMap([...regionalCoordinators, ...accountants]);

    // ── Tracking entries ref for LatestTrackingSummary ──
    const [trackingEntries, setTrackingEntries] = useState<TrackingEntry[]>(
        liquidation.tracking_entries && liquidation.tracking_entries.length > 0
            ? liquidation.tracking_entries
            : []
    );
    const trackingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debouncedSetTrackingEntries = useCallback((entries: TrackingEntry[]) => {
        if (trackingDebounceRef.current) clearTimeout(trackingDebounceRef.current);
        trackingDebounceRef.current = setTimeout(() => setTrackingEntries(entries), 300);
    }, []);

    // ── RC reviewer names (aggregated from all tracking entries) ──
    const rcReviewerName = useMemo(() => {
        const knownNames = [...regionalCoordinators, ...accountants].map(u => u.name);
        const allReviewers = [
            ...new Set(
                trackingEntries
                    .flatMap(e => parseNames(e.reviewed_by, knownNames))
                    .filter(Boolean)
            )
        ];
        if (allReviewers.length > 0) return joinNames(allReviewers);
        return liquidation.reviewed_by_name || null;
    }, [liquidation.reviewed_by_name, trackingEntries, regionalCoordinators, accountants]);

    // ── Latest RC note (from tracking entries, with import fallback) ──
    const latestRcNote = useMemo(() => {
        const latest = trackingEntries[trackingEntries.length - 1];
        return latest?.rc_note || liquidation.rc_notes || null;
    }, [trackingEntries, liquidation.rc_notes]);

    // ── Latest liquidation status (from tracking entries) ──
    const latestLiquidationStatus = useMemo(() => {
        const latest = trackingEntries[trackingEntries.length - 1];
        return latest?.liquidation_status || null;
    }, [trackingEntries]);

    // ── Running data total (for LiquidationDetailsCard) ──
    // Falls back to stored financial.amount_liquidated when no per-row entries exist
    // (e.g. Excel-imported records), so the show page matches the index page.
    const initialRunningTotal = useMemo(() => {
        const runningData = liquidation.running_data ?? [];
        if (runningData.length > 0) {
            return runningData.reduce(
                (sum, entry) => sum + Number(entry.amount_complete_docs ?? 0) + Number(entry.amount_refunded ?? 0), 0
            );
        }
        return Number(liquidation.amount_liquidated ?? 0);
    }, [liquidation.running_data, liquidation.amount_liquidated]);
    const [runningDataTotalLiquidated, setRunningDataTotalLiquidated] = useState(initialRunningTotal);

    // For imported records (running_data is empty but financial.amount_liquidated > 0),
    // surface the imported amount as a single editable row so the table totals
    // align with the details card. Saving normalizes it into running_data.
    const runningDataInitial = useMemo<RunningDataEntry[]>(() => {
        const data = liquidation.running_data ?? [];
        if (data.length > 0) return data;

        const importedAmount = Number(liquidation.amount_liquidated ?? 0);
        if (importedAmount <= 0) return [];

        const grantees = Number(liquidation.number_of_grantees ?? 0);
        return [{
            grantees_liquidated: grantees > 0 ? grantees : null,
            amount_complete_docs: importedAmount,
            amount_refunded: 0,
            refund_or_no: '',
            total_amount_liquidated: importedAmount,
            transmittal_ref_no: '',
            group_transmittal_ref_no: '',
        }];
    }, [liquidation.running_data, liquidation.amount_liquidated, liquidation.number_of_grantees]);
    const totalDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debouncedSetTotalLiquidated = useCallback((total: number) => {
        if (totalDebounceRef.current) clearTimeout(totalDebounceRef.current);
        totalDebounceRef.current = setTimeout(() => setRunningDataTotalLiquidated(total), 300);
    }, []);

    // ── Cleanup debounce timers ──
    useEffect(() => {
        return () => {
            if (trackingDebounceRef.current) clearTimeout(trackingDebounceRef.current);
            if (totalDebounceRef.current) clearTimeout(totalDebounceRef.current);
        };
    }, []);

    // ── Modal handlers ──
    const handleSubmitForReview = useCallback((remarks: string) => {
        setIsSubmitting(true);
        router.post(route('liquidation.submit', liquidation.id), { remarks }, {
            onSuccess: () => { setIsSubmitting(false); setIsSubmitModalOpen(false); },
            onError: () => setIsSubmitting(false),
        });
    }, [liquidation.id]);

    const handleEndorseToAccounting = useCallback((data: { reviewRemarks: string }) => {
        setIsProcessing(true);
        router.post(route('liquidation.endorse-to-accounting', liquidation.id), {
            review_remarks: data.reviewRemarks,
        }, {
            onSuccess: () => { setIsProcessing(false); setIsEndorseModalOpen(false); },
            onError: () => setIsProcessing(false),
        });
    }, [liquidation.id]);

    const handleReturnToHEI = useCallback((data: {
        reviewRemarks: string; documentsForCompliance: string; receiverName: string;
    }) => {
        setIsProcessing(true);
        router.post(route('liquidation.return-to-hei', liquidation.id), {
            review_remarks: data.reviewRemarks, documents_for_compliance: data.documentsForCompliance,
            receiver_name: data.receiverName,
        }, {
            onSuccess: () => { setIsProcessing(false); setIsReturnModalOpen(false); },
            onError: () => setIsProcessing(false),
        });
    }, [liquidation.id]);

    const handleEndorseToCOA = useCallback((remarks: string) => {
        setIsProcessing(true);
        router.post(route('liquidation.endorse-to-coa', liquidation.id), { accountant_remarks: remarks }, {
            onSuccess: () => { setIsProcessing(false); setIsEndorseToCOAModalOpen(false); },
            onError: () => setIsProcessing(false),
        });
    }, [liquidation.id]);

    const handleReturnToRC = useCallback((remarks: string) => {
        setIsProcessing(true);
        router.post(route('liquidation.return-to-rc', liquidation.id), { accountant_remarks: remarks }, {
            onSuccess: () => { setIsProcessing(false); setIsReturnToRCModalOpen(false); },
            onError: () => setIsProcessing(false),
        });
    }, [liquidation.id]);

    const handleUpdateLiquidation = useCallback((amountReceived: string) => {
        setIsUpdating(true);
        router.put(route('liquidation.update', liquidation.id), { amount_received: parseFloat(amountReceived) }, {
            onSuccess: () => { setIsUpdating(false); setIsEditModalOpen(false); router.reload(); },
            onError: () => setIsUpdating(false),
        });
    }, [liquidation.id]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Liquidation - ${liquidation.control_no}`} />

            <div className="py-4">
                {/* Header */}
                <LiquidationHeader
                    liquidation={liquidation}
                    isHEIUser={isHEIUser}
                    canEdit={canEdit}
                    canReview={canReview}
                    userRole={userRole}
                    onEditClick={() => setIsEditModalOpen(true)}
                    onEndorseClick={() => setIsEndorseModalOpen(true)}
                    onEndorseToCOAClick={() => setIsEndorseToCOAModalOpen(true)}
                />

                {/* Details + Workflow Stepper */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6 items-stretch">
                    <div className="lg:col-span-8 flex flex-col">
                        <LiquidationDetailsCard
                            liquidation={liquidation}
                            canEditDetails={canEditDetails}
                            isHEIUser={isHEIUser}
                            runningDataTotalLiquidated={runningDataTotalLiquidated}
                            totalDisbursements={totalDisbursements}
                            latestRcNote={latestRcNote ?? undefined}
                            isStufapsProgram={isStufapsProgram}
                            userRole={userRole}
                        />
                    </div>
                    <div className="lg:col-span-4 flex flex-col">
                        <WorkflowProgressCard
                            liquidation={liquidation}
                            isHEIUser={isHEIUser}
                            avatarMap={avatarMap}
                            rcReviewerName={rcReviewerName}
                            knownNames={[...regionalCoordinators, ...accountants].map(u => u.name)}
                        />
                    </div>
                </div>

                {/* Latest Tracking Summary */}
                <LatestTrackingSummary
                    trackingEntries={trackingEntries}
                    avatarMap={avatarMap}
                    regionalCoordinators={regionalCoordinators}
                />

                {/* Document Tracking Table */}
                <DocumentTrackingTable
                    liquidationId={liquidation.id}
                    initialEntries={liquidation.tracking_entries ?? []}
                    isHEIUser={isHEIUser}
                    readOnly={isViewOnly}
                    regionalCoordinators={regionalCoordinators}
                    documentLocations={documentLocations}
                    avatarMap={avatarMap}
                    onEntriesChange={debouncedSetTrackingEntries}
                    updatedAt={liquidation.updated_at}
                    isStufapsProgram={isStufapsProgram}
                />

                {/* Running Data Table */}
                <RunningDataTable
                    liquidationId={liquidation.id}
                    initialEntries={runningDataInitial}
                    totalDisbursements={totalDisbursements}
                    totalGrantees={totalGrantees}
                    isHEIUser={isHEIUser}
                    readOnly={isViewOnly}
                    latestLiquidationStatus={latestLiquidationStatus ?? undefined}
                    onTotalLiquidatedChange={debouncedSetTotalLiquidated}
                    updatedAt={liquidation.updated_at}
                />

                {/* HEI Document Requirements */}
                <Deferred data={['documentRequirements', 'commentCounts']} fallback={<HeiDocumentUploadSkeleton />}>
                    <HeiDocumentUpload
                        liquidationId={liquidation.id}
                        documents={liquidation.documents ?? []}
                        requirements={documentRequirements ?? []}
                        completeness={liquidation.document_completeness}
                        isHEIUser={isHEIUser}
                        commentCounts={commentCounts ?? {}}
                        currentUserId={String(auth.user.id)}
                        defaultExpanded={focusDocuments}
                        focusRequirementId={focusRequirementId}
                    />
                </Deferred>

                {/* RC Letter Upload */}
                <RcLetterUpload
                    liquidationId={liquidation.id}
                    documents={liquidation.documents ?? []}
                    userRole={userRole}
                    isStufapsProgram={isStufapsProgram}
                />
            </div>

            {/* Modals */}
            <SubmitForReviewModal
                isOpen={isSubmitModalOpen}
                onClose={() => setIsSubmitModalOpen(false)}
                onSubmit={handleSubmitForReview}
                isProcessing={isSubmitting}
                isResubmission={hasBeenReturned}
            />
            <EndorseToAccountingModal
                isOpen={isEndorseModalOpen}
                onClose={() => setIsEndorseModalOpen(false)}
                onSubmit={handleEndorseToAccounting}
                isProcessing={isProcessing}
            />
            <ReturnToHEIModal
                isOpen={isReturnModalOpen}
                onClose={() => setIsReturnModalOpen(false)}
                onSubmit={handleReturnToHEI}
                isProcessing={isProcessing}
                regionalCoordinators={regionalCoordinators}
            />
            <EndorseToCOAModal
                isOpen={isEndorseToCOAModalOpen}
                onClose={() => setIsEndorseToCOAModalOpen(false)}
                onSubmit={handleEndorseToCOA}
                isProcessing={isProcessing}
            />
            <ReturnToRCModal
                isOpen={isReturnToRCModalOpen}
                onClose={() => setIsReturnToRCModalOpen(false)}
                onSubmit={handleReturnToRC}
                isProcessing={isProcessing}
            />
            <EditLiquidationModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSubmit={handleUpdateLiquidation}
                isProcessing={isUpdating}
                initialAmount={liquidation.amount_received?.toString() || '0'}
                totalDisbursed={liquidation.total_disbursed || 0}
            />
        </AppLayout>
    );
}

/* ── Skeleton for deferred HEI Document Requirements section ── */
function HeiDocumentUploadSkeleton() {
    return (
        <div id="document-requirements" className="mb-6">
            <div className="rounded-xl border bg-card p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <div className="space-y-1.5">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-64" />
                    </div>
                </div>
                <div className="space-y-3 pt-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                            <Skeleton className="h-5 w-5 rounded" />
                            <Skeleton className="h-4 flex-1" />
                            <Skeleton className="h-6 w-20 rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
