# UI Design Specification: Document Date Validation & Quick Setting

**Design Date:** 2025-12-19
**Designer:** UI Design Agent
**Project:** OCR Flow v2
**Focus Area:** Pre-Save Validation Warning Modal + Quick Date Setting Panel

---

## Executive Summary

This document provides complete UI specifications for implementing document date validation features in the Manual Review page (Stage 03). The design follows the existing design system and modal patterns established in the codebase.

**Design Goals:**
1. Prevent accidental saves with missing document dates
2. Provide quick date editing without re-labeling workflow
3. Maintain visual consistency with existing modals
4. Enable rapid implementation within sprint timeline

---

## 1. Pre-Save Validation Warning Modal (P1)

### 1.1 Overview

A warning modal that appears when user clicks "Save" but has documents with missing dates. This modal intercepts the save flow before the existing Review Notes Modal.

### 1.2 Visual Mockup (ASCII)

```
+------------------------------------------------------------------+
|  +----------------------------------------------------------+    |
|  |                                                          |    |
|  |   +-----------------------------------------------+      |    |
|  |   |  [!]  Missing Document Dates                  |      |    |
|  |   +-----------------------------------------------+      |    |
|  |                                                          |    |
|  |   The following documents are missing dates:             |    |
|  |                                                          |    |
|  |   +-----------------------------------------------+      |    |
|  |   |  [doc icon] tra-sar (Pages 1-5)               |      |    |
|  |   |             No date set            [Set Date] |      |    |
|  |   +-----------------------------------------------+      |    |
|  |   |  [doc icon] ban-chi-ra (Pages 8-10)           |      |    |
|  |   |             No date set            [Set Date] |      |    |
|  |   +-----------------------------------------------+      |    |
|  |                                                          |    |
|  |   +-----------------------------------------------+      |    |
|  |   | [i] You can set dates now or save without     |      |    |
|  |   |     them. Documents without dates may need    |      |    |
|  |   |     manual correction later.                  |      |    |
|  |   +-----------------------------------------------+      |    |
|  |                                                          |    |
|  |   +-------------------+  +------------------------+      |    |
|  |   | Go Back           |  | Save Without Dates     |      |    |
|  |   +-------------------+  +------------------------+      |    |
|  |                                                          |    |
|  +----------------------------------------------------------+    |
|                                                                  |
+------------------------------------------------------------------+
```

### 1.3 Component Hierarchy

```
MissingDatesWarningModal
  +-- Backdrop (bg-black/70 backdrop-blur-sm)
  +-- ModalContainer (max-w-[520px])
      +-- Header
      |   +-- WarningIcon (amber/warning color)
      |   +-- Title ("Missing Document Dates")
      |   +-- CloseButton (X icon - top right)
      +-- Body
      |   +-- Description text
      |   +-- DocumentList (scrollable, max 4 visible)
      |   |   +-- DocumentItem (repeating)
      |   |       +-- DocumentIcon
      |   |       +-- DocumentInfo (name, page range)
      |   |       +-- SetDateButton (inline action)
      |   +-- InfoBox (optional tip)
      +-- Footer
          +-- GoBackButton (secondary/outline)
          +-- SaveAnywayButton (warning style)
```

### 1.4 Design Tokens & Specifications

#### Modal Container
```css
/* Container */
background: var(--card-bg);           /* #1e293b in dark mode */
border: 1px solid var(--border-color); /* #334155 in dark mode */
border-radius: var(--radius-xl);       /* 1rem / 16px */
box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
max-width: 520px;
width: 90%;
padding: 0;
overflow: hidden;
```

#### Header Section
```css
/* Header Container */
padding: 20px 24px 16px;
border-bottom: 1px solid var(--border-color);
background: rgba(var(--warning-rgb), 0.05); /* Subtle warning tint */

/* Warning Icon */
color: var(--warning);                 /* #f59e0b */
width: 24px;
height: 24px;
margin-right: 12px;

/* Title */
font-size: 1.125rem;                   /* 18px */
font-weight: 600;
color: var(--text-primary);            /* #f1f5f9 in dark */
line-height: 1.4;

/* Close Button */
position: absolute;
top: 16px;
right: 16px;
color: var(--text-secondary);
transition: color 200ms ease;
hover: var(--text-primary);
```

#### Document List
```css
/* List Container */
max-height: 240px;                     /* ~4 items visible */
overflow-y: auto;
padding: 16px 24px;

/* Document Item */
display: flex;
align-items: center;
padding: 12px 16px;
background: var(--bg-secondary);       /* #1e293b */
border: 1px solid var(--border-color);
border-radius: var(--radius-lg);       /* 12px */
margin-bottom: 8px;
transition: all 200ms ease;

/* Document Item - Hover */
hover:border-color: var(--warning);
hover:background: rgba(var(--warning-rgb), 0.05);

/* Document Icon */
width: 36px;
height: 36px;
background: rgba(var(--warning-rgb), 0.15);
border-radius: var(--radius-md);       /* 8px */
color: var(--warning);
flex-shrink: 0;

/* Document Info */
flex: 1;
margin-left: 12px;
min-width: 0;

/* Document Name */
font-size: 0.875rem;                   /* 14px */
font-weight: 500;
color: var(--text-primary);
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;

/* Page Range */
font-size: 0.75rem;                    /* 12px */
color: var(--text-secondary);
margin-top: 2px;

/* Set Date Button */
padding: 6px 12px;
font-size: 0.75rem;
font-weight: 500;
color: var(--warning);
background: rgba(var(--warning-rgb), 0.1);
border: 1px solid rgba(var(--warning-rgb), 0.3);
border-radius: var(--radius-md);
cursor: pointer;
transition: all 200ms ease;

/* Set Date Button - Hover */
hover:background: rgba(var(--warning-rgb), 0.2);
hover:border-color: var(--warning);
```

#### Info Box
```css
/* Info Box Container */
margin: 0 24px 16px;
padding: 12px 16px;
background: var(--bg-tertiary);        /* #334155 */
border-radius: var(--radius-md);
border-left: 3px solid var(--info);    /* #3b82f6 */

/* Info Icon */
width: 16px;
height: 16px;
color: var(--info);
margin-right: 10px;
flex-shrink: 0;

/* Info Text */
font-size: 0.8125rem;                  /* 13px */
color: var(--text-secondary);
line-height: 1.5;
```

#### Footer / Action Buttons
```css
/* Footer Container */
padding: 16px 24px 20px;
display: flex;
gap: 12px;
border-top: 1px solid var(--border-color);
background: var(--bg-secondary);

/* Go Back Button (Secondary) */
flex: 1;
padding: 12px 20px;
font-size: 0.9375rem;                  /* 15px */
font-weight: 600;
color: var(--text-primary);
background: transparent;
border: 2px solid var(--border-color);
border-radius: var(--radius-lg);
cursor: pointer;
transition: all 200ms ease;

/* Go Back Button - Hover */
hover:background: var(--bg-tertiary);
hover:border-color: var(--text-secondary);

/* Save Anyway Button (Warning Style) */
flex: 1;
padding: 12px 20px;
font-size: 0.9375rem;
font-weight: 600;
color: #ffffff;
background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
border: none;
border-radius: var(--radius-lg);
cursor: pointer;
transition: all 200ms ease;
box-shadow: 0 2px 8px rgba(245, 158, 11, 0.25);

/* Save Anyway Button - Hover */
hover:transform: translateY(-1px);
hover:box-shadow: 0 4px 16px rgba(245, 158, 11, 0.4);
```

### 1.5 Component States

#### Default State
- Modal visible with backdrop
- Document list shows all documents with missing dates
- Both buttons enabled
- Set Date buttons on each document item

#### Loading State (when setting date inline)
```css
/* Set Date Button - Loading */
opacity: 0.7;
pointer-events: none;
/* Add spinner icon */
```

#### Empty State (no missing dates)
- Modal should NOT appear
- Proceed directly to Review Notes Modal

#### Error State (if date set fails)
```css
/* Document Item - Error */
border-color: var(--danger);
background: rgba(var(--danger-rgb), 0.05);

/* Error Message */
font-size: 0.75rem;
color: var(--danger);
margin-top: 4px;
```

### 1.6 Interaction Flow

```
User clicks "Save"
       |
       v
Check for missing dates (getDocumentsWithMissingDates)
       |
       +-- No missing dates --> Show Review Notes Modal (existing flow)
       |
       +-- Has missing dates --> Show Warning Modal
                                      |
                                      +-- "Go Back" --> Close modal, stay on page
                                      |
                                      +-- "Set Date" on item --> Show Date Picker Inline
                                      |                              |
                                      |                              v
                                      |                         Date set --> Remove from list
                                      |                              |
                                      |                              +-- All dates set --> Close modal,
                                      |                                                    show Review Notes
                                      |
                                      +-- "Save Without Dates" --> Close modal,
                                                                   show Review Notes Modal
```

### 1.7 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Escape` | Close modal (Go Back) |
| `Enter` | Save Without Dates |
| `Tab` | Navigate between document items and buttons |

### 1.8 Animation Specifications

```css
/* Modal Enter */
animation: fadeIn 200ms ease, zoomIn95 200ms ease;

/* Modal Exit */
animation: fadeOut 150ms ease;

/* Document Item - When removed after date set */
animation: slideOutLeft 200ms ease;

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes zoomIn95 {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes slideOutLeft {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(-20px); opacity: 0; }
}
```

---

## 2. Inline Date Picker (for Warning Modal)

### 2.1 Overview

When user clicks "Set Date" on a document item, an inline date input appears replacing the button.

### 2.2 Visual Mockup

```
Before:
+-----------------------------------------------+
|  [doc icon] tra-sar (Pages 1-5)               |
|             No date set            [Set Date] |
+-----------------------------------------------+

After clicking "Set Date":
+-----------------------------------------------+
|  [doc icon] tra-sar (Pages 1-5)               |
|             [2024-06-15____] [OK] [Cancel]    |
+-----------------------------------------------+
```

### 2.3 Specifications

```css
/* Date Input Container */
display: flex;
align-items: center;
gap: 8px;

/* Date Input */
width: 140px;
padding: 6px 10px;
font-size: 0.8125rem;
color: var(--text-primary);
background: var(--bg-primary);
border: 1px solid var(--accent);
border-radius: var(--radius-sm);
outline: none;

/* OK Button */
padding: 6px 12px;
font-size: 0.75rem;
font-weight: 500;
color: #ffffff;
background: var(--success);
border: none;
border-radius: var(--radius-sm);
cursor: pointer;

/* Cancel Button */
padding: 6px 12px;
font-size: 0.75rem;
font-weight: 500;
color: var(--text-secondary);
background: transparent;
border: 1px solid var(--border-color);
border-radius: var(--radius-sm);
cursor: pointer;
```

---

## 3. Quick Date Setting Panel (P1 - Alternative Approach)

### 3.1 Overview

A new "Documents" tab in the right panel that shows all labeled documents with their dates for quick editing.

### 3.2 Visual Mockup

```
Right Panel (w-64):
+------------------------------------------+
|  [Info] [Templates] [OCR] [Documents]    |  <-- New tab
+------------------------------------------+
|                                          |
|  LABELED DOCUMENTS                       |
|  2 documents | 1 missing date            |
|                                          |
|  +------------------------------------+  |
|  |  [template color]                  |  |
|  |  tra-sar                           |  |
|  |  Pages 1-5 (5 pages)               |  |
|  |  +------------------------------+  |  |
|  |  | 2024-06-15            [x]    |  |  |
|  |  +------------------------------+  |  |
|  +------------------------------------+  |
|                                          |
|  +------------------------------------+  |
|  |  [template color]  [!] No date     |  |
|  |  ban-chi-ra                        |  |
|  |  Pages 8-10 (3 pages)              |  |
|  |  +------------------------------+  |  |
|  |  | Select date...        [cal] |  |  |
|  |  +------------------------------+  |  |
|  +------------------------------------+  |
|                                          |
|  +------------------------------------+  |
|  | [!] 1 document missing date        |  |
|  +------------------------------------+  |
|                                          |
+------------------------------------------+
```

### 3.3 Component Hierarchy

```
DocumentsTabPanel
  +-- Header
  |   +-- Title ("LABELED DOCUMENTS")
  |   +-- Summary ("2 documents | 1 missing date")
  +-- DocumentList (scrollable)
  |   +-- DocumentCard (repeating)
  |       +-- ColorBar (left edge, template color)
  |       +-- CardHeader
  |       |   +-- TemplateName
  |       |   +-- WarningBadge (if no date)
  |       +-- PageInfo ("Pages 1-5 (5 pages)")
  |       +-- DateInput
  |           +-- DatePicker
  |           +-- ClearButton
  +-- MissingSummary (warning banner if any missing)
```

### 3.4 Design Specifications

#### Tab Button (New "Documents" Tab)
```css
/* Tab Button */
flex: 1;
padding: 8px 12px;
font-size: 0.75rem;                    /* 12px */
font-weight: 500;
color: var(--text-secondary);
background: transparent;
border: none;
border-bottom: 2px solid transparent;
cursor: pointer;
transition: all 200ms ease;

/* Tab Button - Active */
color: var(--text-primary);
border-bottom-color: var(--accent);

/* Tab Button - With Warning (missing dates) */
position: relative;

/* Warning Dot */
::after {
  content: '';
  position: absolute;
  top: 6px;
  right: 6px;
  width: 6px;
  height: 6px;
  background: var(--warning);
  border-radius: 50%;
}
```

#### Document Card
```css
/* Card Container */
background: var(--bg-secondary);
border: 1px solid var(--border-color);
border-radius: var(--radius-lg);
padding: 12px;
margin-bottom: 8px;
position: relative;
overflow: hidden;

/* Card - With Missing Date */
border-color: var(--warning);
background: rgba(var(--warning-rgb), 0.03);

/* Color Bar (Left Edge) */
position: absolute;
left: 0;
top: 0;
bottom: 0;
width: 4px;
background: [template-color];

/* Template Name */
font-size: 0.875rem;
font-weight: 500;
color: var(--text-primary);
padding-left: 12px;                    /* Account for color bar */

/* Warning Badge */
display: inline-flex;
align-items: center;
gap: 4px;
padding: 2px 6px;
font-size: 0.625rem;                   /* 10px */
font-weight: 600;
color: var(--warning);
background: rgba(var(--warning-rgb), 0.15);
border-radius: var(--radius-full);
text-transform: uppercase;

/* Page Info */
font-size: 0.75rem;
color: var(--text-secondary);
margin-top: 4px;
padding-left: 12px;

/* Date Input Container */
margin-top: 8px;
padding-left: 12px;

/* Date Input */
width: 100%;
padding: 8px 12px;
font-size: 0.8125rem;
color: var(--text-primary);
background: var(--bg-primary);
border: 1px solid var(--border-color);
border-radius: var(--radius-md);
transition: all 200ms ease;

/* Date Input - Focus */
border-color: var(--accent);
box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.1);

/* Date Input - Empty (Placeholder) */
color: var(--text-secondary);

/* Clear Button */
position: absolute;
right: 8px;
top: 50%;
transform: translateY(-50%);
width: 20px;
height: 20px;
color: var(--text-secondary);
cursor: pointer;
transition: color 200ms ease;

/* Clear Button - Hover */
color: var(--danger);
```

#### Missing Summary Banner
```css
/* Banner Container */
padding: 10px 12px;
background: rgba(var(--warning-rgb), 0.1);
border: 1px solid rgba(var(--warning-rgb), 0.3);
border-radius: var(--radius-md);
display: flex;
align-items: center;
gap: 8px;

/* Warning Icon */
width: 16px;
height: 16px;
color: var(--warning);
flex-shrink: 0;

/* Text */
font-size: 0.75rem;
font-weight: 500;
color: var(--warning);
```

### 3.5 Interaction Patterns

1. **Tab Switch:** Click "Documents" tab to view document list
2. **Date Edit:** Click on date input field to show native date picker
3. **Clear Date:** Click X button to clear date (shows confirmation)
4. **Auto-Update:** Changes save automatically (debounced)
5. **Visual Feedback:** Card border turns green when date is set

---

## 4. Visual Indicators in Page List (P2)

### 4.1 Overview

Add visual indicators to the page list sidebar showing which pages belong to documents with missing dates.

### 4.2 Visual Mockup

```
Current Page Item:
+------------------------+
| [2] [Handle]           |
| [Thumbnail]            |
| tra-sar       [Labeled]|
+------------------------+

Proposed - With Date Set:
+------------------------+
| [2] [Handle]           |
| [Thumbnail]            |
| tra-sar       [Labeled]|
| [cal] 2024-06-15       |  <-- Date indicator
+------------------------+

Proposed - Missing Date:
+------------------------+
| [2] [Handle]     [!]   |  <-- Warning icon
| [Thumbnail]            |
| tra-sar       [Labeled]|
| [!] No date set        |  <-- Warning text
+------------------------+
```

### 4.3 Specifications

```css
/* Date Indicator Row */
display: flex;
align-items: center;
gap: 4px;
padding: 4px 8px;
font-size: 0.625rem;                   /* 10px */
margin-top: 4px;

/* Date Set - Success State */
color: var(--text-secondary);

/* Calendar Icon */
width: 10px;
height: 10px;
color: inherit;

/* Date Text */
font-weight: 500;

/* Missing Date - Warning State */
color: var(--warning);

/* Warning Icon (Header) */
position: absolute;
top: 8px;
right: 8px;
width: 14px;
height: 14px;
color: var(--warning);
```

---

## 5. React Component Structure

### 5.1 MissingDatesWarningModal Component

```tsx
interface DocumentWithMissingDate {
  documentId: number;
  templateName: string;
  pageRange: { start: number; end: number };
  pageCount: number;
  templateColor: string | null;
}

interface MissingDatesWarningModalProps {
  isOpen: boolean;
  documents: DocumentWithMissingDate[];
  onClose: () => void;                    // Go Back
  onSaveAnyway: () => void;               // Save Without Dates
  onSetDate: (documentId: number, date: string) => void; // Inline date set
}

export function MissingDatesWarningModal({
  isOpen,
  documents,
  onClose,
  onSaveAnyway,
  onSetDate,
}: MissingDatesWarningModalProps) {
  const [editingDocId, setEditingDocId] = useState<number | null>(null);
  const [tempDate, setTempDate] = useState('');

  if (!isOpen || documents.length === 0) return null;

  const handleDateConfirm = (docId: number) => {
    if (tempDate) {
      onSetDate(docId, tempDate);
    }
    setEditingDocId(null);
    setTempDate('');
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm">
      <div className="bg-card-bg rounded-2xl max-w-[520px] w-[90%] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-border-color overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border-color bg-warning/5 relative">
          <div className="flex items-center gap-3">
            <WarningIcon className="w-6 h-6 text-warning" />
            <h2 className="text-lg font-semibold text-text-primary">
              Missing Document Dates
            </h2>
          </div>
          <button onClick={onClose} className="absolute top-4 right-4 ...">
            <XIcon />
          </button>
        </div>

        {/* Document List */}
        <div className="px-6 py-4 max-h-[240px] overflow-y-auto">
          <p className="text-sm text-text-secondary mb-4">
            The following documents are missing dates:
          </p>

          <div className="space-y-2">
            {documents.map((doc) => (
              <DocumentItem
                key={doc.documentId}
                document={doc}
                isEditing={editingDocId === doc.documentId}
                tempDate={tempDate}
                onEdit={() => setEditingDocId(doc.documentId)}
                onDateChange={setTempDate}
                onConfirm={() => handleDateConfirm(doc.documentId)}
                onCancel={() => { setEditingDocId(null); setTempDate(''); }}
              />
            ))}
          </div>
        </div>

        {/* Info Box */}
        <div className="mx-6 mb-4 p-3 bg-bg-tertiary rounded-lg border-l-[3px] border-info">
          <p className="text-[13px] text-text-secondary">
            You can set dates now or save without them. Documents without dates
            may need manual correction later.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex gap-3 border-t border-border-color bg-bg-secondary">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-5 text-[15px] font-semibold text-text-primary
                       bg-transparent border-2 border-border-color rounded-lg
                       hover:bg-bg-tertiary hover:border-text-secondary transition-all"
          >
            Go Back
          </button>
          <button
            onClick={onSaveAnyway}
            className="flex-1 py-3 px-5 text-[15px] font-semibold text-white
                       bg-gradient-to-br from-warning to-[#d97706] rounded-lg
                       shadow-[0_2px_8px_rgba(245,158,11,0.25)]
                       hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(245,158,11,0.4)]
                       transition-all"
          >
            Save Without Dates
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 5.2 DocumentItem Sub-Component

```tsx
interface DocumentItemProps {
  document: DocumentWithMissingDate;
  isEditing: boolean;
  tempDate: string;
  onEdit: () => void;
  onDateChange: (date: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function DocumentItem({
  document,
  isEditing,
  tempDate,
  onEdit,
  onDateChange,
  onConfirm,
  onCancel,
}: DocumentItemProps) {
  return (
    <div className="flex items-center p-3 bg-bg-secondary border border-border-color
                    rounded-xl hover:border-warning hover:bg-warning/5 transition-all">
      {/* Icon */}
      <div className="w-9 h-9 rounded-lg bg-warning/15 flex items-center justify-center
                      flex-shrink-0">
        <DocumentIcon className="w-5 h-5 text-warning" />
      </div>

      {/* Info */}
      <div className="flex-1 ml-3 min-w-0">
        <div className="text-sm font-medium text-text-primary truncate">
          {document.templateName.replace('.pdf', '')}
        </div>
        <div className="text-xs text-text-secondary mt-0.5">
          Pages {document.pageRange.start + 1}-{document.pageRange.end + 1}
          ({document.pageCount} pages)
        </div>
      </div>

      {/* Action */}
      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={tempDate}
            onChange={(e) => onDateChange(e.target.value)}
            autoFocus
            className="w-[130px] px-2 py-1.5 text-xs bg-bg-primary border border-accent
                       rounded text-text-primary"
          />
          <button
            onClick={onConfirm}
            className="px-2 py-1.5 text-xs font-medium text-white bg-success rounded"
          >
            OK
          </button>
          <button
            onClick={onCancel}
            className="px-2 py-1.5 text-xs font-medium text-text-secondary
                       bg-transparent border border-border-color rounded"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={onEdit}
          className="px-3 py-1.5 text-xs font-medium text-warning
                     bg-warning/10 border border-warning/30 rounded-lg
                     hover:bg-warning/20 hover:border-warning transition-all"
        >
          Set Date
        </button>
      )}
    </div>
  );
}
```

### 5.3 Integration with Existing Code

```tsx
// In ManualLabelPage component:

// Add state
const [showDateWarningModal, setShowDateWarningModal] = useState(false);
const [missingDateDocuments, setMissingDateDocuments] = useState<DocumentWithMissingDate[]>([]);

// Utility function to find missing dates
const getDocumentsWithMissingDates = useCallback((): DocumentWithMissingDate[] => {
  // Group pages by documentId
  const documentGroups = new Map<number, PageLabel[]>();

  pages.forEach(page => {
    if (page.documentId && page.templateName) {
      if (!documentGroups.has(page.documentId)) {
        documentGroups.set(page.documentId, []);
      }
      documentGroups.get(page.documentId)!.push(page);
    }
  });

  // Find documents without dates
  const missing: DocumentWithMissingDate[] = [];

  documentGroups.forEach((docPages, docId) => {
    const templateName = docPages[0].templateName!;
    const key = `${docId}_${templateName}`;

    if (!documentDates[key]) {
      const sortedPages = docPages.sort((a, b) => a.orderInGroup - b.orderInGroup);
      const startIdx = pages.findIndex(p => p.id === sortedPages[0].id);
      const endIdx = pages.findIndex(p => p.id === sortedPages[sortedPages.length - 1].id);

      missing.push({
        documentId: docId,
        templateName,
        pageRange: { start: startIdx, end: endIdx },
        pageCount: docPages.length,
        templateColor: getTemplateColor(templateName),
      });
    }
  });

  return missing;
}, [pages, documentDates]);

// Modify handleSave
const handleSave = useCallback(() => {
  if (!user?.name) {
    alert('Please log in to save changes.');
    return;
  }

  // Check for missing dates first
  const missing = getDocumentsWithMissingDates();

  if (missing.length > 0) {
    setMissingDateDocuments(missing);
    setShowDateWarningModal(true);
    return;
  }

  // No missing dates - proceed to Review Notes Modal
  setShowNotesModal(true);
}, [user, getDocumentsWithMissingDates]);

// Handle date set from warning modal
const handleWarningModalSetDate = (documentId: number, date: string) => {
  const doc = missingDateDocuments.find(d => d.documentId === documentId);
  if (doc) {
    const key = `${documentId}_${doc.templateName}`;
    setDocumentDates(prev => ({ ...prev, [key]: date }));

    // Remove from missing list
    setMissingDateDocuments(prev => prev.filter(d => d.documentId !== documentId));

    // If no more missing, close warning modal and show notes modal
    if (missingDateDocuments.length === 1) {
      setShowDateWarningModal(false);
      setShowNotesModal(true);
    }
  }
};
```

---

## 6. Tailwind CSS Classes Reference

### Complete Button Styles

```tsx
// Secondary Button (Go Back, Cancel)
className="flex-1 py-3 px-5 text-[15px] font-semibold text-text-primary
           bg-transparent border-2 border-border-color rounded-lg
           hover:bg-bg-tertiary hover:border-text-secondary
           transition-all duration-200"

// Primary Button (existing - blue gradient)
className="flex-1 py-3 px-5 text-[15px] font-semibold text-white
           bg-gradient-to-br from-[#3b82f6] to-[#2563eb] rounded-lg
           shadow-[0_2px_8px_rgba(59,130,246,0.25)]
           hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(59,130,246,0.4)]
           transition-all duration-200"

// Warning Button (Save Without Dates)
className="flex-1 py-3 px-5 text-[15px] font-semibold text-white
           bg-gradient-to-br from-warning to-[#d97706] rounded-lg
           shadow-[0_2px_8px_rgba(245,158,11,0.25)]
           hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(245,158,11,0.4)]
           transition-all duration-200"

// Small Action Button (Set Date)
className="px-3 py-1.5 text-xs font-medium text-warning
           bg-warning/10 border border-warning/30 rounded-lg
           hover:bg-warning/20 hover:border-warning
           transition-all duration-200"

// Small Success Button (OK)
className="px-2 py-1.5 text-xs font-medium text-white bg-success rounded
           hover:bg-success/90 transition-all duration-200"
```

### Modal Backdrop & Container

```tsx
// Backdrop
className="fixed inset-0 bg-black/70 flex items-center justify-center
           z-[1000] backdrop-blur-sm"

// Modal Container
className="bg-card-bg rounded-2xl max-w-[520px] w-[90%]
           shadow-[0_20px_60px_rgba(0,0,0,0.3)]
           border border-border-color overflow-hidden"

// Header with Warning Tint
className="px-6 py-5 border-b border-border-color bg-warning/5 relative"

// Footer
className="px-6 py-4 flex gap-3 border-t border-border-color bg-bg-secondary"
```

---

## 7. Accessibility Considerations

### ARIA Attributes

```tsx
// Modal
<div
  role="alertdialog"
  aria-modal="true"
  aria-labelledby="warning-modal-title"
  aria-describedby="warning-modal-description"
>

// Title
<h2 id="warning-modal-title">Missing Document Dates</h2>

// Description
<p id="warning-modal-description">
  The following documents are missing dates...
</p>
```

### Focus Management

1. Focus trap within modal when open
2. Auto-focus on first interactive element (first "Set Date" button)
3. Return focus to Save button when modal closes
4. Escape key closes modal

### Screen Reader Announcements

```tsx
// Live region for document removal
<div aria-live="polite" className="sr-only">
  {removedDoc && `Date set for ${removedDoc.templateName}`}
</div>
```

---

## 8. Implementation Checklist

### Phase 1: Warning Modal (P1 - 2-3 hours)

- [ ] Create `MissingDatesWarningModal` component
- [ ] Add `getDocumentsWithMissingDates` utility function
- [ ] Modify `handleSave` to check for missing dates
- [ ] Add state for modal visibility and missing documents
- [ ] Implement inline date setting
- [ ] Add keyboard shortcuts (Escape, Enter)
- [ ] Test with various document combinations

### Phase 2: Documents Tab (P1 - 3-4 hours)

- [ ] Add "Documents" tab to right panel
- [ ] Create `DocumentsTabPanel` component
- [ ] Implement document list with date inputs
- [ ] Add warning indicator on tab when dates missing
- [ ] Connect to `documentDates` state
- [ ] Add auto-save with debounce

### Phase 3: Visual Indicators (P2 - 1-2 hours)

- [ ] Add date indicator to `SortablePageItem`
- [ ] Add warning icon for missing dates
- [ ] Update progress bar to show date completion

---

## 9. Files to Create/Modify

### New Files

```
frontend/src/components/MissingDatesWarningModal.tsx
frontend/src/components/DocumentsTabPanel.tsx (optional)
```

### Modified Files

```
frontend/src/app/stages/03-pdf-label/manual/[groupId]/page.tsx
  - Add state: showDateWarningModal, missingDateDocuments
  - Add function: getDocumentsWithMissingDates
  - Modify: handleSave
  - Add: MissingDatesWarningModal import and render
  - (Optional) Add: Documents tab in right panel
```

---

**Document Prepared By:** UI Design Agent
**Review Status:** Ready for Development
**Last Updated:** 2025-12-19
