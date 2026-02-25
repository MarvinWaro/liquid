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
    isActive?: boolean;
}

export interface NavigationAbilities {
    canViewDashboard: boolean;
    canViewLiquidation: boolean;
    canViewRoles: boolean;
    canViewUsers: boolean;
    canViewHEI: boolean;
    canViewRegions: boolean;
    canViewPrograms: boolean;
    canViewSemesters: boolean;
    canViewAcademicYears: boolean;
    canViewDocumentRequirements: boolean;
    canViewActivityLogs: boolean;
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
