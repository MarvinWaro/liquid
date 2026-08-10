import { cn } from '@/lib/utils';

/**
 * Liqui's chat head — the avatar beside every assistant message.
 *
 * The tinted circle is kept from the Lucide glyph it replaces so spacing and
 * alignment match the rest of the thread. The artwork is transparent outside
 * the mascot, so the tint reads as the avatar background in both themes.
 *
 * Source is a 96px WebP (3.3 KB), which covers this 32px circle at 3x.
 */
export function LiquiAvatar({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                'mt-1 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10',
                className,
            )}
        >
            <img
                src="/assets/img/liqui-icon.webp"
                alt=""
                aria-hidden="true"
                className="h-6 w-6 object-contain"
            />
        </div>
    );
}
