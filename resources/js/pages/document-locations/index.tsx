import { DocumentLocationModal } from '@/components/document-locations/document-location-modal';
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
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Archive, Lock, Pencil, Plus, Search } from 'lucide-react';
import { useState } from 'react';

interface DocumentLocation {
    id: string;
    name: string;
    sort_order: number;
    is_active: boolean;
    transmittals_count: number;
    tracking_entries_count: number;
}

interface Props {
    locations: DocumentLocation[];
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Settings', href: '/settings/profile' },
    { title: 'Document Locations', href: '/document-locations' },
];

export default function Index({
    locations,
    canCreate,
    canEdit,
    canDelete,
}: Props) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedLocation, setSelectedLocation] =
        useState<DocumentLocation | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredLocations = locations.filter((location) =>
        location.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const handleCreate = () => {
        setSelectedLocation(null);
        setIsModalOpen(true);
    };

    const handleEdit = (location: DocumentLocation) => {
        setSelectedLocation(location);
        setIsModalOpen(true);
    };

    const handleDelete = (locationId: string) => {
        router.delete(route('document-locations.destroy', locationId), {
            preserveScroll: true,
        });
    };

    /** Records filed here. Non-zero means deleting is refused server-side. */
    const usageOf = (location: DocumentLocation) =>
        location.transmittals_count + location.tracking_entries_count;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Document Locations" />

            <SettingsLayout wide>
                <DocumentLocationModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    location={selectedLocation}
                />

                <div className="w-full py-8">
                    <div className="mx-auto w-full max-w-[95%]">
                        {/* Header */}
                        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                            <div>
                                <h2 className="text-xl font-semibold tracking-tight">
                                    Document Locations
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Shelf positions where liquidation documents
                                    are filed.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative w-64">
                                    <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        placeholder="Search locations..."
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
                                        className="bg-foreground text-background shadow-sm hover:bg-foreground/90"
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Location
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-b hover:bg-transparent">
                                        <TableHead className="h-9 pl-6 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                            Name
                                        </TableHead>
                                        <TableHead className="h-9 w-28 text-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                            Sort Order
                                        </TableHead>
                                        <TableHead className="h-9 w-32 text-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                            Filed Here
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
                                    {filteredLocations.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={5}
                                                className="py-12 text-center text-muted-foreground"
                                            >
                                                <div className="flex flex-col items-center gap-2">
                                                    <Archive className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>No locations found.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredLocations.map((location) => {
                                            const usage = usageOf(location);

                                            return (
                                                <TableRow
                                                    key={location.id}
                                                    className="transition-colors hover:bg-muted/50"
                                                >
                                                    <TableCell className="py-2 pl-6">
                                                        <span className="text-sm font-medium">
                                                            {location.name}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-center">
                                                        <span className="text-sm text-muted-foreground">
                                                            {
                                                                location.sort_order
                                                            }
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-center">
                                                        <Badge
                                                            variant="outline"
                                                            className="border-border bg-muted text-foreground"
                                                        >
                                                            {usage}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <Badge
                                                            className={`${
                                                                location.is_active
                                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-400'
                                                                    : 'border-border bg-muted text-muted-foreground'
                                                            } shadow-none`}
                                                        >
                                                            <span
                                                                className={`mr-2 h-1.5 w-1.5 rounded-full ${
                                                                    location.is_active
                                                                        ? 'bg-emerald-500'
                                                                        : 'bg-muted-foreground/50'
                                                                }`}
                                                            />
                                                            {location.is_active
                                                                ? 'Active'
                                                                : 'Archived'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="py-2 pr-6 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {canEdit && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                                    onClick={() =>
                                                                        handleEdit(
                                                                            location,
                                                                        )
                                                                    }
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                            {canDelete &&
                                                                (usage > 0 ? (
                                                                    /* Deleting is refused server-side while
                                                                       records are filed here, so say why
                                                                       rather than offering a button that
                                                                       only ever returns an error. */
                                                                    <Tooltip>
                                                                        <TooltipTrigger
                                                                            asChild
                                                                        >
                                                                            <span className="flex h-8 w-8 items-center justify-center text-muted-foreground/50">
                                                                                <Lock className="h-4 w-4" />
                                                                            </span>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            In
                                                                            use
                                                                            by{' '}
                                                                            {
                                                                                usage
                                                                            }{' '}
                                                                            record
                                                                            {usage ===
                                                                            1
                                                                                ? ''
                                                                                : 's'}{' '}
                                                                            —
                                                                            archive
                                                                            it
                                                                            instead
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                ) : (
                                                                    <DeletePopover
                                                                        itemName={
                                                                            location.name
                                                                        }
                                                                        onConfirm={() =>
                                                                            handleDelete(
                                                                                location.id,
                                                                            )
                                                                        }
                                                                    />
                                                                ))}
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
