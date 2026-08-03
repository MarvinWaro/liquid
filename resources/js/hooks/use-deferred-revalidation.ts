import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

/**
 * Reports whether a partial reload touching any of `props` is currently in
 * flight.
 *
 * Deferred props keep their previous value while they are being refreshed from
 * a restored history entry, so the usual "prop is still undefined" check cannot
 * detect that kind of update. Watching the visit itself lets the UI signal that
 * fresher data is on its way without blanking out what is already on screen.
 *
 * Full-page visits are ignored: they carry no `only` list, and the undefined
 * props they produce already drive the existing loading states.
 *
 * `props` must be referentially stable — declare it outside the component.
 */
export function useDeferredRevalidation(props: readonly string[]): boolean {
    const [pending, setPending] = useState(0);

    useEffect(() => {
        const watched = new Set(props);
        const isWatched = (only: string[]) => only.some((prop) => watched.has(prop));

        const stopStart = router.on('start', (event) => {
            if (isWatched(event.detail.visit.only)) {
                setPending((count) => count + 1);
            }
        });

        // `finish` also fires for cancelled and interrupted visits, so the
        // counter cannot get stuck. Clamp at zero in case this hook mounts
        // between a visit's start and finish.
        const stopFinish = router.on('finish', (event) => {
            if (isWatched(event.detail.visit.only)) {
                setPending((count) => Math.max(0, count - 1));
            }
        });

        return () => {
            stopStart();
            stopFinish();
        };
    }, [props]);

    return pending > 0;
}
