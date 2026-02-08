import React, { useEffect } from 'react';
import { useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { HEISelector } from '@/components/ui/hei-selector';
import { Save, Loader2 } from 'lucide-react';

interface Role {
    id: number;
    name: string;
}

interface Region {
    id: string;
    code: string;
    name: string;
}

interface HEI {
    id: string;
    name: string;
    code?: string | null;
    region_id?: string | null;
    region?: Region | null;
}

interface User {
    id: number;
    name: string;
    email: string;
    role_id: number;
    status: string;
    region_id?: string | null;
    hei_id?: string | null;
}

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    user?: User | null;
    roles: Role[];
    regions: Region[];
    heis: HEI[];
}

interface FormData {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    role_id: string;
    region_id: string;
    hei_id: string;
    status: string;
}

export function UserModal({ isOpen, onClose, user, roles, regions, heis }: UserModalProps) {
    const isEdit = !!user;

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm<FormData>({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        role_id: '',
        region_id: '',
        hei_id: '',
        status: 'active',
    });

    // Get selected role name for conditional field display
    const selectedRole = roles.find(r => r.id.toString() === data.role_id);
    const isHEIRole = selectedRole?.name === 'HEI';
    const isRegionalCoordinator = selectedRole?.name === 'Regional Coordinator';

    useEffect(() => {
        if (isOpen) {
            if (user) {
                setData({
                    name: user.name,
                    email: user.email,
                    password: '',
                    password_confirmation: '',
                    role_id: user.role_id.toString(),
                    region_id: user.region_id || '',
                    hei_id: user.hei_id || '',
                    status: user.status,
                });
            } else {
                reset();
                setData({
                    name: '',
                    email: '',
                    password: '12345678',
                    password_confirmation: '12345678',
                    role_id: '',
                    region_id: '',
                    hei_id: '',
                    status: 'active',
                });
            }
            clearErrors();
        }
    }, [isOpen, user]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const options = {
            onSuccess: () => {
                reset();
                onClose();
            },
        };

        if (isEdit && user) {
            put(route('users.update', user.id), options);
        } else {
            post(route('users.store'), options);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader className="pb-2">
                    <DialogTitle>{isEdit ? 'Edit User' : 'Create New User'}</DialogTitle>
                    <DialogDescription>
                        {isEdit ? 'Update user details.' : 'Add a new user to the system.'}
                    </DialogDescription>
                </DialogHeader>

                <form id="user-form" onSubmit={handleSubmit} className="space-y-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="name">Full Name *</Label>
                        <Input
                            id="name"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder="Juan Dela Cruz"
                            className={errors.name ? 'border-destructive' : ''}
                        />
                        {errors.name && (
                            <p className="text-sm text-destructive">{errors.name}</p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="email">Email Address *</Label>
                        <Input
                            id="email"
                            type="email"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            placeholder="juan@example.com"
                            className={errors.email ? 'border-destructive' : ''}
                        />
                        {errors.email && (
                            <p className="text-sm text-destructive">{errors.email}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="role">Role *</Label>
                            <Select
                                value={data.role_id}
                                onValueChange={(value) => {
                                    // Clear role-specific fields when role changes
                                    const newRole = roles.find(r => r.id.toString() === value);
                                    if (newRole?.name === 'HEI') {
                                        setData(data => ({ ...data, role_id: value, region_id: '' }));
                                    } else if (newRole?.name === 'Regional Coordinator') {
                                        setData(data => ({ ...data, role_id: value, hei_id: '' }));
                                    } else {
                                        setData(data => ({ ...data, role_id: value, hei_id: '', region_id: '' }));
                                    }
                                }}
                            >
                                <SelectTrigger className={errors.role_id ? 'border-destructive' : ''}>
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map((role) => (
                                        <SelectItem key={role.id} value={role.id.toString()}>
                                            {role.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.role_id && (
                                <p className="text-sm text-destructive">{errors.role_id}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="status">Status *</Label>
                            <Select
                                value={data.status}
                                onValueChange={(value) => setData('status', value)}
                            >
                                <SelectTrigger className={errors.status ? 'border-destructive' : ''}>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.status && (
                                <p className="text-sm text-destructive">{errors.status}</p>
                            )}
                        </div>
                    </div>

                    {/* Region Selection - For Regional Coordinators only */}
                    {isRegionalCoordinator && (
                        <div className="space-y-1.5">
                            <Label htmlFor="region_id">
                                Region <span className="text-destructive">*</span>
                            </Label>
                            <Select
                                value={data.region_id || undefined}
                                onValueChange={(value) => setData('region_id', value)}
                            >
                                <SelectTrigger className={errors.region_id ? 'border-destructive' : ''}>
                                    <SelectValue placeholder="Select region" />
                                </SelectTrigger>
                                <SelectContent>
                                    {regions.map((region) => (
                                        <SelectItem key={region.id} value={region.id}>
                                            {region.name} ({region.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.region_id && (
                                <p className="text-sm text-destructive">{errors.region_id}</p>
                            )}
                        </div>
                    )}

                    {/* HEI Selection - Only visible for HEI role */}
                    {isHEIRole && (
                        <div className="space-y-1.5">
                            <Label htmlFor="hei_id">
                                Institution <span className="text-destructive">*</span>
                            </Label>
                            <HEISelector
                                heis={heis}
                                regions={regions}
                                value={data.hei_id}
                                onChange={(value) => {
                                    // Auto-populate region when HEI is selected
                                    const selectedHEI = heis.find(h => h.id === value);
                                    if (selectedHEI?.region_id) {
                                        setData(data => ({
                                            ...data,
                                            hei_id: value,
                                            region_id: selectedHEI.region_id,
                                        }));
                                    } else {
                                        setData('hei_id', value);
                                    }
                                }}
                                error={!!errors.hei_id}
                                placeholder="Search institution..."
                            />
                            {errors.hei_id && (
                                <p className="text-sm text-destructive">{errors.hei_id}</p>
                            )}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label htmlFor="password">
                            Password {isEdit ? '(Leave blank to keep current)' : '*'}
                        </Label>
                        <Input
                            id="password"
                            type="password"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            placeholder="••••••••"
                            className={errors.password ? 'border-destructive' : ''}
                        />
                        {!isEdit && (
                            <p className="text-xs text-muted-foreground">
                                Default password: 12345678 (User should change after first login)
                            </p>
                        )}
                        {errors.password && (
                            <p className="text-sm text-destructive">{errors.password}</p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="password_confirmation">Confirm Password</Label>
                        <Input
                            id="password_confirmation"
                            type="password"
                            value={data.password_confirmation}
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>
                </form>

                <DialogFooter>
                    <Button variant="outline" type="button" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" form="user-form" disabled={processing}>
                        {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {isEdit ? 'Update User' : 'Create User'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
