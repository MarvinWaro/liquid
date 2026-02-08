import React, { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { type BreadcrumbItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserModal } from '@/components/users/user-modal';
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
import {
    Plus,
    Pencil,
    User as UserIcon,
    Power,
    PowerOff,
    Search,
    ShieldAlert,
    Lock,
    UserRoundPlus
} from 'lucide-react';

interface Role {
    id: number;
    name: string;
}

interface HEI {
    id: string;
    name: string;
    code?: string | null;
    region_id?: string | null;
    region?: Region | null;
}

interface Region {
    id: string;
    code: string;
    name: string;
}

interface User {
    id: number;
    name: string;
    email: string;
    status: string;
    role: Role;
    role_id: number;
    hei?: HEI | null;
    hei_id?: string | null;
    region?: Region | null;
    region_id?: string | null;
    created_at: string;
}

interface Props {
    auth: {
        user: any;
    };
    users: User[];
    roles: Role[];
    regions: Region[];
    heis: HEI[];
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canChangeStatus: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'User Management', href: route('users.index') },
];

export default function Index({ auth, users, roles, regions, heis, canCreate, canEdit, canDelete, canChangeStatus }: Props) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Format region label for display
    const getRegionLabel = (region?: Region | null) => {
        if (!region) return null;
        return region.name;
    };

    // Filter users based on search
    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.role?.name && user.role.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleDelete = (userId: number) => {
        router.delete(route('users.destroy', userId), {
            preserveScroll: true,
        });
    };

    const handleToggleStatus = (userId: number) => {
        router.patch(route('users.toggle-status', userId), {}, {
            preserveScroll: true,
        });
    };

    const handleCreate = () => {
        setSelectedUser(null);
        setIsModalOpen(true);
    };

    const handleEdit = (user: User) => {
        setSelectedUser(user);
        setIsModalOpen(true);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="User Management" />

            <UserModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                user={selectedUser}
                roles={roles}
                regions={regions}
                heis={heis}
            />

            <div className="py-8 w-full">
                {/* Maximized width container */}
                <div className="w-full max-w-[95%] mx-auto">

                    {/* Header Section */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
                            <p className="text-muted-foreground mt-1">
                                Manage system users, assign roles, and monitor account status.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Search Input */}
                            <div className="relative w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search users..."
                                    className="pl-9 bg-background"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            {canCreate && (
                                <Button onClick={handleCreate} className="bg-primary hover:bg-primary/90 shadow-sm">
                                    <UserRoundPlus className="mr-2 h-4 w-4" />
                                    Add User
                                </Button>
                            )}
                        </div>
                    </div>

                    <Card className="shadow-sm border-border/50">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="pl-6 h-12">User</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Region</TableHead>
                                        <TableHead>Institution</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Joined Date</TableHead>
                                        <TableHead className="text-right pr-6">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                                 <div className="flex flex-col items-center gap-2">
                                                    <UserIcon className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>No users found matching your search.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredUsers.map((user) => (
                                            <TableRow key={user.id} className="hover:bg-muted/50 transition-colors">
                                                <TableCell className="pl-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {/* Avatar Logic: ShieldAlert for Super Admin */}
                                                        <div className={`h-9 w-9 rounded-full flex items-center justify-center font-semibold ${
                                                            user.role?.name === 'Super Admin'
                                                                ? 'bg-amber-100 text-amber-700'
                                                                : 'bg-primary/10 text-primary'
                                                        }`}>
                                                            {user.role?.name === 'Super Admin' ? (
                                                                <ShieldAlert className="h-4 w-4" />
                                                            ) : (
                                                                user.name.charAt(0).toUpperCase()
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-sm flex items-center gap-2">
                                                                {user.name}
                                                                {user.id === auth.user.id && (
                                                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">You</Badge>
                                                                )}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">{user.email}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="border-border bg-background">
                                                        {user.role?.name || 'No Role'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {(() => {
                                                        // Get region from user directly or from their HEI
                                                        const region = user.region || user.hei?.region;
                                                        if (region) {
                                                            return (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="border-blue-200 bg-blue-50 text-blue-900 font-medium"
                                                                >
                                                                    {getRegionLabel(region)}
                                                                </Badge>
                                                            );
                                                        }
                                                        return <span className="text-sm text-muted-foreground">-</span>;
                                                    })()}
                                                </TableCell>
                                                <TableCell>
                                                    {user.hei ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium">{user.hei.name}</span>
                                                            <span className="text-xs text-muted-foreground">{user.hei.code}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        className={`${
                                                            user.status === 'active'
                                                                ? 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200'
                                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200'
                                                        } shadow-none`}
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full mr-2 ${
                                                            user.status === 'active' ? 'bg-green-600' : 'bg-gray-500'
                                                        }`}></span>
                                                        {user.status === 'active' ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {new Date(user.created_at).toLocaleDateString(undefined, {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })}
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {/* Protection Logic: If user is Super Admin AND NOT current user -> Lock it */}
                                                        {user.role?.name === 'Super Admin' && auth.user.id !== user.id ? (
                                                            <span className="text-xs text-muted-foreground italic flex items-center">
                                                                <Lock className="h-3 w-3 mr-1" /> Protected
                                                            </span>
                                                        ) : (
                                                            <>
                                                                {/* Normal Actions */}
                                                                {canChangeStatus && user.id !== auth.user.id && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8"
                                                                        onClick={() => handleToggleStatus(user.id)}
                                                                        title={user.status === 'active' ? 'Deactivate User' : 'Activate User'}
                                                                    >
                                                                        {user.status === 'active' ? (
                                                                            <PowerOff className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                                                        ) : (
                                                                            <Power className="h-4 w-4 text-green-600" />
                                                                        )}
                                                                    </Button>
                                                                )}

                                                                {canEdit && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                                        onClick={() => handleEdit(user)}
                                                                    >
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                )}

                                                                {canDelete && user.id !== auth.user.id && (
                                                                    <DeletePopover
                                                                        itemName={user.name}
                                                                        onConfirm={() => handleDelete(user.id)}
                                                                    />
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
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
