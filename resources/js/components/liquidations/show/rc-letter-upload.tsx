import { useRef, useState, useCallback } from 'react';
import { router } from '@inertiajs/react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Upload, FileText, Download, Trash2, Eye, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import type { LiquidationDocument } from '@/types/liquidation';

const RC_LETTER_TYPE = 'RC Letter';
const MAX_LETTERS = 3;
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

interface RcLetterUploadProps {
    liquidationId: number;
    documents: LiquidationDocument[];
    userRole: string;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function RcLetterUpload({ liquidationId, documents, userRole }: RcLetterUploadProps) {
    const isRC = userRole === 'Regional Coordinator';
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const rcLetters = documents.filter(d => d.document_type === RC_LETTER_TYPE && !d.is_gdrive);
    const canUploadMore = rcLetters.length < MAX_LETTERS;

    const handleUpload = useCallback(async (file: File) => {
        if (!file) return;

        if (file.type !== 'application/pdf') {
            toast.error('Only PDF files are allowed.');
            return;
        }
        if (file.size > MAX_SIZE_BYTES) {
            toast.error('File size must not exceed 20MB.');
            return;
        }
        if (!canUploadMore) {
            toast.error(`Maximum of ${MAX_LETTERS} letters allowed. Please delete an existing one first.`);
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('document_type', RC_LETTER_TYPE);
        formData.append('description', 'Letter from Regional Coordinator to HEI');

        try {
            const { data } = await axios.post(route('liquidation.upload-document', liquidationId), formData);

            if (data?.success) {
                toast.success('Letter uploaded successfully.');
                router.reload({ only: ['liquidation'], preserveScroll: true });
            } else {
                toast.error(data?.message ?? 'Upload failed. Please try again.');
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message ?? 'An error occurred while uploading. Please try again.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [liquidationId, canUploadMore]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleUpload(file);
    }, [handleUpload]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(() => setIsDragging(false), []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleUpload(file);
    }, [handleUpload]);

    const handleDelete = useCallback((documentId: number) => {
        router.delete(route('liquidation.delete-document', documentId), {
            preserveScroll: true,
            onError: () => toast.error('Failed to delete letter.'),
        });
    }, []);

    return (
        <Card className="mb-3">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center">
                        <Mail className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                        <CardTitle className="text-base font-semibold">RC Letters</CardTitle>
                        <CardDescription className="text-xs">
                            Letters from the Regional Coordinator for the HEI to view
                        </CardDescription>
                    </div>
                </div>

                {isRC && canUploadMore && (
                    <Button
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="gap-2"
                    >
                        {isUploading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" />Uploading…</>
                        ) : (
                            <><Upload className="w-4 h-4" />Upload Letter</>
                        )}
                    </Button>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={handleFileSelect}
                />
            </CardHeader>

            <CardContent className="pt-0">
                {/* Uploaded letters list */}
                {rcLetters.length > 0 && (
                    <div className="space-y-2 mb-3">
                        {rcLetters.map(doc => (
                            <div
                                key={doc.id}
                                className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50 dark:bg-gray-900/40"
                            >
                                <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatFileSize(doc.file_size)} &middot; Uploaded {formatUploadDate(doc.uploaded_at)}
                                    </p>
                                </div>

                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <Button variant="ghost" size="icon" title="View in browser" asChild>
                                        <a
                                            href={route('liquidation.view-document', doc.id)}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </a>
                                    </Button>
                                    <Button variant="ghost" size="icon" title="Download" asChild>
                                        <a href={route('liquidation.download-document', doc.id)}>
                                            <Download className="w-4 h-4" />
                                        </a>
                                    </Button>
                                    {isRC && (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-3" side="left" align="center">
                                                <p className="text-sm font-medium mb-1">Delete this letter?</p>
                                                <p className="text-xs text-muted-foreground mb-3">This action cannot be undone.</p>
                                                <div className="flex justify-end gap-2">
                                                    <PopoverClose asChild>
                                                        <Button variant="outline" size="sm" className="h-7 text-xs px-2">Cancel</Button>
                                                    </PopoverClose>
                                                    <PopoverClose asChild>
                                                        <Button variant="destructive" size="sm" className="h-7 text-xs px-2" onClick={() => handleDelete(doc.id)}>Delete</Button>
                                                    </PopoverClose>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Drag-and-drop zone (RC only) */}
                {isRC && canUploadMore && (
                    <div
                        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer select-none ${
                            isDragging
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload className="w-7 h-7 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-muted-foreground">
                            Drag & drop a PDF here, or{' '}
                            <span className="text-blue-600 dark:text-blue-400 underline">browse</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            PDF only &middot; Max 20 MB &middot; {MAX_LETTERS - rcLetters.length} upload{MAX_LETTERS - rcLetters.length !== 1 ? 's' : ''} remaining
                        </p>
                    </div>
                )}

                {/* Empty state for non-RC users */}
                {!isRC && rcLetters.length === 0 && (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                        No letters have been uploaded yet.
                    </div>
                )}

                {/* Max reached notice for RC */}
                {isRC && !canUploadMore && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                        Maximum of {MAX_LETTERS} letters reached. Delete one to upload a new file.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
