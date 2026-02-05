import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Building2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Region {
    id: string;
    code: string;
    name: string;
}

interface HEI {
    id: string;
    name: string;
    code?: string | null;
    region_id?: string | null;
    region?: Region | null;
}

interface HEISelectorProps {
    heis: HEI[];
    regions: Region[];
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    error?: boolean;
    className?: string;
}

export function HEISelector({
    heis,
    regions,
    value,
    onChange,
    placeholder = 'Search institution...',
    error = false,
    className,
}: HEISelectorProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');

    // Filter HEIs based on search and selected region tab
    const filteredHeis = useMemo(() => {
        return heis.filter((hei) => {
            const matchesSearch =
                searchQuery === '' ||
                hei.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (hei.code && hei.code.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesRegion =
                activeTab === 'all' ||
                (hei.region_id && hei.region_id === activeTab) ||
                (hei.region && hei.region.id === activeTab);

            return matchesSearch && matchesRegion;
        });
    }, [heis, searchQuery, activeTab]);

    // Get selected HEI details
    const selectedHei = useMemo(() => {
        return heis.find((h) => h.id === value);
    }, [heis, value]);

    return (
        <div className={cn('space-y-2', className)}>
            {/* Selected HEI Display - Compact badge style with remove button */}
            {selectedHei && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-primary/10 border border-primary/20 rounded-md text-primary">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs truncate flex-1">{selectedHei.name}</span>
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        className="shrink-0 hover:bg-primary/20 rounded p-0.5 transition-colors"
                        title="Remove selection"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="text"
                    placeholder={placeholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={cn('pl-9 h-9', error && 'border-destructive')}
                />
            </div>

            {/* Region Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full grid grid-cols-3 h-7">
                    <TabsTrigger value="all" className="text-xs h-6">
                        All
                    </TabsTrigger>
                    {regions.map((region) => (
                        <TabsTrigger key={region.id} value={region.id} className="text-xs h-6">
                            {region.code}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            {/* HEI List - Dynamic height */}
            <div className="rounded-md border overflow-hidden">
                <div className="max-h-[150px] overflow-y-auto">
                    {filteredHeis.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                            <Building2 className="h-6 w-6 mb-1.5 opacity-50" />
                            <p className="text-xs">No institutions found</p>
                        </div>
                    ) : (
                        <div className="p-1">
                            {filteredHeis.map((hei) => (
                                <button
                                    key={hei.id}
                                    type="button"
                                    onClick={() => onChange(hei.id)}
                                    className={cn(
                                        'w-full flex items-start gap-2 px-2.5 py-2 rounded text-left transition-colors',
                                        'hover:bg-muted/80',
                                        value === hei.id && 'bg-primary/10 text-primary'
                                    )}
                                >
                                    <span className="text-sm leading-snug flex-1">{hei.name}</span>
                                    {value === hei.id && (
                                        <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
