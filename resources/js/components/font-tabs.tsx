import { type FontPreference, useFontPreference } from '@/hooks/use-font-preference';
import { cn } from '@/lib/utils';
import { Check, Type } from 'lucide-react';
import { type CSSProperties, type HTMLAttributes } from 'react';

interface FontOption {
    value: FontPreference;
    label: string;
    description: string;
    fontFamily: string;
}

const fontOptions: FontOption[] = [
    {
        value: 'inter',
        label: 'Inter (Default)',
        description: 'Modern sans-serif with tabular numerals for consistent figures.',
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
    },
    {
        value: 'plex',
        label: 'IBM Plex Sans',
        description: 'Enterprise typeface favored for financial and accounting interfaces.',
        fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
    },
    {
        value: 'jetbrains',
        label: 'JetBrains Mono',
        description: 'Monospaced type for strict column alignment — ideal for ledgers and figures.',
        fontFamily: "'JetBrains Mono', ui-monospace, Consolas, monospace",
    },
];

function NumberSample() {
    const rows: [string, string][] = [
        ['Disbursed', '1,234,567.89'],
        ['Liquidated', '987,650.00'],
        ['Balance', '246,917.89'],
    ];
    return (
        <div className="flex h-full flex-col justify-center gap-0.5 overflow-hidden rounded-md border border-neutral-200 bg-white px-2 py-1.5 dark:border-neutral-600 dark:bg-neutral-900">
            {rows.map(([label, value]) => (
                <div key={label} className="flex flex-col leading-tight">
                    <span className="text-[9px] text-neutral-500 dark:text-neutral-400">{label}</span>
                    <span className="tabular-nums text-[10px] text-neutral-900 dark:text-neutral-100">₱{value}</span>
                </div>
            ))}
        </div>
    );
}

export default function FontTabs({
    className = '',
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    const { font, setFont } = useFontPreference();

    return (
        <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-3', className)} {...props}>
            {fontOptions.map(({ value, label, description, fontFamily }) => {
                const isActive = font === value;
                const fontStyle: CSSProperties = { fontFamily };
                return (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setFont(value)}
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
                            <Type className="h-5 w-5" />
                        </div>

                        {/* Label (rendered in the option's font so users can feel the difference) */}
                        <h3 className="text-sm font-semibold" style={fontStyle}>{label}</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>

                        {/* Number preview using the option's actual font */}
                        <div className="mt-3 h-20" style={fontStyle}>
                            <NumberSample />
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
