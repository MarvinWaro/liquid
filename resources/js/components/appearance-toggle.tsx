import { Button } from '@/components/ui/button';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import { Moon, Sun } from 'lucide-react';

export function AppearanceToggle({ className = '' }: { className?: string }) {
    const { resolvedAppearance, updateAppearance } = useAppearance();
    const isDark = resolvedAppearance === 'dark';
    const nextAppearance = isDark ? 'light' : 'dark';
    const label = `Switch to ${nextAppearance} mode`;

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(event) => updateAppearance(nextAppearance, { x: event.clientX, y: event.clientY })}
            className={cn('h-8 w-8', className)}
            aria-label={label}
            title={label}
        >
            {isDark ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="sr-only">{label}</span>
        </Button>
    );
}
