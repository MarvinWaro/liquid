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
import { Save, Loader2 } from 'lucide-react';

interface Role {
    id: number;
    name: string;
}

interface User {
    id: number;
    name: string;
    email: string;
    role_id: number;
    status: string;
}

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    user?: User | null;
    roles: Role[];
}

interface FormData {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    role_id: string;
    status: string;
}

export function UserModal({ isOpen, onClose, user, roles }: UserModalProps) {
    const isEdit = !!user;

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm<FormData>({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        role_id: '',
        status: 'active',
    });

    useEffect(() => {
        if (isOpen) {
            if (user) {
                // Edit Mode: Populate form
                setData({
                    name: user.name,
                    email: user.email,
                    password: '',
                    password_confirmation: '',
                    role_id: user.role_id.toString(),
                    status: user.status,
                });
            } else {
                // Create Mode: Reset form
                reset();
                setData('status', 'active');
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
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{isEdit ? 'Edit User' : 'Create New User'}</DialogTitle>
                    <DialogDescription>
                        {isEdit ? 'Update user details.' : 'Add a new user to the system.'}
                    </DialogDescription>
                </DialogHeader>

                <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
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

                    <div className="space-y-2">
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
                        <div className="space-y-2">
                            <Label htmlFor="role">Role *</Label>
                            <Select
                                value={data.role_id}
                                onValueChange={(value) => setData('role_id', value)}
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

                        <div className="space-y-2">
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

                    <div className="space-y-2">
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
                        {errors.password && (
                            <p className="text-sm text-destructive">{errors.password}</p>
                        )}
                    </div>

                    <div className="space-y-2">
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
