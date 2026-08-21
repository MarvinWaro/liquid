import { toast } from '@/lib/toast';
import type { Driver, DriveStep } from 'driver.js';
import { useCallback, useEffect, useRef } from 'react';

/**
 * "Show me how" walkthroughs for HEI users.
 *
 * Deliberately replayable rather than shown once at first login: an HEI submits
 * twice an academic year, so anything taught in September is long forgotten by
 * January. A button they can press at the moment they are stuck is worth more
 * than a walkthrough they clicked past six months ago.
 *
 * Two separate tours rather than one spanning both pages. Driver.js can drive a
 * multi-page tour, but under Inertia that means persisting progress and resuming
 * after navigation, and a half-finished tour resuming on the wrong page is worse
 * than no tour. Separate tours also let someone replay only the part they are
 * stuck on.
 */

const SHARED_CONFIG = {
    showProgress: true,
    allowClose: true,
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Got it',
    popoverClass: 'liquid-tour',
} as const;

/**
 * Shared lifecycle: one live tour at a time, always torn down on unmount.
 *
 * `buildSteps` receives a getter for the running instance because a step that
 * advances the tour itself cannot close over an instance that does not exist
 * until after its own config has been built.
 */
function useTour(
    buildSteps: (getDriver: () => Driver | null) => DriveStep[],
): () => Promise<void> {
    const driverRef = useRef<Driver | null>(null);

    // Inertia swaps the page without unmounting the document, so a tour left
    // running would strand its overlay on top of whatever loads next.
    useEffect(() => {
        return () => {
            driverRef.current?.destroy();
            driverRef.current = null;
        };
    }, []);

    return useCallback(async () => {
        try {
            // Fetched on click rather than with the page. Only HEI users ever
            // see the button, so a static import would bill every coordinator,
            // admin and accountant ~13KB of code they can never reach. The types
            // above are erased at compile time and cost nothing.
            const [{ driver }] = await Promise.all([
                import('driver.js'),
                import('driver.js/dist/driver.css'),
            ]);

            driverRef.current?.destroy();
            driverRef.current = driver({
                ...SHARED_CONFIG,
                steps: buildSteps(() => driverRef.current),
            });
            driverRef.current.drive();
        } catch {
            // Loading on demand means it can fail on demand — a dropped
            // connection, or a stale chunk reference after a deploy. Without
            // this the promise rejects into nothing and the button appears
            // simply not to work, which is the worst outcome for the very users
            // this exists to help. Tell them, and let them try again.
            toast.error(
                'Could not open the guide. Please check your connection and try again.',
            );
        }
    }, [buildSteps]);
}

/**
 * Open the requirement list if it is collapsed.
 *
 * Clicks the real toggle rather than reaching into HeiDocumentUpload's state,
 * which leaves that component's behaviour untouched. Checking visibility first
 * makes this a no-op when the list is already open, so the tour can never close
 * it by accident.
 */
function ensureRequirementsExpanded(): void {
    const target = document.querySelector<HTMLElement>(
        '[data-tour="upload-pdf"]',
    );

    if (target && target.offsetParent !== null) {
        return;
    }

    document.querySelector<HTMLElement>('[data-tour="upload-toggle"]')?.click();
}

/**
 * The liquidation detail page, top to bottom.
 *
 * The load-bearing step is the one about incomplete submissions. "Your
 * coordinator sees nothing until every requirement is complete" is genuinely
 * surprising - a half-finished upload looks like progress and achieves nothing -
 * and it is the mistake that sends people back to submitting by Messenger.
 */
export function useHeiDetailTour(): () => Promise<void> {
    return useTour(
        useCallback(
            (getDriver: () => Driver | null): DriveStep[] => [
                {
                    element: '[data-tour="detail-header"]',
                    popover: {
                        title: 'This liquidation',
                        description:
                            'The reference number, programme and period for this submission.',
                    },
                },
                {
                    element: '[data-tour="detail-summary"]',
                    popover: {
                        title: 'The amounts',
                        description:
                            'How much was released to you, how much has been liquidated, and what is still outstanding.',
                    },
                },
                {
                    element: '[data-tour="detail-workflow"]',
                    popover: {
                        title: 'Where your submission is',
                        description:
                            'Your progress through review. The filled circle is the stage you are at now.',
                    },
                },
                {
                    element: '[data-tour="detail-tracking"]',
                    popover: {
                        title: 'Handled by your coordinator',
                        description:
                            'The Regional Coordinator fills this in as your documents move along. You can read it, but you do not enter anything here.',
                    },
                },
                {
                    element: '[data-tour="detail-running"]',
                    popover: {
                        title: 'Also your coordinator',
                        description:
                            'The running financial figures, for you to read only.',
                    },
                },
                {
                    element: '#document-requirements',
                    popover: {
                        title: 'Your part',
                        description:
                            'This is the one section you fill in. The counter shows how many documents you have submitted out of the total required.',
                    },
                },
                {
                    element: '[data-tour="upload-notice"]',
                    popover: {
                        title: 'Important',
                        description:
                            'Your coordinator cannot see any of your documents until every requirement is complete. Submitting only some of them sends nothing.',
                        // The next steps point inside a list that may be
                        // collapsed. Open it and let React paint, or there is
                        // nothing left on screen to highlight. Taking over
                        // onNextClick means advancing is now ours to do.
                        onNextClick: () => {
                            ensureRequirementsExpanded();
                            window.setTimeout(
                                () => getDriver()?.moveNext(),
                                250,
                            );
                        },
                    },
                },
                {
                    element: '[data-tour="upload-pdf"]',
                    popover: {
                        title: 'Send a document',
                        description:
                            'Press Upload PDF and choose the file for that requirement. PDF only, up to 10MB.',
                    },
                },
                {
                    element: '[data-tour="upload-gdrive"]',
                    popover: {
                        title: 'File too large?',
                        description:
                            'If your scan is bigger than 10MB, put it in Google Drive and paste the link here instead. It counts the same as uploading a file.',
                    },
                },
                {
                    element: '[data-tour="detail-letters"]',
                    popover: {
                        title: 'Letters for you',
                        description:
                            'Any letter your coordinator sends about this liquidation appears here.',
                    },
                },
            ],
            [],
        ),
    );
}

/**
 * The liquidation list. Short on purpose - for an HEI this page only ever shows
 * their own records, so the real question is just how to find one and open it.
 */
export function useHeiListTour(): () => Promise<void> {
    return useTour(
        useCallback(
            (): DriveStep[] => [
                {
                    element: '[data-tour="list-search"]',
                    popover: {
                        title: 'Find a liquidation',
                        description:
                            'Search by reference number or HEI name, or narrow the list with the filters beside it.',
                    },
                },
                {
                    element: '[data-tour="list-legend"]',
                    popover: {
                        title: 'What the colours mean',
                        description:
                            'Red needs attention, green is complete. Each row carries one of these so you can see at a glance where it stands.',
                    },
                },
                {
                    element: '[data-tour="list-open"]',
                    popover: {
                        title: 'Open a record',
                        description:
                            'Press the eye icon to open a liquidation and upload its documents.',
                    },
                },
            ],
            [],
        ),
    );
}
