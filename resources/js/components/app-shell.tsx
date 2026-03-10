import { SidebarProvider } from '@/components/ui/sidebar';
import { useCallback, useState } from 'react';

interface AppShellProps {
    children: React.ReactNode;
    variant?: 'header' | 'sidebar';
}

function getCookieValue(name: string): string | null {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

export function AppShell({ children, variant = 'header' }: AppShellProps) {
    const [open, setOpen] = useState(() => {
        const cookie = getCookieValue('sidebar_state');
        return cookie === null ? true : cookie === 'true';
    });

    const handleOpenChange = useCallback((value: boolean) => {
        setOpen(value);
    }, []);

    if (variant === 'header') {
        return (
            <div className="flex min-h-screen w-full flex-col">{children}</div>
        );
    }

    return (
        <SidebarProvider open={open} onOpenChange={handleOpenChange}>
            {children}
        </SidebarProvider>
    );
}
