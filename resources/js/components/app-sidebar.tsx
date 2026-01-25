import { NavFooter } from '@/components/nav-footer';
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
import { BookOpen, Folder, LayoutGrid, Shield, Users, FileText } from 'lucide-react';
import AppLogo from './app-logo';
import { useMemo } from 'react';

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
    {
        title: 'Roles & Permissions',
        href: '/roles',
        icon: Shield,
        ability: 'canViewRoles',
    },
    {
        title: 'Users',
        href: '/users',
        icon: Users,
        ability: 'canViewUsers',
    },
];

const footerNavItems: NavItem[] = [
    {
        title: 'Repository',
        href: 'https://github.com/laravel/react-starter-kit',
        icon: Folder,
    },
    {
        title: 'Documentation',
        href: 'https://laravel.com/docs/starter-kits#react',
        icon: BookOpen,
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

    // Filter navigation items based on user abilities
    const mainNavItems = allNavItems.filter(item => {
        // If no ability key specified, always show (fallback)
        if (!item.ability) return true;

        // Check if user has the required ability
        return can[item.ability] === true;
    });

    return (
        <Sidebar collapsible="icon" variant="inset" className="bg-[#2c3e50] border-r border-[#1a252f]">
            <SidebarHeader className="bg-[#2c3e50]">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild className="hover:bg-white/10">
                            <Link href={dashboard()} prefetch className="flex items-center space-x-3">
                                <img
                                    src="/assets/img/unifast.png"
                                    alt="UniFAST Logo"
                                    className="h-8 w-8"
                                />
                                <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                                    <span className="text-white font-semibold text-sm leading-tight">
                                        UniFAST
                                    </span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent className="bg-[#2c3e50]">
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter className="bg-[#2c3e50]">
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
