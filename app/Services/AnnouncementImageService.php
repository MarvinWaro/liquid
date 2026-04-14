<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\ImageManager;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Encoders\WebpEncoder;

/**
 * Processes an uploaded announcement cover into three derivatives:
 *  - original   : untouched source (kept for archival / future re-processing)
 *  - display    : max 1600px wide, WebP, for the post detail view
 *  - thumb      : max 400px wide, WebP, for the list card background
 *
 * Downsampling only — images smaller than the target stay untouched.
 * Aspect ratio is preserved.
 */
class AnnouncementImageService
{
    private const DISPLAY_MAX_WIDTH = 1600;
    private const THUMB_MAX_WIDTH   = 800;
    private const DISK              = 'public';
    private const DIR               = 'announcements/covers';

    private ImageManager $manager;

    public function __construct()
    {
        $this->manager = new ImageManager(new Driver());
    }

    /**
     * Process and store all three cover variants.
     *
     * @return array{original: string, display: string, thumb: string}
     */
    public function store(UploadedFile $file): array
    {
        $disk = Storage::disk(self::DISK);
        $dir = self::DIR;

        $basename = Str::uuid()->toString();
        $originalExt = strtolower($file->getClientOriginalExtension() ?: 'bin');

        // 1. Keep the original untouched.
        $originalPath = "{$dir}/{$basename}.{$originalExt}";
        $disk->put($originalPath, file_get_contents($file->getRealPath()));

        // 2. Display (WebP, ≤1600px wide, quality 85).
        $displayPath = "{$dir}/{$basename}-display.webp";
        $disk->put($displayPath, $this->encodeVariant($file, self::DISPLAY_MAX_WIDTH, 85));

        // 3. Thumbnail (WebP, ≤800px wide, quality 82 — crisp card-sized).
        $thumbPath = "{$dir}/{$basename}-thumb.webp";
        $disk->put($thumbPath, $this->encodeVariant($file, self::THUMB_MAX_WIDTH, 82));

        return [
            'original' => $originalPath,
            'display'  => $displayPath,
            'thumb'    => $thumbPath,
        ];
    }

    private function encodeVariant(UploadedFile $file, int $maxWidth, int $quality): string
    {
        $image = $this->manager->decodePath($file->getRealPath());

        if ($image->width() > $maxWidth) {
            $image = $image->scaleDown(width: $maxWidth);
        }

        return (string) $image->encode(new WebpEncoder($quality));
    }
}
