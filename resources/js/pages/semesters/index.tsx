import { SemesterModal } from '@/components/semesters/semester-modal';
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
import { Calendar, Pencil, Plus, Search } from 'lucide-react';
import { useState } from 'react';

interface Semester {
    id: string;
    code: string;
    name: string;
    sort_order: number;
    is_active: boolean;
    liquidations_count: number;
}

interface Props {
    semesters: Semester[];
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Settings', href: '/settings/profile' },
    { title: 'Semesters', href: '/semesters' },
];

export default function Index({ semesters, canCreate, canEdit, canDelete }: Props) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSemester, setSelectedSemester] = useState<Semester | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredSemesters = semesters.filter(
        (s) =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.code.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const handleCreate = () => {
        setSelectedSemester(null);
        setIsModalOpen(true);
    };

    const handleEdit = (semester: Semester) => {
        setSelectedSemester(semester);
        setIsModalOpen(true);
    };

    const handleDelete = (semesterId: string) => {
        router.delete(route('semesters.destroy', semesterId), {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Semesters" />

            <SettingsLayout wide>
                <SemesterModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    semester={selectedSemester}
                />

                <div className="w-full py-8">
                    <div className="mx-auto w-full max-w-[95%]">
                        {/* Header */}
                        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                            <div>
                                <h2 className="text-xl font-semibold tracking-tight">
                                    Semesters
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Manage academic semester periods.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative w-64">
                                    <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        placeholder="Search semesters..."
                                        className="bg-background pl-9"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                {canCreate && (
                                    <Button
                                        onClick={handleCreate}
                                        className="bg-primary shadow-sm hover:bg-primary/90"
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Semester
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-b hover:bg-transparent">
                                        <TableHead className="h-9 w-24 pl-6 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                            Code
                                        </TableHead>
                                        <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                            Name
                                        </TableHead>
                                        <TableHead className="h-9 w-28 text-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                            Sort Order
                                        </TableHead>
                                        <TableHead className="h-9 w-32 text-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                            Liquidations
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
                                    {filteredSemesters.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={6}
                                                className="py-12 text-center text-muted-foreground"
                                            >
                                                <div className="flex flex-col items-center gap-2">
                                                    <Calendar className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>No semesters found.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredSemesters.map((semester) => (
                                            <TableRow
                                                key={semester.id}
                                                className="transition-colors hover:bg-muted/50"
                                            >
                                                <TableCell className="py-2 pl-6">
                                                    <span className="font-mono text-sm font-semibold text-primary">
                                                        {semester.code}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <span className="text-sm font-medium">
                                                        {semester.name}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-2 text-center">
                                                    <span className="text-sm text-muted-foreground">
                                                        {semester.sort_order}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-2 text-center">
                                                    <Badge
                                                        variant="outline"
                                                        className="border-blue-200 bg-blue-50 text-blue-800"
                                                    >
                                                        {semester.liquidations_count}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <Badge
                                                        className={`${
                                                            semester.is_active
                                                                ? 'border-green-200 bg-green-100 text-green-700 hover:bg-green-200'
                                                                : 'border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                        } shadow-none`}
                                                    >
                                                        <span
                                                            className={`mr-2 h-1.5 w-1.5 rounded-full ${
                                                                semester.is_active
                                                                    ? 'bg-green-600'
                                                                    : 'bg-gray-500'
                                                            }`}
                                                        />
                                                        {semester.is_active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="py-2 pr-6 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {canEdit && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                                onClick={() => handleEdit(semester)}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        {canDelete && (
                                                            <DeletePopover
                                                                itemName={semester.name}
                                                                onConfirm={() => handleDelete(semester.id)}
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
