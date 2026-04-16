import React, { useState, useRef, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterOption {
    value: string;
    label: string;
    group?: string;
    indent?: boolean;
    dot?: string; // color dot class e.g. "bg-red-500"
}

interface MultiSelectFilterProps {
    label: string;
    options: FilterOption[];
    selected: string[];
    onChange: (values: string[]) => void;
    width?: string;
}

export const MultiSelectFilter = React.memo(function MultiSelectFilter({
    label,
    options,
    selected,
    onChange,
    width = 'w-[180px]',
}: MultiSelectFilterProps) {
    const [open, setOpen] = useState(false);

    const toggle = useCallback((value: string) => {
        const next = selected.includes(value)
            ? selected.filter(v => v !== value)
            : [...selected, value];
        onChange(next);
    }, [selected, onChange]);

    const clear = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onChange([]);
    }, [onChange]);

    // Group options by group key
    const groups: { key: string; items: FilterOption[] }[] = [];
    let currentGroup = '';
    options.forEach(opt => {
        if (opt.group && opt.group !== currentGroup) {
            currentGroup = opt.group;
            groups.push({ key: opt.group, items: [] });
        }
        if (groups.length === 0) groups.push({ key: '', items: [] });
        groups[groups.length - 1].items.push(opt);
    });

    const count = selected.length;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    className={cn('justify-between font-normal', width)}
                >
                    <span className="truncate text-sm">
                        {count === 0
                            ? label
                            : count === 1
                                ? options.find(o => o.value === selected[0])?.label ?? label
                                : `${count} selected`}
                    </span>
                    <div className="flex items-center gap-1 ml-1 shrink-0">
                        {count > 0 && (
                            <span
                                role="button"
                                tabIndex={-1}
                                onClick={clear}
                                className="rounded-full hover:bg-muted p-0.5"
                            >
                                <X className="h-3 w-3 text-muted-foreground" />
                            </span>
                        )}
                        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                    </div>
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-0 w-[240px]">
                <div className="max-h-[300px] overflow-y-auto p-1">
                    {groups.map((group, gi) => (
                        <React.Fragment key={gi}>
                            {group.key && (
                                <>
                                    {gi > 0 && <div className="border-t my-1" />}
                                    <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                        {group.key}
                                    </div>
                                </>
                            )}
                            {group.items.map(opt => (
                                <label
                                    key={opt.value}
                                    className={cn(
                                        'flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent text-sm',
                                        opt.indent && 'pl-7',
                                    )}
                                >
                                    <Checkbox
                                        checked={selected.includes(opt.value)}
                                        onCheckedChange={() => toggle(opt.value)}
                                    />
                                    {opt.dot && (
                                        <span className={cn('w-2 h-2 rounded-full shrink-0', opt.dot)} />
                                    )}
                                    <span className="truncate">{opt.label}</span>
                                </label>
                            ))}
                        </React.Fragment>
                    ))}
                </div>
                {count > 0 && (
                    <div className="border-t p-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs h-7"
                            onClick={() => { onChange([]); setOpen(false); }}
                        >
                            Clear all
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
});
