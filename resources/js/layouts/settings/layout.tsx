import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn, toUrl } from '@/lib/utils';
import { useActiveUrl } from '@/hooks/use-active-url';
import { edit as editAppearance } from '@/routes/appearance';
import { edit } from '@/routes/profile';
import { show } from '@/routes/two-factor';
import { edit as editPassword } from '@/routes/user-password';
import { type NavItem, type NavigationAbilities, type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { Building2, FileText, FolderOpen, MapPin, Shield, Users } from 'lucide-react';
import { type PropsWithChildren, useMemo } from 'react';

const sidebarNavItems: NavItem[] = [
    {
        title: 'Profile',
        href: edit(),
        icon: null,
    },
    {
        title: 'Password',
        href: editPassword(),
        icon: null,
    },
    {
        title: 'Two-Factor Auth',
        href: show(),
        icon: null,
    },
    {
        title: 'Appearance',
        href: editAppearance(),
        icon: null,
    },
];

// Admin settings items with ability checks
const adminNavItems: (NavItem & { ability?: keyof NavigationAbilities })[] = [
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
    {
        title: 'HEI',
        href: '/hei',
        icon: Building2,
        ability: 'canViewHEI',
    },
    {
        title: 'Regions',
        href: '/regions',
        icon: MapPin,
        ability: 'canViewRegions',
    },
    {
        title: 'Programs',
        href: '/programs',
        icon: FolderOpen,
        ability: 'canViewPrograms',
    },
    {
        title: 'Document Requirements',
        href: '/document-requirements',
        icon: FileText,
        ability: 'canViewDocumentRequirements',
    },
];

interface SettingsLayoutProps extends PropsWithChildren {
    wide?: boolean;
}

export default function SettingsLayout({ children, wide = false }: SettingsLayoutProps) {
    const { urlIsActive } = useActiveUrl();
    const page = usePage<SharedData>();

    const can = page.props.can || {
        canViewDashboard: false,
        canViewLiquidation: false,
        canViewRoles: false,
        canViewUsers: false,
        canViewHEI: false,
        canViewRegions: false,
        canViewPrograms: false,
        canViewDocumentRequirements: false,
    };

    // Filter admin nav items based on user abilities
    const filteredAdminNavItems = useMemo(() => {
        return adminNavItems.filter((item) => {
            if (!item.ability) return true;
            return can[item.ability] === true;
        });
    }, [can]);

    const hasAdminAccess = filteredAdminNavItems.length > 0;

    // When server-side rendering, we only render the layout on the client...
    if (typeof window === 'undefined') {
        return null;
    }

    return (
        <div className="px-4 py-6">
            <Heading
                title="Settings"
                description="Manage your profile and account settings"
            />

            <div className="flex flex-col lg:flex-row lg:space-x-12 lg:items-start">
                <aside className="w-full max-w-xl lg:w-48 shrink-0 lg:sticky lg:top-6 lg:self-start">
                    <nav className="flex flex-col space-y-1 space-x-0" aria-label="Settings">
                        {/* Account Settings */}
                        <span className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">
                            Account
                        </span>
                        {sidebarNavItems.map((item, index) => (
                            <Button
                                key={`${toUrl(item.href)}-${index}`}
                                size="sm"
                                variant="ghost"
                                asChild
                                className={cn('w-full justify-start', {
                                    'bg-muted': urlIsActive(item.href),
                                })}
                            >
                                <Link href={item.href}>
                                    {item.icon && (
                                        <item.icon className="h-4 w-4" />
                                    )}
                                    {item.title}
                                </Link>
                            </Button>
                        ))}

                        {/* Admin Settings - Only show if user has access to any admin item */}
                        {hasAdminAccess && (
                            <>
                                <Separator className="my-4" />
                                <span className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">
                                    Administration
                                </span>
                                {filteredAdminNavItems.map((item, index) => (
                                    <Button
                                        key={`admin-${toUrl(item.href)}-${index}`}
                                        size="sm"
                                        variant="ghost"
                                        asChild
                                        className={cn('w-full justify-start', {
                                            'bg-muted': urlIsActive(item.href),
                                        })}
                                    >
                                        <Link href={item.href}>
                                            {item.icon && (
                                                <item.icon className="mr-2 h-4 w-4" />
                                            )}
                                            {item.title}
                                        </Link>
                                    </Button>
                                ))}
                            </>
                        )}
                    </nav>
                </aside>

                <Separator className="my-6 lg:hidden" />

                <div className={cn('flex-1', wide ? 'max-w-full' : 'md:max-w-2xl')}>
                    <section className={cn(wide ? 'w-full' : 'max-w-xl', 'space-y-12')}>
                        {children}
                    </section>
                </div>
            </div>
        </div>
    );
}
