import { useState } from 'react';
import { useForm } from '@inertiajs/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TipTapEditor } from '@/components/tiptap-editor';
import { toast } from 'sonner';
import { ImagePlus, X, Settings2 } from 'lucide-react';

type TagColor = 'blue' | 'emerald' | 'violet' | 'amber' | 'sky' | 'rose';
type Category = 'news' | 'event' | 'important' | 'update';

export interface AnnouncementFormValues {
    title: string;
    category: Category;
    tag_color: TagColor | '';
    excerpt: string;
    content: string;
    is_featured: boolean;
    show_to_hei: boolean;
    published_at: string;
    end_date: string;
    cover: File | null;
    remove_cover: boolean;
    _method?: 'PUT';
}

interface Props {
    initial?: Partial<AnnouncementFormValues> & { cover_display?: string | null };
    submitUrl: string;
    isUpdate?: boolean;
    cancelUrl?: string;
}

const CATEGORIES: { value: Category; label: string }[] = [
    { value: 'news', label: 'News' },
    { value: 'event', label: 'Event' },
    { value: 'important', label: 'Important' },
    { value: 'update', label: 'Update' },
];

const COLORS: { value: TagColor; label: string; dot: string }[] = [
    { value: 'blue', label: 'Blue', dot: 'bg-blue-500' },
    { value: 'emerald', label: 'Emerald', dot: 'bg-emerald-500' },
    { value: 'violet', label: 'Violet', dot: 'bg-violet-500' },
    { value: 'amber', label: 'Amber', dot: 'bg-amber-500' },
    { value: 'sky', label: 'Sky', dot: 'bg-sky-500' },
    { value: 'rose', label: 'Rose', dot: 'bg-rose-500' },
];

export function AnnouncementForm({ initial, submitUrl, isUpdate, cancelUrl = '/announcement' }: Props) {
    const existingCover = initial?.cover_display ?? null;
    const [preview, setPreview] = useState<string | null>(existingCover);

    const { data, setData, post, processing, errors, reset } = useForm<AnnouncementFormValues>({
        title: initial?.title ?? '',
        category: (initial?.category as Category) ?? 'news',
        tag_color: (initial?.tag_color as TagColor) ?? '',
        excerpt: initial?.excerpt ?? '',
        content: initial?.content ?? '',
        is_featured: initial?.is_featured ?? false,
        show_to_hei: initial?.show_to_hei ?? true,
        published_at: initial?.published_at ?? '',
        end_date: initial?.end_date ?? '',
        cover: null,
        remove_cover: false,
        ...(isUpdate ? { _method: 'PUT' as const } : {}),
    });

    const handleCoverChange = (file: File | null) => {
        if (!file) {
            setData('cover', null);
            setPreview(existingCover);
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            toast.error('Cover image must be 8MB or less.');
            return;
        }
        setData((prev) => ({ ...prev, cover: file, remove_cover: false }));
        const reader = new FileReader();
        reader.onload = (e) => setPreview(typeof e.target?.result === 'string' ? e.target.result : null);
        reader.readAsDataURL(file);
    };

    const clearCover = () => {
        setData((prev) => ({ ...prev, cover: null, remove_cover: true }));
        setPreview(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(submitUrl, {
            forceFormData: true,
            onSuccess: () => {
                if (!isUpdate) reset();
            },
            onError: () => toast.error('Please fix the errors below.'),
        });
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="flex flex-col lg:flex-row gap-6">
                {/* ─── Main Content (left) ─── */}
                <div className="flex-1 space-y-6">
                    {/* Cover */}
                    <div className="space-y-2">
                        <Label>Cover image <span className="text-xs text-muted-foreground font-normal">(optional — up to 8MB)</span></Label>
                        {preview ? (
                            <div className="relative rounded-lg border overflow-hidden bg-muted">
                                <img src={preview} alt="cover preview" className="w-full h-56 object-cover" />
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    className="absolute top-2 right-2 h-7"
                                    onClick={clearCover}
                                >
                                    <X className="mr-1 h-3.5 w-3.5" /> Remove
                                </Button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center gap-2 h-40 rounded-lg border border-dashed bg-muted/30 hover:bg-muted/60 cursor-pointer transition-colors">
                                <ImagePlus className="h-7 w-7 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Click to upload (JPG, PNG, WebP)</span>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="sr-only"
                                    onChange={(e) => handleCoverChange(e.target.files?.[0] ?? null)}
                                />
                            </label>
                        )}
                        {errors.cover && <p className="text-xs text-destructive">{errors.cover}</p>}
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title">Title *</Label>
                        <Input
                            id="title"
                            value={data.title}
                            onChange={(e) => setData('title', e.target.value)}
                            maxLength={255}
                            required
                        />
                        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                    </div>

                    {/* Excerpt */}
                    <div className="space-y-2">
                        <Label htmlFor="excerpt">Short summary <span className="text-xs text-muted-foreground font-normal">(shown on the list card)</span></Label>
                        <Textarea
                            id="excerpt"
                            value={data.excerpt}
                            onChange={(e) => setData('excerpt', e.target.value)}
                            rows={3}
                            maxLength={500}
                        />
                        <div className="text-xs text-muted-foreground text-right">{data.excerpt.length}/500</div>
                        {errors.excerpt && <p className="text-xs text-destructive">{errors.excerpt}</p>}
                    </div>

                    {/* Content */}
                    <div className="space-y-2">
                        <Label>Content *</Label>
                        <TipTapEditor value={data.content} onChange={(html) => setData('content', html)} />
                        {errors.content && <p className="text-xs text-destructive">{errors.content}</p>}
                    </div>
                </div>

                {/* ─── Publish Settings (right sidebar) ─── */}
                <div className="lg:w-80 shrink-0 space-y-5">
                    <div className="rounded-xl border bg-card p-5 space-y-5">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Settings2 className="h-4 w-4 text-muted-foreground" />
                            Publish Settings
                        </div>

                        {/* Category */}
                        <div className="space-y-2">
                            <Label>Category *</Label>
                            <Select value={data.category} onValueChange={(v) => setData('category', v as Category)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map((c) => (
                                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
                        </div>

                        {/* Publish date */}
                        <div className="space-y-2">
                            <Label htmlFor="published_at">Publish date</Label>
                            <Input
                                id="published_at"
                                type="datetime-local"
                                value={data.published_at ? data.published_at.slice(0, 16) : ''}
                                onChange={(e) => setData('published_at', e.target.value)}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Leave empty for now. Future date = scheduled.
                            </p>
                            {errors.published_at && <p className="text-xs text-destructive">{errors.published_at}</p>}
                        </div>

                        {/* End date */}
                        <div className="space-y-2">
                            <Label htmlFor="end_date">End date <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
                            <Input
                                id="end_date"
                                type="datetime-local"
                                value={data.end_date ? data.end_date.slice(0, 16) : ''}
                                onChange={(e) => setData('end_date', e.target.value)}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Auto-hides the post after this date.
                            </p>
                            {errors.end_date && <p className="text-xs text-destructive">{errors.end_date}</p>}
                        </div>

                        <div className="border-t pt-4 space-y-4">
                            {/* Featured toggle */}
                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id="is_featured"
                                    checked={data.is_featured}
                                    onCheckedChange={(v) => setData('is_featured', !!v)}
                                />
                                <div className="grid gap-0.5">
                                    <Label htmlFor="is_featured" className="text-sm cursor-pointer">Featured</Label>
                                    <p className="text-[11px] text-muted-foreground">
                                        Shows as the hero banner on the list page.
                                    </p>
                                </div>
                            </div>

                            {/* Show to HEI toggle */}
                            <div className="flex items-center justify-between gap-3">
                                <div className="grid gap-0.5">
                                    <Label htmlFor="show_to_hei" className="text-sm cursor-pointer">Visible to HEI</Label>
                                    <p className="text-[11px] text-muted-foreground">
                                        HEI users will see this post.
                                    </p>
                                </div>
                                <Switch
                                    id="show_to_hei"
                                    checked={data.show_to_hei}
                                    onCheckedChange={(v) => setData('show_to_hei', v)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                        <Button type="submit" disabled={processing} className="w-full">
                            {processing ? 'Saving…' : isUpdate ? 'Update announcement' : 'Publish announcement'}
                        </Button>
                        <Button type="button" variant="outline" className="w-full" asChild>
                            <a href={cancelUrl}>Cancel</a>
                        </Button>
                    </div>
                </div>
            </div>
        </form>
    );
}
