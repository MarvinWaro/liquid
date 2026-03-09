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
    Check,
    FileText,
    LayoutGrid,
    Menu,
    Monitor,
    Moon,
    PanelLeft,
    Sun,
} from 'lucide-react';
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
        return allNavItems.filter((item) => {
            if (!item.ability) return true;
            return can[item.ability] === true;
        });
    }, [can]);

    return (
        <>
            {/* Single clean header bar */}
            <header className="border-b border-sidebar-border/70">
                <div className="flex h-14 items-center gap-4 px-4 md:px-16">
                    {/* Mobile Menu */}
                    <div className="lg:hidden">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent
                                side="left"
                                className="flex h-full w-64 flex-col items-stretch justify-between"
                            >
                                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                                <SheetHeader className="flex justify-start text-left">
                                    <Link href={dashboard()} prefetch className="flex items-center gap-2">
                                        <img src="/assets/img/unifast.png" alt="UniFAST Logo" className="h-8 w-8" />
                                        <span className="font-anton text-base tracking-wide">
                                            Uni<span className="text-orange-500">FAST</span>
                                        </span>
                                    </Link>
                                </SheetHeader>
                                <div className="flex h-full flex-1 flex-col space-y-1 p-4">
                                    {mainNavItems.map((item) => (
                                        <Link
                                            key={item.title}
                                            href={item.href}
                                            className={cn(
                                                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                                urlIsActive(item.href)
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                            )}
                                        >
                                            {item.icon && <Icon iconNode={item.icon} className="h-4 w-4" />}
                                            <span>{item.title}</span>
                                        </Link>
                                    ))}
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>

                    {/* Logo */}
                    <Link href={dashboard()} prefetch className="flex shrink-0 items-center gap-2">
                        <img src="/assets/img/unifast.png" alt="UniFAST Logo" className="h-8 w-8" />
                        <span className="font-anton text-base tracking-wide">
                            Uni<span className="text-orange-500">FAST</span>
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden h-full items-center gap-1 lg:flex">
                        {mainNavItems.map((item) => (
                            <Link
                                key={item.title}
                                href={item.href}
                                className={cn(
                                    'relative inline-flex h-full items-center gap-2 px-3 text-sm font-medium transition-colors',
                                    'text-muted-foreground hover:text-foreground',
                                    urlIsActive(item.href) && 'text-foreground',
                                )}
                            >
                                {item.icon && <Icon iconNode={item.icon} className="h-4 w-4" />}
                                {item.title}
                                {urlIsActive(item.href) && (
                                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
                                )}
                            </Link>
                        ))}
                    </nav>

                    {/* Right section */}
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

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleLayout}
                            className="h-8 w-8"
                            title="Switch to sidebar layout"
                        >
                            <PanelLeft className="h-4 w-4" />
                        </Button>

                        <span className="hidden text-sm font-medium text-muted-foreground md:block mx-1">
                            {auth.user.name}
                        </span>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="size-8 rounded-full p-0">
                                    <Avatar className="size-8 overflow-hidden rounded-full">
                                        <AvatarImage src={auth.user.avatar_url} alt={auth.user.name} />
                                        <AvatarFallback className="rounded-full text-xs">
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

            {breadcrumbs.length > 1 && (
                <div className="flex w-full border-b border-sidebar-border/70">
                    <div className="flex h-10 w-full items-center justify-start px-4 text-muted-foreground md:px-16">
                        <Breadcrumbs breadcrumbs={breadcrumbs} />
                    </div>
                </div>
            )}
        </>
    );
}
