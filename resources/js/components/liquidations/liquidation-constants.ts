export interface Program {
    id: string;
    name: string;
    code: string;
    parent_id: string | null;
    parent?: { id: string; code: string; name: string } | null;
    children_count?: number;
    is_selectable?: boolean;
}

export interface HEIOption {
    id: string;
    uii: string;
    name: string;
}

export interface AcademicYearOption {
    id: string;
    code: string;
    name: string;
}

export const SEMESTERS = [
    { value: '1st Semester', label: '1st Semester' },
    { value: '2nd Semester', label: '2nd Semester' },
    { value: 'Summer', label: 'Summer' },
] as const;

export const DOCUMENT_STATUSES = [
    { value: 'NONE', label: 'No Submission' },
    { value: 'PARTIAL', label: 'Partial Submission' },
    { value: 'COMPLETE', label: 'Complete Submission' },
] as const;

export interface RcNoteStatusOption {
    id: string;
    code: string;
    name: string;
    badge_color: string;
}

/** @deprecated Use rcNoteStatuses from backend instead */
export const RC_NOTES_OPTIONS = [
    { value: 'For Review', label: 'For Review' },
    { value: 'For Compliance', label: 'For Compliance' },
    { value: 'For Endorsement', label: 'For Endorsement' },
    { value: 'Fully Endorsed', label: 'Fully Endorsed' },
    { value: 'Partially Endorsed', label: 'Partially Endorsed' },
] as const;
