import { useRef, useState, useCallback, useMemo } from 'react';
import { router } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Upload, FileText, Download, Trash2, Eye, Loader2,
    ClipboardList, CheckCircle2, Circle, ExternalLink, Link2, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import type { LiquidationDocument, DocumentRequirement, DocumentCompleteness } from '@/types/liquidation';

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

interface HeiDocumentUploadProps {
    liquidationId: number;
    documents: LiquidationDocument[];
    requirements: DocumentRequirement[];
    completeness?: DocumentCompleteness;
    isHEIUser: boolean;
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

export default function HeiDocumentUpload({
    liquidationId,
    documents,
    requirements,
    completeness,
    isHEIUser,
}: HeiDocumentUploadProps) {
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [gdriveOpenId, setGdriveOpenId] = useState<string | null>(null);
    const [gdriveLink, setGdriveLink] = useState('');
    const [gdriveSubmitting, setGdriveSubmitting] = useState(false);

    // Memoize the document-to-requirement lookup map
    const docByRequirement = useMemo(() => {
        const map = new Map<string, LiquidationDocument>();
        for (const doc of documents) {
            if (doc.document_requirement_id) {
                map.set(doc.document_requirement_id, doc);
            }
        }
        return map;
    }, [documents]);

    if (requirements.length === 0) return null;

    const total = completeness?.total ?? requirements.length;
    const fulfilled = completeness?.fulfilled ?? 0;
    const percentage = completeness?.percentage ?? 0;
    const isComplete = total > 0 && fulfilled >= total;

    const handleUpload = useCallback(async (requirementId: string, file: File) => {
        if (file.type !== 'application/pdf') {
            toast.error('Only PDF files are allowed.');
            return;
        }
        if (file.size > MAX_SIZE_BYTES) {
            toast.error('File size must not exceed 20MB.');
            return;
        }

        setUploadingId(requirementId);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('document_requirement_id', requirementId);

        try {
            const csrfToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
            const response = await fetch(route('liquidation.upload-document', liquidationId), {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: formData,
            });

            const contentType = response.headers.get('Content-Type') ?? '';
            const data = contentType.includes('application/json') ? await response.json() : null;

            if (response.ok && data?.success) {
                toast.success('Document uploaded successfully.');
                router.reload({ only: ['liquidation'] });
            } else {
                toast.error(data?.message ?? `Upload failed (${response.status}). Please try again.`);
            }
        } catch {
            toast.error('An error occurred while uploading. Please try again.');
        } finally {
            setUploadingId(null);
            const ref = fileInputRefs.current[requirementId];
            if (ref) ref.value = '';
        }
    }, [liquidationId]);

    const handleGdriveSubmit = useCallback(async (requirementId: string) => {
        if (!gdriveLink.trim()) {
            toast.error('Please enter a Google Drive link.');
            return;
        }

        setGdriveSubmitting(true);
        try {
            const csrfToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
            const response = await fetch(route('liquidation.store-gdrive-link', liquidationId), {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    gdrive_link: gdriveLink.trim(),
                    document_requirement_id: requirementId,
                }),
            });

            const contentType = response.headers.get('Content-Type') ?? '';
            const data = contentType.includes('application/json') ? await response.json() : null;

            if (response.ok && data?.success) {
                toast.success('Google Drive link added successfully.');
                setGdriveLink('');
                setGdriveOpenId(null);
                router.reload({ only: ['liquidation'] });
            } else {
                toast.error(data?.message ?? `Failed to add link (${response.status}).`);
            }
        } catch {
            toast.error('An error occurred. Please try again.');
        } finally {
            setGdriveSubmitting(false);
        }
    }, [liquidationId, gdriveLink]);

    const handleDelete = useCallback((documentId: number) => {
        router.delete(route('liquidation.delete-document', documentId), {
            onError: () => toast.error('Failed to delete document.'),
        });
    }, []);

    // RC sees only the card header + completion status when incomplete (server already filters documents)
    if (!isHEIUser && !isComplete) {
        return (
            <Card className="mb-3">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-md bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                <ClipboardList className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <CardTitle className="text-base font-semibold">Document Requirements</CardTitle>
                                <CardDescription className="text-xs">
                                    HEI document submissions
                                </CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-muted-foreground">
                                {fulfilled}/{total}
                            </span>
                            <div className="w-24 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-amber-500 transition-all duration-300"
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
                        <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                            The HEI has not yet completed all required document uploads ({fulfilled} of {total} submitted).
                            Documents will be visible once all requirements are fulfilled.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="mb-3">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-md bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <ClipboardList className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-semibold">Document Requirements</CardTitle>
                            <CardDescription className="text-xs">
                                {isHEIUser ? 'Upload required liquidation documents' : 'HEI document submissions'}
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground">
                            {fulfilled}/{total}
                        </span>
                        <div className="w-24 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ${isComplete ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-0">
                {/* HEI status alert */}
                {isHEIUser && !isComplete && (
                    <div className="flex items-center gap-2 p-3 mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
                        <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                            Please upload all {total} required documents. Your submissions will only be visible to the Regional Coordinator once all requirements are complete.
                        </p>
                    </div>
                )}

                {isHEIUser && isComplete && (
                    <div className="flex items-center gap-2 p-3 mb-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        <p className="text-xs text-emerald-700 dark:text-emerald-300">
                            All documents have been submitted. Your submissions are now visible to the Regional Coordinator.
                        </p>
                    </div>
                )}

                <div className="space-y-1">
                    {requirements.map((req, index) => {
                        const doc = docByRequirement.get(req.id);
                        const isFulfilled = !!doc;
                        const isUploadingThis = uploadingId === req.id;

                        return (
                            <div
                                key={req.id}
                                className={`rounded-lg border p-3 transition-colors ${
                                    isFulfilled
                                        ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50'
                                        : 'bg-gray-50/50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
                                }`}
                            >
                                <div className="flex items-start gap-2">
                                    {isFulfilled ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                    ) : (
                                        <Circle className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium ${isFulfilled ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>
                                            {index + 1}. {req.name}
                                            {req.is_required && (
                                                <span className="text-red-400 ml-0.5">*</span>
                                            )}
                                        </p>

                                        {req.description && !isFulfilled && (
                                            <p className="text-xs text-muted-foreground mt-0.5">{req.description}</p>
                                        )}

                                        {/* Uploaded document info */}
                                        {doc && (
                                            <DocumentRow
                                                doc={doc}
                                                canDelete={isHEIUser}
                                                onDelete={handleDelete}
                                            />
                                        )}

                                        {/* Upload actions (HEI only, when empty) */}
                                        {!doc && isHEIUser && (
                                            <div className="flex items-center gap-2 mt-2">
                                                <input
                                                    ref={el => { fileInputRefs.current[req.id] = el; }}
                                                    type="file"
                                                    accept=".pdf,application/pdf"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleUpload(req.id, file);
                                                    }}
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs gap-1.5"
                                                    disabled={isUploadingThis}
                                                    onClick={() => fileInputRefs.current[req.id]?.click()}
                                                >
                                                    {isUploadingThis ? (
                                                        <><Loader2 className="w-3 h-3 animate-spin" />Uploading...</>
                                                    ) : (
                                                        <><Upload className="w-3 h-3" />Upload PDF</>
                                                    )}
                                                </Button>

                                                <Popover
                                                    open={gdriveOpenId === req.id}
                                                    onOpenChange={(open) => {
                                                        setGdriveOpenId(open ? req.id : null);
                                                        if (!open) setGdriveLink('');
                                                    }}
                                                >
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs gap-1.5"
                                                        >
                                                            <Link2 className="w-3 h-3" />
                                                            Google Drive
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-80 p-3" side="bottom" align="start">
                                                        <p className="text-sm font-medium mb-2">Add Google Drive Link</p>
                                                        <Input
                                                            placeholder="https://drive.google.com/..."
                                                            value={gdriveLink}
                                                            onChange={(e) => setGdriveLink(e.target.value)}
                                                            className="h-8 text-xs mb-2"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleGdriveSubmit(req.id);
                                                                }
                                                            }}
                                                        />
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-7 text-xs"
                                                                onClick={() => {
                                                                    setGdriveOpenId(null);
                                                                    setGdriveLink('');
                                                                }}
                                                            >
                                                                Cancel
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                className="h-7 text-xs"
                                                                disabled={gdriveSubmitting || !gdriveLink.trim()}
                                                                onClick={() => handleGdriveSubmit(req.id)}
                                                            >
                                                                {gdriveSubmitting ? (
                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                ) : (
                                                                    'Submit'
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

/** Displays an uploaded document (PDF or Google Drive link) with action buttons. */
function DocumentRow({ doc, canDelete, onDelete }: {
    doc: LiquidationDocument;
    canDelete: boolean;
    onDelete: (id: number) => void;
}) {
    return (
        <div className="flex items-center gap-2 mt-2">
            {doc.is_gdrive ? (
                <>
                    <div className="w-7 h-7 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                        <Link2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">Google Drive Link</p>
                        <p className="text-xs text-muted-foreground">
                            Added {formatUploadDate(doc.uploaded_at)}
                        </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Open in Google Drive" asChild>
                            <a href={doc.gdrive_link} target="_blank" rel="noreferrer">
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        </Button>
                        {canDelete && <DeletePopover onDelete={() => onDelete(doc.id)} />}
                    </div>
                </>
            ) : (
                <>
                    <div className="w-7 h-7 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                            {formatFileSize(doc.file_size)} &middot; {formatUploadDate(doc.uploaded_at)}
                        </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="View" asChild>
                            <a href={route('liquidation.view-document', doc.id)} target="_blank" rel="noreferrer">
                                <Eye className="w-3.5 h-3.5" />
                            </a>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Download" asChild>
                            <a href={route('liquidation.download-document', doc.id)}>
                                <Download className="w-3.5 h-3.5" />
                            </a>
                        </Button>
                        {canDelete && <DeletePopover onDelete={() => onDelete(doc.id)} />}
                    </div>
                </>
            )}
        </div>
    );
}

function DeletePopover({ onDelete }: { onDelete: () => void }) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Delete"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" side="left" align="center">
                <p className="text-sm font-medium mb-1">Delete this document?</p>
                <p className="text-xs text-muted-foreground mb-3">This action cannot be undone.</p>
                <div className="flex justify-end gap-2">
                    <PopoverClose asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs px-2">Cancel</Button>
                    </PopoverClose>
                    <PopoverClose asChild>
                        <Button variant="destructive" size="sm" className="h-7 text-xs px-2" onClick={onDelete}>Delete</Button>
                    </PopoverClose>
                </div>
            </PopoverContent>
        </Popover>
    );
}
