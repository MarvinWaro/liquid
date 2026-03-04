import Heading from '@/components/heading';
import { Separator } from '@/components/ui/separator';
import { cn, toUrl } from '@/lib/utils';
import { useActiveUrl } from '@/hooks/use-active-url';
import { edit as editAppearance } from '@/routes/appearance';
import { edit } from '@/routes/profile';
import { show } from '@/routes/two-factor';
import { edit as editPassword } from '@/routes/user-password';
import { type NavItem, type NavigationAbilities, type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { Building2, Calendar, FileText, FolderOpen, GraduationCap, History, KeyRound, MapPin, Palette, Shield, ShieldCheck, User, Users } from 'lucide-react';
import { type PropsWithChildren, useMemo } from 'react';

const sidebarNavItems: NavItem[] = [
    {
        title: 'Profile',
        href: edit(),
        icon: User,
    },
    {
        title: 'Password',
        href: editPassword(),
        icon: KeyRound,
    },
    {
        title: 'Two-Factor Auth',
        href: show(),
        icon: ShieldCheck,
    },
    {
        title: 'Appearance',
        href: editAppearance(),
        icon: Palette,
    },
];

type AdminNavItem = NavItem & { ability?: keyof NavigationAbilities };

// User Management
const userManagementNavItems: AdminNavItem[] = [
    {
        title: 'Users',
        href: '/users',
        icon: Users,
        ability: 'canViewUsers',
    },
    {
        title: 'Roles & Permissions',
        href: '/roles',
        icon: Shield,
        ability: 'canViewRoles',
    },
];

// System Configuration
const systemConfigNavItems: AdminNavItem[] = [
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
        title: 'Semesters',
        href: '/semesters',
        icon: Calendar,
        ability: 'canViewSemesters',
    },
    {
        title: 'Academic Years',
        href: '/academic-years',
        icon: GraduationCap,
        ability: 'canViewAcademicYears',
    },
    {
        title: 'Document Requirements',
        href: '/document-requirements',
        icon: FileText,
        ability: 'canViewDocumentRequirements',
    },
    {
        title: 'Activity Logs',
        href: '/activity-logs',
        icon: History,
        ability: 'canViewActivityLogs',
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
        canViewSemesters: false,
        canViewAcademicYears: false,
        canViewDocumentRequirements: false,
        canViewActivityLogs: false,
    };

    const filterByAbility = (items: AdminNavItem[]) =>
        items.filter((item) => !item.ability || can[item.ability] === true);

    const filteredUserManagement = useMemo(() => filterByAbility(userManagementNavItems), [can]);
    const filteredSystemConfig = useMemo(() => filterByAbility(systemConfigNavItems), [can]);

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

            <div className="flex flex-col lg:flex-row lg:gap-x-8 lg:items-start">
                <aside className="w-full max-w-xl lg:w-52 shrink-0 lg:sticky lg:top-6 lg:self-start">
                    <nav className="flex flex-col" aria-label="Settings">
                        {/* Account Settings */}
                        <span className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Account
                        </span>
                        {sidebarNavItems.map((item, index) => (
                            <Link
                                key={`${toUrl(item.href)}-${index}`}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                                    urlIsActive(item.href)
                                        ? 'bg-muted font-medium text-foreground'
                                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                )}
                            >
                                {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
                                {item.title}
                            </Link>
                        ))}

                        {/* User Management */}
                        {filteredUserManagement.length > 0 && (
                            <>
                                <span className="mb-1 mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    User Management
                                </span>
                                {filteredUserManagement.map((item, index) => (
                                    <Link
                                        key={`um-${toUrl(item.href)}-${index}`}
                                        href={item.href}
                                        className={cn(
                                            'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                                            urlIsActive(item.href)
                                                ? 'bg-muted font-medium text-foreground'
                                                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                        )}
                                    >
                                        {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
                                        {item.title}
                                    </Link>
                                ))}
                            </>
                        )}

                        {/* System Configuration */}
                        {filteredSystemConfig.length > 0 && (
                            <>
                                <span className="mb-1 mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    System Configuration
                                </span>
                                {filteredSystemConfig.map((item, index) => (
                                    <Link
                                        key={`sc-${toUrl(item.href)}-${index}`}
                                        href={item.href}
                                        className={cn(
                                            'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                                            urlIsActive(item.href)
                                                ? 'bg-muted font-medium text-foreground'
                                                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                        )}
                                    >
                                        {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
                                        {item.title}
                                    </Link>
                                ))}
                            </>
                        )}
                    </nav>
                </aside>

                <Separator className="my-6 lg:hidden" />

                <div className="flex-1 min-w-0">
                    <section className={cn('space-y-12', !wide && 'max-w-xl')}>
                        {children}
                    </section>
                </div>
            </div>
        </div>
    );
}
