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
import { GraduationCap, Pencil, Plus, Search, Settings2 } from 'lucide-react';
import { useState } from 'react';

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

    const filteredAcademicYears = academicYears.filter(
        (ay) =>
            ay.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ay.code.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const handleCreate = () => {
        setSelectedAcademicYear(null);
        setIsModalOpen(true);
    };

    const handleEdit = (academicYear: AcademicYear) => {
        setSelectedAcademicYear(academicYear);
        setIsModalOpen(true);
    };

    const handleDelete = (academicYearId: string) => {
        router.delete(route('academic-years.destroy', academicYearId), {
            preserveScroll: true,
        });
    };

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
                                <TableBody>
                                    {filteredAcademicYears.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={7}
                                                className="py-12 text-center text-muted-foreground"
                                            >
                                                <div className="flex flex-col items-center gap-2">
                                                    <GraduationCap className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>No academic years found.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredAcademicYears.map((ay) => (
                                            <TableRow
                                                key={ay.id}
                                                className="transition-colors hover:bg-muted/50"
                                            >
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
