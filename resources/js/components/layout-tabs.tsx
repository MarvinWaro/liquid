import { type LayoutPreference, useLayoutPreference } from '@/hooks/use-layout-preference';
import { cn } from '@/lib/utils';
import { Check, PanelLeft, PanelTop } from 'lucide-react';
import { type HTMLAttributes } from 'react';

interface LayoutOption {
    value: LayoutPreference;
    label: string;
    description: string;
    icon: typeof PanelLeft;
    preview: React.ReactNode;
}

function SidebarPreview() {
    return (
        <div className="flex h-full overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-600">
            {/* Sidebar */}
            <div className="flex w-8 shrink-0 flex-col gap-1.5 border-r border-neutral-200 bg-neutral-100 p-1.5 dark:border-neutral-600 dark:bg-neutral-700">
                <div className="h-1.5 w-full rounded-sm bg-neutral-300 dark:bg-neutral-500" />
                <div className="h-1.5 w-3/4 rounded-sm bg-neutral-300 dark:bg-neutral-500" />
                <div className="h-1.5 w-full rounded-sm bg-neutral-300 dark:bg-neutral-500" />
            </div>
            {/* Content */}
            <div className="flex flex-1 flex-col gap-1.5 p-2">
                <div className="h-2 w-3/4 rounded-sm bg-neutral-200 dark:bg-neutral-600" />
                <div className="h-2 w-full rounded-sm bg-neutral-200 dark:bg-neutral-600" />
                <div className="h-2 w-2/3 rounded-sm bg-neutral-200 dark:bg-neutral-600" />
            </div>
        </div>
    );
}

function HeaderPreview() {
    return (
        <div className="flex h-full flex-col overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-600">
            {/* Top bar */}
            <div className="flex items-center gap-1.5 border-b border-neutral-200 bg-neutral-100 px-2 py-1.5 dark:border-neutral-600 dark:bg-neutral-700">
                <div className="h-1.5 w-6 rounded-sm bg-neutral-300 dark:bg-neutral-500" />
                <div className="h-1.5 w-8 rounded-sm bg-neutral-300 dark:bg-neutral-500" />
                <div className="h-1.5 w-5 rounded-sm bg-neutral-300 dark:bg-neutral-500" />
            </div>
            {/* Content */}
            <div className="flex flex-1 flex-col gap-1.5 p-2">
                <div className="h-2 w-3/4 rounded-sm bg-neutral-200 dark:bg-neutral-600" />
                <div className="h-2 w-full rounded-sm bg-neutral-200 dark:bg-neutral-600" />
                <div className="h-2 w-2/3 rounded-sm bg-neutral-200 dark:bg-neutral-600" />
            </div>
        </div>
    );
}

const layoutOptions: LayoutOption[] = [
    {
        value: 'sidebar',
        label: 'Sidebar Navigation',
        description: 'Menu is always visible on the left side of the page.',
        icon: PanelLeft,
        preview: <SidebarPreview />,
    },
    {
        value: 'header',
        label: 'Header Navigation',
        description: 'Menu is located at the top of the page.',
        icon: PanelTop,
        preview: <HeaderPreview />,
    },
];

export default function LayoutTabs({
    className = '',
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    const { layout, setLayout } = useLayoutPreference();

    return (
        <div className={cn('grid grid-cols-2 gap-4', className)} {...props}>
            {layoutOptions.map(({ value, label, description, icon: Icon, preview }) => {
                const isActive = layout === value;
                return (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setLayout(value)}
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
