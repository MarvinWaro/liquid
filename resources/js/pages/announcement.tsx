import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Calendar, ChevronRight, Clock, Megaphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Announcement', href: '/announcement' },
];

type TagColor = 'blue' | 'emerald' | 'violet' | 'amber' | 'sky' | 'rose';

interface Post {
    id: number;
    tag: string;
    tagColor: TagColor;
    date: string;
    title: string;
    body: string;
    featured?: boolean;
}

const TAG_STYLES: Record<TagColor, string> = {
    blue:    'bg-blue-100    text-blue-700    border-blue-200    dark:bg-blue-950/60    dark:text-blue-400    dark:border-blue-800',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800',
    violet:  'bg-violet-100  text-violet-700  border-violet-200  dark:bg-violet-950/60  dark:text-violet-400  dark:border-violet-800',
    amber:   'bg-amber-100   text-amber-700   border-amber-200   dark:bg-amber-950/60   dark:text-amber-400   dark:border-amber-800',
    sky:     'bg-sky-100     text-sky-700     border-sky-200     dark:bg-sky-950/60     dark:text-sky-400     dark:border-sky-800',
    rose:    'bg-rose-100    text-rose-700    border-rose-200    dark:bg-rose-950/60    dark:text-rose-400    dark:border-rose-800',
};

const ACCENT: Record<TagColor, string> = {
    blue:    'border-l-blue-400',
    emerald: 'border-l-emerald-400',
    violet:  'border-l-violet-400',
    amber:   'border-l-amber-400',
    sky:     'border-l-sky-400',
    rose:    'border-l-rose-400',
};

const POSTS: Post[] = [
    {
        id: 1,
        tag: 'NOTICE',
        tagColor: 'blue',
        date: 'April 12, 2026',
        title: 'Submission Deadline for TES Liquidation Reports — AY 2024–2025',
        body: 'All partner HEIs are reminded to submit their complete liquidation documents on or before the prescribed deadline. Failure to comply may result in the withholding of future scholarship fund releases. Kindly coordinate with your Regional Coordinator for any concerns regarding documentary requirements.',
        featured: true,
    },
    {
        id: 2,
        tag: 'MEMO',
        tagColor: 'violet',
        date: 'April 10, 2026',
        title: 'Updated Documentary Requirements for TDP Program',
        body: 'CHED Region XII has released an updated checklist for TDP liquidation compliance. All HEIs are required to use the revised template effective immediately.',
    },
    {
        id: 3,
        tag: 'ADVISORY',
        tagColor: 'emerald',
        date: 'April 8, 2026',
        title: 'Regional Coordination Meeting — Q2 2026',
        body: 'All Regional Coordinators are required to attend the quarterly coordination meeting on liquidation compliance monitoring scheduled this quarter.',
    },
    {
        id: 4,
        tag: 'REMINDER',
        tagColor: 'amber',
        date: 'April 5, 2026',
        title: 'Grace Period Extension for Late Submissions',
        body: 'HEIs with incomplete liquidation documents may avail of the grace period extension. Coordinate with your Regional Coordinator for eligibility requirements and deadlines.',
    },
    {
        id: 5,
        tag: 'UPDATE',
        tagColor: 'sky',
        date: 'April 2, 2026',
        title: 'New Online Submission Portal — Version 2 Guidelines',
        body: 'The liquidation portal has been updated with improved document upload workflow, real-time status tracking, and enhanced notification features for HEIs and coordinators.',
    },
    {
        id: 6,
        tag: 'NOTICE',
        tagColor: 'rose',
        date: 'March 28, 2026',
        title: 'HEI Compliance Status Report — Q1 2026',
        body: 'The Q1 2026 compliance report is now available for review. HEIs are encouraged to check their current liquidation status and take corrective action where necessary.',
    },
];

export default function Announcement() {
    const featured = POSTS.find(p => p.featured)!;
    const others = POSTS.filter(p => !p.featured);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Announcement" />
            <div className="py-8 w-full">
                <div className="w-full max-w-[100%] mx-auto space-y-6">

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
                        <Badge variant="outline" className="text-xs text-muted-foreground font-normal shrink-0 mt-1">
                            Dynamic announcements coming soon
                        </Badge>
                    </div>

                    {/* Featured Post */}
                    <article className={`rounded-xl border bg-card shadow-sm overflow-hidden border-l-4 ${ACCENT[featured.tagColor]} hover:shadow-md transition-shadow`}>
                        <div className="p-6 sm:p-8">
                            <div className="flex items-center gap-2.5 mb-4 flex-wrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase border ${TAG_STYLES[featured.tagColor]}`}>
                                    {featured.tag}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {featured.date}
                                </span>
                                <span className="ml-auto text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 border border-border/60 px-2 py-0.5 rounded">
                                    Featured
                                </span>
                            </div>
                            <h2 className="text-lg sm:text-xl font-bold text-foreground mb-3 leading-snug">
                                {featured.title}
                            </h2>
                            <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
                                {featured.body}
                            </p>
                            <button className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                                Read more <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </article>

                    {/* Other Posts Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {others.map(post => (
                            <article
                                key={post.id}
                                className={`rounded-xl border bg-card shadow-sm overflow-hidden border-l-4 ${ACCENT[post.tagColor]} hover:shadow-md transition-shadow cursor-default`}
                            >
                                <div className="p-5 space-y-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase border ${TAG_STYLES[post.tagColor]}`}>
                                            {post.tag}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <Clock className="h-2.5 w-2.5" />
                                            {post.date}
                                        </span>
                                    </div>
                                    <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                                        {post.title}
                                    </h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                                        {post.body}
                                    </p>
                                    <button className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/60 hover:text-foreground transition-colors">
                                        Read more <ChevronRight className="h-3 w-3" />
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>

                </div>
            </div>
        </AppLayout>
    );
}
