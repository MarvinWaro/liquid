/**
 * Upload size checks that agree with what the server will actually accept.
 *
 * Each upload has two ceilings: the one the feature intends (a liquidation
 * document is capped at 10MB by policy) and the one PHP is configured to allow.
 * Only the smaller is real.
 *
 * Comparing against the feature limit alone is what made a failed upload so
 * confusing: the browser waved a 4MB PDF through against a hardcoded 10MB, PHP
 * refused it at 2MB before Laravel ran, and all the user saw was "The file
 * failed to upload."
 */

const BYTES_PER_MB = 1024 * 1024;

/** Human-readable size, matching how uploaded files are already labelled. */
export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < BYTES_PER_MB) return `${(bytes / 1024).toFixed(1)} KB`;

    return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
}

/**
 * The ceiling actually in force: the smaller of what the feature allows and what
 * the server can take.
 *
 * `serverMaxBytes` comes from the shared `maxUploadBytes` prop. It is treated as
 * optional so a component still behaves sensibly if the prop is ever missing —
 * falling back to the feature's own limit rather than blocking every upload.
 */
export function resolveMaxUpload(featureMaxBytes: number, serverMaxBytes?: number): number {
    if (!serverMaxBytes || serverMaxBytes <= 0) {
        return featureMaxBytes;
    }

    return Math.min(featureMaxBytes, serverMaxBytes);
}

/**
 * Null when the file fits, otherwise a message naming both numbers.
 *
 * Stating the file's own size alongside the limit is the point: "must not exceed
 * 10MB" gave no clue when the real limit was 2MB.
 */
export function checkUploadSize(
    file: File,
    featureMaxBytes: number,
    serverMaxBytes?: number,
): string | null {
    const limit = resolveMaxUpload(featureMaxBytes, serverMaxBytes);

    if (file.size <= limit) {
        return null;
    }

    return `This file is ${formatBytes(file.size)}. The maximum is ${formatBytes(limit)}.`;
}
