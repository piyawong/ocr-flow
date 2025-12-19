# Frontend Updates - Document Date Feature

> **File affected:** `frontend/src/app/stages/03-pdf-label/manual/[groupId]/page.tsx`

---

## Overview

เพิ่มฟีเจอร์ input วันที่เอกสาร (document date) ในหน้า Manual Label Page:
- กรอกวันที่ได้ **ตอน manual label แต่ละหน้า**
- **ทุกหน้าของ document เดียวกัน** ใช้วันที่เดียวกัน (กรอกครั้งเดียวตอน START page)
- วันที่เป็น **optional** (ไม่บังคับกรอก)
- Save ได้แม้ไม่มี changes

---

## Changes Required

### 1. State Management (เพิ่ม state สำหรับเก็บ documentDates)

```typescript
// Add this to existing states
const [documentDates, setDocumentDates] = useState<{
  [key: string]: string | null; // key = `${documentNumber}_${templateName}`
}>({});
```

---

### 2. Document Date Modal Component

**Create:** `DocumentDateModal.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';

interface DocumentDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (date: string | null) => void;
  documentNumber: number;
  templateName: string;
  initialDate?: string | null;
}

export function DocumentDateModal({
  isOpen,
  onClose,
  onConfirm,
  documentNumber,
  templateName,
  initialDate,
}: DocumentDateModalProps) {
  const [date, setDate] = useState<string>(initialDate || '');

  useEffect(() => {
    setDate(initialDate || '');
  }, [initialDate, isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(date || null);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">
          กรอกวันที่เอกสาร
        </h2>

        <div className="mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            เอกสาร: <span className="font-medium">{templateName}</span>
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Document #{documentNumber}
          </p>

          <label className="block text-sm font-medium mb-2 dark:text-gray-300">
            วันที่ของเอกสาร (ไม่บังคับ)
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="YYYY-MM-DD"
          />
          {date && (
            <button
              type="button"
              onClick={() => setDate('')}
              className="mt-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ล้างวันที่
            </button>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 dark:text-white"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600"
          >
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### 3. เมื่อ Assign Template (After user selects template)

**หลังจาก user เลือก template สำเร็จ:**

```typescript
// EXISTING CODE: After template selection
const handleTemplateSelect = async (template: Template) => {
  if (startPage !== null && endPage !== null) {
    // Assign template to pages...

    // === ADD THIS: Prompt for document date ===
    const docNumber = getNextDocumentNumber(groupId);
    const key = `${docNumber}_${template.name}`;

    // Show date modal
    setDocumentDateModal({
      isOpen: true,
      documentNumber: docNumber,
      templateName: template.name,
      initialDate: documentDates[key] || null,
    });
  }
};

// Handle date modal confirm
const handleDocumentDateConfirm = (date: string | null) => {
  const key = `${documentDateModal.documentNumber}_${documentDateModal.templateName}`;
  setDocumentDates(prev => ({
    ...prev,
    [key]: date,
  }));
};
```

---

### 4. Save Flow (อัปเดต API payload)

**เดิม:**
```typescript
const response = await fetch(`${API_URL}/labeled-files/group/${groupId}/pages`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ updates }),
});
```

**ใหม่:**
```typescript
// Build documents array from documentDates state
const documents = Object.entries(documentDates).map(([key, date]) => {
  const [docNum, templateName] = key.split('_');
  return {
    documentNumber: parseInt(docNum),
    templateName,
    documentDate: date, // "YYYY-MM-DD" or null
  };
});

const response = await fetch(`${API_URL}/labeled-files/group/${groupId}/pages`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    updates,
    documents, // NEW: Include document dates
  }),
});
```

---

### 5. Display Document Dates (แสดงวันที่ในหน้า Manual Label)

**In Left Sidebar - Page List:**

```typescript
{files.map((file) => (
  <div key={file.id} className="page-item">
    {/* ... existing content ... */}

    {file.templateName && file.document?.documentDate && (
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        📅 {new Date(file.document.documentDate).toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </div>
    )}
  </div>
))}
```

---

### 6. Allow Save Without Changes

**Remove or modify this validation:**

```typescript
// OLD - Don't allow save without changes
if (!hasChanges) {
  alert('ไม่มีการเปลี่ยนแปลง');
  return;
}

// NEW - Allow save even without changes (for document dates)
if (!hasChanges && Object.keys(documentDates).length === 0) {
  alert('ไม่มีการเปลี่ยนแปลง');
  return;
}
```

---

## UI Flow

### Scenario 1: Manual Label from Scratch

1. User selects START page (หน้าที่ 1)
2. User selects END page (หน้าที่ 10)
3. User clicks template "ตราสาร"
4. **NEW:** Modal แสดงให้กรอกวันที่ (optional)
5. User กรอกวันที่ หรือ skip (ปิด modal)
6. Pages 1-10 ถูก assign เป็น "ตราสาร" พร้อมวันที่
7. User กด Save → ส่ง updates + documents ไป API

### Scenario 2: Edit Existing Date

1. User เห็นว่าเอกสารมีวันที่แล้ว (แสดงใน sidebar)
2. User คลิก edit date button (ต้องเพิ่ม UI)
3. Modal เปิดพร้อมวันที่เดิม
4. User แก้ไขวันที่
5. Save → อัปเดตวันที่

---

## Testing Checklist

- [ ] กรอกวันที่ตอน manual label ได้
- [ ] Skip กรอกวันที่ได้ (optional)
- [ ] แสดงวันที่ใน sidebar
- [ ] Save ได้แม้ไม่มี changes (เฉพาะวันที่)
- [ ] API payload ถูกต้อง (มี documents array)
- [ ] วันที่ถูก persist หลัง refresh
- [ ] Multi-document support (หลายเอกสารในกลุ่มเดียว)

---

## API Response Format (Expected)

```json
{
  "groupId": 1,
  "files": [
    {
      "id": 1,
      "templateName": "ตราสาร",
      "document": {
        "id": 1,
        "documentNumber": 1,
        "documentDate": "2025-01-15"
      }
    }
  ],
  "documents": [
    {
      "id": 1,
      "documentNumber": 1,
      "templateName": "ตราสาร",
      "documentDate": "2025-01-15",
      "pageCount": 10
    }
  ]
}
```

---

## Next Steps

1. Implement DocumentDateModal component
2. Update handleTemplateSelect to show modal
3. Update save flow to include documents
4. Update UI to display dates
5. Test thoroughly
6. Deploy to stage env
