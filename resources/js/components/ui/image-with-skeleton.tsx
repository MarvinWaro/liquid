import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useCallback, useState, type CSSProperties } from 'react';

/**
 * An image that shows a skeleton in its place until it has loaded.
 *
 * The skeleton is positioned `absolute inset-0`, so every call site must sit
 * inside a `relative` parent — which the announcement cards already do. That
 * keeps the image's own sizing classes untouched and means adding this cannot
 * shift any layout.
 *
 * On error the skeleton is cleared rather than left spinning; the parent's own
 * placeholder background shows through instead.
 */
export function ImageWithSkeleton({
    src,
    alt = '',
    className,
    skeletonClassName,
    style,
    loading,
    fill = true,
}: {
    src: string;
    alt?: string;
    className?: string;
    /** Extra classes for the skeleton, e.g. to match a non-default corner radius. */
    skeletonClassName?: string;
    style?: CSSProperties;
    loading?: 'lazy' | 'eager';
    /**
     * `true` (default) overlays the skeleton on a box the image already fills —
     * the announcement cards, where the parent fixes the height.
     *
     * `false` is for an image whose height comes from the image itself, like the
     * full-width cover on an announcement page. There is no box to overlay, so
     * the skeleton takes the space in flow and the image stays hidden until it is
     * ready. A hidden image still downloads, so nothing is delayed by this.
     */
    fill?: boolean;
}) {
    const [settled, setSettled] = useState(false);

    // A cached image can finish loading before React attaches onLoad, which would
    // leave the skeleton up forever. A ref callback runs early enough to catch it,
    // and unlike an effect it does not trip react-hooks/set-state-in-effect.
    const measureRef = useCallback((node: HTMLImageElement | null) => {
        if (node?.complete) setSettled(true);
    }, []);

    return (
        <>
            <img
                ref={measureRef}
                src={src}
                alt={alt}
                loading={loading}
                style={style}
                className={cn(className, !settled && (fill ? 'opacity-0' : 'hidden'))}
                onLoad={() => setSettled(true)}
                onError={() => setSettled(true)}
            />
            {!settled && (
                <Skeleton
                    aria-hidden
                    className={cn(
                        fill ? 'absolute inset-0 rounded-lg' : 'w-full',
                        skeletonClassName,
                    )}
                />
            )}
        </>
    );
}
