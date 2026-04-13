import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { AnnouncementForm } from '@/components/announcement-form';

interface PostPayload {
    id: string;
    slug: string;
    title: string;
    category: string;
    tag_color: string | null;
    excerpt: string | null;
    content: string;
    is_featured: boolean;
    show_to_hei: boolean;
    published_at: string | null;
    end_date: string | null;
    cover_display: string | null;
}

interface PageProps {
    post: PostPayload;
    [key: string]: unknown;
}

export default function EditAnnouncement() {
    const { post } = usePage<PageProps>().props;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Announcement', href: '/announcement' },
        { title: post.title, href: `/announcement/${post.slug}` },
        { title: 'Edit', href: `/announcement/${post.slug}/edit` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit — ${post.title}`} />
            <div className="py-8 w-full">
                <div className="max-w-5xl mx-auto space-y-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Edit Announcement</h1>
                        <p className="text-sm text-muted-foreground">Update the title, content, or cover image.</p>
                    </div>
                    <AnnouncementForm
                        isUpdate
                        submitUrl={`/announcement/${post.slug}`}
                        cancelUrl={`/announcement/${post.slug}`}
                        initial={{
                            title: post.title,
                            category: post.category as 'news' | 'event' | 'important' | 'update',
                            tag_color: (post.tag_color as '' | 'blue' | 'emerald' | 'violet' | 'amber' | 'sky' | 'rose') ?? '',
                            excerpt: post.excerpt ?? '',
                            content: post.content,
                            is_featured: post.is_featured,
                            show_to_hei: post.show_to_hei,
                            published_at: post.published_at ?? '',
                            end_date: post.end_date ?? '',
                            cover_display: post.cover_display,
                        }}
                    />
                </div>
            </div>
        </AppLayout>
    );
}
