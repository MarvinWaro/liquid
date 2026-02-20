import { useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage, AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { type LiquidationUser, getInitials, getAvatarColor } from '@/types/liquidation';

interface AvatarStackProps {
    namesStr: string;
    avatarMap: Record<string, string>;
    maxVisible?: number;
}

export default function AvatarStack({ namesStr, avatarMap, maxVisible = 3 }: AvatarStackProps) {
    const names = namesStr.split(',').filter(Boolean).map(s => s.trim());
    if (names.length === 0) return null;

    const visible = names.slice(0, maxVisible);
    const overflow = names.length - maxVisible;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="inline-flex">
                        {names.length === 1 ? (
                            <Avatar size="sm" className="size-6">
                                {avatarMap[names[0]] && <AvatarImage src={avatarMap[names[0]]} alt={names[0]} />}
                                <AvatarFallback className={`text-[9px] font-bold ${getAvatarColor(names[0])}`}>
                                    {getInitials(names[0])}
                                </AvatarFallback>
                            </Avatar>
                        ) : (
                            <AvatarGroup>
                                {visible.map((name, i) => (
                                    <Avatar key={i} size="sm" className="size-6">
                                        {avatarMap[name] && <AvatarImage src={avatarMap[name]} alt={name} />}
                                        <AvatarFallback className={`text-[9px] font-bold ${getAvatarColor(name)}`}>
                                            {getInitials(name)}
                                        </AvatarFallback>
                                    </Avatar>
                                ))}
                                {overflow > 0 && (
                                    <AvatarGroupCount className="size-6 text-[9px] font-semibold">
                                        +{overflow}
                                    </AvatarGroupCount>
                                )}
                            </AvatarGroup>
                        )}
                    </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="p-2">
                    <div className="space-y-1">
                        {names.map((n, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                                {avatarMap[n] ? (
                                    <img src={avatarMap[n]} alt={n} className="size-4 rounded-full object-cover" />
                                ) : (
                                    <div className={`size-4 rounded-full flex items-center justify-center text-[7px] font-bold ${getAvatarColor(n)}`}>
                                        {getInitials(n)}
                                    </div>
                                )}
                                {n}
                            </div>
                        ))}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

/** Build a name → avatar_url map from user arrays */
export function useAvatarMap(users: LiquidationUser[]): Record<string, string> {
    return useMemo(() => {
        const map: Record<string, string> = {};
        users.forEach(u => {
            if (u.avatar_url) map[u.name] = u.avatar_url;
        });
        return map;
    }, [users]);
}
