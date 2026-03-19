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
import { Save, Loader2, Shield, ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

// Category ordering for permission modules
const PERMISSION_CATEGORIES: Record<string, string[]> = {
    'Core Operations': ['Liquidation', 'Reports'],
    'User Management': ['Users', 'Roles'],
    'System Configuration': ['HEI', 'Regions', 'Programs', 'Semesters', 'Academic Years', 'Document Requirements', 'Activity Logs'],
};

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
    role?: Role | null;
    permissions: Record<string, Permission[]>;
}

interface FormData {
    name: string;
    description: string;
    permissions: number[];
}

export function RoleModal({ isOpen, onClose, role, permissions }: RoleModalProps) {
    const isEdit = !!role;
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm<FormData>({
        name: '',
        description: '',
        permissions: [],
    });

    useEffect(() => {
        if (isOpen) {
            if (role) {
                setData({
                    name: role.name,
                    description: role.description || '',
                    permissions: role.permissions ? role.permissions.map(p => p.id) : [],
                });
            } else {
                reset();
            }
            clearErrors();
            setCollapsedCategories(new Set());
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

    const isModulePartial = (modulePermissions: Permission[]) => {
        const moduleIds = modulePermissions.map(p => p.id);
        const selectedCount = moduleIds.filter(id => data.permissions.includes(id)).length;
        return selectedCount > 0 && selectedCount < moduleIds.length;
    };

    const toggleCategory = (category: string) => {
        setCollapsedCategories(prev => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    };

    const totalPermissions = useMemo(() => {
        return Object.values(permissions).reduce((acc, perms) => acc + perms.length, 0);
    }, [permissions]);

    const groupedPermissions = useMemo(() => {
        const categorized: { category: string; modules: [string, Permission[]][] }[] = [];
        const assigned = new Set<string>();

        for (const [category, moduleNames] of Object.entries(PERMISSION_CATEGORIES)) {
            const modules = moduleNames
                .filter((name) => permissions[name])
                .map((name) => {
                    assigned.add(name);
                    return [name, permissions[name]] as [string, Permission[]];
                });
            if (modules.length > 0) {
                categorized.push({ category, modules });
            }
        }

        const remaining = Object.entries(permissions)
            .filter(([name]) => !assigned.has(name))
            .sort(([a], [b]) => a.localeCompare(b));
        if (remaining.length > 0) {
            categorized.push({ category: 'Other', modules: remaining });
        }

        return categorized;
    }, [permissions]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                    <DialogTitle className="text-base">{isEdit ? 'Edit Role' : 'Create New Role'}</DialogTitle>
                    <DialogDescription>
                        {isEdit ? 'Update role details and permissions.' : 'Add a new role and assign permissions.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-5">
                    <form id="role-form" onSubmit={handleSubmit} className="space-y-6">
                        {/* Role info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="name" className="text-xs font-medium">Role Name <span className="text-destructive">*</span></Label>
                                <Input
                                    id="name"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    placeholder="e.g., Regional Coordinator"
                                    className={`h-9 ${errors.name ? 'border-destructive focus-visible:ring-destructive/30' : ''}`}
                                />
                                {errors.name && (
                                    <p className="text-xs text-destructive">{errors.name}</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="description" className="text-xs font-medium">Description</Label>
                                <Input
                                    id="description"
                                    value={data.description}
                                    onChange={(e) => setData('description', e.target.value)}
                                    placeholder="Brief description..."
                                    className="h-9"
                                />
                            </div>
                        </div>

                        {/* Permissions */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-muted-foreground" />
                                    <h3 className="text-sm font-semibold">Permissions</h3>
                                </div>
                                <span className="text-xs text-muted-foreground font-medium tabular-nums">
                                    {data.permissions.length} of {totalPermissions} selected
                                </span>
                            </div>

                            <div className="space-y-5">
                                {groupedPermissions.map(({ category, modules }) => {
                                    const isCollapsed = collapsedCategories.has(category);
                                    const categoryPermCount = modules.reduce(
                                        (acc, [, perms]) => acc + perms.filter(p => data.permissions.includes(p.id)).length,
                                        0
                                    );
                                    const categoryTotalCount = modules.reduce((acc, [, perms]) => acc + perms.length, 0);

                                    return (
                                        <div key={category}>
                                            <button
                                                type="button"
                                                onClick={() => toggleCategory(category)}
                                                className="flex items-center gap-1.5 mb-3 group w-full text-left"
                                            >
                                                {isCollapsed
                                                    ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                                }
                                                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
                                                    {category}
                                                </span>
                                                <span className="text-[11px] text-muted-foreground tabular-nums ml-1">
                                                    {categoryPermCount}/{categoryTotalCount}
                                                </span>
                                            </button>

                                            {!isCollapsed && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    {modules.map(([module, modulePermissions]) => {
                                                        const selectedCount = modulePermissions.filter(p => data.permissions.includes(p.id)).length;
                                                        const allSelected = isModuleSelected(modulePermissions);
                                                        const partial = isModulePartial(modulePermissions);

                                                        return (
                                                            <div key={module} className="rounded-lg border border-border overflow-hidden">
                                                                {/* Module header */}
                                                                <div className="flex items-center gap-2.5 px-3 py-2 bg-muted/50 border-b border-border">
                                                                    <Checkbox
                                                                        checked={allSelected ? true : partial ? 'indeterminate' : false}
                                                                        onCheckedChange={() => handleSelectAllModule(modulePermissions)}
                                                                    />
                                                                    <span className="text-sm font-semibold text-foreground">{module}</span>
                                                                    <span className={`text-[11px] font-medium ml-auto tabular-nums ${
                                                                        selectedCount === modulePermissions.length
                                                                            ? 'text-foreground'
                                                                            : 'text-muted-foreground'
                                                                    }`}>
                                                                        {selectedCount}/{modulePermissions.length}
                                                                    </span>
                                                                </div>

                                                                {/* Permission items */}
                                                                <div className="px-3 py-2 space-y-0.5">
                                                                    {modulePermissions.map((permission) => (
                                                                        <label
                                                                            key={permission.id}
                                                                            htmlFor={`permission-${permission.id}`}
                                                                            className="flex items-center gap-2 rounded-md px-1 py-1.5 -mx-1 cursor-pointer hover:bg-muted/50 transition-colors"
                                                                        >
                                                                            <Checkbox
                                                                                id={`permission-${permission.id}`}
                                                                                checked={data.permissions.includes(permission.id)}
                                                                                onCheckedChange={() => handlePermissionToggle(permission.id)}
                                                                            />
                                                                            <span className="text-sm leading-tight">
                                                                                {permission.name.split('_').map(word =>
                                                                                    word.charAt(0).toUpperCase() + word.slice(1)
                                                                                ).join(' ')}
                                                                            </span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </form>
                </div>

                <DialogFooter className="px-6 py-4 border-t bg-muted/30">
                    <Button variant="outline" type="button" onClick={onClose} className="h-9">
                        Cancel
                    </Button>
                    <Button type="submit" form="role-form" disabled={processing} className="h-9">
                        {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {isEdit ? 'Update Role' : 'Create Role'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
