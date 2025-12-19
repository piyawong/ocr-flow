# Display Document Dates - All Pages

> **Goal:** แสดงวันที่เอกสารในทุกหน้าที่เกี่ยวข้อง

---

## 1. Stage 03 - PDF Label List Page

**File:** `frontend/src/app/stages/03-pdf-label/page.tsx`

**Location:** Table columns (เพิ่ม column "Documents")

```typescript
// Add to table header
<th className="px-4 py-2 text-left">Documents</th>

// Add to table body
<td className="px-4 py-2">
  {group.documents?.map((doc: any) => (
    <div key={doc.id} className="text-sm mb-1">
      <span className="font-medium">{doc.templateName}</span>
      {doc.documentDate && (
        <span className="text-gray-500 dark:text-gray-400 ml-2">
          📅 {new Date(doc.documentDate).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      )}
      <span className="text-gray-400 ml-2">({doc.pageCount} หน้า)</span>
    </div>
  ))}
</td>
```

**API Changes:**
- Update `GET /labeled-files/summary` to include `documents` array
- Each group should have `documents` property

---

## 2. Stage 03 - Manual Label Page (Left Sidebar)

**File:** `frontend/src/app/stages/03-pdf-label/manual/[groupId]/page.tsx`

**Location:** Page list item (แสดงวันที่ใต้ template name)

```typescript
<div className="page-item">
  {/* Existing content */}
  <div className="template-name">{file.templateName}</div>

  {/* NEW: Show document date */}
  {file.document?.documentDate && (
    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
      <span>📅</span>
      <span>
        {new Date(file.document.documentDate).toLocaleDateString('th-TH', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </span>
    </div>
  )}
</div>
```

---

## 3. Stage 04 - Extract List Page

**File:** `frontend/src/app/stages/04-extract/page.tsx`

**Location:** Table columns (เพิ่ม column หรือแสดงใน existing column)

```typescript
// Option 1: Add new column
<th className="px-4 py-2 text-left">Document Date</th>

<td className="px-4 py-2">
  {group.foundationInstrument?.documentDate ? (
    <span className="text-gray-700 dark:text-gray-300">
      {new Date(group.foundationInstrument.documentDate).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}
    </span>
  ) : (
    <span className="text-gray-400">-</span>
  )}
</td>

// Option 2: Show under Foundation name
<div>
  <div className="font-medium">{group.foundationInstrument.name}</div>
  {group.foundationInstrument.documentDate && (
    <div className="text-sm text-gray-500 mt-1">
      📅 วันที่: {new Date(group.foundationInstrument.documentDate).toLocaleDateString('th-TH')}
    </div>
  )}
</div>
```

---

## 4. Stage 04 - Extract Detail Page

**File:** `frontend/src/app/stages/04-extract/[groupId]/page.tsx`

**Location:** Foundation Instrument section (Tab 1)

```typescript
<div className="foundation-info-section">
  {/* Existing fields */}
  <div className="info-row">
    <span className="label">ชื่อมูลนิธิ:</span>
    <span className="value">{foundationInstrument.name}</span>
  </div>

  {/* NEW: Document Date */}
  {foundationInstrument.documentDate && (
    <div className="info-row">
      <span className="label">วันที่เอกสาร:</span>
      <span className="value">
        {new Date(foundationInstrument.documentDate).toLocaleDateString('th-TH', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </span>
    </div>
  )}
</div>
```

---

## 5. Documents Viewer Page

**File:** `frontend/src/app/documents/[groupId]/page.tsx`

**Location:** Left Sidebar - File List (แสดงวันที่ของ document)

```typescript
<div className="file-list">
  {files.map((file, index) => (
    <div key={file.id} className={`file-item ${active ? 'active' : ''}`}>
      {/* Existing content */}
      <div className="page-number">Page {index + 1}</div>
      <div className="template-name">{file.templateName}</div>

      {/* NEW: Show document date for START pages */}
      {file.labelStatus === 'start' && file.document?.documentDate && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          📅 {new Date(file.document.documentDate).toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </div>
      )}
    </div>
  ))}
</div>
```

---

## 6. Stage 05 - Review Page

**File:** `frontend/src/app/stages/05-review/[groupId]/page.tsx`

**Location:** Stage 03 Summary section

```typescript
<div className="stage-03-summary">
  <h3>Stage 03: PDF Labeling</h3>

  {/* Existing fields */}
  <div className="summary-row">
    <span className="label">Documents found:</span>
    <span className="value">{documents.length}</span>
  </div>

  {/* NEW: Document dates */}
  <div className="documents-list mt-4">
    <h4 className="text-sm font-medium mb-2">เอกสารที่พบ:</h4>
    {documents.map((doc) => (
      <div key={doc.id} className="document-item mb-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
        <div className="flex justify-between">
          <span className="font-medium">{doc.templateName}</span>
          <span className="text-sm text-gray-500">({doc.pageCount} หน้า)</span>
        </div>
        {doc.documentDate && (
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            📅 {new Date(doc.documentDate).toLocaleDateString('th-TH', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        )}
      </div>
    ))}
  </div>
</div>
```

---

## Helper Function: Format Thai Date

**Create:** `frontend/src/utils/formatDate.ts`

```typescript
/**
 * Format date to Thai locale
 */
export function formatThaiDate(
  date: string | Date,
  options?: {
    format?: 'short' | 'medium' | 'long' | 'full';
  },
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const formatOptions: Record<string, Intl.DateTimeFormatOptions> = {
    short: {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
    medium: {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },
    long: {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },
    full: {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    },
  };

  const format = options?.format || 'short';

  return dateObj.toLocaleDateString('th-TH', formatOptions[format]);
}

// Usage
formatThaiDate('2025-01-15'); // "15 ม.ค. 2568"
formatThaiDate('2025-01-15', { format: 'medium' }); // "15 มกราคม 2568"
formatThaiDate('2025-01-15', { format: 'long' }); // "วันพุธที่ 15 มกราคม 2568"
```

---

## Visual Examples

### Example 1: Manual Label Page - Left Sidebar
```
┌─────────────────────────┐
│ ⋮⋮  Page 1              │
│    🔵 ตราสาร            │
│    📅 15 ม.ค. 2568      │  ← NEW
│    ● START              │
├─────────────────────────┤
│ ⋮⋮  Page 2              │
│    🔵 ตราสาร            │
│    📅 15 ม.ค. 2568      │  ← NEW
│    ● CONTINUE           │
└─────────────────────────┘
```

### Example 2: Extract Detail Page
```
Foundation Instrument
─────────────────────
ชื่อมูลนิธิ: มูลนิธิเพื่อการพัฒนาสังคม
ชื่อย่อ: ม.พ.ส.
วันที่เอกสาร: วันพุธที่ 15 มกราคม 2568  ← NEW
ที่อยู่: 123 ถนนสุขุมวิท กรุงเทพฯ
```

---

## Testing Checklist

- [ ] แสดงวันที่ใน Stage 03 list page
- [ ] แสดงวันที่ใน Manual Label sidebar
- [ ] แสดงวันที่ใน Extract list page
- [ ] แสดงวันที่ใน Extract detail page
- [ ] แสดงวันที่ใน Documents viewer
- [ ] แสดงวันที่ใน Review page
- [ ] Format วันที่เป็นภาษาไทยถูกต้อง
- [ ] แสดง "-" หรือ "ไม่ระบุ" เมื่อไม่มีวันที่
- [ ] Responsive design (mobile/tablet)

---

## Priority Order

1. **High Priority:**
   - Manual Label Page (sidebar)
   - Extract Detail Page

2. **Medium Priority:**
   - Extract List Page
   - Documents Viewer

3. **Low Priority:**
   - Stage 03 List Page
   - Review Page
