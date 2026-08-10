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
                A hard height caps SidebarInset so the wrapper below becomes a
                real scroll container — its default min-h-svh would let it grow
                with content, and a flex child only scrolls when its parent has
                a fixed height. Paired with overflow-y-auto + min-h-0, sticky
                children inside pages then bind to it correctly.

                The md: subtraction matters: the sidebar runs variant="inset",
                which gives this element md:m-2 — 0.5rem top and bottom. A flat
                h-svh therefore measured 100svh + 1rem and pushed the document
                past the viewport, producing a second scrollbar beside the
                content's own. Below md the margin is not applied, so full
                height is correct there.
            */}
            <AppContent variant="sidebar" className="h-svh md:h-[calc(100svh-1rem)]">
                <AppSidebarHeader breadcrumbs={breadcrumbs} />
                <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-4 md:px-6 py-3">
                    {children}
                </div>
                <AppFooter />
            </AppContent>
        </AppShell>
    );
}
