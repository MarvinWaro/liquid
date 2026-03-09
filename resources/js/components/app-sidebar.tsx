import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import { type NavItem, type SharedData, type NavigationAbilities } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { FileText, LayoutGrid, ScrollText } from 'lucide-react';

// Define all navigation items with their required ability key
const allNavItems: (NavItem & { ability?: keyof NavigationAbilities })[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
        ability: 'canViewDashboard',
    },
    {
        title: 'Liquidation',
        href: '/liquidation',
        icon: FileText,
        ability: 'canViewLiquidation',
    },
];

export function AppSidebar() {
    const page = usePage<SharedData>();
    const can = page.props.can || {
        canViewDashboard: false,
        canViewLiquidation: false,
        canViewRoles: false,
        canViewUsers: false,
        canViewActivityLogs: false,
    };

    const mainNavItems = allNavItems.filter(item => {
        if (!item.ability) return true;
        return can[item.ability] === true;
    });

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch className="flex items-center gap-3">
                                <img
                                    src="/assets/img/unifast.png"
                                    alt="UniFAST Logo"
                                    className="h-8 w-8 shrink-0"
                                />
                                <span className="font-anton text-lg tracking-widest leading-tight group-data-[collapsible=icon]:hidden">
                                    Uni<span className="text-orange-500">FAST</span>
                                </span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                {can.canViewActivityLogs && (
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                                <Link href="/activity-logs" prefetch>
                                    <ScrollText />
                                    <span>Activity Logs</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                )}
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
