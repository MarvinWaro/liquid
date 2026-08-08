/**
 * Date/time display helpers.
 *
 * The app stores timestamps in UTC (see config/app.php) but every user reads them
 * as Philippine time. These helpers pin the output to Asia/Manila so the same record
 * shows the same date and time on every machine, regardless of the laptop's own
 * timezone or clock setting.
 *
 * Always use these instead of a bare `new Date(x).toLocaleDateString()`.
 */

const MANILA_TZ = 'Asia/Manila';

/**
 * Matches a timezone-naive datetime like "2026-08-04 05:30:00" or "2026-08-04T05:30:00"
 * — no trailing Z and no +HH:MM offset.
 */
const NAIVE_DATETIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)$/;

/**
 * Turn a server timestamp into a Date.
 *
 * Timezone-naive values are read as UTC, which is how the backend stores them.
 * Without this, JavaScript would read those digits as the laptop's local time and
 * the result would be off by the laptop's UTC offset (8 hours in the Philippines).
 * It also avoids the space-separated form, which older Safari rejects outright.
 */
function parseServerDate(value: string | Date): Date | null {
    if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value;
    }

    const naive = NAIVE_DATETIME.exec(value.trim());
    const parsed = new Date(naive ? `${naive[1]}T${naive[2]}Z` : value);

    return isNaN(parsed.getTime()) ? null : parsed;
}

function formatInManila(
    value: string | Date | null | undefined,
    options: Intl.DateTimeFormatOptions,
    fallback: string,
): string {
    if (!value) return fallback;

    const parsed = parseServerDate(value);
    if (!parsed) return fallback;

    return parsed.toLocaleString('en-US', { ...options, timeZone: MANILA_TZ });
}

/** "Aug 4, 2026" in Philippine time. */
export function formatManilaDate(value: string | Date | null | undefined, fallback = 'N/A'): string {
    return formatInManila(value, { month: 'short', day: 'numeric', year: 'numeric' }, fallback);
}

/**
 * Today's date in Philippine time as "YYYY-MM-DD".
 *
 * Only a fallback for when the server has not supplied its own date. Prefer a
 * server-sent value for anything that decides a status (overdue, expired, late) —
 * this still reads the machine's clock, so a wrong clock gives a wrong answer.
 * It does at least stay correct across timezones, which a bare `new Date()` does not.
 */
export function manilaToday(): string {
    // 'en-CA' formats as YYYY-MM-DD, which sorts and compares as a plain string.
    return new Date().toLocaleDateString('en-CA', { timeZone: MANILA_TZ });
}

/** "Aug 4, 2026, 01:30 PM" in Philippine time. */
export function formatManilaDateTime(value: string | Date | null | undefined, fallback = 'N/A'): string {
    return formatInManila(
        value,
        { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
        fallback,
    );
}
