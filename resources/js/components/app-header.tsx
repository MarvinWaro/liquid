import { Breadcrumbs } from '@/components/breadcrumbs';
import { Icon } from '@/components/icon';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { UserMenuContent } from '@/components/user-menu-content';
import { useActiveUrl } from '@/hooks/use-active-url';
import { useAppearance } from '@/hooks/use-appearance';
import { useLayoutPreference } from '@/hooks/use-layout-preference';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import {
    type BreadcrumbItem,
    type NavigationAbilities,
    type NavItem,
    type SharedData,
} from '@/types';
import { Link, usePage } from '@inertiajs/react';
import {
    BarChart3,
    Check,
    ChevronDown,
    FileText,
    LayoutGrid,
    LifeBuoy,
    Megaphone,
    Menu,
    Monitor,
    Moon,
    PanelLeft,
    Sun,
} from 'lucide-react';
import { useMemo } from 'react';

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
        title: 'Contact & Support',
        href: '/contact-support',
        icon: LifeBuoy,
    },
];

interface AppHeaderProps {
    breadcrumbs?: BreadcrumbItem[];
}

export function AppHeader({ breadcrumbs = [] }: AppHeaderProps) {
    const page = usePage<SharedData>();
    const { auth } = page.props;
    const getInitials = useInitials();
    const { urlIsActive } = useActiveUrl();
    const { appearance, updateAppearance } = useAppearance();
    const { toggleLayout } = useLayoutPreference();

    const can = page.props.can || {
        canViewDashboard: false,
        canViewLiquidation: false,
        canViewRoles: false,
        canViewUsers: false,
        canViewHEI: false,
        canViewRegions: false,
    };

    const mainNavItems = useMemo(() => {
        return allNavItems
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
    }, [can]);

    return (
        <>
        <div className="sticky top-0 z-50">
            <header className="bg-gray-100 dark:bg-card text-foreground shadow-none">
                {/* Top row: Logo + controls */}
                <div className="flex items-center gap-4 px-8 md:px-16 py-1">
                    {/* Mobile Menu */}
                    <div className="lg:hidden">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="flex h-full w-64 flex-col items-stretch justify-between">
                                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                                <SheetHeader className="flex justify-start text-left">
                                    <Link href={dashboard()} prefetch className="flex items-center gap-3">
                                        <img src="/assets/img/unifast.png" alt="UniFAST" className="h-9 w-9 shrink-0" />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold leading-tight text-foreground">Uni<span className="text-orange-500">FAST</span></span>
                                            <span className="text-[10px] text-muted-foreground leading-tight">Liquidation Management</span>
                                        </div>
                                    </Link>
                                </SheetHeader>
                                <div className="flex h-full flex-1 flex-col space-y-1 p-4">
                                    {mainNavItems.map((item) =>
                                        item.children && item.children.length > 0 ? (
                                            <div key={item.title} className="space-y-1">
                                                <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground">
                                                    {item.icon && <Icon iconNode={item.icon} className="h-4 w-4" />}
                                                    <span>{item.title}</span>
                                                </div>
                                                {item.children.map((child) => (
                                                    <Link
                                                        key={child.title}
                                                        href={child.href}
                                                        className={cn(
                                                            'flex items-center gap-2 rounded-md px-3 py-2 pl-9 text-sm font-medium transition-colors',
                                                            urlIsActive(child.href)
                                                                ? 'bg-foreground text-background'
                                                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                                        )}
                                                    >
                                                        <span>{child.title}</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        ) : (
                                            <Link
                                                key={item.title}
                                                href={item.href}
                                                className={cn(
                                                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                                    urlIsActive(item.href)
                                                        ? 'bg-foreground text-background'
                                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                                )}
                                            >
                                                {item.icon && <Icon iconNode={item.icon} className="h-4 w-4" />}
                                                <span>{item.title}</span>
                                            </Link>
                                        )
                                    )}
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>

                    {/* Logo + Title + ACHIEVE */}
                    <div className="flex shrink-0 items-center gap-3">
                        <Link href={dashboard()} prefetch className="flex items-center gap-3">
                            <img src="/assets/img/unifast.png" alt="UniFAST" className="h-11 w-11 shrink-0" />
                            <div className="hidden flex-col md:flex">
                                <span className="text-sm font-bold leading-tight tracking-wide">Uni<span className="text-orange-500">FAST</span></span>
                                <span className="text-[11px] text-muted-foreground leading-tight">Liquidation Management System</span>
                            </div>
                        </Link>
                        <div className="hidden md:flex items-center gap-3">
                            <img src="/assets/img/ched-logo.png" alt="CHED" className="h-12 w-auto shrink-0" />
                            <img src="/assets/img/bagong-pilipinas.png" alt="Bagong Pilipinas" className="h-12 w-auto shrink-0" />
                            <img src="/assets/img/achieve.png" alt="ACHIEVE" className="h-17 w-auto shrink-0 pt-1" />
                        </div>
                    </div>

                    {/* Right section */}
                    <div className="ml-auto flex items-center gap-1">
                        <NotificationDropdown />

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
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

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleLayout}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Switch to sidebar layout"
                        >
                            <PanelLeft className="h-4 w-4" />
                        </Button>

                        <span className="hidden text-sm font-medium text-foreground md:block mx-1">
                            {auth.user.name}
                        </span>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="size-8 rounded-full p-0">
                                    <Avatar className="size-8 overflow-hidden rounded-full ring-2 ring-border">
                                        <AvatarImage src={auth.user.avatar_url} alt={auth.user.name} />
                                        <AvatarFallback className="rounded-full text-xs bg-muted text-foreground">
                                            {getInitials(auth.user.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end">
                                <UserMenuContent user={auth.user} />
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

            </header>

            {/* Desktop Navigation - transparent bar */}
            <nav className="hidden h-10 items-center gap-1 lg:flex px-8 md:px-16 bg-gray-100 dark:bg-card border-b border-border">
                {mainNavItems.map((item) =>
                    item.children && item.children.length > 0 ? (
                        <DropdownMenu key={item.title}>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className={cn(
                                        'relative inline-flex h-10 items-center gap-1.5 px-4 text-sm font-medium transition-colors outline-none',
                                        item.children.some(child => urlIsActive(child.href))
                                            ? 'text-foreground'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    {item.icon && <Icon iconNode={item.icon} className="h-4 w-4" />}
                                    {item.title}
                                    <ChevronDown className="h-3.5 w-3.5" />
                                    {item.children.some(child => urlIsActive(child.href)) && (
                                        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground" />
                                    )}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                {item.children.map((child) => (
                                    <DropdownMenuItem key={child.title} asChild className="cursor-pointer">
                                        <Link href={child.href} prefetch>
                                            {child.title}
                                        </Link>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Link
                            key={item.title}
                            href={item.href}
                            className={cn(
                                'relative inline-flex h-10 items-center gap-2 px-4 text-sm font-medium transition-colors',
                                urlIsActive(item.href)
                                    ? 'text-foreground'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {item.icon && <Icon iconNode={item.icon} className="h-4 w-4" />}
                            {item.title}
                            {urlIsActive(item.href) && (
                                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground" />
                            )}
                        </Link>
                    )
                )}
            </nav>
        </div>

            {breadcrumbs.length > 1 && (
                <div className="flex w-full border-b">
                    <div className="flex h-10 w-full items-center justify-start px-4 text-muted-foreground md:px-16">
                        <Breadcrumbs breadcrumbs={breadcrumbs} />
                    </div>
                </div>
            )}
        </>
    );
}
