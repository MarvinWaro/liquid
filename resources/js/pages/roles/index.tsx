import { RoleModal } from '@/components/roles/role-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeletePopover } from '@/components/ui/delete-popover';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Lock, Pencil, Plus, Search, Shield } from 'lucide-react';
import { useState } from 'react';

interface Permission {
    id: number;
    name: string;
    module: string;
    description: string;
}

interface Role {
    id: number;
    name: string;
    description: string | null;
    users_count: number;
    permissions: Permission[];
}

interface Props {
    auth: {
        user: any;
    };
    roles: Role[];
    permissions: Record<string, Permission[]>;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Settings', href: '/settings/profile' },
    { title: 'Roles & Permissions', href: '/roles' },
];

export default function Index({
    auth,
    roles,
    permissions,
    canCreate,
    canEdit,
    canDelete,
}: Props) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter roles based on search
    const filteredRoles = roles.filter(
        (role) =>
            role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (role.description &&
                role.description
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase())),
    );

    const handleDelete = (roleId: number) => {
        router.delete(route('roles.destroy', roleId), {
            preserveScroll: true,
        });
    };

    const handleCreate = () => {
        setSelectedRole(null);
        setIsModalOpen(true);
    };

    const handleEdit = (role: Role) => {
        setSelectedRole(role);
        setIsModalOpen(true);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Roles & Permissions" />

            <SettingsLayout wide>
                <RoleModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                role={selectedRole}
                permissions={permissions}
            />

            <div className="w-full py-8">
                {/* Maximized width */}
                <div className="mx-auto w-full max-w-[95%]">
                    <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                        <div>
                            <h2 className="text-xl font-semibold tracking-tight">
                                Roles & Permissions
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Manage access control levels and assign
                                permissions to specific roles.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Search Bar */}
                            <div className="relative w-64">
                                <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search roles..."
                                    className="bg-background pl-9"
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
                                />
                            </div>
                            {canCreate && (
                                <Button
                                    onClick={handleCreate}
                                    className="bg-primary shadow-sm hover:bg-primary/90"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Role
                                </Button>
                            )}
                        </div>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-b">
                                <TableHead className="h-9 pl-6 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Role Name
                                </TableHead>
                                <TableHead className="h-9 text-xs font-medium uppercase tracking-wider text-muted-foreground">Description</TableHead>
                                <TableHead className="h-9 text-xs font-medium uppercase tracking-wider text-muted-foreground">Users</TableHead>
                                <TableHead className="h-9 text-xs font-medium uppercase tracking-wider text-muted-foreground">Permissions</TableHead>
                                <TableHead className="pr-6 text-right h-9 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRoles.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={5}
                                        className="py-12 text-center text-muted-foreground"
                                    >
                                        <div className="flex flex-col items-center gap-2">
                                            <Shield className="h-8 w-8 text-muted-foreground/50" />
                                            <p>
                                                No roles found matching your
                                                search.
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredRoles.map((role) => (
                                    <TableRow
                                        key={role.id}
                                        className="transition-colors hover:bg-muted/50"
                                    >
                                        <TableCell className="py-2 pl-6 font-medium">
                                            <div className="flex items-center gap-2">
                                                {role.name === 'Super Admin' ? (
                                                    <Lock className="h-3.5 w-3.5 text-amber-500" />
                                                ) : (
                                                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                                                )}
                                                <span className="text-sm">
                                                    {role.name}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-2 max-w-md truncate text-sm text-muted-foreground">
                                            {role.description ||
                                                'No description provided'}
                                        </TableCell>
                                        <TableCell className="py-2">
                                            <Badge
                                                variant="secondary"
                                                className="font-normal"
                                            >
                                                {role.users_count}{' '}
                                                {role.users_count === 1
                                                    ? 'user'
                                                    : 'users'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-2">
                                            {/* Permission Logic: Show "All" for Super Admin */}
                                            <Badge
                                                variant="outline"
                                                className="border-primary/20 bg-primary/5 font-normal text-primary"
                                            >
                                                {role.name === 'Super Admin'
                                                    ? 'All Permissions'
                                                    : `${role.permissions.length} permissions`}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="pr-6 py-2 text-right">
                                            {/* Action Logic: Hide buttons if Super Admin */}
                                            {role.name === 'Super Admin' ? (
                                                <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground italic">
                                                    <Lock className="mr-1 h-3 w-3" />{' '}
                                                    System Locked
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-2">
                                                    {canEdit && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                            onClick={() =>
                                                                handleEdit(role)
                                                            }
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {canDelete &&
                                                        role.name !==
                                                            'Admin' && (
                                                            <DeletePopover
                                                                itemName={
                                                                    role.name
                                                                }
                                                                onConfirm={() =>
                                                                    handleDelete(
                                                                        role.id,
                                                                    )
                                                                }
                                                            />
                                                        )}
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
            </SettingsLayout>
        </AppLayout>
    );
}
