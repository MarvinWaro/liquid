import { HEIModal } from '@/components/hei/hei-modal';
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
import { Building2, Pencil, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

interface HEI {
    id: string;
    uii: string;
    name: string;
    type: string;
    code?: string;
    region_id?: string | null;
    region?: {
        id: string;
        code: string;
        name: string;
    } | null;
    status: string;
    created_at: string;
}

interface Region {
    id: string;
    code: string;
    name: string;
}

interface Props {
    heis: HEI[];
    regions: Region[];
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Settings', href: '/settings/profile' },
    { title: 'HEI', href: '/hei' },
];

export default function Index({
    heis,
    regions,
    canCreate,
    canEdit,
    canDelete,
}: Props) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedHEI, setSelectedHEI] = useState<HEI | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [regionFilter, setRegionFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const perPage = 15;

    // Reset to page 1 whenever any filter changes
    const handleSearch = (val: string) => {
        setSearchQuery(val);
        setCurrentPage(1);
    };
    const handleTypeFilter = (val: string) => {
        setTypeFilter(val);
        setCurrentPage(1);
    };
    const handleRegionFilter = (val: string) => {
        setRegionFilter(val);
        setCurrentPage(1);
    };
    const handleStatusFilter = (val: string) => {
        setStatusFilter(val);
        setCurrentPage(1);
    };

    // Client-side filtering — instant, no reload
    const filteredHEIs = useMemo(() => {
        return heis.filter((hei) => {
            const matchesSearch =
                searchQuery === '' ||
                hei.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                hei.uii.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (hei.region?.name &&
                    hei.region.name
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()));

            const matchesType = typeFilter === 'all' || hei.type === typeFilter;
            const matchesRegion =
                regionFilter === 'all' || hei.region_id === regionFilter;
            const matchesStatus =
                statusFilter === 'all' || hei.status === statusFilter;

            return (
                matchesSearch && matchesType && matchesRegion && matchesStatus
            );
        });
    }, [heis, searchQuery, typeFilter, regionFilter, statusFilter]);

    const totalPages = Math.ceil(filteredHEIs.length / perPage);
    const paginatedHEIs = filteredHEIs.slice(
        (currentPage - 1) * perPage,
        currentPage * perPage,
    );

    const getTypeBadgeColor = (type: string) => {
        switch (type) {
            case 'Private':
                return 'border-blue-200 bg-blue-50 text-blue-900';
            case 'SUC':
                return 'border-green-200 bg-green-50 text-green-900';
            case 'LUC':
                return 'border-purple-200 bg-purple-50 text-purple-900';
            default:
                return 'border-gray-200 bg-gray-50 text-gray-900';
        }
    };

    const getFullTypeName = (type: string) => {
        switch (type) {
            case 'SUC':
                return 'State University Colleges';
            case 'LUC':
                return 'Local University Colleges';
            default:
                return type;
        }
    };

    const handleDelete = (heiId: string) => {
        router.delete(route('hei.destroy', heiId), {
            preserveScroll: true,
        });
    };

    const handleCreate = () => {
        setSelectedHEI(null);
        setIsModalOpen(true);
    };

    const handleEdit = (hei: HEI) => {
        setSelectedHEI(hei);
        setIsModalOpen(true);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="HEI Management" />

            <SettingsLayout wide>
                <HEIModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    hei={selectedHEI}
                    regions={regions}
                />

                <div className="w-full py-8">
                    <div className="mx-auto w-full max-w-[95%]">
                        {/* Header Section */}
                        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                            <div>
                                <h2 className="text-xl font-semibold tracking-tight">
                                    HEI Management
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Manage Higher Education Institutions and
                                    their information.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative w-64">
                                    <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        placeholder="Search HEI..."
                                        className="bg-background pl-9"
                                        value={searchQuery}
                                        onChange={(e) =>
                                            handleSearch(e.target.value)
                                        }
                                    />
                                </div>
                                {canCreate && (
                                    <Button
                                        onClick={handleCreate}
                                        className="bg-primary shadow-sm hover:bg-primary/90"
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add HEI
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Filters Row */}
                        <div className="mb-4 flex flex-wrap gap-3">
                            <Select
                                value={typeFilter}
                                onValueChange={handleTypeFilter}
                            >
                                <SelectTrigger className="w-40 bg-background">
                                    <SelectValue placeholder="All Types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        All Types
                                    </SelectItem>
                                    <SelectItem value="Private">
                                        Private
                                    </SelectItem>
                                    <SelectItem value="SUC">SUC</SelectItem>
                                    <SelectItem value="LUC">LUC</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select
                                value={regionFilter}
                                onValueChange={handleRegionFilter}
                            >
                                <SelectTrigger className="w-44 bg-background">
                                    <SelectValue placeholder="All Regions" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        All Regions
                                    </SelectItem>
                                    {regions.map((r) => (
                                        <SelectItem key={r.id} value={r.id}>
                                            {r.code} — {r.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select
                                value={statusFilter}
                                onValueChange={handleStatusFilter}
                            >
                                <SelectTrigger className="w-36 bg-background">
                                    <SelectValue placeholder="All Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        All Status
                                    </SelectItem>
                                    <SelectItem value="active">
                                        Active
                                    </SelectItem>
                                    <SelectItem value="inactive">
                                        Inactive
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="overflow-hidden rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-b hover:bg-transparent">
                                    <TableHead className="h-9 pl-6 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        UII
                                    </TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        HEI Name
                                    </TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Type
                                    </TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Region
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
                                {paginatedHEIs.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="py-12 text-center text-muted-foreground"
                                        >
                                            <div className="flex flex-col items-center gap-2">
                                                <Building2 className="h-8 w-8 text-muted-foreground/50" />
                                                <p>
                                                    No HEI found matching your
                                                    search.
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedHEIs.map((hei) => (
                                        <TableRow
                                            key={hei.id}
                                            className="transition-colors hover:bg-muted/50"
                                        >
                                            <TableCell className="py-2 pl-6">
                                                <span className="font-mono text-sm text-muted-foreground">
                                                    {hei.uii}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <span className="text-sm font-medium">
                                                    {hei.name}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={`${getTypeBadgeColor(hei.type)} font-medium`}
                                                    title={getFullTypeName(
                                                        hei.type,
                                                    )}
                                                >
                                                    {hei.type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {hei.region ? (
                                                    <span className="text-sm">
                                                        {hei.region.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">
                                                        -
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    className={`${
                                                        hei.status === 'active'
                                                            ? 'border-green-200 bg-green-100 text-green-700 hover:bg-green-200'
                                                            : 'border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    } shadow-none`}
                                                >
                                                    <span
                                                        className={`mr-2 h-1.5 w-1.5 rounded-full ${
                                                            hei.status ===
                                                            'active'
                                                                ? 'bg-green-600'
                                                                : 'bg-gray-500'
                                                        }`}
                                                    ></span>
                                                    {hei.status === 'active'
                                                        ? 'Active'
                                                        : 'Inactive'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="pr-6 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {canEdit && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                            onClick={() =>
                                                                handleEdit(hei)
                                                            }
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    )}

                                                    {canDelete && (
                                                        <DeletePopover
                                                            itemName={hei.name}
                                                            onConfirm={() =>
                                                                handleDelete(
                                                                    hei.id,
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

                        {/* Pagination Footer */}
                        <div className="flex items-center justify-between border-t px-4 py-3">
                            <div className="text-sm text-muted-foreground">
                                {filteredHEIs.length > 0 ? (
                                    <>
                                        Showing{' '}
                                        <span className="font-semibold">
                                            {(currentPage - 1) * perPage + 1}
                                        </span>{' '}
                                        -{' '}
                                        <span className="font-semibold">
                                            {Math.min(
                                                currentPage * perPage,
                                                filteredHEIs.length,
                                            )}
                                        </span>{' '}
                                        of{' '}
                                        <span className="font-semibold">
                                            {filteredHEIs.length}
                                        </span>{' '}
                                        records
                                    </>
                                ) : (
                                    <span>No records found</span>
                                )}
                            </div>

                            {totalPages > 1 && (
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCurrentPage((p) =>
                                                Math.max(1, p - 1),
                                            )
                                        }
                                        disabled={currentPage === 1}
                                        className="h-8 px-3"
                                    >
                                        &laquo;
                                    </Button>
                                    {Array.from(
                                        { length: totalPages },
                                        (_, i) => i + 1,
                                    )
                                        .filter(
                                            (page) =>
                                                page === 1 ||
                                                page === totalPages ||
                                                Math.abs(page - currentPage) <=
                                                    1,
                                        )
                                        .reduce<(number | '...')[]>(
                                            (acc, page, idx, arr) => {
                                                if (
                                                    idx > 0 &&
                                                    (page as number) -
                                                        (arr[
                                                            idx - 1
                                                        ] as number) >
                                                        1
                                                )
                                                    acc.push('...');
                                                acc.push(page);
                                                return acc;
                                            },
                                            [],
                                        )
                                        .map((item, idx) =>
                                            item === '...' ? (
                                                <span
                                                    key={`ellipsis-${idx}`}
                                                    className="flex h-8 items-center px-2 text-muted-foreground"
                                                >
                                                    …
                                                </span>
                                            ) : (
                                                <Button
                                                    key={item}
                                                    variant={
                                                        currentPage === item
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    size="sm"
                                                    onClick={() =>
                                                        setCurrentPage(
                                                            item as number,
                                                        )
                                                    }
                                                    className="h-8 min-w-[32px]"
                                                >
                                                    {item}
                                                </Button>
                                            ),
                                        )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCurrentPage((p) =>
                                                Math.min(totalPages, p + 1),
                                            )
                                        }
                                        disabled={currentPage === totalPages}
                                        className="h-8 px-3"
                                    >
                                        &raquo;
                                    </Button>
                                </div>
                            )}
                        </div>
                        </div>
                    </div>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
