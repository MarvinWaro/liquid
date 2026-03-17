import { ProgramModal } from '@/components/programs/program-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeletePopover } from '@/components/ui/delete-popover';
import { Input } from '@/components/ui/input';
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
import { CornerDownRight, FolderOpen, Pencil, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

interface ParentOption {
    id: string;
    code: string;
    name: string;
}

interface Program {
    id: string;
    code: string;
    name: string;
    description: string | null;
    status: string;
    parent_id: string | null;
    parent?: ParentOption | null;
    document_requirements_count: number;
    children_count: number;
    liquidations_count: number;
}

interface Props {
    programs: Program[];
    parentOptions: ParentOption[];
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Settings', href: '/settings/profile' },
    { title: 'Programs', href: '/programs' },
];

export default function Index({
    programs,
    parentOptions,
    canCreate,
    canEdit,
    canDelete,
}: Props) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Build hierarchical display: parents first, then their children indented
    const displayPrograms = useMemo(() => {
        const filtered = programs.filter(
            (p) =>
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())),
        );

        if (searchQuery) return filtered;

        // Group: top-level programs, each followed by their children
        const topLevel = filtered.filter((p) => !p.parent_id);
        const childrenMap = new Map<string, Program[]>();
        filtered
            .filter((p) => p.parent_id)
            .forEach((p) => {
                const existing = childrenMap.get(p.parent_id!) || [];
                existing.push(p);
                childrenMap.set(p.parent_id!, existing);
            });

        const result: Program[] = [];
        topLevel.forEach((parent) => {
            result.push(parent);
            const children = childrenMap.get(parent.id) || [];
            children.forEach((child) => result.push(child));
        });

        // Add orphans (children whose parent wasn't in the filtered set)
        filtered
            .filter((p) => p.parent_id && !topLevel.some((t) => t.id === p.parent_id))
            .forEach((orphan) => {
                if (!result.includes(orphan)) result.push(orphan);
            });

        return result;
    }, [programs, searchQuery]);

    const handleCreate = () => {
        setSelectedProgram(null);
        setIsModalOpen(true);
    };

    const handleEdit = (program: Program) => {
        setSelectedProgram(program);
        setIsModalOpen(true);
    };

    const handleDelete = (programId: string) => {
        router.delete(route('programs.destroy', programId), {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Programs" />

            <SettingsLayout wide>
                <ProgramModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    program={selectedProgram}
                    parentOptions={parentOptions}
                />

                <div className="w-full py-8">
                    <div className="mx-auto w-full max-w-[95%]">
                        {/* Header */}
                        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                            <div>
                                <h2 className="text-xl font-semibold tracking-tight">
                                    Programs
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Manage scholarship programs and their configurations.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative w-64">
                                    <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        placeholder="Search programs..."
                                        className="bg-background pl-9"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                {canCreate && (
                                    <Button
                                        onClick={handleCreate}
                                        className="bg-foreground text-background shadow-sm hover:bg-foreground/90"
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Program
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-b hover:bg-transparent">
                                        <TableHead className="h-9 w-32 pl-6 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                            Code
                                        </TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                            Program Name
                                        </TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                            Description
                                        </TableHead>
                                        <TableHead className="h-9 w-32 text-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                            Requirements
                                        </TableHead>
                                        <TableHead className="h-9 w-28 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                            Status
                                        </TableHead>
                                        <TableHead className="h-9 w-28 pr-6 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                            Actions
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayPrograms.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={6}
                                                className="py-12 text-center text-muted-foreground"
                                            >
                                                <div className="flex flex-col items-center gap-2">
                                                    <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>No programs found.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        displayPrograms.map((program) => {
                                            const isChild = !!program.parent_id;
                                            const isParent = program.children_count > 0;

                                            return (
                                                <TableRow
                                                    key={program.id}
                                                    className={`transition-colors hover:bg-muted/50 ${isParent ? 'bg-muted/20' : ''}`}
                                                >
                                                    <TableCell className="py-2 pl-6">
                                                        <div className="flex items-center gap-1.5">
                                                            {isChild && (
                                                                <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                                                            )}
                                                            <span className="font-mono text-sm font-semibold text-foreground">
                                                                {program.code}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-medium">
                                                                {program.name}
                                                            </span>
                                                            {isParent && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-[10px] border-border text-muted-foreground px-1.5 py-0"
                                                                >
                                                                    {program.children_count} sub-program{program.children_count !== 1 ? 's' : ''}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="max-w-xs py-2">
                                                        <span className="line-clamp-2 text-sm text-muted-foreground">
                                                            {program.description || '—'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-center">
                                                        <Badge
                                                            variant="outline"
                                                            className="border-border bg-muted text-foreground"
                                                        >
                                                            {program.document_requirements_count} docs
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <Badge
                                                            className={`${
                                                                program.status === 'active'
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60'
                                                                    : 'bg-muted text-muted-foreground border-border'
                                                            } shadow-none`}
                                                        >
                                                            <span
                                                                className={`mr-2 h-1.5 w-1.5 rounded-full ${
                                                                    program.status === 'active'
                                                                        ? 'bg-emerald-500'
                                                                        : 'bg-muted-foreground/50'
                                                                }`}
                                                            />
                                                            {program.status === 'active' ? 'Active' : 'Inactive'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="py-2 pr-6 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {canEdit && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                                    onClick={() => handleEdit(program)}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                            {canDelete && (
                                                                <DeletePopover
                                                                    itemName={program.name}
                                                                    onConfirm={() => handleDelete(program.id)}
                                                                />
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
