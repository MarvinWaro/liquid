import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Heart } from 'lucide-react';
import { useState } from 'react';

/**
 * The heart + count pill on a comment, which reveals who reacted.
 *
 * Built on Popover rather than Tooltip on purpose. A tooltip only answers to a
 * mouse, so on a phone the names would be unreachable — and HEI staff do open
 * announcements on their phones. Popover handles pointer, touch and keyboard,
 * so hovering on a laptop, tapping on a phone, and tabbing to it all open the
 * same list.
 */
export function ReactorsBadge({
    count,
    names,
    className,
}: {
    count: number;
    /** Up to AnnouncementComment::REACTOR_NAMES_LIMIT names, viewer first as "You". */
    names: string[];
    className?: string;
}) {
    const [open, setOpen] = useState(false);

    if (count <= 0) return null;

    // The server caps the list, so anyone past the cap is summarised.
    const remaining = count - names.length;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={`${count} ${count === 1 ? 'reaction' : 'reactions'}. Show who reacted.`}
                    onMouseEnter={() => setOpen(true)}
                    onMouseLeave={() => setOpen(false)}
                    className={cn(
                        'inline-flex cursor-pointer items-center gap-0.5 rounded-full border bg-background px-1.5 py-0.5 text-[10px] shadow-sm transition-colors hover:bg-muted',
                        className,
                    )}
                >
                    <Heart className="h-2.5 w-2.5 fill-red-500 text-red-500" />
                    {count}
                </button>
            </PopoverTrigger>
            <PopoverContent
                side="top"
                align="end"
                sideOffset={6}
                // Hovering must not steal focus from whatever the user was doing,
                // and the pointer needs to be able to leave without the popover
                // grabbing it back.
                onOpenAutoFocus={(event) => event.preventDefault()}
                onPointerEnter={() => setOpen(true)}
                onPointerLeave={() => setOpen(false)}
                className="w-auto max-w-56 p-2"
            >
                <ul className="space-y-0.5 text-xs">
                    {names.map((name, index) => (
                        <li key={`${name}-${index}`} className="truncate">
                            {name}
                        </li>
                    ))}
                    {remaining > 0 && (
                        <li className="text-muted-foreground">
                            and {remaining} {remaining === 1 ? 'other' : 'others'}
                        </li>
                    )}
                </ul>
            </PopoverContent>
        </Popover>
    );
}
