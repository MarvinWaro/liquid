import { AcademicYearModal } from '@/components/academic-years/academic-year-modal';
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
import { Head, Link, router } from '@inertiajs/react';
import { GrabIcon, GraduationCap, Pencil, Plus, Search, Settings2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Sortable from 'sortablejs';

interface AcademicYear {
    id: string;
    code: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    sort_order: number;
    is_active: boolean;
    liquidations_count: number;
}

interface Props {
    academicYears: AcademicYear[];
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canManageRequirements: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Settings', href: '/settings/profile' },
    { title: 'Academic Years', href: '/academic-years' },
];

export default function Index({ academicYears, canCreate, canEdit, canDelete, canManageRequirements }: Props) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAcademicYear, setSelectedAcademicYear] = useState<AcademicYear | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [items, setItems] = useState<AcademicYear[]>(academicYears);
    const tbodyRef = useRef<HTMLTableSectionElement>(null);
    const sortableRef = useRef<Sortable | null>(null);

    // Sync items when server data changes
    useEffect(() => {
        setItems(academicYears);
    }, [academicYears]);

    const isFiltering = searchQuery.trim().length > 0;

    const filteredItems = isFiltering
        ? items.filter(
            (ay) =>
                ay.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                ay.code.toLowerCase().includes(searchQuery.toLowerCase()),
          )
        : items;

    // Initialize SortableJS
    useEffect(() => {
        if (!tbodyRef.current || !canEdit) return;

        sortableRef.current = Sortable.create(tbodyRef.current, {
            animation: 200,
            handle: '.drag-handle',
            ghostClass: 'opacity-30',
            chosenClass: 'bg-muted/80',
            disabled: isFiltering,
            onEnd: (evt) => {
                if (evt.oldIndex === undefined || evt.newIndex === undefined) return;
                if (evt.oldIndex === evt.newIndex) return;

                setItems(prev => {
                    const updated = [...prev];
                    const [moved] = updated.splice(evt.oldIndex!, 1);
                    updated.splice(evt.newIndex!, 0, moved);
                    return updated;
                });
            },
        });

        return () => {
            sortableRef.current?.destroy();
        };
    }, [canEdit, isFiltering]);

    // Persist new order to backend after drag
    const prevItemsRef = useRef<string>(JSON.stringify(academicYears.map(a => a.id)));
    useEffect(() => {
        const currentIds = JSON.stringify(items.map(a => a.id));
        if (currentIds !== prevItemsRef.current) {
            prevItemsRef.current = currentIds;
            router.post(route('academic-years.reorder'), {
                ids: items.map(a => a.id),
            }, {
                preserveScroll: true,
                preserveState: true,
            });
        }
    }, [items]);

    const handleCreate = () => {
        setSelectedAcademicYear(null);
        setIsModalOpen(true);
    };

    const handleEdit = useCallback((academicYear: AcademicYear) => {
        setSelectedAcademicYear(academicYear);
        setIsModalOpen(true);
    }, []);

    const handleDelete = useCallback((academicYearId: string) => {
        router.delete(route('academic-years.destroy', academicYearId), {
            preserveScroll: true,
        });
    }, []);

    const formatDate = (date: string | null) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Academic Years" />

            <SettingsLayout wide>
                <AcademicYearModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    academicYear={selectedAcademicYear}
                />

                <div className="w-full py-8">
                    <div className="mx-auto w-full max-w-[95%]">
                        {/* Header */}
                        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                            <div>
                                <h2 className="text-xl font-semibold tracking-tight">
                                    Academic Years
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Manage academic year periods for liquidations.
                                    {canEdit && !isFiltering && (
                                        <span className="ml-1 text-xs text-muted-foreground/70">
                                            Drag rows to reorder.
                                        </span>
                                    )}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative w-64">
                                    <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        placeholder="Search academic years..."
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
                                        Add Academic Year
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-b hover:bg-transparent">
                                        {canEdit && (
                                            <TableHead className="h-9 w-10 pl-3 text-xs font-medium tracking-wider text-muted-foreground uppercase" />
                                        )}
                                        <TableHead className="h-9 w-32 pl-6 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                            Code
                                        </TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                            Name
                                        </TableHead>
                                        <TableHead className="h-9 w-32 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                            Start Date
                                        </TableHead>
                                        <TableHead className="h-9 w-32 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                            End Date
                                        </TableHead>
                                        <TableHead className="h-9 w-32 text-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                            Liquidations
                                        </TableHead>
                                        <TableHead className="h-9 w-28 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                            Status
                                        </TableHead>
                                        <TableHead className="h-9 w-36 pr-6 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                            Actions
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody ref={tbodyRef}>
                                    {filteredItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={canEdit ? 8 : 7}
                                                className="py-12 text-center text-muted-foreground"
                                            >
                                                <div className="flex flex-col items-center gap-2">
                                                    <GraduationCap className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>No academic years found.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredItems.map((ay) => (
                                            <TableRow
                                                key={ay.id}
                                                data-id={ay.id}
                                                className="transition-colors hover:bg-muted/50"
                                            >
                                                {canEdit && (
                                                    <TableCell className="py-2 pl-3 w-10">
                                                        {!isFiltering && (
                                                            <GrabIcon className="drag-handle h-4 w-4 cursor-grab text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing" />
                                                        )}
                                                    </TableCell>
                                                )}
                                                <TableCell className="py-2 pl-6">
                                                    <span className="font-mono text-sm font-semibold text-foreground">
                                                        {ay.code}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <span className="text-sm font-medium">
                                                        {ay.name}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <span className="text-sm text-muted-foreground">
                                                        {formatDate(ay.start_date)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <span className="text-sm text-muted-foreground">
                                                        {formatDate(ay.end_date)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-2 text-center">
                                                    <Badge
                                                        variant="outline"
                                                        className="border-border bg-muted text-foreground"
                                                    >
                                                        {ay.liquidations_count}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <Badge
                                                        className={`${
                                                            ay.is_active
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60'
                                                                : 'bg-muted text-muted-foreground border-border'
                                                        } shadow-none`}
                                                    >
                                                        <span
                                                            className={`mr-2 h-1.5 w-1.5 rounded-full ${
                                                                ay.is_active
                                                                    ? 'bg-emerald-500'
                                                                    : 'bg-muted-foreground/50'
                                                            }`}
                                                        />
                                                        {ay.is_active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="py-2 pr-6 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {canManageRequirements && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                                title="Configure requirements"
                                                                asChild
                                                            >
                                                                <Link href={route('academic-years.requirements.index', ay.id)}>
                                                                    <Settings2 className="h-4 w-4" />
                                                                </Link>
                                                            </Button>
                                                        )}
                                                        {canEdit && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                                onClick={() => handleEdit(ay)}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        {canDelete && (
                                                            <DeletePopover
                                                                itemName={ay.name}
                                                                onConfirm={() => handleDelete(ay.id)}
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
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
