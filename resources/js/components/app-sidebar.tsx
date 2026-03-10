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
import { FileText, LayoutGrid } from 'lucide-react';

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
                            <Link href={dashboard()} prefetch className="flex items-center gap-2">
                                <img
                                    src="/assets/img/unifast.png"
                                    alt="UniFAST"
                                    className="h-8 w-8 shrink-0"
                                />
                                <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                                    <span className="text-sm font-bold leading-tight">UniFAST</span>
                                    <span className="text-[10px] opacity-70 leading-tight">Liquidation Management</span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
