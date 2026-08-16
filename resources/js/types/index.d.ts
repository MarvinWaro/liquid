import { InertiaLinkProps } from '@inertiajs/react';
import { LucideIcon } from 'lucide-react';

export interface Auth {
    user: User;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
    icon?: LucideIcon | null;
    /**
     * Path to an image to use instead of `icon`, for entries with their own
     * artwork rather than a Lucide glyph (Liqui). Takes precedence when set.
     */
    iconImage?: string;
    isActive?: boolean;
    children?: NavItem[];
}

/**
 * A nav entry that is shown or hidden by a permission.
 *
 * `Omit` matters: NavItem already declares `children?: NavItem[]`, and
 * intersecting that with a narrower children type leaves TypeScript resolving
 * `.filter()` callbacks to the plain NavItem, which then has no `ability`.
 * Dropping the property before redefining it avoids that collision.
 */
export type NavItemWithAbility = Omit<NavItem, 'children'> & {
    ability?: keyof NavigationAbilities;
    children?: NavItemWithAbility[];
};

export interface NavigationAbilities {
    canViewDashboard: boolean;
    canViewLiquidation: boolean;
    canViewReports: boolean;
    canUseReportAssistant: boolean;
    canViewRoles: boolean;
    canViewUsers: boolean;
    canViewHEI: boolean;
    canViewRegions: boolean;
    canViewPrograms: boolean;
    canViewSemesters: boolean;
    canViewAcademicYears: boolean;
    canViewDocumentRequirements: boolean;
    canViewTemplates: boolean;
    canViewActivityLogs: boolean;
    canAccessActivityLogs: boolean;
    canViewQueueHealth: boolean;
    canViewServerLogs: boolean;
    canViewServerMonitoring: boolean;
    canViewSummaryAY: boolean;
    canViewSummaryHEI: boolean;
    canCreateAnnouncements: boolean;
    canEditAnnouncements: boolean;
    canDeleteAnnouncements: boolean;
    canCreateTicket: boolean;
}

export interface AppNotification {
    id: string;
    actor_name: string;
    actor_avatar_url: string | null;
    action: string;
    description: string;
    subject_type: string | null;
    subject_id: string | null;
    subject_label: string | null;
    module: string | null;
    metadata: Record<string, string> | null;
    read_at: string | null;
    created_at: string;
    time_ago: string;
}

export interface SharedData {
    name: string;
    quote: { message: string; author: string };
    auth: Auth;
    can: NavigationAbilities;
    sidebarOpen: boolean;
    notifications_unread_count: number;
    /**
     * Largest single file this server accepts, in bytes — read from PHP's own
     * limits rather than assumed. Use `resolveMaxUpload` in lib/upload.ts to
     * combine it with a feature's own cap.
     */
    maxUploadBytes: number;
    [key: string]: unknown;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    avatar_url?: string;
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    created_at: string;
    updated_at: string;
    [key: string]: unknown; // This allows for additional properties...
}
