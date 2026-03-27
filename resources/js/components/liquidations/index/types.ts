export interface Program {
    id: string;
    name: string;
    code: string;
    parent_id: string | null;
}

export interface Liquidation {
    id: number;
    program: Program | null;
    uii: string;
    hei_name: string;
    date_fund_released: string | null;
    due_date: string | null;
    academic_year: string | null;
    semester: string | null;
    batch_no: string | null;
    dv_control_no: string;
    number_of_grantees: number | null;
    total_disbursements: string;
    total_amount_liquidated: string;
    total_unliquidated_amount: string;
    document_status: string;
    document_status_code: string;
    rc_notes: string | null;
    liquidation_status: string;
    liquidation_status_code: string;
    percentage_liquidation: number;
    lapsing_period: number;
    is_voided: boolean;
}

export interface HEIOption {
    id: string;
    name: string;
    uii: string;
}

export interface AcademicYearOption {
    id: string;
    code: string;
    name: string;
}

export interface RcNoteStatusOption {
    id: string;
    code: string;
    name: string;
    badge_color: string;
}

export function getDocumentStatusColor(status: string): string {
    if (status?.includes('Complete')) {
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60';
    }
    if (status?.includes('Partial')) {
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60';
    }
    return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60';
}

export function getLiquidationStatusColor(status: string): string {
    if (status?.includes('Voided')) {
        return 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-950/40 dark:text-gray-400 dark:border-gray-800/60';
    }
    if (status?.includes('Fully Liquidated')) {
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60';
    }
    if (status?.includes('Partially Liquidated')) {
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60';
    }
    return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60';
}
