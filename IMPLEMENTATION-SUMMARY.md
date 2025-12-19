# Implementation Summary: Document Date Feature

> **Created:** 2025-12-19
> **Feature:** Add document_date field with proper database normalization

---

## ✅ Completed Tasks

### 1. Database Schema & Entities
- ✅ Created `Document` entity (`backend/src/labeled-files/document.entity.ts`)
- ✅ Updated `LabeledFile` entity with `documentTableId` relation
- ✅ Created migration script (`backend/migrations/add-documents-table.sql`)
- ✅ Updated `labeled-files.module.ts` to include Document entity

### 2. Migration Script Features
- ✅ Creates `documents` table with proper indexes
- ✅ Migrates existing data from `labeled_files`
- ✅ Links `labeled_files.documentTableId` to `documents.id`
- ✅ Includes rollback script
- ✅ Includes verification queries

---

## 🔄 Remaining Tasks

### 3. Backend - Service Layer
**File:** `backend/src/labeled-files/labeled-files.service.ts`

**Methods to Update:**
- `createLabeledFile()` - Create document record when labeling
- `findByGroup()` - Include document relations
- `getGroupSummary()` - Include document dates
- `updatePageLabels()` - Update document dates
- `markGroupAsReviewed()` - No changes needed (works with existing flow)
- **NEW:** `createOrUpdateDocument()` - Create/update document with date
- **NEW:** `getDocumentsByGroup()` - Get all documents for a group
- **NEW:** `updateDocumentDate()` - Update document date

### 4. Backend - API Layer
**File:** `backend/src/labeled-files/labeled-files.controller.ts`

**Endpoints to Update:**
- `GET /labeled-files/group/:groupId` - Include document info
- `GET /labeled-files/summary` - Include document dates
- `PATCH /labeled-files/group/:groupId/pages` - Accept document dates
- **NEW:** `PATCH /labeled-files/document/:documentId/date` - Update document date

### 5. Label Runner (Auto-Label Logic)
**File:** `backend/src/label-runner/label-runner.service.ts`

**Changes Needed:**
- When creating `labeled_files`, also create `documents` records
- Set `documentDate = null` for auto-labeled documents
- Group consecutive pages by template into documents

### 6. Frontend - Manual Label Page
**File:** `frontend/src/app/stages/03-pdf-label/manual/[groupId]/page.tsx`

**UI Changes:**
- Add date input field when assigning template (after selecting template)
- Show document date in page list (for labeled pages)
- Allow editing document date for existing documents
- Batch update: When user selects START-END and assigns template, prompt for date

**Location of Date Input:**
- **Option 1 (Recommended):** Show date input in Template Modal after selecting template
- **Option 2:** Show date input in a separate modal after template selection
- **Option 3:** Add date field in Right Panel below template list

### 7. Frontend - Save Flow
**File:** `frontend/src/app/stages/03-pdf-label/manual/[groupId]/page.tsx`

**API Payload Changes:**
```typescript
// OLD payload
{
  updates: [{
    id: number;
    templateName: string;
    labelStatus: string;
    documentId: number;
    pageInDocument: number;
  }]
}

// NEW payload
{
  updates: [{
    id: number;
    templateName: string;
    labelStatus: string;
    documentId: number;
    pageInDocument: number;
  }],
  documents: [{
    documentNumber: number; // (documentId)
    templateName: string;
    documentDate: string | null; // "YYYY-MM-DD" or null
  }]
}
```

### 8. Frontend - Display Document Dates
**Files to Update:**

1. **Stage 03 - PDF Label List**
   - `frontend/src/app/stages/03-pdf-label/page.tsx`
   - Show document dates in the groups table

2. **Stage 03 - Manual Label Page**
   - `frontend/src/app/stages/03-pdf-label/manual/[groupId]/page.tsx`
   - Show document date in page list (left sidebar)

3. **Stage 04 - Extract Detail**
   - `frontend/src/app/stages/04-extract/[groupId]/page.tsx`
   - Show document date in foundation instrument section

4. **Documents Viewer**
   - `frontend/src/app/documents/[groupId]/page.tsx`
   - Show document date in file list (left sidebar)

---

## 📋 Implementation Plan

### Phase 1: Backend (จุดที่กระทบ label process)
1. Update `LabeledFilesService`:
   - Add document CRUD methods
   - Update existing methods to handle documents
2. Update `LabeledFilesController`:
   - Update API responses to include document info
   - Add endpoint for updating document dates
3. Update `LabelRunnerService`:
   - Auto-create documents when labeling
   - Set documentDate = null initially

### Phase 2: Frontend (UI changes)
1. Update Manual Label Page:
   - Add date input UI
   - Update save flow to send document dates
2. Update display pages:
   - Show document dates in all relevant locations

### Phase 3: Testing & Documentation
1. Run migration script
2. Test CRUD operations
3. Test auto-label flow
4. Test manual label flow
5. Update documentation

---

## 🎯 Expected Behavior

### Auto-Label Flow
1. Label Runner creates documents with `documentDate = null`
2. User can edit dates later in manual label page

### Manual Label Flow
1. User selects START-END pages
2. User selects template
3. **NEW:** System prompts for document date (optional)
4. User saves → Backend creates/updates document with date

### Display Behavior
- Document date shown in format: "DD MMM YYYY" (Thai format)
- If no date: show "-" or "ไม่ระบุวันที่"
- Date is editable in manual label page

---

## 📝 Migration Steps

1. **Backup database** (recommended)
2. **Run migration script:**
   ```bash
   psql -h localhost -p 5434 -U postgres -d ocrflow -f backend/migrations/add-documents-table.sql
   ```
3. **Verify migration:**
   - Check tables created
   - Check data migrated correctly
   - Check foreign keys working
4. **Restart backend** to load new entities
5. **Test basic operations**

---

## 🔧 Technical Notes

### Why Use Separate `documents` Table?
- **Normalized**: Store document date once, not per page
- **Scalable**: Easy to add more document metadata later
- **Maintainable**: Update date affects all pages automatically
- **Queryable**: Can query by document date efficiently

### Backward Compatibility
- Kept `documentId` field in `labeled_files` for compatibility
- Added `documentTableId` as new foreign key
- Migration creates documents from existing data
- No data loss during migration

### Performance Considerations
- Added indexes on foreign keys
- Documents table is relatively small (much smaller than labeled_files)
- JOIN queries will be fast due to proper indexing

---

**Status:** Ready for implementation
**Next Step:** Proceed with Backend Service Layer updates
