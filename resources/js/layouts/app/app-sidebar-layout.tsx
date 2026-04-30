import { AppContent } from '@/components/app-content';
import { AppFooter } from '@/components/app-footer';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import { type BreadcrumbItem } from '@/types';
import { type PropsWithChildren } from 'react';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: PropsWithChildren<{ breadcrumbs?: BreadcrumbItem[] }>) {
    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            {/*
                h-svh caps SidebarInset at exactly viewport height. Without
                this, its default min-h-svh lets it grow with content, which
                cancels out the wrapper's overflow-y-auto (a flex child needs
                a height-constrained parent for its overflow to actually
                scroll). With h-svh + overflow-y-auto + min-h-0 below, the
                wrapper becomes a real scroll container and sticky children
                inside any page bind to it correctly.
            */}
            <AppContent variant="sidebar" className="h-svh">
                <AppSidebarHeader breadcrumbs={breadcrumbs} />
                <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-4 md:px-6 py-3">
                    {children}
                </div>
                <AppFooter />
            </AppContent>
        </AppShell>
    );
}
