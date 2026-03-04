import { type Appearance, useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { type HTMLAttributes } from 'react';

interface AppearanceOption {
    value: Appearance;
    label: string;
    description: string;
    icon: typeof Sun;
    preview: React.ReactNode;
}

function LightPreview() {
    return (
        <div className="flex h-full flex-col overflow-hidden rounded-md border border-neutral-200 bg-white">
            <div className="flex items-center gap-1.5 border-b border-neutral-200 bg-neutral-50 px-2 py-1.5">
                <div className="h-1.5 w-6 rounded-sm bg-neutral-200" />
                <div className="h-1.5 w-8 rounded-sm bg-neutral-200" />
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-2">
                <div className="h-2 w-3/4 rounded-sm bg-neutral-100" />
                <div className="h-2 w-full rounded-sm bg-neutral-100" />
                <div className="h-2 w-2/3 rounded-sm bg-neutral-100" />
            </div>
        </div>
    );
}

function DarkPreview() {
    return (
        <div className="flex h-full flex-col overflow-hidden rounded-md border border-neutral-600 bg-neutral-900">
            <div className="flex items-center gap-1.5 border-b border-neutral-700 bg-neutral-800 px-2 py-1.5">
                <div className="h-1.5 w-6 rounded-sm bg-neutral-600" />
                <div className="h-1.5 w-8 rounded-sm bg-neutral-600" />
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-2">
                <div className="h-2 w-3/4 rounded-sm bg-neutral-700" />
                <div className="h-2 w-full rounded-sm bg-neutral-700" />
                <div className="h-2 w-2/3 rounded-sm bg-neutral-700" />
            </div>
        </div>
    );
}

function SystemPreview() {
    return (
        <div className="flex h-full overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-600">
            {/* Light half */}
            <div className="flex w-1/2 flex-col bg-white">
                <div className="flex items-center gap-1 border-b border-neutral-200 bg-neutral-50 px-1.5 py-1.5">
                    <div className="h-1.5 w-4 rounded-sm bg-neutral-200" />
                    <div className="h-1.5 w-5 rounded-sm bg-neutral-200" />
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-1.5">
                    <div className="h-2 w-3/4 rounded-sm bg-neutral-100" />
                    <div className="h-2 w-full rounded-sm bg-neutral-100" />
                    <div className="h-2 w-2/3 rounded-sm bg-neutral-100" />
                </div>
            </div>
            {/* Dark half */}
            <div className="flex w-1/2 flex-col bg-neutral-900">
                <div className="flex items-center gap-1 border-b border-neutral-700 bg-neutral-800 px-1.5 py-1.5">
                    <div className="h-1.5 w-4 rounded-sm bg-neutral-600" />
                    <div className="h-1.5 w-5 rounded-sm bg-neutral-600" />
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-1.5">
                    <div className="h-2 w-3/4 rounded-sm bg-neutral-700" />
                    <div className="h-2 w-full rounded-sm bg-neutral-700" />
                    <div className="h-2 w-2/3 rounded-sm bg-neutral-700" />
                </div>
            </div>
        </div>
    );
}

const appearanceOptions: AppearanceOption[] = [
    {
        value: 'light',
        label: 'Light',
        description: 'Clean and bright interface for daytime use.',
        icon: Sun,
        preview: <LightPreview />,
    },
    {
        value: 'dark',
        label: 'Dark',
        description: 'Easier on the eyes in low-light environments.',
        icon: Moon,
        preview: <DarkPreview />,
    },
    {
        value: 'system',
        label: 'System',
        description: 'Automatically matches your device settings.',
        icon: Monitor,
        preview: <SystemPreview />,
    },
];

export default function AppearanceTabs({
    className = '',
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    const { appearance, updateAppearance } = useAppearance();

    return (
        <div className={cn('grid grid-cols-3 gap-4', className)} {...props}>
            {appearanceOptions.map(({ value, label, description, icon: Icon, preview }) => {
                const isActive = appearance === value;
                return (
                    <button
                        key={value}
                        type="button"
                        onClick={() => updateAppearance(value)}
                        className={cn(
                            'relative flex flex-col rounded-xl border-2 p-4 text-left transition-all',
                            isActive
                                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600',
                        )}
                    >
                        {/* Checkmark */}
                        {isActive && (
                            <div className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                                <Check className="h-3 w-3" />
                            </div>
                        )}

                        {/* Icon */}
                        <div
                            className={cn(
                                'mb-3 flex h-10 w-10 items-center justify-center rounded-lg',
                                isActive
                                    ? 'bg-primary/10 text-primary dark:bg-primary/20'
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
