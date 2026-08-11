export interface DueDateRule {
    id: string;
    program_id: string;
    academic_year_id: string | null;
    due_date_days: number;
}

export interface Program {
    id: string;
    name: string;
    code: string;
    parent_id: string | null;
    parent?: { id: string; code: string; name: string } | null;
    children_count?: number;
    is_selectable?: boolean;
    due_date_rules?: DueDateRule[];
}

/**
 * Look up due date days for a program + optional academic year.
 * Priority: program+AY specific → program default (null AY) → fallback (30/90).
 */
export function getDueDateDays(programs: Program[], programId: string, academicYearId?: string | null): number {
    const program = programs.find((p) => p.id === programId);
    if (!program) return 90;

    const rules = program.due_date_rules || [];
    const fallback = program.parent_id ? 30 : 90;

    if (rules.length === 0) return fallback;

    // 1. Try program + specific AY
    if (academicYearId) {
        const ayRule = rules.find((r) => r.academic_year_id === academicYearId);
        if (ayRule) return ayRule.due_date_days;
    }

    // 2. Try program default (null AY)
    const defaultRule = rules.find((r) => !r.academic_year_id);
    if (defaultRule) return defaultRule.due_date_days;

    // 3. Fallback
    return fallback;
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

/**
 * Shape returned by Semester::getDropdownOptions().
 *
 * Replaces a hardcoded SEMESTERS list that lived here. That list could not see
 * anything added under Settings > Semesters, so a new semester was manageable in
 * the table yet never selectable on a liquidation. The options now come from the
 * server; `name` is what gets submitted, since that is the string the backend
 * resolves and the one saved bulk-entry drafts already hold.
 */
export interface SemesterOption {
    id: string;
    code: string;
    name: string;
}

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
