import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { AnnouncementForm } from '@/components/announcement-form';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Announcement', href: '/announcement' },
    { title: 'New post', href: '/announcement/create' },
];

export default function CreateAnnouncement() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Post Announcement" />
            <div className="py-8 w-full">
                <div className="max-w-5xl mx-auto space-y-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Post Announcement</h1>
                        <p className="text-sm text-muted-foreground">
                            Share a new notice, memo, or update with the region.
                        </p>
                    </div>
                    <AnnouncementForm submitUrl="/announcement" />
                </div>
            </div>
        </AppLayout>
    );
}
