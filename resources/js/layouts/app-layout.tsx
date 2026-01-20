import AppLayoutTemplate from '@/layouts/app/app-sidebar-layout';
import { type BreadcrumbItem } from '@/types';
import { type ReactNode, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

interface AppLayoutProps {
    children: ReactNode;
    breadcrumbs?: BreadcrumbItem[];
}

export default ({ children, breadcrumbs, ...props }: AppLayoutProps) => {
    // 1. Get the flash data from Laravel via Inertia
    const { flash } = usePage().props as any;

    // 2. Listen for changes in flash messages and trigger the toast
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    return (
        <AppLayoutTemplate breadcrumbs={breadcrumbs} {...props}>
            {children}

            {/* 3. The Toaster component renders the actual notifications */}
            <Toaster richColors position="bottom-right" />
        </AppLayoutTemplate>
    );
};
