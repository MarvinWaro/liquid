import React from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
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
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Shield } from 'lucide-react';

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
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
}

export default function Index({ auth, roles, canCreate, canEdit, canDelete }: Props) {
    const handleDelete = (roleId: number) => {
        router.delete(route('roles.destroy', roleId), {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout>
            <Head title="Roles & Permissions" />

            <div className="py-12">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-2xl font-bold">
                                        Roles & Permissions
                                    </CardTitle>
                                    <CardDescription>
                                        Manage system roles and their permissions
                                    </CardDescription>
                                </div>
                                {canCreate && (
                                    <Link href={route('roles.create')}>
                                        <Button>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add Role
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Role Name</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Users</TableHead>
                                        <TableHead>Permissions</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {roles.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                No roles found. Create your first role to get started.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        roles.map((role) => (
                                            <TableRow key={role.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Shield className="h-4 w-4 text-muted-foreground" />
                                                        {role.name}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {role.description || 'No description'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">
                                                        {role.users_count} {role.users_count === 1 ? 'user' : 'users'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">
                                                        {role.permissions.length} {role.permissions.length === 1 ? 'permission' : 'permissions'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {canEdit && (
                                                            <Link href={route('roles.edit', role.id)}>
                                                                <Button variant="outline" size="sm">
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                            </Link>
                                                        )}
                                                        {canDelete && role.name !== 'Admin' && (
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="outline" size="sm">
                                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            This will permanently delete the role "{role.name}".
                                                                            This action cannot be undone.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            onClick={() => handleDelete(role.id)}
                                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                        >
                                                                            Delete
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
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
