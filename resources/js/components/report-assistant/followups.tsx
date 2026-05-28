import { CornerDownRight } from 'lucide-react';

interface FollowupsProps {
    items: string[];
    onSelect: (question: string) => void;
    disabled?: boolean;
    label?: string;
}

/**
 * Clickable chip row of suggested questions.
 *
 * Used for both AI-emitted follow-ups (after an answer) and the empty-state
 * "Try asking..." block (when no conversation has started yet). Clicking a
 * chip fills the prompt textarea so the user can edit before sending.
 */
export function Followups({
    items,
    onSelect,
    disabled = false,
    label = 'Suggested follow-ups',
}: FollowupsProps) {
    if (!items || items.length === 0) return null;

    return (
        <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
            </p>
            <div className="flex flex-wrap gap-1.5">
                {items.map((question, index) => (
                    <button
                        key={`${index}-${question}`}
                        type="button"
                        disabled={disabled}
                        onClick={() => onSelect(question)}
                        className="group inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <CornerDownRight className="h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                        <span className="truncate">{question}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
