import { RegionModal } from '@/components/regions/region-modal';
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
import { MapPin, Pencil, Plus, Search } from 'lucide-react';
import { useState } from 'react';

interface Region {
    id: string;
    code: string;
    name: string;
    description?: string;
    status: string;
    created_at: string;
}

interface Props {
    regions: Region[];
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Settings', href: '/settings/profile' },
    { title: 'Regions', href: '/regions' },
];

export default function Index({
    regions,
    canCreate,
    canEdit,
    canDelete,
}: Props) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Client-side filter — instant, no reload
    const filteredRegions = regions.filter(
        (region) =>
            region.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            region.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (region.description &&
                region.description
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase())),
    );

    const handleDelete = (regionId: string) => {
        router.delete(route('regions.destroy', regionId), {
            preserveScroll: true,
        });
    };

    const handleCreate = () => {
        setSelectedRegion(null);
        setIsModalOpen(true);
    };

    const handleEdit = (region: Region) => {
        setSelectedRegion(region);
        setIsModalOpen(true);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Region Management" />

            <SettingsLayout wide>
                <RegionModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    region={selectedRegion}
                />

                <div className="w-full py-8">
                    <div className="mx-auto w-full max-w-[95%]">
                        {/* Header Section */}
                        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                            <div>
                                <h2 className="text-xl font-semibold tracking-tight">
                                    Region Management
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Manage regions and their information.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative w-64">
                                    <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        placeholder="Search regions..."
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
                                        Add Region
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-b hover:bg-transparent">
                                    <TableHead className="h-9 pl-6 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Region
                                    </TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Code
                                    </TableHead>
                                    <TableHead className="h-9 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Description
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
                                {filteredRegions.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={5}
                                            className="py-12 text-center text-muted-foreground"
                                        >
                                            <div className="flex flex-col items-center gap-2">
                                                <MapPin className="h-8 w-8 text-muted-foreground/50" />
                                                <p>
                                                    No regions found matching
                                                    your search.
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRegions.map((region) => (
                                        <TableRow
                                            key={region.id}
                                            className="transition-colors hover:bg-muted/50"
                                        >
                                            <TableCell className="py-2 pl-6">
                                                <span className="text-sm font-medium">
                                                    {region.name}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <Badge
                                                    variant="outline"
                                                    className="font-mono"
                                                >
                                                    {region.code}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                {region.description ? (
                                                    <span className="text-sm">
                                                        {region.description}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">
                                                        -
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <Badge
                                                    className={`${
                                                        region.status ===
                                                        'active'
                                                            ? 'border-green-200 bg-green-100 text-green-700 hover:bg-green-200'
                                                            : 'border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    } shadow-none`}
                                                >
                                                    <span
                                                        className={`mr-2 h-1.5 w-1.5 rounded-full ${
                                                            region.status ===
                                                            'active'
                                                                ? 'bg-green-600'
                                                                : 'bg-gray-500'
                                                        }`}
                                                    ></span>
                                                    {region.status === 'active'
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
                                                                handleEdit(
                                                                    region,
                                                                )
                                                            }
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    )}

                                                    {canDelete && (
                                                        <DeletePopover
                                                            itemName={
                                                                region.name
                                                            }
                                                            onConfirm={() =>
                                                                handleDelete(
                                                                    region.id,
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
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
