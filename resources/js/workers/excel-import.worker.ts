/**
 * Web Worker for parsing Excel import files using SheetJS.
 *
 * Offloads the heavy Excel-to-JSON conversion from both the main thread
 * (keeps UI responsive) and the server (eliminates PhpSpreadsheet memory usage).
 *
 * Messages IN:  { buffer: ArrayBuffer }
 * Messages OUT: { type: 'progress', processed, total }
 *             | { type: 'complete', rows: ParsedRow[], total: number }
 *             | { type: 'error', message: string }
 */
import * as XLSX from 'xlsx';

// ── Column indices (must match backend COL_* constants) ──────────────────────
const COL = {
    SEQ:                0,
    PROGRAM:            1,
    UII:                2,
    HEI_NAME:           3,
    DATE_FUND_RELEASED: 4,
    DUE_DATE:           5,
    ACADEMIC_YEAR:      6,
    SEMESTER:           7,
    BATCH_NO:           8,
    CONTROL_NO:         9,
    GRANTEES:           10,
    DISBURSEMENTS:      11,
    AMOUNT_LIQUIDATED:  12,
    DOC_STATUS:         13,
    RC_NOTES:           14,
} as const;

// ── Types ────────────────────────────────────────────────────────────────────
export interface ParsedRow {
    row: number;
    seq: string;
    program: string;
    uii: string;
    hei_name: string;
    academic_year: string;
    semester: string;
    batch_no: string;
    control_no: string;
    grantees: string;
    disbursements: string;
    amount_liquidated: string;
    date_fund_released: string;
    due_date: string;
    doc_status: string;
    rc_notes: string;
}

export type WorkerMessage =
    | { type: 'progress'; processed: number; total: number }
    | { type: 'complete'; rows: ParsedRow[]; total: number }
    | { type: 'error'; message: string };

// ── Helpers ──────────────────────────────────────────────────────────────────

function cellToString(value: unknown): string {
    if (value == null) return '';
    // Date objects from SheetJS (cellDates: true)
    if (value instanceof Date) return formatDateObj(value);
    return String(value).trim();
}

function formatDateObj(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatDate(value: unknown): string {
    if (value == null || String(value).trim() === '') return '';
    if (value instanceof Date) return formatDateObj(value);
    // Excel serial number — convert using SheetJS utility
    if (typeof value === 'number') {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (parsed) {
            return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
        }
        return '';
    }
    // String date — pass through for backend to parse with Carbon
    return String(value).trim();
}

function isDataRow(row: unknown[]): boolean {
    const seq = cellToString(row[COL.SEQ]);
    return seq !== '' && !isNaN(Number(seq));
}

// ── Main handler ─────────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<{ buffer: ArrayBuffer }>) => {
    try {
        const wb = XLSX.read(e.data.buffer, { type: 'array', cellDates: true });

        // Find the sheet with data rows (mirrors backend logic)
        let data: unknown[][] = XLSX.utils.sheet_to_json(
            wb.Sheets[wb.SheetNames[0]],
            { header: 1, defval: '' },
        );

        if (!data.some(isDataRow) && wb.SheetNames.length > 1) {
            for (const name of wb.SheetNames) {
                const candidate: unknown[][] = XLSX.utils.sheet_to_json(
                    wb.Sheets[name],
                    { header: 1, defval: '' },
                );
                if (candidate.some(isDataRow)) {
                    data = candidate;
                    break;
                }
            }
        }

        // Count data rows for accurate progress reporting
        const totalDataRows = data.filter(isDataRow).length;
        if (totalDataRows === 0) {
            self.postMessage({ type: 'complete', rows: [], total: 0 } satisfies WorkerMessage);
            return;
        }

        const rows: ParsedRow[] = [];
        let processed = 0;

        for (let i = 0; i < data.length; i++) {
            const raw = data[i] as unknown[];
            if (!isDataRow(raw)) continue;

            processed++;

            rows.push({
                row:                i + 1, // 1-based Excel row number
                seq:                cellToString(raw[COL.SEQ]),
                program:            cellToString(raw[COL.PROGRAM]),
                uii:                cellToString(raw[COL.UII]),
                hei_name:           cellToString(raw[COL.HEI_NAME]),
                academic_year:      cellToString(raw[COL.ACADEMIC_YEAR]),
                semester:           cellToString(raw[COL.SEMESTER]),
                batch_no:           cellToString(raw[COL.BATCH_NO]),
                control_no:         cellToString(raw[COL.CONTROL_NO]),
                grantees:           cellToString(raw[COL.GRANTEES]),
                disbursements:      cellToString(raw[COL.DISBURSEMENTS]),
                amount_liquidated:  cellToString(raw[COL.AMOUNT_LIQUIDATED]),
                date_fund_released: formatDate(raw[COL.DATE_FUND_RELEASED]),
                due_date:           formatDate(raw[COL.DUE_DATE]),
                doc_status:         cellToString(raw[COL.DOC_STATUS]),
                rc_notes:           cellToString(raw[COL.RC_NOTES]),
            });

            // Report progress every 50 rows
            if (processed % 50 === 0 || processed === totalDataRows) {
                self.postMessage({ type: 'progress', processed, total: totalDataRows } satisfies WorkerMessage);
            }
        }

        self.postMessage({ type: 'complete', rows, total: totalDataRows } satisfies WorkerMessage);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to parse Excel file.';
        self.postMessage({ type: 'error', message } satisfies WorkerMessage);
    }
};
