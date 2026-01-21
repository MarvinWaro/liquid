import React, { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, router, Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
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
    Card,
    CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, FileText, Eye } from 'lucide-react';
import { LiquidationCreateModal } from '@/components/liquidation/liquidation-create-modal';

interface HEI {
    id: number;
    name: string;
    code: string;
}

interface Liquidation {
    id: number;
    reference_number: string;
    hei: HEI;
    disbursed_amount: string;
    liquidated_amount: string;
    status: string;
    status_label: string;
    status_badge: string;
    created_at: string;
    created_by: string;
    reviewed_by: string | null;
    accountant_reviewed_by: string | null;
}

interface Props {
    auth: {
        user: any;
    };
    liquidations: {
        data: Liquidation[];
        links: any[];
        meta: any;
    };
    heis: HEI[];
    filters: {
        search?: string;
    };
    permissions: {
        create: boolean;
        edit: boolean;
        delete: boolean;
        review: boolean;
        endorse: boolean;
    };
    userRole: string;
}

export default function Index({ auth, liquidations, heis, filters, permissions, userRole }: Props) {
    const [searchQuery, setSearchQuery] = useState(filters.search || '');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(route('liquidation.index'), { search: searchQuery }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const getBadgeVariant = (badge: string) => {
        const variants: Record<string, any> = {
            'secondary': 'secondary',
            'warning': 'default',
            'destructive': 'destructive',
            'info': 'default',
            'success': 'default',
        };
        return variants[badge] || 'secondary';
    };

    return (
        <AppLayout>
            <Head title="Liquidation Management" />

            <LiquidationCreateModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                heis={heis}
            />

            <div className="py-8 w-full">
                <div className="w-full max-w-[95%] mx-auto">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Liquidation Management</h1>
                            <p className="text-muted-foreground mt-1">
                                {userRole === 'Regional Coordinator' && 'Review and endorse liquidations to Accounting'}
                                {userRole === 'Accountant' && 'Review and endorse liquidations to COA'}
                                {!['Regional Coordinator', 'Accountant'].includes(userRole) && 'Manage liquidation records and submissions'}
                            </p>
                        </div>
                        {permissions.create && (
                            <Button onClick={() => setIsCreateModalOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Liquidation
                            </Button>
                        )}
                    </div>

                    <Card>
                        <CardContent className="pt-6">
                            <form onSubmit={handleSearch} className="mb-4">
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="search"
                                            placeholder="Search by reference number or HEI name..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-8"
                                        />
                                    </div>
                                    <Button type="submit">Search</Button>
                                </div>
                            </form>

                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Reference #</TableHead>
                                            <TableHead>HEI</TableHead>
                                            <TableHead className="text-right">Disbursed Amount</TableHead>
                                            <TableHead className="text-right">Liquidated Amount</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Created By</TableHead>
                                            <TableHead>Date Created</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {liquidations.data.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                                    <FileText className="mx-auto h-12 w-12 mb-2 opacity-50" />
                                                    <p>No liquidation records found</p>
                                                    {permissions.create && (
                                                        <Button
                                                            variant="link"
                                                            onClick={() => setIsCreateModalOpen(true)}
                                                            className="mt-2"
                                                        >
                                                            Create your first liquidation
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            liquidations.data.map((liquidation) => (
                                                <TableRow key={liquidation.id}>
                                                    <TableCell className="font-medium">
                                                        {liquidation.reference_number}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div>
                                                            <div className="font-medium">{liquidation.hei.name}</div>
                                                            <div className="text-xs text-muted-foreground">{liquidation.hei.code}</div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        ₱{liquidation.disbursed_amount}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        ₱{liquidation.liquidated_amount}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={getBadgeVariant(liquidation.status_badge)}>
                                                            {liquidation.status_label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-sm">{liquidation.created_by}</div>
                                                        {liquidation.reviewed_by && (
                                                            <div className="text-xs text-muted-foreground">
                                                                RC: {liquidation.reviewed_by}
                                                            </div>
                                                        )}
                                                        {liquidation.accountant_reviewed_by && (
                                                            <div className="text-xs text-muted-foreground">
                                                                Acct: {liquidation.accountant_reviewed_by}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{liquidation.created_at}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Link href={route('liquidation.edit', liquidation.id)}>
                                                            <Button variant="ghost" size="sm">
                                                                <Eye className="h-4 w-4 mr-1" />
                                                                View
                                                            </Button>
                                                        </Link>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {liquidations.data.length > 0 && liquidations.links && (
                                <div className="flex items-center justify-center gap-2 mt-4">
                                    {liquidations.links.map((link: any, index: number) => (
                                        <Button
                                            key={index}
                                            variant={link.active ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => link.url && router.visit(link.url)}
                                            disabled={!link.url}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
