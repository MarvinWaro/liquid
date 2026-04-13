import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Calendar, ChevronRight, Megaphone, Pencil, Plus, Trash2, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Announcement', href: '/announcement' }];

type TagColor = 'blue' | 'emerald' | 'violet' | 'amber' | 'sky' | 'rose';
type Category = 'news' | 'event' | 'important' | 'update';

type PostStatus = 'live' | 'scheduled' | 'expired';

interface Post {
    id: string;
    slug: string;
    title: string;
    category: Category;
    tag_color: TagColor | null;
    excerpt: string | null;
    is_featured: boolean;
    show_to_hei: boolean;
    status: PostStatus;
    published_at: string | null;
    end_date: string | null;
    cover_thumb: string | null;
    cover_display: string | null;
    author_name: string | null;
}

interface PageProps {
    posts: Post[];
    permissions: { create: boolean; edit: boolean; delete: boolean };
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

const PLACEHOLDER_BG = 'bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800';

const STATUS_BADGE: Record<PostStatus, { label: string; className: string } | null> = {
    live: null, // no badge for live posts
    scheduled: { label: 'Scheduled', className: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700' },
    expired: { label: 'Expired', className: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700' },
};

function StatusBadge({ status }: { status: PostStatus }) {
    const badge = STATUS_BADGE[status];
    if (!badge) return null;
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-semibold tracking-wider uppercase ${badge.className}`}>
            {badge.label}
        </span>
    );
}

export default function Announcement() {
    const { posts, permissions: can } = usePage<PageProps>().props;

    const featured = posts.find((p) => p.is_featured) ?? null;
    // Sidebar only renders when a featured post exists — so only dedupe against
    // it in that case. Otherwise every post flows into the Recent grid.
    const otherFeaturedLike = featured ? posts.filter((p) => !p.is_featured).slice(0, 3) : [];
    const sidebarIds = new Set(otherFeaturedLike.map((p) => p.id));
    const recent = posts.filter((p) => p.id !== featured?.id && !sidebarIds.has(p.id));

    const handleDelete = (slug: string) => {
        router.delete(`/announcement/${slug}`, { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Announcement" />
            <div className="py-8 w-full">
                <div className="w-full mx-auto space-y-8">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Megaphone className="h-5 w-5 text-muted-foreground" />
                                <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Official notices, memos, and updates from UniFAST Region XII
                            </p>
                        </div>
                        {can.create && (
                            <Button asChild>
                                <Link href="/announcement/create">
                                    <Plus className="mr-1 h-4 w-4" />
                                    Post Announcement
                                </Link>
                            </Button>
                        )}
                    </div>

                    {/* Empty state */}
                    {posts.length === 0 && (
                        <div className="rounded-xl border bg-card p-16 text-center">
                            <Megaphone className="mx-auto h-12 w-12 text-muted-foreground/40" />
                            <h3 className="mt-4 text-base font-semibold">No announcements yet</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {can.create ? 'Click "Post Announcement" to publish the first one.' : 'Check back later for updates.'}
                            </p>
                        </div>
                    )}

                    {/* Hero row: Featured (left) + sidebar list (right) */}
                    {featured && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Featured hero — spans 2 cols */}
                            <div className="lg:col-span-2">
                                <HeroFeatured post={featured} can={can} onDelete={handleDelete} />
                            </div>

                            {/* Sidebar — latest 3 non-featured */}
                            {otherFeaturedLike.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Other Featured Posts</h3>
                                    <div className="space-y-3">
                                        {otherFeaturedLike.map((p) => (
                                            <SidebarCard key={p.id} post={p} can={can} onDelete={handleDelete} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Recent Posts Grid */}
                    {recent.length > 0 && (
                        <section className="space-y-5 border-t pt-8">
                            <h2 className="text-lg font-bold tracking-tight">Recent Posts</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {recent.map((post) => (
                                    <PostCard key={post.id} post={post} can={can} onDelete={handleDelete} />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

/* ─── Hero Featured Banner ─── */
function HeroFeatured({ post, can, onDelete }: { post: Post; can: PageProps['permissions']; onDelete: (slug: string) => void }) {
    const cat = CATEGORY_CONFIG[post.category] ?? CATEGORY_CONFIG.news;
    return (
        <article className="relative overflow-hidden rounded-lg group h-full min-h-[340px] flex flex-col">
            {post.cover_display ? (
                <img src={post.cover_display} alt="" className="absolute inset-0 h-full w-full object-cover rounded-lg transition-transform duration-500 group-hover:scale-105" />
            ) : (
                <div className={`absolute inset-0 rounded-lg ${PLACEHOLDER_BG}`} />
            )}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

            <div className="absolute top-4 right-4 z-20">
                <PostActions post={post} can={can} onDelete={onDelete} light />
            </div>

            <div className="relative z-10 mt-auto p-6 sm:p-8 space-y-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-bold tracking-widest uppercase ${cat.color}`}>
                        {cat.label}
                    </span>
                    {post.status !== 'live' && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase ${post.status === 'expired' ? 'bg-red-500/80 text-white' : 'bg-amber-500/80 text-white'}`}>
                            {post.status}
                        </span>
                    )}
                    <span className="text-xs text-white/70 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {formatDate(post.published_at)}
                    </span>
                    {post.author_name && (
                        <span className="text-xs text-white/70 flex items-center gap-1">
                            <UserIcon className="h-3 w-3" /> {post.author_name}
                        </span>
                    )}
                </div>
                <Link href={`/announcement/${post.slug}`}>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight hover:underline decoration-2 underline-offset-4">
                        {post.title}
                    </h2>
                </Link>
                {post.excerpt && <p className="text-sm text-white/80 leading-relaxed line-clamp-2">{post.excerpt}</p>}
                <Link href={`/announcement/${post.slug}`} className="inline-flex items-center gap-1 text-sm font-medium text-white hover:text-white/80 transition-colors pt-1">
                    Read more <ChevronRight className="h-4 w-4" />
                </Link>
            </div>
        </article>
    );
}

/* ─── Sidebar compact card ─── */
function SidebarCard({ post, can, onDelete }: { post: Post; can: PageProps['permissions']; onDelete: (slug: string) => void }) {
    const cat = CATEGORY_CONFIG[post.category] ?? CATEGORY_CONFIG.news;
    return (
        <article className="flex gap-3 rounded-lg border bg-card p-3 hover:shadow-sm transition-shadow group">
            <Link href={`/announcement/${post.slug}`} className="shrink-0 relative">
                {post.cover_thumb ? (
                    <img src={post.cover_thumb} alt="" className="h-20 w-28 rounded object-cover" loading="lazy" />
                ) : (
                    <div className={`h-20 w-28 rounded ${PLACEHOLDER_BG} flex items-center justify-center`}>
                        <Megaphone className="h-5 w-5 text-muted-foreground/30" />
                    </div>
                )}
                <span className={`absolute top-1 left-1 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold tracking-widest uppercase ${cat.color}`}>
                    {cat.label}
                </span>
            </Link>
            <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-1.5">
                    <StatusBadge status={post.status} />
                    <div className="ml-auto">
                        <PostActions post={post} can={can} onDelete={onDelete} />
                    </div>
                </div>
                <Link href={`/announcement/${post.slug}`}>
                    <h4 className="text-xs font-semibold text-foreground leading-snug line-clamp-2 group-hover:underline">
                        {post.title}
                    </h4>
                </Link>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-2.5 w-2.5" /> {formatDate(post.published_at)}
                </span>
            </div>
        </article>
    );
}

/* ─── Grid Card ─── */
function PostCard({ post, can, onDelete }: { post: Post; can: PageProps['permissions']; onDelete: (slug: string) => void }) {
    const cat = CATEGORY_CONFIG[post.category] ?? CATEGORY_CONFIG.news;
    return (
        <article className={`rounded-xl border bg-card shadow-sm overflow-hidden hover:shadow-lg transition-shadow flex flex-col group ${post.status === 'expired' ? 'opacity-60' : ''}`}>
            <Link href={`/announcement/${post.slug}`} className="block relative overflow-hidden">
                {post.cover_thumb ? (
                    <img src={post.cover_thumb} alt="" className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                ) : (
                    <div className={`h-48 w-full ${PLACEHOLDER_BG} flex items-center justify-center`}>
                        <Megaphone className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                )}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase ${cat.color}`}>
                        {cat.label}
                    </span>
                    {post.status !== 'live' && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase ${post.status === 'expired' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>
                            {post.status}
                        </span>
                    )}
                </div>
            </Link>

            <div className="p-5 flex-1 flex flex-col space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {formatDate(post.published_at)}
                        </span>
                        {post.author_name && (
                            <>
                                <span className="text-muted-foreground/40">|</span>
                                <span className="flex items-center gap-1">
                                    <UserIcon className="h-3 w-3" /> {post.author_name}
                                </span>
                            </>
                        )}
                    </div>
                    <PostActions post={post} can={can} onDelete={onDelete} />
                </div>

                <Link href={`/announcement/${post.slug}`}>
                    <h3 className="text-base font-semibold text-foreground leading-snug line-clamp-2 hover:underline">
                        {post.title}
                    </h3>
                </Link>

                {post.excerpt && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 flex-1">
                        {post.excerpt}
                    </p>
                )}

                <Link href={`/announcement/${post.slug}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors mt-auto pt-1">
                    Read more <ChevronRight className="h-3.5 w-3.5" />
                </Link>
            </div>
        </article>
    );
}

/* ─── Edit/Delete Actions ─── */
function PostActions({ post, can, onDelete, light }: { post: Post; can: PageProps['permissions']; onDelete: (slug: string) => void; light?: boolean }) {
    if (!can.edit && !can.delete) return null;
    const cls = light
        ? 'h-8 w-8 p-0 bg-white/20 hover:bg-white/40 text-white backdrop-blur-sm'
        : 'h-7 w-7 p-0';
    return (
        <div className="flex items-center gap-1">
            {can.edit && (
                <Button asChild variant="ghost" size="sm" className={cls}>
                    <Link href={`/announcement/${post.slug}/edit`} title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                    </Link>
                </Button>
            )}
            {can.delete && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className={`${cls} ${light ? '' : 'text-destructive hover:text-destructive'}`} title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
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
                            <AlertDialogAction onClick={() => onDelete(post.slug)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    );
}
