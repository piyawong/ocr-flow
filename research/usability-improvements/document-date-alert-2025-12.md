# UX Research Report: Document Date Setting in Manual Review (Stage 03)

**Research Date:** 2025-12-19
**Researcher:** UX Research Agent
**Project:** OCR Flow v2
**Focus Area:** Document Date Setting Alert & Quick Edit

---

## Executive Summary

This research analyzes the user experience pain points related to document date setting in the Manual Review page (Stage 03). Users face difficulty tracking which documents are missing dates before saving, leading to incomplete data submissions and frustrating re-labeling workflows.

**Key Findings:**
1. No warning exists when saving with missing document dates
2. Setting dates requires re-labeling documents (high friction)
3. Users lack visibility into which documents need date entry
4. Current flow interrupts the labeling workflow

**Recommendations:**
1. Implement pre-save validation warning modal
2. Add quick date setting panel/modal for bulk editing
3. Add visual indicators for missing dates in page list
4. Consider inline date editing in sidebar

---

## 1. Current State Analysis

### 1.1 Current User Flow

```
Current Document Date Flow:
===========================

1. User selects page range (Space or click)
           |
           v
2. User selects template from modal
           |
           v
3. DocumentDateModal appears
   - User can enter date or skip
           |
           v
4. Template applied to pages
   - Date stored in documentDates state
           |
           v
5. User continues labeling other pages
           |
           v
6. User clicks "Save" button
           |
           v
7. Review Notes Modal appears
           |
           v
8. Changes saved to backend
   - No validation for missing dates
   - No warning about incomplete data
```

### 1.2 Current Implementation Details

Based on code analysis of `/frontend/src/app/stages/03-pdf-label/manual/[groupId]/page.tsx`:

**Document Date Tracking:**
```typescript
// Current state management
const [documentDates, setDocumentDates] = useState<Record<string, string | null>>({});
// Key format: `${documentId}_${templateName}` -> date or null
```

**Save Flow:**
- `handleSave()` shows notes modal
- `performSave()` sends `documentsPayload` to backend
- No check for documents with `null` dates
- No user feedback about missing dates

**Template Selection Flow:**
- Date modal appears after template selection
- User can "skip" (set null date)
- No way to edit date later without re-labeling

### 1.3 Technical Constraints

| Constraint | Impact |
|------------|--------|
| Document date tied to template selection | Cannot edit date independently |
| No dedicated date editing UI | Forces re-labeling workflow |
| Date stored by documentId + templateName | Requires lookup logic for display |
| Save always proceeds | No validation gate |

---

## 2. Pain Points Analysis

### 2.1 Primary Pain Points

#### Pain Point 1: No Pre-Save Validation
**Severity:** High
**Frequency:** Every save action

**Description:**
Users can save without any warning about missing document dates. They only discover missing dates later when reviewing data downstream or when errors occur in data processing.

**Impact:**
- Incomplete data in database
- Manual correction needed later
- Reduced data quality
- User frustration

**User Quote (hypothetical):**
> "I saved my work and thought I was done, but then realized I forgot to add dates to several documents. Now I have to go back and re-label everything."

---

#### Pain Point 2: No Quick Date Editing
**Severity:** High
**Frequency:** Every time date needs correction

**Description:**
To change or add a document date, users must re-select the page range and re-apply the template. This is the only way to trigger the DocumentDateModal again.

**Impact:**
- High friction for corrections
- Time wasted on repetitive actions
- Risk of accidental template changes
- Workflow interruption

**Current Workaround:**
1. Remember which pages need dates
2. Select those pages again
3. Apply same template
4. Enter the date
5. This resets any unsaved label changes

---

#### Pain Point 3: No Visibility of Missing Dates
**Severity:** Medium
**Frequency:** Throughout labeling session

**Description:**
The page list sidebar and page info panel show template names and label status, but do not indicate whether a document date has been set or is missing.

**Impact:**
- Users cannot prioritize incomplete documents
- Mental burden to track missing dates
- Easy to overlook documents
- No visual scanning capability

**Current Indicators (what exists):**
- Matched/Unmatched badge
- Template name
- Label status (start/continue/end/single)
- No date indicator

---

#### Pain Point 4: Date Modal Interrupts Flow
**Severity:** Low-Medium
**Frequency:** Every template selection

**Description:**
The DocumentDateModal appears after every template selection, requiring user interaction even when date is not relevant or not known at that moment.

**Impact:**
- Slows down labeling workflow
- Forces premature decision
- Users often "skip" dates to continue
- Creates habit of skipping

---

### 2.2 User Journey Map

```
                    MANUAL REVIEW PAGE - DOCUMENT DATE SETTING JOURNEY

Stage:      ENTER PAGE    LABEL DOCUMENTS    SET DATES    REVIEW & SAVE    EXIT
            =========     ===============    =========    ==============    ====
                |               |                |               |            |
Actions:    View pages     Select range      Date modal     Click Save    Leave page
            Review OCR     Pick template     Enter/skip     Add notes
            Plan work      Apply label                      Confirm
                |               |                |               |            |
                |               |                |               |            |
Emotions:      O               O               O/O             O/?          O/?
              OK             Focused          Mixed         Uncertain     Uncertain

Thoughts:   "Need to      "This looks      "I don't      "Did I        "Hope I
            label all      like ..."       know date      set all       didn't
            these"                         right now,     dates?"       forget
                                          will skip"                    anything"

Pain        None          None            Modal          NO WARNING     Too late
Points:                                   interrupts     about          to check
                                          flow          missing dates

                                                         ^^^^^^^
                                                         CRITICAL
                                                         PAIN POINT

Opportunities:
            Quick          Visual          Defer date    Pre-save       Success
            summary        date status     entry         validation     confirmation
            card           indicators                    modal          with details
```

---

## 3. Best Practices Research

### 3.1 Form Validation Patterns

Based on research from [Smashing Magazine](https://www.smashingmagazine.com/2022/09/inline-validation-web-forms-ux/) and [NN/G](https://www.nngroup.com/articles/errors-forms-design-guidelines/):

**Key Principles:**
1. **"Reward Early, Punish Late"** - Validate when users fix errors (positive feedback), wait before showing new errors
2. **Keep Submit Enabled** - Allow users to proceed, then show clear error messages
3. **Inline Validation** - Show issues near relevant fields to reduce cognitive load
4. **Visual Hierarchy** - Use red for errors, yellow/orange for warnings, green for success

### 3.2 Confirmation Dialog Patterns

Based on research from [LogRocket](https://blog.logrocket.com/ux-design/double-check-user-actions-confirmation-dialog/) and [Cloudscape Design System](https://cloudscape.design/patterns/general/unsaved-changes/):

**When to Use Warning Modals:**
1. Irreversible actions (data loss risk)
2. Confirming user decisions with consequences
3. When there are unsaved changes
4. Before exiting with incomplete data

**Best Practices:**
- Clear, specific title (not generic "Warning")
- Describe action and consequences
- Descriptive button labels (action verbs)
- Allow user to fix issues before proceeding

### 3.3 Bulk Editing Patterns

Based on research from [Basis Design System](https://design.basis.com/patterns/bulk-editing) and [eBay Playbook](https://playbook.ebay.com/design-system/patterns/bulk-editing):

**Bulk Editing Approaches:**
1. **Sidebar Panel** - Quick view sidebar formatted like a form
2. **Floating Toolbar** - Appears when items selected
3. **Wizard Flow** - Guided multi-step for complex changes
4. **Inline Editing** - Edit directly in list/table view

**Common Metadata Fields for Bulk Edit:**
- Status
- Expiration date
- Author
- Keywords/Tags
- **Document date** (our use case)

---

## 4. Recommendations

### 4.1 Recommendation 1: Pre-Save Validation Warning Modal
**Priority:** High
**Effort:** Medium

**Description:**
When user clicks "Save", check if any labeled documents have missing dates. If found, show a warning modal before the Review Notes modal.

**Proposed Flow:**
```
User clicks "Save"
       |
       v
Check documents for missing dates
       |
       +-- All dates set --> Show Review Notes Modal (current flow)
       |
       +-- Some dates missing --> Show Warning Modal
                                      |
                                      v
                                  Warning Modal:
                                  - List documents missing dates
                                  - "Continue without dates" button
                                  - "Add dates first" button
                                      |
                                      +-- "Add dates" --> Close modal, scroll to first missing
                                      |
                                      +-- "Continue" --> Show Review Notes Modal
```

**UI Mockup (ASCII):**
```
+--------------------------------------------------+
|  [!] Some Documents Missing Dates                 |
+--------------------------------------------------+
|                                                   |
|  The following documents don't have dates set:    |
|                                                   |
|  +---------------------------------------------+  |
|  | Doc #1: "tra-sar" (Pages 1-5)         [Set] |  |
|  | Doc #3: "ban-chi-ra" (Pages 8-10)     [Set] |  |
|  +---------------------------------------------+  |
|                                                   |
|  You can continue without dates or add them now.  |
|                                                   |
|  [Continue Without Dates]     [Add Dates First]   |
+--------------------------------------------------+
```

**Benefits:**
- Prevents accidental incomplete saves
- Allows user choice (not blocking)
- Lists specific documents (visibility)
- Quick action to fix issues

---

### 4.2 Recommendation 2: Quick Date Setting Panel/Modal
**Priority:** High
**Effort:** Medium-High

**Description:**
Add a dedicated UI for editing document dates without re-labeling. This could be:
- A sidebar section in the right panel
- A dedicated modal accessed via button
- Inline editing in a documents list

**Option A: Documents Overview Panel**

Add a new tab in the right panel called "Documents" that shows all labeled documents with their dates.

```
Right Panel Tabs: [Info] [Templates] [OCR] [Documents]

Documents Tab:
+------------------------------------------+
|  LABELED DOCUMENTS                        |
+------------------------------------------+
|  [ ] Doc #1: tra-sar                      |
|      Pages: 1-5 (5 pages)                 |
|      Date: [2024-06-15] [Edit] [Clear]    |
|                                           |
|  [!] Doc #2: ban-chi-ra                   |
|      Pages: 6-10 (5 pages)                |
|      Date: [Not set] [Set Date]           |
|                                           |
|  [ ] Doc #3: other-doc                    |
|      Pages: 11-12 (2 pages)               |
|      Date: [2024-07-20] [Edit] [Clear]    |
+------------------------------------------+
|  Missing dates: 1                    [!]  |
+------------------------------------------+
```

**Option B: Quick Date Modal (via button)**

Add "Edit Dates" button in header that opens a modal showing all documents:

```
+--------------------------------------------------+
|  Edit Document Dates                       [X]    |
+--------------------------------------------------+
|                                                   |
|  Document #1: tra-sar (Pages 1-5)                 |
|  [2024-06-15__________]  [Clear]                  |
|                                                   |
|  Document #2: ban-chi-ra (Pages 6-10)             |
|  [___________________]  (not set)                 |
|                                                   |
|  Document #3: other-doc (Pages 11-12)             |
|  [2024-07-20__________]  [Clear]                  |
|                                                   |
|  ------------------------------------------       |
|  Bulk Actions:                                    |
|  [Set All to Today] [Clear All]                   |
|                                                   |
|                               [Cancel] [Apply]    |
+--------------------------------------------------+
```

**Benefits:**
- Edit dates without re-labeling
- See all documents in one view
- Bulk actions available
- Clear visibility of missing dates

---

### 4.3 Recommendation 3: Visual Indicators for Missing Dates
**Priority:** Medium
**Effort:** Low

**Description:**
Add visual indicators in the page list sidebar to show when a page's document is missing a date.

**Proposed Visual Changes:**

1. **Page List Item - Date Indicator:**
```
Current:
+------------------------+
| [2] [Handle]           |
| [Thumbnail]            |
| tra-sar       [Labeled]|
+------------------------+

Proposed (missing date):
+------------------------+
| [2] [Handle]     [!]   |  <-- Warning icon for missing date
| [Thumbnail]            |
| tra-sar       [Labeled]|
| [No date set]          |  <-- Date status line
+------------------------+

Proposed (date set):
+------------------------+
| [2] [Handle]           |
| [Thumbnail]            |
| tra-sar       [Labeled]|
| [2024-06-15]           |  <-- Date shown
+------------------------+
```

2. **Progress Bar Enhancement:**
```
Current header progress:
[========|--] 8/12

Proposed (show date completion):
[========|--] 8/12 labeled | 5/8 dated  <-- Additional metric
```

3. **Color Coding:**
- Green border/indicator: Labeled + Date set
- Yellow border/indicator: Labeled + No date
- Red border/indicator: Unmatched

**Benefits:**
- Immediate visual feedback
- Easy scanning of page list
- No workflow interruption
- Awareness without modal

---

### 4.4 Recommendation 4: Deferred Date Entry Option
**Priority:** Low
**Effort:** Low

**Description:**
Modify the DocumentDateModal to better support "I'll add later" workflow with clear messaging.

**Proposed Changes:**

```
Current Modal:
+----------------------------------+
| Enter Document Date              |
| ...                              |
| [Skip]  [Confirm]                |
+----------------------------------+

Proposed Modal:
+----------------------------------+
| Enter Document Date              |
| ...                              |
|                                  |
| [!] You can add date later from  |
|     the Documents panel          |
|                                  |
| [Add Later]  [Set Date: Confirm] |
+----------------------------------+
```

**Benefits:**
- Reduces anxiety about skipping
- Informs about alternative
- Maintains labeling speed
- Clear call-to-action

---

## 5. Implementation Priority Matrix

| Recommendation | Impact | Effort | Priority | Sprint |
|----------------|--------|--------|----------|--------|
| Pre-Save Validation Warning | High | Medium | **P1** | Sprint 1 |
| Quick Date Setting Panel | High | Medium-High | **P1** | Sprint 1-2 |
| Visual Indicators | Medium | Low | **P2** | Sprint 2 |
| Deferred Date Messaging | Low | Low | **P3** | Sprint 3 |

---

## 6. Success Metrics

### 6.1 Quantitative Metrics

| Metric | Current (Estimated) | Target | How to Measure |
|--------|---------------------|--------|----------------|
| Documents saved without date | ~30% | <5% | DB query |
| Re-labeling for date correction | Unknown | Reduce 80% | User survey |
| Time to complete labeling | Baseline | -10% | Analytics |
| Save attempts with warning | N/A | Track | Event logging |

### 6.2 Qualitative Metrics

- User satisfaction with date entry flow
- Perceived workflow efficiency
- Error recovery experience
- Overall labeling confidence

### 6.3 Usability Testing Plan

**Test 1: Warning Modal Validation**
- Task: Label 10 pages, skip dates, attempt save
- Observe: User reaction to warning modal
- Measure: Completion rate, error recovery

**Test 2: Quick Date Panel Usage**
- Task: Edit dates for 3 documents without re-labeling
- Observe: Discoverability, ease of use
- Measure: Task time, success rate

---

## 7. Technical Implementation Notes

### 7.1 Data Structure for Warning Modal

```typescript
interface DocumentWithMissingDate {
  documentId: number;
  templateName: string;
  pageRange: { start: number; end: number };
  pageCount: number;
}

// Utility function to find missing dates
function getDocumentsWithMissingDates(
  pages: PageLabel[],
  documentDates: Record<string, string | null>
): DocumentWithMissingDate[] {
  // Group pages by documentId
  // Check if documentDates has entry for each document
  // Return list of documents without dates
}
```

### 7.2 State Changes Required

```typescript
// Add to existing state
const [showDateWarningModal, setShowDateWarningModal] = useState(false);
const [missingDateDocuments, setMissingDateDocuments] = useState<DocumentWithMissingDate[]>([]);

// Modify handleSave
const handleSave = useCallback(() => {
  // Check for missing dates first
  const missing = getDocumentsWithMissingDates(pages, documentDates);

  if (missing.length > 0) {
    setMissingDateDocuments(missing);
    setShowDateWarningModal(true);
    return;
  }

  // Continue with existing flow
  setShowNotesModal(true);
}, [pages, documentDates]);
```

### 7.3 Component Structure

```
ManualLabelPage
  +-- Header
  +-- LeftSidebar (PageList)
  |     +-- PageItem (add date indicator)
  +-- CenterPanel (Preview)
  +-- RightPanel
  |     +-- [Info | Templates | OCR | Documents*]
  |     +-- DocumentsPanel* (new)
  +-- Modals
        +-- TemplateModal
        +-- DocumentDateModal
        +-- DateWarningModal* (new)
        +-- ReviewNotesModal
```

---

## 8. Appendix

### 8.1 Research Sources

**Form Validation UX:**
- [Smashing Magazine - Live Validation UX](https://www.smashingmagazine.com/2022/09/inline-validation-web-forms-ux/)
- [NN/G - Design Guidelines for Errors in Forms](https://www.nngroup.com/articles/errors-forms-design-guidelines/)
- [LogRocket - Inline vs After Submission](https://blog.logrocket.com/ux-design/ux-form-validation-inline-after-submission/)

**Confirmation Dialog Patterns:**
- [LogRocket - Warning Message UI](https://blog.logrocket.com/ux-design/double-check-user-actions-confirmation-dialog/)
- [Cloudscape - Unsaved Changes Pattern](https://cloudscape.design/patterns/general/unsaved-changes/)
- [Carbon Design System - Dialog Pattern](https://carbondesignsystem.com/patterns/dialog-pattern/)

**Bulk Editing Patterns:**
- [Basis Design System - Bulk Editing](https://design.basis.com/patterns/bulk-editing)
- [eBay Playbook - Bulk Editing](https://playbook.ebay.com/design-system/patterns/bulk-editing)
- [Eleken - Bulk Action UX Guidelines](https://www.eleken.co/blog-posts/bulk-actions-ux)

### 8.2 Related Documentation

- [frontend-detailed.md](../../frontend-detailed.md) - Frontend architecture
- [STRUCTURE.md](../../STRUCTURE.md) - Project overview
- Stage 03 Manual Label Page implementation

---

## 9. Next Steps

1. **Review with stakeholders** - Present recommendations to product team
2. **Create design mockups** - High-fidelity designs for warning modal and date panel
3. **Technical spike** - Estimate effort for Quick Date Panel implementation
4. **Usability testing** - Validate proposed solutions with users
5. **Implementation** - Start with P1 items in upcoming sprint

---

**Report Prepared By:** UX Research Agent
**Review Status:** Ready for stakeholder review
**Last Updated:** 2025-12-19
