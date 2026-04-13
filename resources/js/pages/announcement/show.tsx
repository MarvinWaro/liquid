import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, Pencil, Trash2, User as UserIcon } from 'lucide-react';
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

type Category = 'news' | 'event' | 'important' | 'update';

interface Post {
    id: string;
    slug: string;
    title: string;
    category: Category;
    tag_color: string | null;
    excerpt: string | null;
    content: string;
    is_featured: boolean;
    show_to_hei: boolean;
    published_at: string | null;
    end_date: string | null;
    cover_display: string | null;
    cover_original: string | null;
    author_name: string | null;
}

interface PageProps {
    post: Post;
    permissions: { edit: boolean; delete: boolean };
    [key: string]: unknown;
}

const CATEGORY_CONFIG: Record<Category, { label: string; color: string }> = {
    news: { label: 'NEWS', color: 'bg-blue-600 text-white' },
    event: { label: 'EVENT', color: 'bg-emerald-600 text-white' },
    important: { label: 'IMPORTANT', color: 'bg-red-600 text-white' },
    update: { label: 'UPDATE', color: 'bg-amber-500 text-white' },
};

const formatDate = (iso: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

export default function ShowAnnouncement() {
    const { post, permissions: can } = usePage<PageProps>().props;
    const cat = CATEGORY_CONFIG[post.category] ?? CATEGORY_CONFIG.news;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Announcement', href: '/announcement' },
        { title: post.title, href: `/announcement/${post.slug}` },
    ];

    const handleDelete = () => {
        router.delete(`/announcement/${post.slug}`);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={post.title} />
            <div className="py-8 w-full">
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="flex items-center justify-between gap-2">
                        <Button asChild variant="ghost" size="sm">
                            <Link href="/announcement">
                                <ArrowLeft className="mr-1 h-4 w-4" /> Back to announcements
                            </Link>
                        </Button>
                        <div className="flex items-center gap-2">
                            {can.edit && (
                                <Button asChild variant="outline" size="sm">
                                    <Link href={`/announcement/${post.slug}/edit`}>
                                        <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                                    </Link>
                                </Button>
                            )}
                            {can.delete && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                                            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete this announcement?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                "{post.title}" will be removed. This can be restored by an admin.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                    </div>

                    <article className="rounded-xl border bg-card shadow-sm overflow-hidden">
                        {(post.cover_original || post.cover_display) && (
                            <div className="w-full bg-muted flex justify-center">
                                <img
                                    src={post.cover_original ?? post.cover_display ?? ''}
                                    alt=""
                                    className="w-full h-auto object-contain"
                                />
                            </div>
                        )}
                        <div className="p-6 sm:p-10 space-y-6">
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase ${cat.color}`}>
                                    {cat.label}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> {formatDate(post.published_at)}
                                </span>
                                {post.author_name && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <UserIcon className="h-3 w-3" /> {post.author_name}
                                    </span>
                                )}
                                {post.is_featured && (
                                    <span className="ml-auto text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 border border-border/60 px-2 py-0.5 rounded">
                                        Featured
                                    </span>
                                )}
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
                                {post.title}
                            </h1>
                            {post.excerpt && (
                                <p className="text-base text-muted-foreground leading-relaxed">{post.excerpt}</p>
                            )}
                            <div
                                className="prose prose-sm sm:prose-base dark:prose-invert max-w-none"
                                dangerouslySetInnerHTML={{ __html: post.content }}
                            />
                        </div>
                    </article>
                </div>
            </div>
        </AppLayout>
    );
}
