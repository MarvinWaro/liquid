import React, { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RoleModal } from '@/components/roles/role-modal';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Card,
    CardContent,
} from '@/components/ui/card';
import { DeletePopover } from '@/components/ui/delete-popover';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Shield, Search, Lock } from 'lucide-react';

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

export default function Index({ auth, roles, permissions, canCreate, canEdit, canDelete }: Props) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter roles based on search
    const filteredRoles = roles.filter(role =>
        role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (role.description && role.description.toLowerCase().includes(searchQuery.toLowerCase()))
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
        <AppLayout>
            <Head title="Roles & Permissions" />

            <RoleModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                role={selectedRole}
                permissions={permissions}
            />

            <div className="py-8 w-full">
                {/* Maximized width */}
                <div className="w-full max-w-[95%] mx-auto">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight">Roles & Permissions</h2>
                            <p className="text-muted-foreground mt-1">
                                Manage access control levels and assign permissions to specific roles.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                             {/* Search Bar */}
                             <div className="relative w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search roles..."
                                    className="pl-9 bg-background"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            {canCreate && (
                                <Button onClick={handleCreate} className="bg-primary hover:bg-primary/90 shadow-sm">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Role
                                </Button>
                            )}
                        </div>
                    </div>

                    <Card className="shadow-sm border-border/50">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="pl-6 h-12">Role Name</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Users</TableHead>
                                        <TableHead>Permissions</TableHead>
                                        <TableHead className="text-right pr-6">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRoles.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Shield className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>No roles found matching your search.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredRoles.map((role) => (
                                            <TableRow key={role.id} className="hover:bg-muted/50 transition-colors">
                                                <TableCell className="pl-6 py-4 font-medium">
                                                    <div className="flex items-center gap-3">
                                                        {/* Icon Logic: Lock for Super Admin, Shield for others */}
                                                        <div className={`p-2 rounded-lg ${
                                                            role.name === 'Super Admin'
                                                                ? 'bg-amber-100 text-amber-700'
                                                                : 'bg-primary/10 text-primary'
                                                        }`}>
                                                            {role.name === 'Super Admin' ? (
                                                                <Lock className="h-4 w-4" />
                                                            ) : (
                                                                <Shield className="h-4 w-4" />
                                                            )}
                                                        </div>
                                                        <span className="text-base">{role.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground max-w-md truncate">
                                                    {role.description || 'No description provided'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="font-normal">
                                                        {role.users_count} {role.users_count === 1 ? 'user' : 'users'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {/* Permission Logic: Show "All" for Super Admin */}
                                                    <Badge variant="outline" className="font-normal border-primary/20 text-primary bg-primary/5">
                                                        {role.name === 'Super Admin' ? 'All Permissions' : `${role.permissions.length} permissions`}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    {/* Action Logic: Hide buttons if Super Admin */}
                                                    {role.name === 'Super Admin' ? (
                                                        <div className="flex items-center justify-end gap-2 text-muted-foreground text-xs italic">
                                                            <Lock className="h-3 w-3 mr-1" /> System Locked
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-end gap-2">
                                                            {canEdit && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                                    onClick={() => handleEdit(role)}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                            {canDelete && role.name !== 'Admin' && (
                                                                <DeletePopover
                                                                    itemName={role.name}
                                                                    onConfirm={() => handleDelete(role.id)}
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
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
