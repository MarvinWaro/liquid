import { router } from '@inertiajs/react';

/** Deferred prop names keyed by the group Inertia loads them in. */
type DeferredGroups = Record<string, string[]>;

/**
 * Re-fetch a restored page's deferred props, one request per group so the
 * server-side grouping stays meaningful — the liquidation index puts all of its
 * deferreds in the default group and therefore still costs a single request.
 *
 * `reload` forces preserveScroll/preserveState, so filters, sorting, row
 * selection and scroll position survive; only the data swaps.
 */
function reloadDeferredGroups(groups: DeferredGroups | undefined): void {
    for (const only of Object.values(groups ?? {})) {
        if (only.length > 0) {
            router.reload({ only });
        }
    }
}

/**
 * Revalidate deferred props when a page is restored from browser history.
 *
 * Inertia snapshots resolved deferred props into the history entry, and on
 * back/forward it only re-fetches props that are `undefined` in that snapshot.
 * Because the stale values are present rather than missing, nothing is
 * re-fetched and the page renders data captured before the user navigated away
 * — e.g. the liquidation table still showing the document status the user just
 * changed on the detail page.
 *
 * Pages that declare no deferred props issue no requests at all.
 */
export function initDeferredPropRevalidation(): void {
    if (typeof window === 'undefined') {
        return;
    }

    let isRestoring = false;

    // `popstate` fires before Inertia has swapped the restored page in, so the
    // reload is deferred to the `navigate` event below — reloading here would
    // target the URL we are leaving rather than the one being restored.
    window.addEventListener('popstate', (event) => {
        // Only flag entries Inertia will actually restore. Hash changes and
        // foreign history states never reach `navigate`, and a flag left set
        // would misfire on the next ordinary visit.
        if ((event.state as { page?: unknown } | null)?.page) {
            isRestoring = true;
        }
    });

    router.on('navigate', (event) => {
        const wasRestoring = isRestoring;
        isRestoring = false;

        if (wasRestoring) {
            // `deferredProps` is pruned as groups resolve, whereas
            // `initialDeferredProps` is preserved across partial reloads, so
            // repeated back/forward navigations keep revalidating.
            reloadDeferredGroups(event.detail.page.initialDeferredProps);
        }
    });

    // A bfcache restore brings back the whole app — equally stale — without
    // firing `popstate`, and Inertia emits no `navigate` for it. The page is
    // already current at this point, so reload straight from the history entry
    // instead of setting the flag (which would otherwise leak into the next
    // navigation).
    window.addEventListener('pageshow', (event) => {
        if (!event.persisted) {
            return;
        }

        const page = window.history.state?.page as
            | { initialDeferredProps?: DeferredGroups }
            | undefined;

        reloadDeferredGroups(page?.initialDeferredProps);
    });
}
