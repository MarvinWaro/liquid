# Liquidation System - Missing Columns and Fields Analysis

## CURRENT DATABASE vs EXCEL REQUIREMENTS

### SHEET 2 COLUMNS (STATUS - INITIAL REVIEW):

```
 1. # (SEQ NUMBER)                                          AUTO INCREMENT
 2. HEI Name                                                EXISTS (hei_id)
 3. Academic Year                                           EXISTS
 4. Semester                                                EXISTS
 5. Date Endorsed for Payment/TES Fund Released             MISSING
 6. Batch no.                                               EXISTS
 7. DV Control no.                                          EXISTS (control_no)
 8. Number of Grantees                                      COMPUTED (beneficiaries count)
 9. Total Disbursements                                     EXISTS (amount_received)
10. Amount with Complete Documents                          MISSING
11. Amount Refunded                                         EXISTS but named 'amount_refunded'
12. Refund OR no.                                           MISSING
13. Total Amount Liquidated                                 EXISTS (liquidated_amount)
14. Total Unliquidated Amount                               COMPUTED (amount_received - liquidated_amount)
15. Status of Documents                                     MISSING (Complete/Partial/No Submission)
16. Date of HEI's submission of Liquidation Report          EXISTS as 'created_at' but should track submission date
17. Number of days Lapsed                                   COMPUTED
18. Receiver                                                MISSING (who received the physical documents)
19. Document Location                                       MISSING (physical location tracking)
20. Reviewed By                                             EXISTS (reviewed_by)
21. Date Reviewed                                           EXISTS (reviewed_at)
22. Regional Coordinator's Note                             EXISTS (review_remarks)
23. Documents for compliance                                MISSING
24. Status of HEI Compliance                                MISSING
25. Date of Email of Concerns                               MISSING
26. Date of Submission of Compliance                        MISSING
27. Aging of compliance for Concerns                        COMPUTED
28. Status of Liquidation                                   EXISTS (status)
29. Endorsed by (Regional Coordinator)                      EXISTS (reviewed_by)
30. Date of Endorsement                                     EXISTS (reviewed_at)
31. Transmittal Reference Number                            MISSING
32. Number of Folders                                       MISSING
33. Group Transmittal                                       MISSING
34. Other File Location                                     MISSING
```

## RECOMMENDED DATABASE MIGRATION

```sql
ALTER TABLE liquidations ADD COLUMN:

-- Fund Release & Endorsement Tracking
date_fund_released           DATE          -- Date Endorsed for Payment/TES Fund Released
dv_control_no                VARCHAR(255)  -- if different from control_no

-- Document Status Tracking
document_status              ENUM('Complete Submission', 'Partial Submission', 'No Submission')
date_submitted               DATETIME      -- Date of HEI's submission
days_lapsed                  INT GENERATED -- DATEDIFF(date_submitted, date_fund_released + 90)

-- Physical Document Management
receiver_name                VARCHAR(255)  -- Who received physical docs
received_at                  DATETIME      -- When received
document_location            VARCHAR(255)  -- Physical storage location: Shelf 1B R5, etc.
document_location_history    JSON          -- Track document transfers

-- Refund Details
refund_or_number            VARCHAR(255)  -- Official Receipt number for refund
amount_with_complete_docs   DECIMAL(15,2) -- Amount with complete documentation

-- Compliance Tracking (FOR COMPLIANCE status)
documents_for_compliance    TEXT          -- List of missing/required documents
compliance_status           VARCHAR(255)  -- Pending Review by HEI, Submitted, etc.
date_concerns_emailed       DATETIME      -- When compliance concerns were sent
date_compliance_submitted   DATETIME      -- When HEI submitted compliance docs
compliance_aging_days       INT GENERATED -- Days since concerns emailed

-- Endorsement to Accounting
transmittal_reference_no    VARCHAR(255)  -- Transmittal number to accounting
number_of_folders           INT           -- Physical folder count
folder_location_number      VARCHAR(255)  -- e.g., "2/UniFAST R12-CMFCI-File 1952"
group_transmittal           VARCHAR(255)  -- Group transmittal number
other_file_location         TEXT          -- Additional location notes
date_endorsed_to_accounting DATETIME      -- When endorsed to accounting
```

## STATUS FLOW MAPPING

```
Current Statuses:
✓ draft                    - HEI is preparing the liquidation
✓ for_initial_review       - Submitted by HEI, pending RC review (INITIAL REVIEW)
✓ returned_to_hei          - RC returned for compliance (FOR COMPLIANCE)
✗ for_endorsement          - MISSING - RC marked as ready for endorsement
✓ endorsed_to_accounting   - RC endorsed to Accounting (STATUS AFTER ENDORSEMENT)
✓ returned_to_rc           - Accountant returned to RC
✓ endorsed_to_coa          - Accountant endorsed to COA
```

## FORM FIELD ADDITIONS NEEDED

### 1. CREATE LIQUIDATION FORM (HEI):
```
✓ HEI Name (auto-filled from user)
✓ Academic Year
✓ Semester
✓ Batch Number
✓ Amount Received
✗ ADD: Date Fund Released/Endorsed for Payment
✗ ADD: DV Control Number (if different from auto-generated control_no)
```

### 2. SUBMIT FOR REVIEW (HEI):
```
✓ Upload Beneficiaries CSV
✓ Upload Supporting Documents
✓ Optional Remarks
✗ ADD: Document Status (Complete/Partial/No Submission) - auto-detect or manual
✗ ADD: Amount with Complete Documents
✗ ADD: Refund OR Number (if applicable)
✗ ADD: Amount Refunded
```

### 3. REGIONAL COORDINATOR INITIAL REVIEW:
```
✓ Review Remarks
✗ ADD: Receiver (who physically received the documents)
✗ ADD: Document Location (shelf location dropdown)
✗ ADD: Date Reviewed (auto-filled)
✗ ADD: Document Status assessment
```

### 4. RC RETURN TO HEI (FOR COMPLIANCE):
```
✓ Review Remarks (required)
✗ ADD: Documents for Compliance (checklist of missing items)
✗ ADD: Compliance Status
✗ ADD: Date of Email of Concerns (auto-filled when returned)
```

### 5. RC ENDORSE TO ACCOUNTING:
```
✓ Review Remarks (optional)
✗ ADD: Transmittal Reference Number (required)
✗ ADD: Number of Folders
✗ ADD: Folder Location Number
✗ ADD: Group Transmittal Number
✗ ADD: Date of Endorsement (auto-filled)
```

## PRIORITY RECOMMENDATIONS

### HIGH PRIORITY (Critical for workflow):
1. **Document Status** (Complete/Partial/No Submission) - dropdown enum
2. **Date of Submission** (separate from created_at) - track when HEI submits
3. **Receiver Name** (physical document tracking) - dropdown from list
4. **Document Location** (physical storage) - dropdown: Shelf 1B R1-R5
5. **Documents for Compliance** (when returning to HEI) - textarea with checklist
6. **Transmittal Reference Number** (for accounting endorsement) - required field
7. **Date Fund Released** (for aging calculations) - date field in create form

### MEDIUM PRIORITY (Important for reporting):
8. **Refund OR Number** - text field when amount_refunded > 0
9. **Amount with Complete Documents** - numeric field
10. **Date Concerns Emailed** - auto-filled when status changes to returned_to_hei
11. **Date Compliance Submitted** - when HEI resubmits after compliance
12. **Number of Folders** - integer field
13. **Folder Location Number** - text field

### LOW PRIORITY (Nice to have):
14. **Group Transmittal** - text field
15. **Other File Location** - textarea for notes
16. **Document Location History** - JSON tracking of transfers

## DROPDOWN OPTIONS (From 'list' sheet)

### Status of Documents:
- Complete Submission
- Partial Submission
- No Submission (Default)

### Receiver / Reviewed by:
- Aries Jake Laro
- Jay-Arr Castillo
- Beberly Baton
- Edelle Joy Villanueva
- Angel Mae Magbanua

### Document Location:
- Shelf 1B R1
- Shelf 1B R2
- Shelf 1B R3
- Shelf 1B R4
- Shelf 1B R5

### Regional Coordinator's Note (Status):
- For Review
- Fully Endorsed
- Partially Endorsed
- FOR COMPLIANCE
- FOR ENDORSEMENT
- Returned to HEI

## COMPUTED FIELDS

### Number of days Lapsed:
```
DATEDIFF(NOW(), date_fund_released + INTERVAL 90 DAY)
```

### Aging of compliance for Concerns:
```
DATEDIFF(NOW(), date_concerns_emailed)
```

### Total Unliquidated Amount:
```
amount_received - liquidated_amount
```

### Number of Grantees:
```
COUNT(beneficiaries WHERE liquidation_id = X)
```
