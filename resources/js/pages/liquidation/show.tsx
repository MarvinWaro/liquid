import { useState, useCallback, useMemo, useEffect } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, router, usePage } from '@inertiajs/react';
import { type BreadcrumbItem, type SharedData } from '@/types';
import type { ShowPageProps, TrackingEntry } from '@/types/liquidation';

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
    const canSubmit = permissions.submit;
    const canReview = permissions.review;
    const canEditDetails = permissions.edit || permissions.review;
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

    // ── RC reviewer name (from tracking entries as fallback) ──
    const rcReviewerName = useMemo(() => {
        if (liquidation.reviewed_by_name) return liquidation.reviewed_by_name;
        const latest = trackingEntries[trackingEntries.length - 1];
        return latest?.reviewed_by || null;
    }, [liquidation.reviewed_by_name, trackingEntries]);

    // ── Latest RC note (from tracking entries) ──
    const latestRcNote = useMemo(() => {
        const latest = trackingEntries[trackingEntries.length - 1];
        return latest?.rc_note || null;
    }, [trackingEntries]);

    // ── Running data total (for LiquidationDetailsCard) ──
    const initialRunningTotal = useMemo(() => {
        return (liquidation.running_data ?? []).reduce(
            (sum, entry) => sum + Number(entry.amount_complete_docs ?? 0) + Number(entry.amount_refunded ?? 0), 0
        );
    }, [liquidation.running_data]);
    const [runningDataTotalLiquidated, setRunningDataTotalLiquidated] = useState(initialRunningTotal);

    // ── Modal handlers ──
    const handleSubmitForReview = useCallback((remarks: string) => {
        setIsSubmitting(true);
        router.post(route('liquidation.submit', liquidation.id), { remarks }, {
            onSuccess: () => { setIsSubmitting(false); setIsSubmitModalOpen(false); },
            onError: () => setIsSubmitting(false),
        });
    }, [liquidation.id]);

    const handleEndorseToAccounting = useCallback((data: {
        reviewRemarks: string; receiverName: string; documentLocation: string;
        transmittalRefNo: string; numberOfFolders: string; folderLocationNumber: string; groupTransmittal: string;
    }) => {
        setIsProcessing(true);
        router.post(route('liquidation.endorse-to-accounting', liquidation.id), {
            review_remarks: data.reviewRemarks, receiver_name: data.receiverName,
            document_location: data.documentLocation, transmittal_reference_no: data.transmittalRefNo,
            number_of_folders: data.numberOfFolders ? parseInt(data.numberOfFolders) : null,
            folder_location_number: data.folderLocationNumber, group_transmittal: data.groupTransmittal,
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

            <div className="py-3">
                {/* Header */}
                <LiquidationHeader
                    liquidation={liquidation}
                    isHEIUser={isHEIUser}
                    canEdit={canEdit}
                    onEditClick={() => setIsEditModalOpen(true)}
                />

                {/* Details + Workflow Stepper */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-3 items-stretch">
                    <div className="lg:col-span-8 flex flex-col">
                        <LiquidationDetailsCard
                            liquidation={liquidation}
                            canEditDetails={canEditDetails}
                            isHEIUser={isHEIUser}
                            runningDataTotalLiquidated={runningDataTotalLiquidated}
                            totalDisbursements={totalDisbursements}
                            latestRcNote={latestRcNote ?? undefined}
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
                    regionalCoordinators={regionalCoordinators}
                    documentLocations={documentLocations}
                    avatarMap={avatarMap}
                    onEntriesChange={setTrackingEntries}
                />

                {/* Running Data Table */}
                <RunningDataTable
                    liquidationId={liquidation.id}
                    initialEntries={liquidation.running_data ?? []}
                    totalDisbursements={totalDisbursements}
                    totalGrantees={totalGrantees}
                    isHEIUser={isHEIUser}
                    onTotalLiquidatedChange={setRunningDataTotalLiquidated}
                />

                {/* HEI Document Requirements */}
                <HeiDocumentUpload
                    liquidationId={liquidation.id}
                    documents={liquidation.documents ?? []}
                    requirements={documentRequirements}
                    completeness={liquidation.document_completeness}
                    isHEIUser={isHEIUser}
                    commentCounts={commentCounts}
                    currentUserId={String(auth.user.id)}
                    defaultExpanded={focusDocuments}
                    focusRequirementId={focusRequirementId}
                />

                {/* RC Letter Upload */}
                <RcLetterUpload
                    liquidationId={liquidation.id}
                    documents={liquidation.documents ?? []}
                    userRole={userRole}
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
                accountants={accountants}
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
