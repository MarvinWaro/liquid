import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { toast } from '@/lib/toast';

interface PdfPreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    documentId: number;
    fileName: string;
    downloadUrl?: string;
}

export default function PdfPreviewDialog({
    open,
    onOpenChange,
    documentId,
    fileName,
    downloadUrl,
}: PdfPreviewDialogProps) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!open) return;

        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        setError(null);

        const fetchPdf = async () => {
            try {
                const res = await fetch(route('liquidation.view-document', documentId), {
                    credentials: 'same-origin',
                    signal: controller.signal,
                    headers: { Accept: 'application/pdf' },
                });

                if (!res.ok) {
                    if (res.status === 401 || res.status === 419) {
                        throw new Error('Your session has expired. Please refresh the page and try again.');
                    }
                    if (res.status === 403) {
                        throw new Error('You are not authorized to view this document.');
                    }
                    throw new Error('Unable to load the document. Please try again.');
                }

                const contentType = res.headers.get('content-type') || '';
                if (!contentType.includes('pdf')) {
                    throw new Error('The server did not return a PDF. Your session may have expired.');
                }

                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                setBlobUrl(url);
            } catch (err: any) {
                if (err.name === 'AbortError') return;
                setError(err.message ?? 'Failed to load document.');
                toast.error(err.message ?? 'Failed to load document.');
            } finally {
                setLoading(false);
            }
        };

        fetchPdf();

        return () => {
            controller.abort();
        };
    }, [open, documentId]);

    useEffect(() => {
        if (!open && blobUrl) {
            URL.revokeObjectURL(blobUrl);
            setBlobUrl(null);
            setError(null);
        }
    }, [open, blobUrl]);

    useEffect(() => {
        return () => {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
            abortRef.current?.abort();
        };
    }, [blobUrl]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="!max-w-none w-[95vw] h-[95vh] sm:!max-w-[95vw] p-0 flex flex-col gap-0 overflow-hidden"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
                    <div className="min-w-0 flex-1 pr-4">
                        <DialogTitle className="text-sm font-semibold truncate">{fileName}</DialogTitle>
                        <DialogDescription className="text-xs">PDF preview</DialogDescription>
                    </div>
                    {downloadUrl && (
                        <Button variant="outline" size="sm" className="gap-2 mr-8" asChild>
                            <a href={downloadUrl}>
                                <Download className="w-3.5 h-3.5" />
                                Download
                            </a>
                        </Button>
                    )}
                </DialogHeader>

                <div className="flex-1 bg-muted/30 relative overflow-hidden">
                    {loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Loading preview…</p>
                        </div>
                    )}

                    {error && !loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                            <AlertCircle className="w-8 h-8 text-red-500" />
                            <p className="text-sm font-medium">Unable to preview</p>
                            <p className="text-xs text-muted-foreground max-w-sm">{error}</p>
                            {downloadUrl && (
                                <Button variant="outline" size="sm" className="gap-2 mt-2" asChild>
                                    <a href={downloadUrl}>
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        Download instead
                                    </a>
                                </Button>
                            )}
                        </div>
                    )}

                    {blobUrl && !loading && !error && (
                        <iframe
                            src={blobUrl}
                            title={fileName}
                            className="w-full h-full border-0"
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
