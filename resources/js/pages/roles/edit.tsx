import React from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { ArrowLeft, Save } from 'lucide-react';

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
}

interface Props {
    auth: {
        user: any;
    };
    role: Role;
    permissions: Record<string, Permission[]>;
    rolePermissions: number[];
}

interface FormData {
    name: string;
    description: string;
    permissions: number[];
}

export default function Edit({ auth, role, permissions, rolePermissions }: Props) {
    const { data, setData, put, processing, errors } = useForm<FormData>({
        name: role.name,
        description: role.description || '',
        permissions: rolePermissions,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(route('roles.update', role.id));
    };

    const handlePermissionToggle = (permissionId: number) => {
        setData('permissions',
            data.permissions.includes(permissionId)
                ? data.permissions.filter(id => id !== permissionId)
                : [...data.permissions, permissionId]
        );
    };

    const handleSelectAllModule = (modulePermissions: Permission[]) => {
        const moduleIds = modulePermissions.map(p => p.id);
        const allSelected = moduleIds.every(id => data.permissions.includes(id));

        if (allSelected) {
            setData('permissions', data.permissions.filter(id => !moduleIds.includes(id)));
        } else {
            setData('permissions', [...new Set([...data.permissions, ...moduleIds])]);
        }
    };

    const isModuleSelected = (modulePermissions: Permission[]) => {
        const moduleIds = modulePermissions.map(p => p.id);
        return moduleIds.every(id => data.permissions.includes(id));
    };

    return (
        <AppLayout>
            <Head title="Edit Role" />

            <div className="py-12">
                <div className="max-w-4xl mx-auto sm:px-6 lg:px-8">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <Link href={route('roles.index')}>
                                    <Button variant="outline" size="icon">
                                        <ArrowLeft className="h-4 w-4" />
                                    </Button>
                                </Link>
                                <div>
                                    <CardTitle className="text-2xl font-bold">
                                        Edit Role
                                    </CardTitle>
                                    <CardDescription>
                                        Update role information and permissions
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Role Name *</Label>
                                        <Input
                                            id="name"
                                            type="text"
                                            value={data.name}
                                            onChange={(e) => setData('name', e.target.value)}
                                            placeholder="e.g., Regional Coordinator"
                                            className={errors.name ? 'border-destructive' : ''}
                                        />
                                        {errors.name && (
                                            <p className="text-sm text-destructive">{errors.name}</p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="description">Description</Label>
                                        <Textarea
                                            id="description"
                                            value={data.description}
                                            onChange={(e) => setData('description', e.target.value)}
                                            placeholder="Brief description of this role..."
                                            rows={3}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="border-t pt-4">
                                        <h3 className="text-lg font-semibold mb-2">Permissions</h3>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            Select permissions for this role. Permissions are grouped by module.
                                        </p>
                                    </div>

                                    <Accordion type="multiple" className="w-full">
                                        {Object.entries(permissions).map(([module, modulePermissions]) => (
                                            <AccordionItem key={module} value={module}>
                                                <AccordionTrigger className="hover:no-underline">
                                                    <div className="flex items-center gap-3">
                                                        <Checkbox
                                                            checked={isModuleSelected(modulePermissions)}
                                                            onCheckedChange={() => handleSelectAllModule(modulePermissions)}
                                                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                                        />
                                                        <span className="font-medium">{module}</span>
                                                        <span className="text-sm text-muted-foreground">
                                                            ({modulePermissions.filter(p => data.permissions.includes(p.id)).length}/{modulePermissions.length})
                                                        </span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="pl-9 space-y-3 py-2">
                                                        {modulePermissions.map((permission) => (
                                                            <div key={permission.id} className="flex items-start gap-3">
                                                                <Checkbox
                                                                    id={`permission-${permission.id}`}
                                                                    checked={data.permissions.includes(permission.id)}
                                                                    onCheckedChange={() => handlePermissionToggle(permission.id)}
                                                                />
                                                                <div className="grid gap-1">
                                                                    <Label
                                                                        htmlFor={`permission-${permission.id}`}
                                                                        className="font-normal cursor-pointer"
                                                                    >
                                                                        {permission.name.split('_').map(word =>
                                                                            word.charAt(0).toUpperCase() + word.slice(1)
                                                                        ).join(' ')}
                                                                    </Label>
                                                                    {permission.description && (
                                                                        <p className="text-sm text-muted-foreground">
                                                                            {permission.description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </div>

                                <div className="flex items-center gap-3 pt-4 border-t">
                                    <Button type="submit" disabled={processing}>
                                        <Save className="mr-2 h-4 w-4" />
                                        Update Role
                                    </Button>
                                    <Link href={route('roles.index')}>
                                        <Button type="button" variant="outline">
                                            Cancel
                                        </Button>
                                    </Link>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
