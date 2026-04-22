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
import { FileText, LayoutGrid, BarChart3, Megaphone, FileBarChart, CalendarRange } from 'lucide-react';
import { HatGlasses } from '@/components/icons/hat-glasses';

// Define all navigation items with their required ability key
const allNavItems: (NavItem & { ability?: keyof NavigationAbilities; children?: (NavItem & { ability?: keyof NavigationAbilities })[] })[] = [
    {
        title: 'Announcement',
        href: '/announcement',
        icon: Megaphone,
    },
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
    {
        title: 'Summary',
        href: '#',
        icon: BarChart3,
        children: [
            {
                title: 'Per Academic Year',
                href: '/summary/academic-year',
                ability: 'canViewSummaryAY',
            },
            {
                title: 'Per HEI',
                href: '/summary/hei',
                ability: 'canViewSummaryHEI',
            },
        ],
    },
    {
        title: 'Report',
        href: '/report',
        icon: FileBarChart,
        ability: 'canViewReports',
    },
    {
        title: 'Fiscal Year',
        href: '/fiscal-year',
        icon: CalendarRange,
    },
    {
        title: 'Contact & Support',
        href: '/contact-support',
        icon: HatGlasses,
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

    const mainNavItems = allNavItems
        .map(item => {
            if (item.children) {
                const filteredChildren = item.children.filter(child => {
                    if (!child.ability) return true;
                    return can[child.ability] === true;
                });
                if (filteredChildren.length === 0) return null;
                return { ...item, children: filteredChildren };
            }
            if (!item.ability) return item;
            return can[item.ability] === true ? item : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

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
                                    <span className="text-sm font-bold leading-tight">Uni<span className="text-orange-500">FAST</span></span>
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
