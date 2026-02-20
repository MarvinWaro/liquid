import React, { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HEIModal } from '@/components/hei/hei-modal';
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
    Building2,
    Search,
} from 'lucide-react';

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
    auth: {
        user: any;
    };
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

export default function Index({ auth, heis, regions, canCreate, canEdit, canDelete }: Props) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedHEI, setSelectedHEI] = useState<HEI | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Get type badge color
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

    // Get full type name
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

    // Filter HEIs based on search
    const filteredHEIs = heis.filter(hei =>
        hei.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (hei.uii && hei.uii.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (hei.code && hei.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        hei.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (hei.region?.name && hei.region.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

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

            <div className="py-8 w-full">
                <div className="w-full max-w-[95%] mx-auto">

                    {/* Header Section */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight">HEI Management</h2>
                            <p className="text-muted-foreground mt-1">
                                Manage Higher Education Institutions and their information.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Search Input */}
                            <div className="relative w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search HEI..."
                                    className="pl-9 bg-background"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            {canCreate && (
                                <Button onClick={handleCreate} className="bg-primary hover:bg-primary/90 shadow-sm">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add HEI
                                </Button>
                            )}
                        </div>
                    </div>

                    <Card className="shadow-sm border-border/50">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="pl-6 h-12">UII</TableHead>
                                        <TableHead>HEI Name</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Region</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right pr-6">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredHEIs.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Building2 className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>No HEI found matching your search.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredHEIs.map((hei) => (
                                            <TableRow key={hei.id} className="hover:bg-muted/50 transition-colors">
                                                <TableCell className="pl-6 py-4">
                                                    <span className="text-sm font-mono text-muted-foreground">
                                                        {hei.uii}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                                                            <Building2 className="h-4 w-4" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-sm">
                                                                {hei.name}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={`${getTypeBadgeColor(hei.type)} font-medium`}
                                                        title={getFullTypeName(hei.type)}
                                                    >
                                                        {hei.type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {hei.region ? (
                                                        <span className="text-sm">{hei.region.name}</span>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        className={`${
                                                            hei.status === 'active'
                                                                ? 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200'
                                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200'
                                                        } shadow-none`}
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full mr-2 ${
                                                            hei.status === 'active' ? 'bg-green-600' : 'bg-gray-500'
                                                        }`}></span>
                                                        {hei.status === 'active' ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {canEdit && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                                onClick={() => handleEdit(hei)}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        )}

                                                        {canDelete && (
                                                            <DeletePopover
                                                                itemName={hei.name}
                                                                onConfirm={() => handleDelete(hei.id)}
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
