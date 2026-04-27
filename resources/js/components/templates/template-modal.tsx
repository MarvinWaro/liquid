import React, { useEffect, useState } from 'react';
import { useForm } from '@inertiajs/react';
import { FileText, X } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface Template {
    id: string;
    name: string;
    category: string | null;
    description: string | null;
    original_filename: string;
    file_size: number;
    mime_type: string;
    is_active: boolean;
}

interface TemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    template: Template | null;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function TemplateModal({ isOpen, onClose, template }: TemplateModalProps) {
    const { data, setData, post, processing, errors, reset, transform } = useForm<{
        name: string;
        category: string;
        description: string;
        is_active: boolean;
        file: File | null;
    }>({
        name: '',
        category: '',
        description: '',
        is_active: true,
        file: null,
    });

    const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

    useEffect(() => {
        if (template) {
            setData({
                name: template.name || '',
                category: template.category || '',
                description: template.description || '',
                is_active: template.is_active,
                file: null,
            });
        } else {
            reset();
        }
        setSelectedFileName(null);
    }, [template, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const onSuccess = () => {
            onClose();
            reset();
            setSelectedFileName(null);
        };

        if (template) {
            transform((d) => ({ ...d, _method: 'put' }));
            post(route('templates.update', template.id), {
                preserveScroll: true,
                forceFormData: true,
                onSuccess,
            });
        } else {
            transform((d) => d);
            post(route('templates.store'), {
                preserveScroll: true,
                forceFormData: true,
                onSuccess,
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {template ? 'Edit Template' : 'Add Template'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="name">Name *</Label>
                        <Input
                            id="name"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder="e.g., Liquidation Report Form"
                            className={errors.name ? 'border-red-500' : ''}
                        />
                        {errors.name && (
                            <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="category">Category</Label>
                        <Input
                            id="category"
                            value={data.category}
                            onChange={(e) => setData('category', e.target.value)}
                            placeholder="e.g., Liquidation, Reporting, Bulk Import"
                            className={errors.category ? 'border-red-500' : ''}
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                            Optional label that groups related templates.
                        </p>
                        {errors.category && (
                            <p className="text-sm text-red-500 mt-1">{errors.category}</p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            placeholder="What is this template for?"
                            rows={2}
                            className={errors.description ? 'border-red-500' : ''}
                        />
                        {errors.description && (
                            <p className="text-sm text-red-500 mt-1">{errors.description}</p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="file">
                            File {template ? '(leave empty to keep current)' : '*'}
                        </Label>

                        {template && !selectedFileName && (
                            <div className="mb-2 flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="truncate flex-1">{template.original_filename}</span>
                                <span className="text-xs text-muted-foreground">
                                    {formatFileSize(template.file_size)}
                                </span>
                            </div>
                        )}

                        {selectedFileName && (
                            <div className="mb-2 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800/60 px-3 py-2 text-sm">
                                <FileText className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                                <span className="truncate flex-1 text-emerald-900 dark:text-emerald-200">
                                    {selectedFileName}
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => {
                                        setSelectedFileName(null);
                                        setData('file', null);
                                    }}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        )}

                        <Input
                            id="file"
                            type="file"
                            onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                setData('file', file);
                                setSelectedFileName(file?.name ?? null);
                            }}
                            className={errors.file ? 'border-red-500' : ''}
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                            Max 5MB. Any file format (xlsx, docx, pdf, etc).
                        </p>
                        {errors.file && (
                            <p className="text-sm text-red-500 mt-1">{errors.file}</p>
                        )}
                    </div>

                    <div>
                        <Label>Status</Label>
                        <Select
                            value={data.is_active ? 'true' : 'false'}
                            onValueChange={(value) => setData('is_active', value === 'true')}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="true">Active</SelectItem>
                                <SelectItem value="false">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={processing}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Saving...' : template ? 'Update' : 'Create'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
