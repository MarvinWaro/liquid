import React, { useEffect } from 'react';
import { useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Save, Loader2 } from 'lucide-react';

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
    permissions?: Permission[];
}

interface RoleModalProps {
    isOpen: boolean;
    onClose: () => void;
    role?: Role | null; // If null, we are in CREATE mode
    permissions: Record<string, Permission[]>;
}

interface FormData {
    name: string;
    description: string;
    permissions: number[];
}

export function RoleModal({ isOpen, onClose, role, permissions }: RoleModalProps) {
    const isEdit = !!role;

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm<FormData>({
        name: '',
        description: '',
        permissions: [],
    });

    // Reset or Populate form when modal opens
    useEffect(() => {
        if (isOpen) {
            if (role) {
                // Edit Mode: Populate
                setData({
                    name: role.name,
                    description: role.description || '',
                    permissions: role.permissions ? role.permissions.map(p => p.id) : [],
                });
            } else {
                // Create Mode: Reset
                reset();
            }
            clearErrors();
        }
    }, [isOpen, role]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const options = {
            onSuccess: () => {
                reset();
                onClose();
            },
        };

        if (isEdit && role) {
            put(route('roles.update', role.id), options);
        } else {
            post(route('roles.store'), options);
        }
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
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-6xl max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>{isEdit ? 'Edit Role' : 'Create New Role'}</DialogTitle>
                    <DialogDescription>
                        {isEdit ? 'Update role details and permissions.' : 'Add a new role and assign permissions.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 pt-2">
                    <form id="role-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Role Name *</Label>
                                <Input
                                    id="name"
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
                                <Input
                                    id="description"
                                    value={data.description}
                                    onChange={(e) => setData('description', e.target.value)}
                                    placeholder="Brief description..."
                                />
                            </div>
                        </div>

                        <div className="border-t pt-4">
                            <h3 className="text-sm font-semibold mb-3">Permissions</h3>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-0">
                                {Object.entries(permissions).map(([module, modulePermissions]) => (
                                    <div key={module} className="border rounded-lg mb-3 overflow-hidden">
                                        <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/30">
                                            <Checkbox
                                                checked={isModuleSelected(modulePermissions)}
                                                onCheckedChange={() => handleSelectAllModule(modulePermissions)}
                                            />
                                            <span className="font-medium text-sm">{module}</span>
                                            <span className="text-xs text-muted-foreground ml-auto">
                                                {modulePermissions.filter(p => data.permissions.includes(p.id)).length}/{modulePermissions.length}
                                            </span>
                                        </div>
                                        <div className="px-3 py-2 space-y-1.5">
                                            {modulePermissions.map((permission) => (
                                                <div key={permission.id} className="flex items-center gap-2">
                                                    <Checkbox
                                                        id={`permission-${permission.id}`}
                                                        checked={data.permissions.includes(permission.id)}
                                                        onCheckedChange={() => handlePermissionToggle(permission.id)}
                                                    />
                                                    <Label
                                                        htmlFor={`permission-${permission.id}`}
                                                        className="font-normal cursor-pointer text-sm leading-tight"
                                                    >
                                                        {permission.name.split('_').map(word =>
                                                            word.charAt(0).toUpperCase() + word.slice(1)
                                                        ).join(' ')}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </form>
                </div>

                <DialogFooter className="p-6 border-t bg-muted/20">
                    <Button variant="outline" type="button" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" form="role-form" disabled={processing}>
                        {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {isEdit ? 'Update Role' : 'Create Role'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
