import AppHeaderLayout from '@/layouts/app/app-header-layout';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { useLayoutPreference } from '@/hooks/use-layout-preference';
import { type BreadcrumbItem } from '@/types';
import { type ReactNode, useEffect, useRef } from 'react';
import { usePage } from '@inertiajs/react';
import { Toaster } from '@/components/ui/sonner';
import { toast } from '@/lib/toast';

interface AppLayoutProps {
    children: ReactNode;
    breadcrumbs?: BreadcrumbItem[];
}

export default ({ children, breadcrumbs, ...props }: AppLayoutProps) => {
    const { flash } = usePage().props as any;
    const { layout } = useLayoutPreference();
    const lastFlashRef = useRef<unknown>(null);

    useEffect(() => {
        // Dedupe on the flash object, not on its text. HandleInertiaRequests
        // rebuilds `flash` on every response, so each server reply arrives as a
        // new object while a plain re-render keeps the same one — which makes
        // "once per response" the right key. Comparing the message string instead
        // silently swallowed every repeat of the same message, so pressing Save
        // twice only ever toasted once.
        if (flash === lastFlashRef.current) return;
        lastFlashRef.current = flash;

        if (flash?.success) {
            toast.success(flash.success);
        } else if (flash?.error) {
            toast.error(flash.error);
        } else if (flash?.info) {
            toast.info(flash.info);
        }
    }, [flash]);

    const Layout = layout === 'sidebar' ? AppSidebarLayout : AppHeaderLayout;

    return (
        <Layout breadcrumbs={breadcrumbs} {...props}>
            {children}
            <Toaster richColors position="bottom-right" />
        </Layout>
    );
};
