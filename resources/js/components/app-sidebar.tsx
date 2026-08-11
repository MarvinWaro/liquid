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
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import { type NavItemWithAbility, type SharedData, type NavigationAbilities } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { FileText, LayoutGrid, BarChart3, Megaphone, FileBarChart } from 'lucide-react';
import { HatGlasses } from '@/components/icons/hat-glasses';

// Define all navigation items with their required ability key
const allNavItems: NavItemWithAbility[] = [
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
    // Liqui is deliberately absent here — it is pinned to the sidebar footer
    // instead (see AskLiqui below) so it does not consume a slot in the main nav.
    {
        title: 'Contact & Support',
        href: '/contact-support',
        icon: HatGlasses,
    },
];

export function AppSidebar() {
    const page = usePage<SharedData>();
    // Partial, because the fallback below deliberately lists only a few keys —
    // typing it as the full NavigationAbilities would be a lie, and indexing an
    // incomplete literal is what produced the implicit-any error.
    const can: Partial<NavigationAbilities> = page.props.can || {
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
                {can.canUseReportAssistant && <AskLiqui />}
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}

/**
 * Liqui's entry point, pinned above the user menu.
 *
 * Built here rather than through NavMain or NavFooter because those render a
 * Lucide component from NavItem.icon, and this needs an <img>. Widening that
 * shared type for one branded item would push the exception onto every other
 * nav entry.
 *
 * The icon is a 64px WebP (1.8 KB). The uploaded source is 1254px / 588 KB, which
 * would have been roughly 28x more pixels than are ever displayed here.
 */
function AskLiqui() {
    const page = usePage<SharedData>();
    const isActive = page.url.startsWith('/report-assistant');

    return (
        <>
            {/* Expanded: a promo card carrying Liqui's own artwork. Hidden the
                moment the sidebar collapses, since a card cannot survive a 48px
                rail. */}
            <Link
                href="/report-assistant"
                prefetch
                className={cn(
                    'group/liqui mx-1 mb-1 flex flex-col gap-2 rounded-xl border p-3 transition-colors',
                    'bg-sidebar-accent/40 hover:bg-sidebar-accent',
                    'group-data-[collapsible=icon]:hidden',
                    isActive && 'border-sidebar-ring bg-sidebar-accent',
                )}
            >
                <img
                    src="/assets/img/liqui-with-name.webp"
                    alt="Liqui"
                    className="h-8 w-auto self-start object-contain"
                />
                <span className="text-xs leading-snug text-sidebar-foreground/70">
                    Ask about liquidation totals, breakdowns, and summaries.
                </span>
                <span className="text-xs font-medium text-sidebar-foreground">
                    Ask Liqui &rarr;
                </span>
            </Link>

            {/* Collapsed: icon only, so the rail stays a rail. The tooltip is
                what names it here. */}
            <SidebarMenu className="hidden group-data-[collapsible=icon]:block">
                <SidebarMenuItem>
                    <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={{ children: 'Ask Liqui' }}
                    >
                        <Link href="/report-assistant" prefetch>
                            <img
                                src="/assets/img/liqui-icon.webp"
                                alt=""
                                aria-hidden="true"
                                className="size-5 shrink-0 rounded-full object-contain"
                            />
                            <span>Ask Liqui</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </>
    );
}
