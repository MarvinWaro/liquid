import { TemplateModal } from '@/components/templates/template-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeletePopover } from '@/components/ui/delete-popover';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Download, FileText, Pencil, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

interface Template {
    id: string;
    name: string;
    category: string | null;
    description: string | null;
    original_filename: string;
    file_size: number;
    mime_type: string;
    is_active: boolean;
    uploader: { id: string; name: string } | null;
    created_at: string;
}

interface Props {
    templates: Template[];
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Settings', href: '/settings/profile' },
    { title: 'Templates', href: '/templates' },
];

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function Index({ templates, canCreate, canEdit, canDelete }: Props) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');

    const categories = useMemo(() => {
        const set = new Set<string>();
        for (const t of templates) {
            if (t.category) set.add(t.category);
        }
        return Array.from(set).sort();
    }, [templates]);

    const filtered = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return templates.filter((t) => {
            const matchesCategory =
                filterCategory === 'all' ||
                (filterCategory === '__none__' ? !t.category : t.category === filterCategory);
            const matchesSearch =
                !q ||
                t.name.toLowerCase().includes(q) ||
                (t.description?.toLowerCase().includes(q) ?? false) ||
                t.original_filename.toLowerCase().includes(q);
            return matchesCategory && matchesSearch;
        });
    }, [templates, filterCategory, searchQuery]);

    const handleCreate = () => {
        setSelectedTemplate(null);
        setIsModalOpen(true);
    };

    const handleEdit = (template: Template) => {
        setSelectedTemplate(template);
        setIsModalOpen(true);
    };

    const handleDelete = (templateId: string) => {
        router.delete(route('templates.destroy', templateId), {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Templates" />

            <SettingsLayout wide>
                <TemplateModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    template={selectedTemplate}
                />

                <div className="w-full">
                    <div className="mb-6 flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-semibold tracking-tight">
                                    Templates
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Manage downloadable form templates that HEIs can access.
                                </p>
                            </div>
                            {canCreate && (
                                <Button
                                    onClick={handleCreate}
                                    className="bg-foreground text-background shadow-sm hover:bg-foreground/90 shrink-0 self-start sm:self-auto"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Template
                                </Button>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Select value={filterCategory} onValueChange={setFilterCategory}>
                                <SelectTrigger className="w-44">
                                    <span className="truncate">
                                        {filterCategory === 'all'
                                            ? 'All Categories'
                                            : filterCategory === '__none__'
                                              ? 'Uncategorized'
                                              : filterCategory}
                                    </span>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    <SelectItem value="__none__">Uncategorized</SelectItem>
                                    {categories.map((c) => (
                                        <SelectItem key={c} value={c}>
                                            {c}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <div className="relative flex-1 min-w-48">
                                <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search templates..."
                                    className="bg-background pl-9 w-full"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border">
                        <Table className="table-fixed w-full">
                            <colgroup>
                                <col className="w-12" />
                                <col style={{ width: '22%' }} />
                                <col style={{ width: '14%' }} />
                                <col style={{ width: 'auto' }} />
                                <col className="w-28" />
                                <col className="w-32" />
                                <col className="w-32" />
                            </colgroup>
                            <TableHeader>
                                <TableRow className="border-b hover:bg-transparent">
                                    <TableHead className="h-9 pl-6 text-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        #
                                    </TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Name
                                    </TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Category
                                    </TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        File
                                    </TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Size
                                    </TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Status
                                    </TableHead>
                                    <TableHead className="h-9 pr-6 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={7}
                                            className="py-12 text-center text-muted-foreground"
                                        >
                                            <div className="flex flex-col items-center gap-2">
                                                <FileText className="h-8 w-8 text-muted-foreground/50" />
                                                <p>No templates found.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtered.map((template, index) => (
                                        <TableRow
                                            key={template.id}
                                            className="transition-colors hover:bg-muted/50"
                                        >
                                            <TableCell className="py-2 pl-6 text-center">
                                                <span className="font-mono text-sm text-muted-foreground">
                                                    {index + 1}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <p className="text-sm font-medium whitespace-normal break-words">
                                                    {template.name}
                                                </p>
                                                {template.description && (
                                                    <p className="mt-0.5 text-xs text-muted-foreground whitespace-normal break-words line-clamp-2">
                                                        {template.description}
                                                    </p>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-2">
                                                {template.category ? (
                                                    <Badge
                                                        variant="outline"
                                                        className="border-border bg-muted text-foreground"
                                                    >
                                                        {template.category}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <a
                                                    href={route('templates.download', template.id)}
                                                    className="inline-flex items-center gap-1.5 text-sm text-foreground hover:underline truncate max-w-full"
                                                    title={template.original_filename}
                                                >
                                                    <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                                                    <span className="truncate">{template.original_filename}</span>
                                                </a>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <span className="font-mono text-xs text-muted-foreground">
                                                    {formatFileSize(template.file_size)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-2 pr-3">
                                                <Badge
                                                    className={`px-2.5 py-1 ${
                                                        template.is_active
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60'
                                                            : 'bg-muted text-muted-foreground border-border'
                                                    } shadow-none`}
                                                >
                                                    <span
                                                        className={`mr-2 h-1.5 w-1.5 rounded-full ${
                                                            template.is_active
                                                                ? 'bg-emerald-500'
                                                                : 'bg-muted-foreground/50'
                                                        }`}
                                                    />
                                                    {template.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-2 pr-6 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        asChild
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                    >
                                                        <a
                                                            href={route('templates.download', template.id)}
                                                            title="Download"
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </a>
                                                    </Button>
                                                    {canEdit && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                            onClick={() => handleEdit(template)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {canDelete && (
                                                        <DeletePopover
                                                            itemName={template.name}
                                                            onConfirm={() => handleDelete(template.id)}
                                                        />
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
