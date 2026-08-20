/**
 * Number formatting for chart axes.
 *
 * An axis is a scale, not a ledger: it only has to say roughly where a bar
 * reaches. Spelling a figure out in full there costs width the plot needs and
 * is slower to read — `₱18.5B` lands faster than `₱18,515,644,423`. Exact
 * values belong in the tooltip, which is where people go when they want one.
 *
 * This matters here because the system reports in billions of pesos and over a
 * million grantees, so a full-precision tick label is wide enough to be clipped
 * by the axis and render as `,000,000`.
 */

const compactFormatter = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
});

/**
 * Axis-friendly short form for a count: 1,012,112 becomes "1M".
 *
 * Returns an empty string for anything non-finite so a bad data point leaves a
 * blank tick rather than "NaN" across the axis.
 */
export function formatCompactNumber(value: number): string {
    return Number.isFinite(value) ? compactFormatter.format(value) : '';
}

/**
 * The same for peso axes: 18,515,644,423 becomes "₱18.5B".
 */
export function formatCompactPeso(value: number): string {
    return Number.isFinite(value) ? `₱${compactFormatter.format(value)}` : '';
}
