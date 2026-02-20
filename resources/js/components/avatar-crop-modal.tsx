import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface AvatarCropModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    imageSrc: string;
    onCropComplete: (file: File) => void;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number) {
    return centerCrop(
        makeAspectCrop(
            { unit: '%', width: 80 },
            1,
            mediaWidth,
            mediaHeight,
        ),
        mediaWidth,
        mediaHeight,
    );
}

export default function AvatarCropModal({ open, onOpenChange, imageSrc, onCropComplete }: AvatarCropModalProps) {
    const imgRef = useRef<HTMLImageElement>(null);
    const [crop, setCrop] = useState<Crop>();
    const [zoom, setZoom] = useState(1);

    const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        setCrop(centerAspectCrop(naturalWidth, naturalHeight));
        setZoom(1);
    }, []);

    const handleApply = useCallback(async () => {
        const image = imgRef.current;
        if (!image || !crop) return;

        const canvas = document.createElement('canvas');
        const size = 256;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;

        const cropX = crop.unit === '%' ? (crop.x / 100) * image.width : crop.x;
        const cropY = crop.unit === '%' ? (crop.y / 100) * image.height : crop.y;
        const cropWidth = crop.unit === '%' ? (crop.width / 100) * image.width : crop.width;
        const cropHeight = crop.unit === '%' ? (crop.height / 100) * image.height : crop.height;

        ctx.drawImage(
            image,
            cropX * scaleX,
            cropY * scaleY,
            cropWidth * scaleX,
            cropHeight * scaleY,
            0,
            0,
            size,
            size,
        );

        canvas.toBlob((blob) => {
            if (!blob) return;
            const file = new File([blob], 'avatar.png', { type: 'image/png' });
            onCropComplete(file);
        }, 'image/png');
    }, [crop, onCropComplete]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Crop profile picture</DialogTitle>
                    <DialogDescription>
                        Drag to reposition. Use the slider to zoom in or out.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex justify-center overflow-hidden rounded-md bg-muted">
                    <ReactCrop
                        crop={crop}
                        onChange={(c) => setCrop(c)}
                        aspect={1}
                        circularCrop
                        keepSelection
                    >
                        <img
                            ref={imgRef}
                            src={imageSrc}
                            alt="Crop preview"
                            onLoad={onImageLoad}
                            style={{
                                maxHeight: '350px',
                                transform: `scale(${zoom})`,
                                transformOrigin: 'center',
                            }}
                            draggable={false}
                        />
                    </ReactCrop>
                </div>

                <div className="flex items-center gap-3 px-1">
                    <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <Slider
                        min={100}
                        max={300}
                        step={1}
                        value={[zoom * 100]}
                        onValueChange={([v]) => setZoom(v / 100)}
                    />
                    <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleApply}>
                        Apply
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
