import { Breadcrumbs } from '@/components/breadcrumbs';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAppearance } from '@/hooks/use-appearance';
import { useLayoutPreference } from '@/hooks/use-layout-preference';
import { type BreadcrumbItem as BreadcrumbItemType } from '@/types';
import { Check, Monitor, Moon, PanelTop, Sun } from 'lucide-react';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const { toggleLayout } = useLayoutPreference();
    const { appearance, updateAppearance } = useAppearance();

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

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            {appearance === 'light' && <Sun className="h-4 w-4" />}
                            {appearance === 'dark' && <Moon className="h-4 w-4" />}
                            {appearance === 'system' && <Monitor className="h-4 w-4" />}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => updateAppearance('light')} className="cursor-pointer">
                            <Sun className="mr-2 h-4 w-4" />
                            <span>Light</span>
                            {appearance === 'light' && <Check className="ml-auto h-4 w-4" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateAppearance('dark')} className="cursor-pointer">
                            <Moon className="mr-2 h-4 w-4" />
                            <span>Dark</span>
                            {appearance === 'dark' && <Check className="ml-auto h-4 w-4" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateAppearance('system')} className="cursor-pointer">
                            <Monitor className="mr-2 h-4 w-4" />
                            <span>System</span>
                            {appearance === 'system' && <Check className="ml-auto h-4 w-4" />}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
