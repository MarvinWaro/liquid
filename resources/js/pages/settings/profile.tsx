import { send } from '@/routes/verification';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Transition } from '@headlessui/react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';

import DeleteUser from '@/components/delete-user';
import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/input-error';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInitials } from '@/hooks/use-initials';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit } from '@/routes/profile';
import AvatarCropModal from '@/components/avatar-crop-modal';
import { Camera, Trash2, Upload } from 'lucide-react';
import { type ChangeEvent, type DragEvent, type FormEventHandler, useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Profile settings',
        href: edit().url,
    },
];

export default function Profile({
    mustVerifyEmail,
    status,
}: {
    mustVerifyEmail: boolean;
    status?: string;
}) {
    const { auth } = usePage<SharedData>().props;
    const getInitials = useInitials();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

    const { data, setData, post, processing, errors, recentlySuccessful } = useForm<{
        name: string;
        email: string;
        avatar: File | null;
        _method: 'PATCH';
    }>({
        name: auth.user.name,
        email: auth.user.email,
        avatar: null,
        _method: 'PATCH',
    });

    const handleFileSelect = useCallback((file: File) => {
        const maxSize = 3 * 1024 * 1024;
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

        if (!allowedTypes.includes(file.type)) {
            toast.error('Invalid file type. Please upload JPG, PNG, WebP, or GIF.');
            return;
        }
        if (file.size > maxSize) {
            toast.error('File is too large. Maximum size is 3MB.');
            return;
        }

        setCropImageSrc(URL.createObjectURL(file));
    }, []);

    const handleCropComplete = useCallback((croppedFile: File) => {
        setData('avatar', croppedFile);
        setPreviewUrl(URL.createObjectURL(croppedFile));
        setCropImageSrc(null);
    }, [setData]);

    const handleCropCancel = useCallback(() => {
        setCropImageSrc(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelect(file);
    };

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFileSelect(file);
    };

    const clearPreview = () => {
        setData('avatar', null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveAvatar = () => {
        router.delete('/settings/profile/avatar', {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Profile picture removed.');
            },
        });
    };

    const handleSubmit: FormEventHandler = (e) => {
        e.preventDefault();
        post(edit().url, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                setPreviewUrl(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
        });
    };

    const displayedAvatar = previewUrl || (auth.user.avatar_url as string | undefined);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Profile settings" />

            <h1 className="sr-only">Profile Settings</h1>

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall
                        title="Profile information"
                        description="Update your name, email address, and profile picture"
                    />

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Avatar Upload */}
                        <div className="grid gap-2">
                            <Label>Profile picture</Label>
                            <div className="flex items-start gap-4">
                                <div
                                    className={`group relative cursor-pointer rounded-full transition-all ${isDragOver ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                >
                                    <Avatar className="h-20 w-20">
                                        <AvatarImage src={displayedAvatar} alt={auth.user.name} />
                                        <AvatarFallback className="text-lg">
                                            {getInitials(auth.user.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                                        <Camera className="h-6 w-6 text-white" />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5 pt-1">
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <Upload className="mr-1.5 h-3.5 w-3.5" />
                                            Choose photo
                                        </Button>
                                        {(previewUrl || auth.user.avatar_url) && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive"
                                                onClick={previewUrl ? clearPreview : handleRemoveAvatar}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        JPG, PNG, WebP, or GIF. Max 3MB.
                                    </p>
                                    {previewUrl && (
                                        <p className="text-xs text-blue-600 dark:text-blue-400">
                                            New photo selected. Click Save to apply.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <InputError className="mt-1" message={errors.avatar} />
                        </div>

                        {/* Name */}
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                className="mt-1 block w-full"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                required
                                autoComplete="name"
                                placeholder="Full name"
                            />
                            <InputError className="mt-2" message={errors.name} />
                        </div>

                        {/* Email */}
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email address</Label>
                            <Input
                                id="email"
                                type="email"
                                className="mt-1 block w-full"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                required
                                autoComplete="username"
                                placeholder="Email address"
                            />
                            <InputError className="mt-2" message={errors.email} />
                        </div>

                        {mustVerifyEmail && auth.user.email_verified_at === null && (
                            <div>
                                <p className="-mt-4 text-sm text-muted-foreground">
                                    Your email address is unverified.{' '}
                                    <Link
                                        href={send()}
                                        as="button"
                                        className="text-foreground underline decoration-neutral-300 underline-offset-4 transition-colors duration-300 ease-out hover:decoration-current! dark:decoration-neutral-500"
                                    >
                                        Click here to resend the verification email.
                                    </Link>
                                </p>

                                {status === 'verification-link-sent' && (
                                    <div className="mt-2 text-sm font-medium text-green-600">
                                        A new verification link has been sent to your email address.
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex items-center gap-4">
                            <Button disabled={processing} data-test="update-profile-button">
                                Save
                            </Button>

                            <Transition
                                show={recentlySuccessful}
                                enter="transition ease-in-out"
                                enterFrom="opacity-0"
                                leave="transition ease-in-out"
                                leaveTo="opacity-0"
                            >
                                <p className="text-sm text-neutral-600">Saved</p>
                            </Transition>
                        </div>

                        {cropImageSrc && (
                            <AvatarCropModal
                                open={!!cropImageSrc}
                                onOpenChange={(open) => { if (!open) handleCropCancel(); }}
                                imageSrc={cropImageSrc}
                                onCropComplete={handleCropComplete}
                            />
                        )}
                    </form>
                </div>

                <DeleteUser />
            </SettingsLayout>
        </AppLayout>
    );
}
