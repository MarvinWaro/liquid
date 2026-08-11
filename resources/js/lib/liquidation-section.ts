import { router } from '@inertiajs/react';

/**
 * Which section of a liquidation an action belongs to, and how to navigate there.
 *
 * The liquidation show page already knows how to act on a hash: it polls for the
 * element, scrolls to it and flashes a highlight (see the scrollAndHighlight
 * effect in pages/liquidation/show.tsx). Anything that links to a liquidation
 * just has to put the right fragment on the URL.
 *
 * This lives here rather than inside one component because both the notification
 * dropdown and the activity log link to the same records. Kept in two places, a
 * newly added document action would inevitably be wired into one and forgotten in
 * the other, and the two views would quietly disagree about where an entry leads.
 */

/** Actions that land on a comment thread rather than the section as a whole. */
const COMMENT_ACTIONS = [
    'mentioned_in_comment',
    'replied_to_thread',
    'commented_on_requirement',
];

/** Actions that concern an uploaded or removed document. */
const DOCUMENT_ACTIONS = [
    'uploaded_document',
    'added_gdrive_link',
    'deleted_document',
];

/**
 * Actions on an RC letter. These are documents too, but they live in their own
 * card above Document Requirements, so they need their own destination.
 */
const RC_LETTER_ACTIONS = [
    'uploaded_rc_letter',
    'deleted_rc_letter',
];

/**
 * The URL fragment for an action on a liquidation, or '' for the top of the page.
 *
 * `documentRequirementId` deep-links a comment action to its specific thread.
 * Callers without it — the activity log stores no metadata — fall back to the
 * requirements section, which is the same fallback used when a notification
 * arrives without one.
 */
export function liquidationSectionHash(
    action?: string | null,
    documentRequirementId?: string | null,
): string {
    if (!action) return '';

    if (COMMENT_ACTIONS.includes(action)) {
        return documentRequirementId
            ? `#doc-comment-${documentRequirementId}`
            : '#document-requirements';
    }

    if (action === 'updated_tracking') return '#document-tracking';
    if (action === 'updated_running_data') return '#running-data';
    if (RC_LETTER_ACTIONS.includes(action)) return '#rc-letters';
    if (DOCUMENT_ACTIONS.includes(action)) return '#document-requirements';

    return '';
}

/**
 * Navigate to a URL that may carry a fragment.
 *
 * Inertia drops the fragment during a visit, so it is re-applied once the page
 * has settled. Assigning window.location.hash also fires `hashchange`, which is
 * what makes a second click on the same link scroll again instead of doing
 * nothing because the hash never changed.
 */
export function visitWithHash(url: string): void {
    const hashIndex = url.indexOf('#');

    if (hashIndex < 0) {
        router.visit(url);

        return;
    }

    const path = url.slice(0, hashIndex);
    const hash = url.slice(hashIndex);

    router.visit(path, {
        onFinish: () => {
            window.location.hash = hash;
        },
    });
}
