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
    const lastFlashRef = useRef<string | null>(null);

    useEffect(() => {
        const msg = flash?.success || flash?.error || null;
        if (!msg || msg === lastFlashRef.current) return;
        lastFlashRef.current = msg;

        if (flash?.success) {
            toast.success(flash.success);
        } else if (flash?.error) {
            toast.error(flash.error);
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
