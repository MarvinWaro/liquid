import AppHeaderLayout from '@/layouts/app/app-header-layout';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { useLayoutPreference } from '@/hooks/use-layout-preference';
import { type BreadcrumbItem } from '@/types';
import { type ReactNode, useEffect } from 'react';
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

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
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
