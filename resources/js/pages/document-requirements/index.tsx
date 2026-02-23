import { DocumentRequirementModal } from '@/components/document-requirements/document-requirement-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeletePopover } from '@/components/ui/delete-popover';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
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
import { FileText, Pencil, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

interface Program {
    id: string;
    code: string;
    name: string;
}

interface DocumentRequirement {
    id: string;
    program_id: string;
    code: string;
    name: string;
    description: string | null;
    sort_order: number;
    is_required: boolean;
    is_active: boolean;
    program: {
        id: string;
        code: string;
        name: string;
    } | null;
}

interface Props {
    requirements: DocumentRequirement[];
    programs: Program[];
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Settings', href: '/settings/profile' },
    { title: 'Document Requirements', href: '/document-requirements' },
];

export default function Index({
    requirements,
    programs,
    canCreate,
    canEdit,
    canDelete,
}: Props) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRequirement, setSelectedRequirement] =
        useState<DocumentRequirement | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterProgramId, setFilterProgramId] = useState<string>('all');

    const filtered = useMemo(() => {
        return requirements.filter((r) => {
            const matchesProgram =
                filterProgramId === 'all' || r.program_id === filterProgramId;
            const matchesSearch =
                r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (r.description &&
                    r.description
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()));
            return matchesProgram && matchesSearch;
        });
    }, [requirements, filterProgramId, searchQuery]);

    const handleCreate = () => {
        setSelectedRequirement(null);
        setIsModalOpen(true);
    };

    const handleEdit = (req: DocumentRequirement) => {
        setSelectedRequirement(req);
        setIsModalOpen(true);
    };

    const handleDelete = (reqId: string) => {
        router.delete(route('document-requirements.destroy', reqId), {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Document Requirements" />

            <SettingsLayout wide>
                <DocumentRequirementModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    requirement={selectedRequirement}
                    programs={programs}
                    defaultProgramId={
                        filterProgramId !== 'all' ? filterProgramId : undefined
                    }
                />

                <div className="w-full py-8">
                    <div className="mx-auto w-full max-w-[95%]">
                        {/* Header */}
                        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                            <div>
                                <h2 className="text-xl font-semibold tracking-tight">
                                    Document Requirements
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Manage required documents per program that
                                    HEIs must upload.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Program filter */}
                                <Select
                                    value={filterProgramId}
                                    onValueChange={setFilterProgramId}
                                >
                                    <SelectTrigger className="w-44">
                                        <SelectValue placeholder="All programs" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            All Programs
                                        </SelectItem>
                                        {programs.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.code} — {p.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Search */}
                                <div className="relative w-56">
                                    <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        placeholder="Search requirements..."
                                        className="bg-background pl-9"
                                        value={searchQuery}
                                        onChange={(e) =>
                                            setSearchQuery(e.target.value)
                                        }
                                    />
                                </div>

                                {canCreate && (
                                    <Button
                                        onClick={handleCreate}
                                        className="bg-primary shadow-sm hover:bg-primary/90"
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Requirement
                                    </Button>
                                )}
                            </div>
                        </div>

                        <Table>
                            <TableHeader>
                                <TableRow className="border-b hover:bg-transparent">
                                    <TableHead className="h-9 w-16 pl-6 text-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        #
                                    </TableHead>
                                    <TableHead className="h-9 w-32 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Program
                                    </TableHead>
                                    <TableHead className="h-9 w-36 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Code
                                    </TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Requirement Name
                                    </TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Description
                                    </TableHead>
                                    <TableHead className="h-9 w-24 text-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Required
                                    </TableHead>
                                    <TableHead className="h-9 w-24 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Status
                                    </TableHead>
                                    <TableHead className="h-9 w-24 pr-6 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={8}
                                            className="py-12 text-center text-muted-foreground"
                                        >
                                            <div className="flex flex-col items-center gap-2">
                                                <FileText className="h-8 w-8 text-muted-foreground/50" />
                                                <p>
                                                    No document requirements
                                                    found.
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtered.map((req, index) => (
                                        <TableRow
                                            key={req.id}
                                            className="transition-colors hover:bg-muted/50"
                                        >
                                            <TableCell className="py-2 pl-6 text-center">
                                                <span className="font-mono text-sm text-muted-foreground">
                                                    {index + 1}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <Badge
                                                    variant="outline"
                                                    className="border-purple-200 bg-purple-50 font-mono text-xs text-purple-800"
                                                >
                                                    {req.program?.code ?? '—'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <span className="rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                                                    {req.code}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <span className="text-sm font-medium">
                                                    {req.name}
                                                </span>
                                            </TableCell>
                                            <TableCell className="max-w-xs py-2">
                                                <span className="line-clamp-1 text-sm text-muted-foreground">
                                                    {req.description || '—'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-2 text-center">
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        req.is_required
                                                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                                                            : 'border-gray-200 bg-gray-50 text-gray-600'
                                                    }
                                                >
                                                    {req.is_required
                                                        ? 'Required'
                                                        : 'Optional'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <Badge
                                                    className={`${
                                                        req.is_active
                                                            ? 'border-green-200 bg-green-100 text-green-700 hover:bg-green-200'
                                                            : 'border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    } shadow-none`}
                                                >
                                                    <span
                                                        className={`mr-2 h-1.5 w-1.5 rounded-full ${
                                                            req.is_active
                                                                ? 'bg-green-600'
                                                                : 'bg-gray-500'
                                                        }`}
                                                    />
                                                    {req.is_active
                                                        ? 'Active'
                                                        : 'Inactive'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-2 pr-6 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {canEdit && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                            onClick={() =>
                                                                handleEdit(req)
                                                            }
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {canDelete && (
                                                        <DeletePopover
                                                            itemName={req.name}
                                                            onConfirm={() =>
                                                                handleDelete(
                                                                    req.id,
                                                                )
                                                            }
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
