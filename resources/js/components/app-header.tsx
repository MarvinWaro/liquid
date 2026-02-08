import { Breadcrumbs } from '@/components/breadcrumbs';
import { Icon } from '@/components/icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuList,
} from '@/components/ui/navigation-menu';
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
    Sun,
} from 'lucide-react';
import { useMemo } from 'react';
import AppLogoIcon from './app-logo-icon';

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

    const can = page.props.can || {
        canViewDashboard: false,
        canViewLiquidation: false,
        canViewRoles: false,
        canViewUsers: false,
        canViewHEI: false,
        canViewRegions: false,
    };

    // Filter navigation items based on user abilities
    const mainNavItems = useMemo(() => {
        return allNavItems.filter((item) => {
            // If no ability key specified, always show (fallback)
            if (!item.ability) return true;

            // Check if user has the required ability
            return can[item.ability] === true;
        });
    }, [can]);

    return (
        <>
            {/* Top Bar - Logo and User Section */}
            <div className="bg-[#2c3e50]">
                <div className="flex h-16 items-center border-b border-white/10 px-4 md:px-24">
                    {/* Mobile Menu */}
                    <div className="lg:hidden">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="mr-2 h-[34px] w-[34px] text-white/80 hover:bg-white/10 hover:text-white"
                                >
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent
                                side="left"
                                className="flex h-full w-64 flex-col items-stretch justify-between bg-sidebar"
                            >
                                <SheetTitle className="sr-only">
                                    Navigation Menu
                                </SheetTitle>
                                <SheetHeader className="flex justify-start text-left">
                                    <AppLogoIcon className="h-6 w-6 fill-current text-black dark:text-white" />
                                </SheetHeader>
                                <div className="flex h-full flex-1 flex-col space-y-4 p-4">
                                    <div className="flex h-full flex-col justify-between text-sm">
                                        <div className="flex flex-col space-y-4">
                                            {mainNavItems.map((item) => (
                                                <Link
                                                    key={item.title}
                                                    href={item.href}
                                                    className="flex items-center space-x-2 font-medium"
                                                >
                                                    {item.icon && (
                                                        <Icon
                                                            iconNode={item.icon}
                                                            className="h-5 w-5"
                                                        />
                                                    )}
                                                    <span>{item.title}</span>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>

                    <Link
                        href={dashboard()}
                        prefetch
                        className="flex items-center space-x-3"
                    >
                        <img
                            src="/assets/img/unifast.png"
                            alt="UniFAST Logo"
                            className="h-10 w-10"
                        />
                        <div className="flex flex-col">
                            <span className="text-base leading-tight font-semibold text-white">
                                Unified Student Financial Assistance System for
                                Tertiary Education
                                <span className="text-orange-500">
                                    {' '}
                                    (UniFAST)
                                </span>
                            </span>
                        </div>
                    </Link>

                    <div className="ml-auto flex items-center space-x-2">
                        <div className="hidden items-center space-x-2 text-sm text-white/90 md:flex">
                            <span className="font-medium">
                                {auth.user.name}
                            </span>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="size-10 rounded-full p-1 hover:bg-white/10"
                                >
                                    <Avatar className="size-8 overflow-hidden rounded-full">
                                        <AvatarImage
                                            src={auth.user.avatar}
                                            alt={auth.user.name}
                                        />
                                        <AvatarFallback className="rounded-full border border-white/30 bg-white/20 text-white">
                                            {getInitials(auth.user.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end">
                                <UserMenuContent user={auth.user} />
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-white/80 hover:bg-white/10 hover:text-white"
                                >
                                    {appearance === 'light' && (
                                        <Sun className="h-5 w-5" />
                                    )}
                                    {appearance === 'dark' && (
                                        <Moon className="h-5 w-5" />
                                    )}
                                    {appearance === 'system' && (
                                        <Monitor className="h-5 w-5" />
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    onClick={() => updateAppearance('light')}
                                    className="cursor-pointer"
                                >
                                    <Sun className="mr-2 h-4 w-4" />
                                    <span>Light</span>
                                    {appearance === 'light' && (
                                        <Check className="ml-auto h-4 w-4" />
                                    )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => updateAppearance('dark')}
                                    className="cursor-pointer"
                                >
                                    <Moon className="mr-2 h-4 w-4" />
                                    <span>Dark</span>
                                    {appearance === 'dark' && (
                                        <Check className="ml-auto h-4 w-4" />
                                    )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => updateAppearance('system')}
                                    className="cursor-pointer"
                                >
                                    <Monitor className="mr-2 h-4 w-4" />
                                    <span>System</span>
                                    {appearance === 'system' && (
                                        <Check className="ml-auto h-4 w-4" />
                                    )}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            {/* Navigation Bar */}
            <div className="border-b border-sidebar-border/70">
                <div className="px-4 md:px-20">
                    <div className="hidden h-14 items-center lg:flex">
                        <NavigationMenu className="flex h-full items-stretch">
                            <NavigationMenuList className="flex h-full items-stretch space-x-1">
                                {mainNavItems.map((item, index) => (
                                    <NavigationMenuItem
                                        key={index}
                                        className="relative flex h-full items-center"
                                    >
                                        <Link
                                            href={item.href}
                                            className={cn(
                                                'inline-flex h-full cursor-pointer items-center justify-center px-4 text-sm font-medium whitespace-nowrap text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
                                                urlIsActive(item.href) &&
                                                    'text-neutral-900 dark:text-neutral-100',
                                            )}
                                        >
                                            {item.icon && (
                                                <Icon
                                                    iconNode={item.icon}
                                                    className="mr-2 h-4 w-4"
                                                />
                                            )}
                                            {item.title}
                                        </Link>
                                        {urlIsActive(item.href) && (
                                            <div className="absolute bottom-0 left-0 h-0.5 w-full bg-[#2c3e50]"></div>
                                        )}
                                    </NavigationMenuItem>
                                ))}
                            </NavigationMenuList>
                        </NavigationMenu>
                    </div>
                </div>
            </div>

            {breadcrumbs.length > 1 && (
                <div className="flex w-full border-b border-sidebar-border/70">
                    <div className="flex h-12 w-full items-center justify-start px-4 text-neutral-500 md:px-24">
                        <Breadcrumbs breadcrumbs={breadcrumbs} />
                    </div>
                </div>
            )}
        </>
    );
}
