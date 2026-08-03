import { AppearanceToggle } from '@/components/appearance-toggle';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useLayoutPreference } from '@/hooks/use-layout-preference';
import { type BreadcrumbItem as BreadcrumbItemType } from '@/types';
import { PanelTop } from 'lucide-react';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const { toggleLayout } = useLayoutPreference();

    return (
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleLayout}
                    className="h-7 w-7"
                    title="Switch to header layout"
                >
                    <PanelTop className="h-4 w-4" />
                </Button>
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>

            <div className="ml-auto flex items-center gap-1">
                <NotificationDropdown />

                <AppearanceToggle />
            </div>
        </header>
    );
}
