# UniFAST Liquidation System — Database ERD & Workflow

> Generated from a **live introspection** of the `liquid` MySQL database (MySQL 9.7.1, 62 migrations applied), not from reading the model files. Queried via `information_schema.KEY_COLUMN_USAGE` / `information_schema.COLUMNS` on **2026-07-30**. All diagrams render as Mermaid — GitHub, GitLab, Notion, Confluence (with the Mermaid macro), and Obsidian all display them natively.

**Scope note:** this database connection also hosts a second, unrelated schema (`asean_registration`) on the same MySQL server. It is a separate application and is excluded entirely below. Within `liquid`, 8 tables are Laravel framework infrastructure (`cache`, `cache_locks`, `sessions`, `jobs`, `job_batches`, `failed_jobs`, `migrations`, `password_reset_tokens`) — standard, not app-specific, and omitted from the diagrams for signal-to-noise reasons.

## How to read the ERDs

Crow's-foot notation:

| Symbol | Meaning |
|---|---|
| `\|\|--o{` | One (required) → zero-or-many. Standard parent/child, FK is `NOT NULL`. |
| `\|o--o{` | Zero-or-one → zero-or-many. FK is nullable. |
| `\|\|--\|\|` | One-to-one, required. FK is `NOT NULL` **and** `UNIQUE`. |
| `\|o--o\|` | One-to-one, optional. FK is nullable **and** `UNIQUE`. |

All primary/foreign keys in this app are UUID strings stored as `CHAR(36)` — shown below as `uuid` rather than the raw MySQL `char` for clarity. `tinyint(1)` boolean-cast columns are shown as `boolean`. Large diagrams are split by subject area; a table referenced from another area appears there as a **stub** (just its `id`) so the diagram stays self-contained — its full column list lives in its "home" diagram.

---

## 0. System Context

```mermaid
flowchart LR
    subgraph ORG["Organization &amp; Access"]
        direction TB
        Users["Users / Roles / Permissions"]
        Ref["HEIs · Programs · Regions<br/>Academic Years · Semesters"]
    end

    subgraph CORE["Liquidation Core"]
        direction TB
        Liq["Liquidations + Financials"]
        Docs["Documents · Beneficiaries · Comments"]
    end

    subgraph WF["Review &amp; Compliance Workflow"]
        direction TB
        Rev["Reviews · Compliance · Transmittals"]
        Track["Tracking Entries · Running Data"]
    end

    subgraph COLLAB["Collaboration &amp; Ops"]
        direction TB
        Ann["Announcements"]
        Sup["Support Tickets"]
        Notif["Notifications · Activity Log"]
        Tmpl["Templates · Import Batches"]
    end

    ORG -->|owns records, scopes access| CORE
    CORE -->|drives| WF
    WF -->|status feeds back| CORE
    ORG -->|participates in| COLLAB
    CORE -.->|referenced by| COLLAB
```

---

## 1A. Liquidation Core & Financials

The center of the app: one row per liquidation report, its 1:1 financial figures, and the records attached directly to it.

```mermaid
erDiagram
    LIQUIDATIONS {
        uuid id PK
        varchar control_no UK "e.g. TES-2026-0001"
        uuid hei_id FK
        uuid program_id FK
        uuid academic_year_id FK
        uuid semester_id FK
        uuid created_by FK
        uuid import_batch_id FK
        varchar batch_no
        uuid document_status_id FK
        uuid rc_note_status_id FK
        uuid liquidation_status_id FK
        date date_submitted
        text remarks
        uuid reviewed_by FK "RC"
        timestamp reviewed_at
        uuid accountant_reviewed_by FK
        timestamp accountant_reviewed_at
        uuid coa_endorsed_by FK
        timestamp coa_endorsed_at
        timestamp deleted_at "soft delete"
    }

    LIQUIDATION_FINANCIALS {
        uuid id PK
        uuid liquidation_id FK,UK "1-to-1"
        date date_fund_released
        date due_date
        varchar fund_source
        decimal amount_received
        decimal amount_disbursed
        decimal amount_liquidated
        decimal amount_refunded
        date disbursement_date
        int number_of_grantees
        json ledger_breakdown
        varchar or_number
        text purpose
    }

    LIQUIDATION_BENEFICIARIES {
        uuid id PK
        uuid liquidation_id FK
        varchar student_no
        varchar last_name
        varchar first_name
        varchar middle_name
        varchar extension_name
        varchar award_no
        date date_disbursed
        decimal amount
        text remarks
    }

    LIQUIDATION_DOCUMENTS {
        uuid id PK
        uuid liquidation_id FK
        uuid document_requirement_id FK
        varchar document_type
        varchar file_name
        varchar file_path
        varchar file_type
        int file_size
        varchar gdrive_link
        boolean is_gdrive
        text description
        uuid uploaded_by FK
    }

    LIQUIDATION_COMMENTS {
        uuid id PK
        uuid liquidation_id FK
        uuid document_requirement_id FK
        uuid user_id FK
        uuid parent_id FK "self: thread reply"
        text body
        json mentions
        json attachments
    }

    USER_LIQUIDATION_PINS {
        bigint id PK
        uuid user_id FK
        uuid liquidation_id FK
        timestamp pinned_at
    }

    HEIS { uuid id PK }
    PROGRAMS { uuid id PK }
    ACADEMIC_YEARS { uuid id PK }
    SEMESTERS { uuid id PK }
    IMPORT_BATCHES { uuid id PK }
    USERS { uuid id PK }
    DOCUMENT_STATUSES { uuid id PK }
    RC_NOTE_STATUSES { uuid id PK }
    LIQUIDATION_STATUSES { uuid id PK }
    DOCUMENT_REQUIREMENTS { uuid id PK }

    HEIS ||--o{ LIQUIDATIONS : "submits"
    PROGRAMS ||--o{ LIQUIDATIONS : "classified under"
    ACADEMIC_YEARS |o--o{ LIQUIDATIONS : "covers"
    SEMESTERS |o--o{ LIQUIDATIONS : "covers"
    IMPORT_BATCHES |o--o{ LIQUIDATIONS : "bulk-imported via"
    USERS |o--o{ LIQUIDATIONS : "created_by"
    USERS |o--o{ LIQUIDATIONS : "reviewed_by (RC)"
    USERS |o--o{ LIQUIDATIONS : "accountant_reviewed_by"
    USERS |o--o{ LIQUIDATIONS : "coa_endorsed_by"
    DOCUMENT_STATUSES |o--o{ LIQUIDATIONS : "sets"
    RC_NOTE_STATUSES |o--o{ LIQUIDATIONS : "sets"
    LIQUIDATION_STATUSES |o--o{ LIQUIDATIONS : "sets"

    LIQUIDATIONS ||--|| LIQUIDATION_FINANCIALS : "has"
    LIQUIDATIONS ||--o{ LIQUIDATION_BENEFICIARIES : "lists"
    LIQUIDATIONS ||--o{ LIQUIDATION_DOCUMENTS : "has"
    LIQUIDATIONS ||--o{ LIQUIDATION_COMMENTS : "has"
    LIQUIDATIONS ||--o{ USER_LIQUIDATION_PINS : "pinned as"
    USERS ||--o{ USER_LIQUIDATION_PINS : "pins"
    USERS ||--o{ LIQUIDATION_DOCUMENTS : "uploaded_by"
    USERS ||--o{ LIQUIDATION_COMMENTS : "writes"
    DOCUMENT_REQUIREMENTS |o--o{ LIQUIDATION_DOCUMENTS : "fulfills"
    DOCUMENT_REQUIREMENTS |o--o{ LIQUIDATION_COMMENTS : "discusses"
    LIQUIDATION_COMMENTS ||--o{ LIQUIDATION_COMMENTS : "replies to (self)"
```

> **Sanity check:** as of this snapshot, `liquidations` and `liquidation_financials` both have exactly **5,539** rows — confirming the 1:1 is enforced in practice, not just in schema.

---

## 1B. Review, Compliance & Tracking Workflow

Everything the RC → Accountant → COA review cycle writes to.

```mermaid
erDiagram
    LIQUIDATION_REVIEWS {
        uuid id PK
        uuid liquidation_id FK
        uuid review_type_id FK
        uuid performed_by FK
        varchar performed_by_name "denormalized snapshot"
        text remarks
        text documents_for_compliance
        timestamp performed_at
    }

    LIQUIDATION_COMPLIANCE {
        uuid id PK
        uuid liquidation_id FK
        text documents_required
        uuid compliance_status_id FK
        timestamp concerns_emailed_at
        timestamp compliance_submitted_at
        decimal amount_with_complete_docs
    }

    LIQUIDATION_RUNNING_DATA {
        uuid id PK
        uuid liquidation_id FK
        int grantees_liquidated
        decimal amount_complete_docs
        decimal amount_refunded
        varchar refund_or_no
        decimal total_amount_liquidated
        varchar transmittal_ref_no
        varchar group_transmittal_ref_no
        int sort_order
    }

    LIQUIDATION_TRACKING_ENTRIES {
        uuid id PK
        uuid liquidation_id FK
        uuid document_status_id FK
        text received_by
        date date_received
        text reviewed_by
        date date_reviewed
        varchar rc_note
        date date_endorsement
        uuid liquidation_status_id FK
        int sort_order
    }

    LIQUIDATION_TRACKING_ENTRY_LOCATIONS {
        uuid tracking_entry_id PK,FK
        uuid document_location_id PK,FK
        int sort_order
    }

    LIQUIDATION_TRANSMITTALS {
        uuid id PK
        uuid liquidation_id FK
        varchar transmittal_reference_no UK
        varchar receiver_name
        uuid document_location_id FK
        int number_of_folders
        varchar folder_location_number
        varchar group_transmittal
        text other_file_location
        uuid endorsed_by FK
        timestamp endorsed_at
        timestamp received_at
        json location_history
    }

    LIQUIDATIONS { uuid id PK }
    REVIEW_TYPES { uuid id PK }
    COMPLIANCE_STATUSES { uuid id PK }
    DOCUMENT_LOCATIONS { uuid id PK }
    DOCUMENT_STATUSES { uuid id PK }
    LIQUIDATION_STATUSES { uuid id PK }
    USERS { uuid id PK }

    LIQUIDATIONS ||--o{ LIQUIDATION_REVIEWS : "audit trail"
    LIQUIDATIONS ||--o{ LIQUIDATION_COMPLIANCE : "tracks"
    LIQUIDATIONS ||--o{ LIQUIDATION_RUNNING_DATA : "ledger rows"
    LIQUIDATIONS ||--o{ LIQUIDATION_TRACKING_ENTRIES : "movement log"
    LIQUIDATIONS ||--o{ LIQUIDATION_TRANSMITTALS : "endorsement batches"

    REVIEW_TYPES ||--o{ LIQUIDATION_REVIEWS : "classifies"
    USERS ||--o{ LIQUIDATION_REVIEWS : "performed_by"
    COMPLIANCE_STATUSES |o--o{ LIQUIDATION_COMPLIANCE : "sets"
    DOCUMENT_STATUSES |o--o{ LIQUIDATION_TRACKING_ENTRIES : "sets"
    LIQUIDATION_STATUSES |o--o{ LIQUIDATION_TRACKING_ENTRIES : "sets"
    DOCUMENT_LOCATIONS |o--o{ LIQUIDATION_TRANSMITTALS : "delivered to"
    USERS ||--o{ LIQUIDATION_TRANSMITTALS : "endorsed_by"

    LIQUIDATION_TRACKING_ENTRIES ||--o{ LIQUIDATION_TRACKING_ENTRY_LOCATIONS : "visited"
    DOCUMENT_LOCATIONS ||--o{ LIQUIDATION_TRACKING_ENTRY_LOCATIONS : "visited by"
```

---

## 2A. Identity & Access

```mermaid
erDiagram
    USERS {
        uuid id PK
        varchar name
        varchar email UK
        varchar avatar
        uuid role_id FK
        uuid hei_id FK
        uuid region_id FK
        uuid program_id FK
        enum status "active/inactive"
        timestamp email_verified_at
        varchar password
        text two_factor_secret
        text two_factor_recovery_codes
        timestamp two_factor_confirmed_at
        timestamp last_active_at
    }

    ROLES {
        uuid id PK
        varchar name UK "Super Admin, Admin, Regional Coordinator, STUFAPS Focal, Encoder, HEI, Accountant, COA, Viewer"
        text description
    }

    PERMISSIONS {
        uuid id PK
        varchar name UK
        varchar module
        text description
    }

    ROLE_PERMISSION {
        uuid role_id PK,FK
        uuid permission_id PK,FK
    }

    USER_PERMISSION {
        uuid user_id PK,FK
        uuid permission_id PK,FK
    }

    REGIONS {
        uuid id PK
        varchar code UK
        varchar name
        varchar description
        enum status
    }

    HEIS {
        uuid id PK
        varchar uii UK "unique institutional identifier"
        varchar code
        varchar name
        enum type
        uuid region_id FK
        varchar logo
        enum status
    }

    PROGRAMS {
        uuid id PK
        uuid parent_id FK "self: sub-program"
        varchar code UK
        varchar name
        text description
        enum status
    }

    USER_PROGRAM {
        uuid user_id PK,FK
        uuid program_id PK,FK
    }

    ROLES ||--o{ USERS : "assigned"
    HEIS |o--o{ USERS : "belongs to"
    REGIONS |o--o{ USERS : "belongs to"
    PROGRAMS |o--o{ USERS : "scoped to"

    ROLES ||--o{ ROLE_PERMISSION : "grants"
    PERMISSIONS ||--o{ ROLE_PERMISSION : "granted via"
    USERS ||--o{ USER_PERMISSION : "direct grant"
    PERMISSIONS ||--o{ USER_PERMISSION : "granted to"

    REGIONS ||--o{ HEIS : "located in"
    PROGRAMS ||--o{ PROGRAMS : "parent of (self)"

    USERS ||--o{ USER_PROGRAM : "assigned to"
    PROGRAMS ||--o{ USER_PROGRAM : "assigned via"
```

*Permissions are granted two ways — via `role_permission` (inherited from the assigned role) and `user_permission` (per-user overrides on top of the role). 56 permissions, 9 roles, 176 role→permission grants exist as of this snapshot.*

---

## 2B. Reference & Lookup Data

The controlled vocabularies that drive dropdowns, badges, and status logic app-wide.

```mermaid
erDiagram
    ACADEMIC_YEARS {
        uuid id PK
        varchar code UK
        varchar name
        date start_date
        date end_date
        int sort_order
        boolean is_active
    }

    SEMESTERS {
        uuid id PK
        varchar code UK
        varchar name
        int sort_order
        boolean is_active
    }

    PROGRAM_DUE_DATE_RULES {
        uuid id PK
        uuid program_id FK
        uuid academic_year_id FK
        int due_date_days
    }

    DOCUMENT_REQUIREMENTS {
        uuid id PK
        uuid program_id FK
        varchar code
        varchar name
        text description
        varchar reference_image_path
        text upload_message
        int sort_order
        boolean is_active
        boolean is_required
    }

    ACADEMIC_YEAR_DOCUMENT_REQUIREMENTS {
        uuid id PK
        uuid academic_year_id FK
        uuid document_requirement_id FK
        boolean is_required
        boolean is_active
        int sort_order
    }

    DOCUMENT_LOCATIONS {
        uuid id PK
        varchar name UK
        int sort_order
    }

    LIQUIDATION_STATUSES {
        uuid id PK
        varchar code UK "UNLIQUIDATED / PARTIALLY_LIQUIDATED / FULLY_LIQUIDATED / VOIDED"
        varchar name
        varchar badge_color
        int sort_order
        boolean is_active
    }

    DOCUMENT_STATUSES {
        uuid id PK
        varchar code UK "NONE / PARTIAL / COMPLETE"
        varchar name
        varchar badge_color
        int sort_order
        boolean is_active
    }

    RC_NOTE_STATUSES {
        uuid id PK
        varchar code UK "NO_SUBMISSION / FOR_REVIEW / FOR_COMPLIANCE / FOR_ENDORSEMENT / PARTIALLY_ENDORSED / FULLY_ENDORSED"
        varchar name
        varchar badge_color
        int sort_order
        boolean is_active
    }

    COMPLIANCE_STATUSES {
        uuid id PK
        varchar code UK "pending_hei_review / documents_submitted / under_review / compliant / non_compliant"
        varchar name
        varchar badge_color
        int sort_order
        boolean is_active
    }

    REVIEW_TYPES {
        uuid id PK
        varchar code UK "rc_return / rc_endorsement / hei_resubmission / accountant_return / accountant_endorsement"
        varchar name
        text description
        int sort_order
        boolean is_active
    }

    PROGRAMS { uuid id PK }

    PROGRAMS ||--o{ PROGRAM_DUE_DATE_RULES : "sets SLA for"
    ACADEMIC_YEARS |o--o{ PROGRAM_DUE_DATE_RULES : "per year"
    PROGRAMS ||--o{ DOCUMENT_REQUIREMENTS : "requires"
    ACADEMIC_YEARS ||--o{ ACADEMIC_YEAR_DOCUMENT_REQUIREMENTS : "activates"
    DOCUMENT_REQUIREMENTS ||--o{ ACADEMIC_YEAR_DOCUMENT_REQUIREMENTS : "activated per year"
```

---

## 3. Collaboration, Notifications & Audit

```mermaid
erDiagram
    ANNOUNCEMENTS {
        uuid id PK
        varchar title
        varchar slug UK
        varchar category
        varchar tag_color
        varchar excerpt
        longtext content
        varchar cover_original_path
        varchar cover_display_path
        varchar cover_thumb_path
        boolean is_featured
        boolean show_to_hei
        timestamp published_at
        timestamp end_date
        uuid created_by FK
        timestamp deleted_at
    }

    ANNOUNCEMENT_COMMENTS {
        uuid id PK
        uuid announcement_id FK
        uuid user_id FK
        uuid parent_id FK "self: thread reply"
        text body
        json mentions
        timestamp deleted_at
    }

    ANNOUNCEMENT_COMMENT_REACTIONS {
        uuid id PK
        uuid comment_id FK
        uuid user_id FK
    }

    SUPPORT_TICKETS {
        uuid id PK
        varchar ticket_number UK
        uuid requester_id FK
        uuid liquidation_id FK
        uuid assigned_to FK
        varchar category
        varchar priority
        varchar status
        varchar subject
        text description
        timestamp last_reply_at
        timestamp resolved_at
        uuid resolved_by FK
    }

    SUPPORT_TICKET_MESSAGES {
        uuid id PK
        uuid support_ticket_id FK
        uuid user_id FK
        text body
        boolean is_internal
    }

    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK "recipient"
        uuid actor_id FK "who triggered it"
        varchar actor_name
        varchar action
        varchar description
        varchar subject_type
        uuid subject_id
        varchar subject_label
        varchar module
        json metadata
        timestamp read_at
    }

    ACTIVITY_LOGS {
        uuid id PK
        uuid user_id FK
        varchar user_name "denormalized snapshot"
        varchar action
        varchar description
        varchar subject_type
        uuid subject_id
        varchar subject_label
        json old_values
        json new_values
        varchar module
        varchar ip_address
        varchar user_agent
    }

    TEMPLATES {
        uuid id PK
        varchar name
        varchar category
        text description
        varchar file_path
        varchar original_filename
        bigint file_size
        varchar mime_type
        boolean is_active
        uuid uploaded_by FK
    }

    BULK_ENTRY_DRAFTS {
        uuid id PK
        uuid user_id FK,UK "1 draft per user"
        json rows
    }

    IMPORT_BATCHES {
        uuid id PK
        uuid user_id FK
        varchar file_name
        varchar file_path
        bigint file_size
        int total_rows
        int imported_count
        varchar status
        text failed_reason
        timestamp undone_at
    }

    USERS { uuid id PK }
    LIQUIDATIONS { uuid id PK }

    USERS ||--o{ ANNOUNCEMENTS : "authors"
    ANNOUNCEMENTS ||--o{ ANNOUNCEMENT_COMMENTS : "has"
    USERS ||--o{ ANNOUNCEMENT_COMMENTS : "writes"
    ANNOUNCEMENT_COMMENTS ||--o{ ANNOUNCEMENT_COMMENTS : "replies to (self)"
    ANNOUNCEMENT_COMMENTS ||--o{ ANNOUNCEMENT_COMMENT_REACTIONS : "reacted to"
    USERS ||--o{ ANNOUNCEMENT_COMMENT_REACTIONS : "reacts"

    USERS ||--o{ SUPPORT_TICKETS : "requests"
    LIQUIDATIONS |o--o{ SUPPORT_TICKETS : "concerns"
    USERS |o--o{ SUPPORT_TICKETS : "assigned_to"
    SUPPORT_TICKETS ||--o{ SUPPORT_TICKET_MESSAGES : "thread"
    USERS |o--o{ SUPPORT_TICKET_MESSAGES : "writes"

    USERS ||--o{ NOTIFICATIONS : "receives"
    USERS |o--o{ ACTIVITY_LOGS : "performed by"
    USERS |o--o{ TEMPLATES : "uploaded_by"
    USERS ||--o{ BULK_ENTRY_DRAFTS : "drafts"
    USERS ||--o{ IMPORT_BATCHES : "runs"
```

---

## 4. Liquidation Lifecycle — Workflow Flowchart

Traced directly from `LiquidationService` (`submitForReview`, `endorseToAccounting`, `returnToHEI`, `endorseToCOA`, `returnToRC`) and `LiquidationController::void/restore` — this is the actual guard logic in the code, not the idealized process.

```mermaid
flowchart TD
    Start(["HEI / Encoder / RC creates liquidation"]) --> Create["status = UNLIQUIDATED<br/>document_status = NONE<br/>rc_note_status resolved from input"]
    Create --> Upload["Upload documents &amp; beneficiary list<br/>(optional, any time before submit)"]
    Upload --> Submit(["Submit for review"])

    Submit --> GuardSubmit{"coa_endorsed_at<br/>already set?"}
    GuardSubmit -->|yes| RejectSubmit["❌ Blocked:<br/>already finalized to COA"]
    GuardSubmit -->|no| RecalcDoc["document_status recalculated:<br/>NONE / PARTIAL / COMPLETE<br/>based on beneficiaries + documents present"]
    RecalcDoc --> DateSet["date_submitted = now()"]
    DateSet --> RCQueue(["Enters Regional Coordinator queue"])

    RCQueue --> RCDecision{"RC decision"}

    RCDecision -->|"Return to HEI"| RCReturn["rc_return review logged<br/>liquidation_status → UNLIQUIDATED<br/>reviewed_by / reviewed_at SET ⚠️<br/>optional compliance record created"]
    RCReturn -.->|HEI revises &amp; resubmits| Submit

    RCDecision -->|"Endorse to Accounting"| GuardEndorse{"reviewed_at<br/>already set?"}
    GuardEndorse -->|yes| RejectEndorse["❌ Blocked:<br/>'already endorsed to Accounting'<br/>— also true after a prior<br/>Return-to-HEI ⚠️ see note below"]
    GuardEndorse -->|no| CalcPctRC["% = amount_liquidated ÷ amount_disbursed"]
    CalcPctRC --> PctCheckRC{"% ≥ 100?"}
    PctCheckRC -->|yes| FullRC["liquidation_status →<br/>FULLY_LIQUIDATED"]
    PctCheckRC -->|no| PartialRC["liquidation_status →<br/>PARTIALLY_LIQUIDATED"]
    FullRC --> RCEndorsed
    PartialRC --> RCEndorsed["reviewed_by / reviewed_at set<br/>optional transmittal created<br/>Accountant &amp; Admin notified"]

    RCEndorsed --> AccQueue(["Enters Accountant queue"])
    AccQueue --> AccDecision{"Accountant decision"}

    AccDecision -->|"Return to RC"| AccReturn["accountant_return review logged<br/>liquidation_status → UNLIQUIDATED<br/>accountant_reviewed_at set<br/>(reviewed_at stays set —<br/>record stays in Accountant's pool)"]
    AccReturn -.->|coordinates fix, retries| AccDecision

    AccDecision -->|"Endorse to COA"| GuardCOA{"reviewed_at set AND<br/>coa_endorsed_at not set?"}
    GuardCOA -->|no| RejectCOA["❌ Blocked:<br/>not yet endorsed by RC,<br/>or already sent to COA"]
    GuardCOA -->|yes| CalcPctAcc["% recalculated the same way"]
    CalcPctAcc --> PctCheckAcc{"% ≥ 100?"}
    PctCheckAcc -->|yes| FullAcc["FULLY_LIQUIDATED"]
    PctCheckAcc -->|no| PartialAcc["PARTIALLY_LIQUIDATED"]
    FullAcc --> Final
    PartialAcc --> Final(["✅ Endorsed to COA — terminal state<br/>coa_endorsed_by / coa_endorsed_at set<br/>no code path leaves this state"])

    VoidStart(["User with delete_liquidation permission"]) -.->|"Void"| Voided["liquidation_status → VOIDED"]
    Voided -.->|"Restore"| Restored["liquidation_status → UNLIQUIDATED"]
```

### ⚠️ Finding surfaced while building this diagram

`LiquidationService::returnToHEI()` sets `reviewed_by` / `reviewed_at` — the same two columns `endorseToAccounting()` uses to mean *"RC already endorsed this."* Its guard is a blind non-null check:

```php
// endorseToAccounting()
if ($liquidation->reviewed_at) {
    throw new \InvalidArgumentException('This liquidation has already been endorsed to Accounting.');
}
```

Walk the sequence: HEI submits → RC **returns to HEI** (sets `reviewed_at`) → HEI fixes and resubmits → RC tries to **endorse to Accounting** → the guard sees `reviewed_at` is non-null and rejects it with "already endorsed," even though it never was. I traced this through `LiquidationService.php:713-915` and the three `add*Return`/`addHEIResubmission` helpers in `Liquidation.php` (none of them clear `reviewed_at`), so this isn't a guess — every liquidation that has ever been returned-to-HEI once looks permanently "already endorsed" to that guard. Worth a look when you have time; happy to patch it (the natural fix is scoping the guard to `reviewed_at && !returned-to-HEI-since`, or clearing `reviewed_by`/`reviewed_at` in `returnToHEI()` and using a dedicated flag instead of overloading those two columns for both meanings).

### Role → workflow stage

| Role | Verified action in this workflow |
|---|---|
| **HEI** | Creates and submits liquidations for their own institution (`hei_id`-scoped). |
| **Regional Coordinator** | Creates liquidations for HEIs in their region; endorses to Accounting or returns to HEI. Region-scoped throughout. |
| **STUFAPS Focal** | Same endorse/return actions as RC, scoped by program instead of region (`getParentScopedProgramIds()`). |
| **Accountant** | Endorses to COA or returns to RC. |
| **Encoder** | Data-entry role; shares RC's program-scoping pattern for record creation. |
| **Super Admin / Admin** | Unscoped — can filter by region, manage roles/users/HEIs/programs/reference data. |
| **COA** | Named terminal destination of the workflow (`coa_endorsed_*`); specific route/permission bindings weren't traced in this pass. |
| **Viewer** | Exists in `roles`; not exercised in the code paths read for this document. |

---

## Appendix

### A. Full foreign-key list (live introspection, 2026-07-30)

```
academic_year_document_requirements.academic_year_id -> academic_years.id
academic_year_document_requirements.document_requirement_id -> document_requirements.id
activity_logs.user_id -> users.id
announcement_comment_reactions.comment_id -> announcement_comments.id
announcement_comment_reactions.user_id -> users.id
announcement_comments.announcement_id -> announcements.id
announcement_comments.parent_id -> announcement_comments.id
announcement_comments.user_id -> users.id
announcements.created_by -> users.id
bulk_entry_drafts.user_id -> users.id
document_requirements.program_id -> programs.id
heis.region_id -> regions.id
import_batches.user_id -> users.id
liquidation_beneficiaries.liquidation_id -> liquidations.id
liquidation_comments.document_requirement_id -> document_requirements.id
liquidation_comments.liquidation_id -> liquidations.id
liquidation_comments.parent_id -> liquidation_comments.id
liquidation_comments.user_id -> users.id
liquidation_compliance.compliance_status_id -> compliance_statuses.id
liquidation_compliance.liquidation_id -> liquidations.id
liquidation_documents.document_requirement_id -> document_requirements.id
liquidation_documents.liquidation_id -> liquidations.id
liquidation_documents.uploaded_by -> users.id
liquidation_financials.liquidation_id -> liquidations.id
liquidation_reviews.liquidation_id -> liquidations.id
liquidation_reviews.performed_by -> users.id
liquidation_reviews.review_type_id -> review_types.id
liquidation_running_data.liquidation_id -> liquidations.id
liquidation_tracking_entries.document_status_id -> document_statuses.id
liquidation_tracking_entries.liquidation_id -> liquidations.id
liquidation_tracking_entries.liquidation_status_id -> liquidation_statuses.id
liquidation_tracking_entry_locations.document_location_id -> document_locations.id
liquidation_tracking_entry_locations.tracking_entry_id -> liquidation_tracking_entries.id
liquidation_transmittals.document_location_id -> document_locations.id
liquidation_transmittals.endorsed_by -> users.id
liquidation_transmittals.liquidation_id -> liquidations.id
liquidations.academic_year_id -> academic_years.id
liquidations.accountant_reviewed_by -> users.id
liquidations.coa_endorsed_by -> users.id
liquidations.created_by -> users.id
liquidations.document_status_id -> document_statuses.id
liquidations.hei_id -> heis.id
liquidations.import_batch_id -> import_batches.id
liquidations.liquidation_status_id -> liquidation_statuses.id
liquidations.program_id -> programs.id
liquidations.rc_note_status_id -> rc_note_statuses.id
liquidations.reviewed_by -> users.id
liquidations.semester_id -> semesters.id
notifications.actor_id -> users.id
notifications.user_id -> users.id
program_due_date_rules.academic_year_id -> academic_years.id
program_due_date_rules.program_id -> programs.id
programs.parent_id -> programs.id
role_permission.permission_id -> permissions.id
role_permission.role_id -> roles.id
sessions.user_id -> users.id
support_ticket_messages.support_ticket_id -> support_tickets.id
support_ticket_messages.user_id -> users.id
support_tickets.assigned_to -> users.id
support_tickets.liquidation_id -> liquidations.id
support_tickets.requester_id -> users.id
support_tickets.resolved_by -> users.id
templates.uploaded_by -> users.id
user_liquidation_pins.liquidation_id -> liquidations.id
user_liquidation_pins.user_id -> users.id
user_permission.permission_id -> permissions.id
user_permission.user_id -> users.id
user_program.program_id -> programs.id
user_program.user_id -> users.id
users.hei_id -> heis.id
users.program_id -> programs.id
users.region_id -> regions.id
users.role_id -> roles.id
```

### B. Row counts snapshot (2026-07-30)

Included for scale context — note most workflow-satellite tables (documents, beneficiaries, comments, reviews, compliance, tracking, transmittals) are currently empty relative to 5,539 liquidations, since that volume came from bulk import batches rather than the full per-record UI workflow.

| Table | Rows | Table | Rows |
|---|---|---|---|
| liquidations | 5,539 | permissions | 56 |
| liquidation_financials | 5,539 | role_permission | 176 |
| heis | 177 | roles | 9 |
| users | 203 | semesters | 6 |
| document_locations | 82 | rc_note_statuses | 6 |
| document_requirements | 42 | compliance_statuses | 5 |
| academic_years | 10 | review_types | 5 |
| program_due_date_rules | 10 | liquidation_statuses | 4 |
| programs | 9 | document_statuses | 3 |
| regions | 2 | user_program | 7 |
| import_batches | 2 | activity_logs | 9 |
| notifications | 1 | sessions | 3 |
| academic_year_document_requirements | 3 | cache | 11 |

All other listed tables (beneficiaries, documents, comments, compliance, reviews, running_data, tracking entries/locations, transmittals, announcements + children, support tickets + messages, templates, bulk_entry_drafts, user_liquidation_pins, user_permission) are at 0 rows as of this snapshot.
