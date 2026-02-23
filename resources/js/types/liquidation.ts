export interface Beneficiary {
    id: number;
    student_no: string;
    last_name: string;
    first_name: string;
    middle_name: string | null;
    extension_name: string | null;
    award_no: string;
    date_disbursed: string;
    amount: string;
    remarks: string | null;
}

export interface LiquidationDocument {
    id: number;
    document_requirement_id?: string | null;
    document_type: string;
    file_name: string;
    file_path: string;
    file_size: number;
    uploaded_at: string;
    is_gdrive?: boolean;
    gdrive_link?: string;
}

export interface DocumentRequirement {
    id: string;
    code: string;
    name: string;
    description: string | null;
    is_required: boolean;
}

export interface DocumentCompleteness {
    total: number;
    fulfilled: number;
    percentage: number;
}

export interface ReviewHistoryEntry {
    returned_at?: string;
    returned_by?: string;
    returned_by_id?: number;
    review_remarks?: string;
    documents_for_compliance?: string | null;
    resubmitted_at?: string;
    resubmitted_by?: string;
    resubmitted_by_id?: number;
    hei_remarks?: string;
    type?: string;
}

export interface AccountantReviewHistoryEntry {
    returned_at: string;
    returned_by: string;
    returned_by_id: number;
    accountant_remarks: string;
}

export interface TrackingEntry {
    id?: string;
    document_status: string;
    received_by: string;
    date_received: string;
    document_location: string;
    reviewed_by: string;
    date_reviewed: string;
    rc_note: string;
    date_endorsement: string;
    liquidation_status: string;
}

export interface RunningDataEntry {
    id?: string;
    grantees_liquidated: number | null;
    amount_complete_docs: number | null;
    amount_refunded: number | null;
    refund_or_no: string;
    total_amount_liquidated: number | null;
    transmittal_ref_no: string;
    group_transmittal_ref_no: string;
}

export interface Liquidation {
    id: number;
    control_no: string;
    hei_name: string;
    program_name: string;
    academic_year: string;
    semester: string;
    batch_no: string;
    dv_control_no: string;
    amount_received: number;
    total_disbursed: number;
    remaining_amount: number;
    remarks?: string | null;
    review_remarks?: string | null;
    documents_for_compliance?: string | null;
    compliance_status?: string | null;
    review_history?: ReviewHistoryEntry[];
    accountant_review_history?: AccountantReviewHistoryEntry[];
    accountant_remarks?: string | null;
    beneficiaries: Beneficiary[];
    documents?: LiquidationDocument[];
    tracking_entries?: TrackingEntry[];
    running_data?: RunningDataEntry[];
    receiver_name?: string | null;
    document_location?: string | null;
    transmittal_reference_no?: string | null;
    number_of_folders?: number | null;
    folder_location_number?: string | null;
    group_transmittal?: string | null;
    reviewed_by_name?: string | null;
    reviewed_at?: string | null;
    date_fund_released?: string | null;
    due_date?: string | null;
    fund_source?: string | null;
    number_of_grantees?: number | null;
    amount_liquidated?: number;
    lapsing_period?: number;
    document_status?: string;
    liquidation_status?: string;
    date_submitted?: string | null;
    created_by_name?: string | null;
    document_completeness?: DocumentCompleteness;
}

export interface LiquidationUser {
    id: number;
    name: string;
    avatar_url?: string;
}

export interface HEI {
    id: number;
    name: string;
}

export interface ShowPagePermissions {
    review: boolean;
    submit: boolean;
    edit: boolean;
}

export interface ShowPageProps {
    liquidation: Liquidation;
    userHei: HEI | null;
    regionalCoordinators: LiquidationUser[];
    accountants: LiquidationUser[];
    documentLocations: string[];
    documentRequirements: DocumentRequirement[];
    permissions: ShowPagePermissions;
    userRole: string;
}

export const RC_NOTES_OPTIONS = [
    { value: 'For Review', label: 'For Review' },
    { value: 'For Compliance', label: 'For Compliance' },
    { value: 'For Endorsement', label: 'For Endorsement' },
    { value: 'Fully Endorsed', label: 'Fully Endorsed' },
    { value: 'Partially Endorsed', label: 'Partially Endorsed' },
];

export const AVATAR_COLORS = [
    'bg-blue-500 text-white',
    'bg-emerald-500 text-white',
    'bg-violet-500 text-white',
    'bg-amber-500 text-white',
    'bg-rose-500 text-white',
    'bg-cyan-500 text-white',
    'bg-indigo-500 text-white',
];

export function getInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function getAvatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getDocumentStatusColor(status: string): string {
    if (status?.toLowerCase().includes('complete')) return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    if (status?.toLowerCase().includes('partial')) return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
    return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
}

export function getLiquidationStatusColor(status: string): string {
    if (status?.toLowerCase().includes('fully')) return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    if (status?.toLowerCase().includes('partially')) return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
    return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
}

export function createEmptyTrackingEntry(): TrackingEntry {
    return {
        document_status: 'No Submission',
        received_by: '',
        date_received: '',
        document_location: '',
        reviewed_by: '',
        date_reviewed: '',
        rc_note: '',
        date_endorsement: '',
        liquidation_status: 'Unliquidated',
    };
}

export function createEmptyRunningDataEntry(): RunningDataEntry {
    return {
        grantees_liquidated: null,
        amount_complete_docs: null,
        amount_refunded: null,
        refund_or_no: '',
        total_amount_liquidated: null,
        transmittal_ref_no: '',
        group_transmittal_ref_no: '',
    };
}

export function isTrackingEntryFilled(entry: TrackingEntry): boolean {
    return entry.received_by !== '' || entry.date_received !== '' || entry.document_location !== '' ||
        entry.reviewed_by !== '' || entry.date_reviewed !== '' || entry.rc_note !== '' ||
        entry.date_endorsement !== '' || (entry.document_status !== 'No Submission' && entry.document_status !== '') ||
        (entry.liquidation_status !== 'Unliquidated' && entry.liquidation_status !== '');
}

export function isRunningDataEntryFilled(entry: RunningDataEntry): boolean {
    return (entry.grantees_liquidated !== null && entry.grantees_liquidated !== 0) ||
        (entry.amount_complete_docs !== null && entry.amount_complete_docs !== 0) ||
        (entry.amount_refunded !== null && entry.amount_refunded !== 0) ||
        entry.refund_or_no !== '' || entry.transmittal_ref_no !== '' || entry.group_transmittal_ref_no !== '';
}

export function formatDate(d: string): string {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m)-1]} ${parseInt(day)}, ${y}`;
}
