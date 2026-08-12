import { useEffect, useState } from 'react';
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

/**
 * Previews a liquidation PDF by framing the app's own streaming route.
 *
 * It used to download the file and frame a `blob:` URL instead. That works with no
 * Content-Security-Policy, but a browser treats `blob:` as a source of its own, and
 * production's CSP only lists it under `img-src` — so every preview came up blank
 * while the Download button beside it kept working.
 *
 * Framing the route directly is allowed by `frame-src 'self'` and lets the browser
 * stream the PDF, so the first page paints without waiting for the whole file.
 */
export default function PdfPreviewDialog({
    open,
    onOpenChange,
    documentId,
    fileName,
    downloadUrl,
}: PdfPreviewDialogProps) {
    const [src, setSrc] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;

        const controller = new AbortController();
        const viewUrl = route('liquidation.view-document', documentId);

        setLoading(true);
        setError(null);
        setSrc(null);

        // Checked before framing rather than after. An expired session or a missing
        // file answers with an HTML error page, and those responses keep the app-wide
        // X-Frame-Options: DENY — so framing blind would show an empty box and no
        // explanation. HEAD is cheap: Laravel suppresses the body, so the file is
        // never read out of S3, and the authorisation check it runs writes nothing.
        const checkAccess = async () => {
            try {
                const res = await fetch(viewUrl, {
                    method: 'HEAD',
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

                // Deliberately leaves `loading` on: the iframe has not fetched anything
                // yet. Its onLoad below clears the spinner once there is a page to see.
                setSrc(viewUrl);
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') return;

                const message = err instanceof Error ? err.message : 'Failed to load document.';
                setError(message);
                setLoading(false);
                toast.error(message);
            }
        };

        checkAccess();

        return () => controller.abort();
    }, [open, documentId]);

    useEffect(() => {
        // Cleared on close so reopening cannot flash the previous document for a
        // frame before the effect above has run.
        if (!open) {
            setSrc(null);
            setError(null);
        }
    }, [open]);

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
                    {/* Opaque and above the frame — the iframe is mounted underneath while
                        it loads, and a half-painted PDF should not show through. */}
                    {loading && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background">
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

                    {src && !error && (
                        <iframe
                            src={src}
                            title={fileName}
                            onLoad={() => setLoading(false)}
                            className="w-full h-full border-0"
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
