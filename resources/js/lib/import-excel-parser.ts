import ExcelJS from 'exceljs';

/**
 * Excel → structured rows, shared by the main thread and the parse worker.
 *
 * Kept free of React and DOM so it can run in either context unchanged. The
 * worker at `workers/import-parser.worker.ts` is a thin wrapper around
 * `parseExcelBuffer`; the dialog falls back to calling it directly when workers
 * are unavailable.
 */

/** A data row lifted out of the spreadsheet, in the shape the validator expects. */
export interface ParsedExcelRow {
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

/** ExcelJS column indices (1-based) — the backend COL_* constants + 1. */
const COL = {
    SEQ: 1, PROGRAM: 2, UII: 3, HEI_NAME: 4,
    DATE_FUND_RELEASED: 5, DUE_DATE: 6, ACADEMIC_YEAR: 7,
    SEMESTER: 8, BATCH_NO: 9, CONTROL_NO: 10,
    GRANTEES: 11, DISBURSEMENTS: 12, AMOUNT_LIQUIDATED: 13,
    DOC_STATUS: 14, RC_NOTES: 15,
} as const;

/** Stop scanning after this many consecutive non-data rows past the first hit. */
const MAX_EMPTY_STREAK = 50;

const fmtDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

/** Flatten any ExcelJS cell value — rich text, formula result, date — to a trimmed string. */
const cellStr = (v: ExcelJS.CellValue): string => {
    if (v == null) return '';
    if (v instanceof Date) return fmtDate(v);

    if (typeof v === 'object') {
        // Rich text: { richText: [{ text: '...' }, ...] }
        if ('richText' in v) {
            return v.richText.map((r) => r.text).join('').trim();
        }
        // Formula cell: the cached result is what the user sees.
        if ('result' in v) {
            return cellStr(v.result ?? null);
        }
        // Hyperlink cell: { text, hyperlink }
        if ('text' in v) {
            return cellStr(v.text);
        }
        // Error cell (#REF!, #N/A, …) — nothing meaningful to import.
        if ('error' in v) return '';
    }

    return String(v).trim();
};

const formatDate = (v: ExcelJS.CellValue): string => {
    if (v == null) return '';
    if (v instanceof Date) return fmtDate(v);
    return cellStr(v);
};

/**
 * Parse an .xlsx buffer into data rows.
 *
 * Handles over-formatted sheets (styles applied to all 1M+ rows) by stopping
 * after MAX_EMPTY_STREAK consecutive non-data rows.
 *
 * @param onProgress Called as rows accumulate, so the caller can show a bar.
 */
export async function parseExcelBuffer(
    buffer: ArrayBuffer,
    onProgress?: (rowsFound: number) => void,
): Promise<ParsedExcelRow[]> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    // Find the first worksheet with data rows. Deliberately stricter than the
    // row test below: Program or UII must be present for a sheet to look like
    // the import template at all.
    let ws: ExcelJS.Worksheet | undefined;
    wb.eachSheet((sheet) => {
        if (ws) return;
        sheet.eachRow((row) => {
            if (ws) return;
            const seq = cellStr(row.getCell(COL.SEQ).value);
            const prog = cellStr(row.getCell(COL.PROGRAM).value);
            const uii = cellStr(row.getCell(COL.UII).value);
            if (seq !== '' && !isNaN(Number(seq)) && (prog !== '' || uii !== '')) {
                ws = sheet;
            }
        });
    });

    if (!ws) return [];

    const rows: ParsedExcelRow[] = [];
    let emptyStreak = 0;

    ws.eachRow((row, rowNumber) => {
        if (emptyStreak > MAX_EMPTY_STREAK) return;

        const seq = cellStr(row.getCell(COL.SEQ).value);
        const program = cellStr(row.getCell(COL.PROGRAM).value);
        const uii = cellStr(row.getCell(COL.UII).value);

        // A real data row has a numeric SEQ plus at least one other populated
        // cell. Requiring Program or UII specifically would silently swallow
        // rows that are missing exactly those — the backend flags them as
        // "Program (col B) is required", but only if they reach it. Keeping the
        // "some other cell" condition still excludes bare numbering/total rows.
        const hasOtherData = Object.values(COL).some(
            (col) => col !== COL.SEQ && cellStr(row.getCell(col).value) !== '',
        );

        if (seq === '' || isNaN(Number(seq)) || !hasOtherData) {
            if (rows.length > 0) emptyStreak++;
            return;
        }
        emptyStreak = 0;

        rows.push({
            row: rowNumber,
            seq,
            program,
            uii,
            hei_name:           cellStr(row.getCell(COL.HEI_NAME).value),
            academic_year:      cellStr(row.getCell(COL.ACADEMIC_YEAR).value),
            semester:           cellStr(row.getCell(COL.SEMESTER).value),
            batch_no:           cellStr(row.getCell(COL.BATCH_NO).value),
            control_no:         cellStr(row.getCell(COL.CONTROL_NO).value),
            grantees:           cellStr(row.getCell(COL.GRANTEES).value),
            disbursements:      cellStr(row.getCell(COL.DISBURSEMENTS).value),
            amount_liquidated:  cellStr(row.getCell(COL.AMOUNT_LIQUIDATED).value),
            date_fund_released: formatDate(row.getCell(COL.DATE_FUND_RELEASED).value),
            due_date:           formatDate(row.getCell(COL.DUE_DATE).value),
            doc_status:         cellStr(row.getCell(COL.DOC_STATUS).value),
            rc_notes:           cellStr(row.getCell(COL.RC_NOTES).value),
        });

        // eachRow is synchronous, so throttle the callback rather than firing
        // it 4,000 times.
        if (onProgress && rows.length % 250 === 0) {
            onProgress(rows.length);
        }
    });

    onProgress?.(rows.length);

    return rows;
}
