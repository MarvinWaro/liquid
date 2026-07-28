import { parseExcelBuffer, type ParsedExcelRow } from '@/lib/import-excel-parser';

/**
 * Parses the import workbook off the main thread.
 *
 * ExcelJS on a 4,000-row file blocks for several seconds. Running it here keeps
 * the dialog responsive and lets the progress bar move during the parse phase
 * instead of the tab appearing frozen.
 */

export interface ParseRequest {
    buffer: ArrayBuffer;
}

export type ParseResponse =
    | { type: 'progress'; rowsFound: number }
    | { type: 'done'; rows: ParsedExcelRow[] }
    | { type: 'error'; message: string };

/**
 * The project compiles against the DOM lib, where `self` is a Window. Narrowing
 * it here to just the two members a dedicated worker needs keeps this file
 * type-safe without pulling the WebWorker lib into the program, which conflicts
 * with DOM on dozens of shared declarations.
 */
const ctx = self as unknown as {
    postMessage(message: ParseResponse): void;
    onmessage: ((event: MessageEvent<ParseRequest>) => void) | null;
};

ctx.onmessage = (event) => {
    void (async () => {
        try {
            const rows = await parseExcelBuffer(event.data.buffer, (rowsFound) => {
                ctx.postMessage({ type: 'progress', rowsFound });
            });

            ctx.postMessage({ type: 'done', rows });
        } catch (error: unknown) {
            ctx.postMessage({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to parse the Excel file.',
            });
        }
    })();
};
