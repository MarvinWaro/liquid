import React, { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RegionModal } from '@/components/regions/region-modal';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Card,
    CardContent,
} from '@/components/ui/card';
import { DeletePopover } from '@/components/ui/delete-popover';
import { Badge } from '@/components/ui/badge';
import {
    Plus,
    Pencil,
    MapPin,
    Search,
} from 'lucide-react';

interface Region {
    id: string;
    code: string;
    name: string;
    description?: string;
    status: string;
    created_at: string;
}

interface Props {
    auth: {
        user: any;
    };
    regions: Region[];
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Settings', href: '/settings/profile' },
    { title: 'Regions', href: '/regions' },
];

export default function Index({ auth, regions, canCreate, canEdit, canDelete }: Props) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter regions based on search
    const filteredRegions = regions.filter(region =>
        region.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        region.code.toLowerCase().includes(searchQuery.toLowerCase())
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

            <div className="py-8 w-full">
                <div className="w-full max-w-[95%] mx-auto">

                    {/* Header Section */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight">Region Management</h2>
                            <p className="text-muted-foreground mt-1">
                                Manage regions and their information.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Search Input */}
                            <div className="relative w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search regions..."
                                    className="pl-9 bg-background"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            {canCreate && (
                                <Button onClick={handleCreate} className="bg-primary hover:bg-primary/90 shadow-sm">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Region
                                </Button>
                            )}
                        </div>
                    </div>

                    <Card className="shadow-sm border-border/50">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="pl-6 h-12">Region</TableHead>
                                        <TableHead>Code</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right pr-6">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRegions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                                <div className="flex flex-col items-center gap-2">
                                                    <MapPin className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>No regions found matching your search.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredRegions.map((region) => (
                                            <TableRow key={region.id} className="hover:bg-muted/50 transition-colors">
                                                <TableCell className="pl-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                                                            <MapPin className="h-4 w-4" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-sm">
                                                                {region.name}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="font-mono">
                                                        {region.code}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {region.description ? (
                                                        <span className="text-sm">{region.description}</span>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        className={`${
                                                            region.status === 'active'
                                                                ? 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200'
                                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200'
                                                        } shadow-none`}
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full mr-2 ${
                                                            region.status === 'active' ? 'bg-green-600' : 'bg-gray-500'
                                                        }`}></span>
                                                        {region.status === 'active' ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {canEdit && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                                onClick={() => handleEdit(region)}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        )}

                                                        {canDelete && (
                                                            <DeletePopover
                                                                itemName={region.name}
                                                                onConfirm={() => handleDelete(region.id)}
                                                            />
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
            </SettingsLayout>
        </AppLayout>
    );
}
