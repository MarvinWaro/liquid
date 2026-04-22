import { type DensityPreference, useDensityPreference } from '@/hooks/use-density-preference';
import { cn } from '@/lib/utils';
import { Check, Rows3, Rows4 } from 'lucide-react';
import { type HTMLAttributes } from 'react';

interface DensityOption {
    value: DensityPreference;
    label: string;
    description: string;
    icon: typeof Rows3;
    preview: React.ReactNode;
}

function ComfortablePreview() {
    return (
        <div className="flex h-full flex-col overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-600 dark:bg-neutral-900">
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className={cn(
                        'flex items-center gap-1.5 px-2 py-1.5',
                        i < 2 && 'border-b border-neutral-200 dark:border-neutral-700',
                    )}
                >
                    <div className="h-1.5 w-10 rounded-sm bg-neutral-200 dark:bg-neutral-700" />
                    <div className="h-1.5 w-full rounded-sm bg-neutral-100 dark:bg-neutral-800" />
                </div>
            ))}
        </div>
    );
}

function CompactPreview() {
    return (
        <div className="flex h-full flex-col overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-600 dark:bg-neutral-900">
            {[0, 1, 2, 3, 4].map((i) => (
                <div
                    key={i}
                    className={cn(
                        'flex items-center gap-1.5 px-2 py-[3px]',
                        i < 4 && 'border-b border-neutral-200 dark:border-neutral-700',
                    )}
                >
                    <div className="h-1.5 w-10 rounded-sm bg-neutral-200 dark:bg-neutral-700" />
                    <div className="h-1.5 w-full rounded-sm bg-neutral-100 dark:bg-neutral-800" />
                </div>
            ))}
        </div>
    );
}

const densityOptions: DensityOption[] = [
    {
        value: 'comfortable',
        label: 'Comfortable',
        description: 'Roomier rows that are easier to scan on smaller data sets.',
        icon: Rows3,
        preview: <ComfortablePreview />,
    },
    {
        value: 'compact',
        label: 'Compact',
        description: 'Tighter rows so more records fit on screen — ideal for reviewing long lists.',
        icon: Rows4,
        preview: <CompactPreview />,
    },
];

export default function DensityTabs({
    className = '',
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    const { density, setDensity } = useDensityPreference();

    return (
        <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2', className)} {...props}>
            {densityOptions.map(({ value, label, description, icon: Icon, preview }) => {
                const isActive = density === value;
                return (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setDensity(value)}
                        className={cn(
                            'relative flex flex-col rounded-xl border-2 p-4 text-left transition-all',
                            isActive
                                ? 'border-foreground bg-foreground/5 dark:bg-foreground/10'
                                : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600',
                        )}
                    >
                        {/* Checkmark */}
                        {isActive && (
                            <div className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background">
                                <Check className="h-3 w-3" />
                            </div>
                        )}

                        {/* Icon */}
                        <div
                            className={cn(
                                'mb-3 flex h-10 w-10 items-center justify-center rounded-lg',
                                isActive
                                    ? 'bg-foreground/10 text-foreground dark:bg-foreground/20'
                                    : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
                            )}
                        >
                            <Icon className="h-5 w-5" />
                        </div>

                        {/* Text */}
                        <h3 className="text-sm font-semibold">{label}</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>

                        {/* Preview mockup */}
                        <div className="mt-3 h-20">{preview}</div>
                    </button>
                );
            })}
        </div>
    );
}
