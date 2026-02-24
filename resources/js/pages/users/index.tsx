import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeletePopover } from '@/components/ui/delete-popover';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { UserModal } from '@/components/users/user-modal';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    Lock,
    Pencil,
    Power,
    PowerOff,
    Search,
    ShieldAlert,
    User as UserIcon,
    UserRoundPlus,
} from 'lucide-react';
import { useState } from 'react';

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
    { title: 'Settings', href: '/settings/profile' },
    { title: 'Users', href: '/users' },
];

export default function Index({
    auth,
    users,
    roles,
    regions,
    heis,
    canCreate,
    canEdit,
    canDelete,
    canChangeStatus,
}: Props) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [regionFilter, setRegionFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Format region label for display
    const getRegionLabel = (region?: Region | null) => {
        if (!region) return null;
        return region.name;
    };

    // Get user's effective region (direct or via HEI)
    const getUserRegionId = (user: User): string | null => {
        return user.region_id || user.hei?.region_id || null;
    };

    // Filter users based on search and filters
    const filteredUsers = users.filter((user) => {
        // Search filter
        const matchesSearch =
            searchQuery === '' ||
            user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (user.role?.name &&
                user.role.name
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase()));

        // Role filter
        const matchesRole =
            roleFilter === 'all' || user.role_id.toString() === roleFilter;

        // Region filter (check both direct region and HEI's region)
        const userRegionId = getUserRegionId(user);
        const matchesRegion =
            regionFilter === 'all' || userRegionId === regionFilter;

        // Status filter
        const matchesStatus =
            statusFilter === 'all' || user.status === statusFilter;

        return matchesSearch && matchesRole && matchesRegion && matchesStatus;
    });

    const handleDelete = (userId: number) => {
        router.delete(route('users.destroy', userId), {
            preserveScroll: true,
        });
    };

    const handleToggleStatus = (userId: number) => {
        router.patch(
            route('users.toggle-status', userId),
            {},
            {
                preserveScroll: true,
            },
        );
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

            <SettingsLayout wide>
                <UserModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                user={selectedUser}
                roles={roles}
                regions={regions}
                heis={heis}
            />

            <div className="w-full py-8">
                {/* Maximized width container */}
                <div className="mx-auto w-full max-w-[95%]">
                    {/* Header Section */}
                    <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                        <div>
                            <h2 className="text-xl font-semibold tracking-tight">
                                User Management
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Manage system users, assign roles, and monitor
                                account status.
                            </p>
                        </div>
                        {canCreate && (
                            <Button
                                onClick={handleCreate}
                                className="bg-primary shadow-sm hover:bg-primary/90"
                            >
                                <UserRoundPlus className="mr-2 h-4 w-4" />
                                Add User
                            </Button>
                        )}
                    </div>

                    <div className="mb-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative min-w-[200px] flex-1">
                                <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search by name, email, or role..."
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
                                    className="pl-8"
                                />
                            </div>
                            <Select
                                value={roleFilter}
                                onValueChange={setRoleFilter}
                            >
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="All Roles" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        All Roles
                                    </SelectItem>
                                    {roles.map((role) => (
                                        <SelectItem
                                            key={role.id}
                                            value={role.id.toString()}
                                        >
                                            {role.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={regionFilter}
                                onValueChange={setRegionFilter}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="All Regions" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        All Regions
                                    </SelectItem>
                                    {regions.map((region) => (
                                        <SelectItem
                                            key={region.id}
                                            value={region.id}
                                        >
                                            {region.name} ({region.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={statusFilter}
                                onValueChange={setStatusFilter}
                            >
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="All Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        All Status
                                    </SelectItem>
                                    <SelectItem value="active">
                                        <span className="flex items-center gap-2">
                                            <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                            Active
                                        </span>
                                    </SelectItem>
                                    <SelectItem value="inactive">
                                        <span className="flex items-center gap-2">
                                            <span className="h-2 w-2 rounded-full bg-gray-500"></span>
                                            Inactive
                                        </span>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="overflow-hidden rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-b">
                                <TableHead className="h-9 pl-6 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    User
                                </TableHead>
                                <TableHead className="h-9 text-xs font-medium uppercase tracking-wider text-muted-foreground">Role</TableHead>
                                <TableHead className="h-9 text-xs font-medium uppercase tracking-wider text-muted-foreground">Region</TableHead>
                                <TableHead className="h-9 text-xs font-medium uppercase tracking-wider text-muted-foreground">Institution</TableHead>
                                <TableHead className="h-9 text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</TableHead>
                                <TableHead className="h-9 text-xs font-medium uppercase tracking-wider text-muted-foreground">Joined Date</TableHead>
                                <TableHead className="pr-6 text-right h-9 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={7}
                                        className="py-12 text-center text-muted-foreground"
                                    >
                                        <div className="flex flex-col items-center gap-2">
                                            <UserIcon className="h-8 w-8 text-muted-foreground/50" />
                                            <p>
                                                No users found matching your
                                                criteria.
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredUsers.map((user) => (
                                    <TableRow
                                        key={user.id}
                                        className="transition-colors hover:bg-muted/50"
                                    >
                                        <TableCell className="py-2 pl-6">
                                            <div className="flex flex-col">
                                                <span className="flex items-center gap-2 text-sm font-medium">
                                                    {user.role?.name === 'Super Admin' && (
                                                        <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                                                    )}
                                                    {user.name}
                                                    {user.id ===
                                                        auth.user.id && (
                                                        <Badge
                                                            variant="secondary"
                                                            className="h-5 px-1.5 text-[10px]"
                                                        >
                                                            You
                                                        </Badge>
                                                    )}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {user.email}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-2">
                                            <Badge
                                                variant="outline"
                                                className="border-border bg-background"
                                            >
                                                {user.role?.name || 'No Role'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-2">
                                            {(() => {
                                                // Get region from user directly or from their HEI
                                                const region =
                                                    user.region ||
                                                    user.hei?.region;
                                                if (region) {
                                                    return (
                                                        <Badge
                                                            variant="outline"
                                                            className="border-blue-200 bg-blue-50 font-medium text-blue-900"
                                                        >
                                                            {getRegionLabel(
                                                                region,
                                                            )}
                                                        </Badge>
                                                    );
                                                }
                                                return (
                                                    <span className="text-sm text-muted-foreground">
                                                        -
                                                    </span>
                                                );
                                            })()}
                                        </TableCell>
                                        <TableCell className="py-2">
                                            {user.hei ? (
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">
                                                        {user.hei.name}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {user.hei.code}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">
                                                    -
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="py-2">
                                            <Badge
                                                className={`${
                                                    user.status === 'active'
                                                        ? 'border-green-200 bg-green-100 text-green-700 hover:bg-green-200'
                                                        : 'border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                } shadow-none`}
                                            >
                                                <span
                                                    className={`mr-2 h-1.5 w-1.5 rounded-full ${
                                                        user.status === 'active'
                                                            ? 'bg-green-600'
                                                            : 'bg-gray-500'
                                                    }`}
                                                ></span>
                                                {user.status === 'active'
                                                    ? 'Active'
                                                    : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-2 text-sm text-muted-foreground">
                                            {new Date(
                                                user.created_at,
                                            ).toLocaleDateString(undefined, {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </TableCell>
                                        <TableCell className="pr-6 py-2 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {/* Protection Logic: If user is Super Admin AND NOT current user -> Lock it */}
                                                {user.role?.name ===
                                                    'Super Admin' &&
                                                auth.user.id !== user.id ? (
                                                    <span className="flex items-center text-xs text-muted-foreground italic">
                                                        <Lock className="mr-1 h-3 w-3" />{' '}
                                                        Protected
                                                    </span>
                                                ) : (
                                                    <>
                                                        {/* Normal Actions */}
                                                        {canChangeStatus &&
                                                            user.id !==
                                                                auth.user
                                                                    .id && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8"
                                                                    onClick={() =>
                                                                        handleToggleStatus(
                                                                            user.id,
                                                                        )
                                                                    }
                                                                    title={
                                                                        user.status ===
                                                                        'active'
                                                                            ? 'Deactivate User'
                                                                            : 'Activate User'
                                                                    }
                                                                >
                                                                    {user.status ===
                                                                    'active' ? (
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
                                                                onClick={() =>
                                                                    handleEdit(
                                                                        user,
                                                                    )
                                                                }
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        )}

                                                        {canDelete &&
                                                            user.id !==
                                                                auth.user
                                                                    .id && (
                                                                <DeletePopover
                                                                    itemName={
                                                                        user.name
                                                                    }
                                                                    onConfirm={() =>
                                                                        handleDelete(
                                                                            user.id,
                                                                        )
                                                                    }
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
                    </div>
                </div>
            </div>
            </SettingsLayout>
        </AppLayout>
    );
}
