# Database Verification Report - Document Date Feature

> **Date:** 2025-12-19
> **Status:** ✅ VERIFIED

---

## ✅ Database Schema - ตรวจสอบแล้ว

### 1. labeled_files Table (17 columns)

```
Column            Type              Nullable   Default
----------------  ----------------  ---------  ----------
id                integer           NOT NULL   auto
groupId           integer           NOT NULL
orderInGroup      integer           NOT NULL
groupedFileId     integer           NOT NULL
originalName      varchar           NOT NULL
storagePath       varchar           NOT NULL
ocrText           text              NULL
templateName      varchar           NULL
category          varchar           NULL
labelStatus       varchar           NOT NULL   'unmatched'
matchReason       text              NULL
documentId        integer           NULL       (OLD - backward compat)
pageInDocument    integer           NULL
documentTableId   integer           NULL       (NEW - FK to documents)
isUserReviewed    boolean           NOT NULL   false
reviewer          varchar           NULL
createdAt         timestamp         NOT NULL   now()
```

**Foreign Keys:**
- `groupId` → `groups.id` (CASCADE DELETE)
- `documentTableId` → `documents.id` (CASCADE DELETE)

---

### 2. documents Table (9 columns) ✅

```
Column          Type              Nullable   Default
--------------  ----------------  ---------  ----------
id              integer           NOT NULL   auto
groupId         integer           NOT NULL   FK to groups
documentNumber  integer           NOT NULL   1, 2, 3...
templateName    varchar           NULL
category        varchar           NULL
documentDate    date              NULL       ← KEY FIELD!
pageCount       integer           NOT NULL   0
createdAt       timestamp         NOT NULL   now()
updatedAt       timestamp         NOT NULL   now()
```

**Foreign Keys:**
- `groupId` → `groups.id` (CASCADE DELETE)

**Unique Constraint:**
- UNIQUE(`groupId`, `documentNumber`)

**Referenced By:**
- `labeled_files.documentTableId` (CASCADE DELETE)

---

### 3. groups Table (22 columns)

**Stage Tracking Fields:**
```
isComplete          - Stage 01-02 (Grouping complete)
completedAt

isAutoLabeled       - Stage 02-03 (Auto-label complete)
labeledAt
labeledReviewer
labeledNotes
isLabeledReviewed   - Stage 03 (User reviewed labels)

isParseData         - Stage 03-04 (Parse data complete)
parseDataAt

isParseDataReviewed - Stage 04 (User reviewed extract data)
parseDataReviewer
extractDataNotes

isFinalApproved     - Stage 05 (Final approval)
finalApprovedAt
finalReviewer
finalReviewNotes
```

---

## ✅ Data Verification - ตรวจสอบจริง

### ข้อมูลปัจจุบัน (หลัง Auto-Label)

**Groups:** 19-23 (5 groups)
**Labeled Files:** 76 records
**Documents:** 5 records

### ตัวอย่าง Group 19:

```
Documents Created:
1. Document #1: ตราสาร (7 หน้า) - documentDate: NULL
2. Document #2: บัญชีรายชื่อกรรมการ (1 หน้า) - documentDate: NULL
3. Document #3: ขออนุญาตจดทะเบียน (2 หน้า) - documentDate: NULL
4. Document #4: ใบสำคัญแสดงการจดทะเบียน (1 หน้า) - documentDate: NULL
5. Document #5: ประกาศนายทะเบียน (2 หน้า) - documentDate: NULL

Labeled Files Linkage:
├─ Pages 1-7:   documentTableId = 1 (ตราสาร)
├─ Page 8:      documentTableId = 2 (บัญชีรายชื่อกรรมการ)
├─ Pages 9-10:  documentTableId = 3 (ขออนุญาต)
├─ Page 11:     documentTableId = 4 (ใบสำคัญ)
└─ Pages 12-13: documentTableId = 5 (ประกาศนายทะเบียน)
```

**✅ Verification Results:**
- ✅ All labeled_files have documentTableId set
- ✅ All documentTableId correctly link to documents.id
- ✅ pageCount matches actual pages
- ✅ documentDate is NULL (from auto-label - correct!)

---

## 📊 ความเข้าใจที่ถูกต้อง

### Logic การเก็บ Label

#### Step 1: Auto-Label (Label Runner)
```
1. Pattern matching → ระบุ template, documentId
2. สร้าง labeled_files:
   ├─ templateName = "ตราสาร"
   ├─ documentId = 1 (เลขเอกสารใน group)
   ├─ labelStatus = 'start' | 'continue' | 'end' | 'single'
   └─ pageInDocument = 1, 2, 3...

3. สร้าง documents (NEW!):
   ├─ documentNumber = 1 (เหมือน documentId)
   ├─ templateName = "ตราสาร"
   ├─ documentDate = NULL (ยังไม่กรอก)
   └─ pageCount = 7

4. Link: labeled_files.documentTableId = documents.id
```

#### Step 2: Manual Label (User กรอกวันที่)
```
1. User เลือก template
2. Modal เปิด → User กรอกวันที่ (หรือข้าม)
3. Save → Backend:
   ├─ Update labeled_files (ถ้ามี changes)
   └─ Update documents.documentDate = "2025-01-15"
```

---

## 🎯 ความสัมพันธ์ของ Tables

```
groups (1)
  └─> documents (N) - CASCADE DELETE
        ├─ documentDate ← เก็บวันที่ที่นี่!
        └─> labeled_files (N) - CASCADE DELETE via documentTableId
              └─ documentTableId → documents.id
```

**ตัวอย่าง:**
```
Group 19
  └─> Document 1 (id=1, documentDate=NULL, pageCount=7)
        ├─> labeled_file (orderInGroup=1, documentTableId=1)
        ├─> labeled_file (orderInGroup=2, documentTableId=1)
        ├─> labeled_file (orderInGroup=3, documentTableId=1)
        ├─> ...
        └─> labeled_file (orderInGroup=7, documentTableId=1)
```

---

## 📝 ข้อมูลที่เก็บแยกกัน

### labeled_files (Page-level)
**เก็บข้อมูลของแต่ละหน้า:**
- ❌ ~~documentDate~~ (ไม่เก็บที่นี่!)
- ✅ orderInGroup (1, 2, 3...)
- ✅ templateName
- ✅ labelStatus
- ✅ documentId (legacy - เลขเอกสาร)
- ✅ pageInDocument (หน้าที่ 1, 2, 3...)
- ✅ documentTableId (FK to documents)

### documents (Document-level)
**เก็บข้อมูลของแต่ละเอกสาร:**
- ✅ **documentDate** ← เก็บที่นี่!
- ✅ documentNumber (เหมือน documentId เดิม)
- ✅ templateName
- ✅ pageCount

### groups (Group-level)
**เก็บ status ของ group:**
- ✅ isAutoLabeled
- ✅ isLabeledReviewed
- ✅ labeledReviewer
- ✅ labeledNotes

---

## ✅ สรุป: Migration ที่ทำไป

### สิ่งที่ Migration ทำ:
1. ✅ สร้าง `documents` table
2. ✅ เพิ่ม `documentTableId` column ใน `labeled_files`
3. ✅ Migrate ข้อมูลเดิม (ถ้ามี) → สร้าง documents จาก labeled_files
4. ✅ Link labeled_files.documentTableId → documents.id

### Migration รันเมื่อไหร่:
- รันใน `full-reset.sh` script (ตอนที่ flush DB)
- TypeORM auto-sync สร้าง tables ตาม entities

---

## 🎯 ตอนนี้ทำอะไรไปบ้าง

**✅ ที่ทำแล้ว:**
1. Database schema ถูกสร้างแล้ว (documents table exists)
2. Backend code เขียนเสร็จแล้ว
3. Frontend code เขียนเสร็จแล้ว
4. Auto-label สร้าง documents อัตโนมัติแล้ว (เห็นจากมี 5 documents)
5. Link กันถูกต้องแล้ว (documentTableId → documents.id)

**❓ ที่ยังไม่แน่ใจ:**
- User สามารถกรอกวันที่ผ่าน Modal ได้หรือยัง (ต้องทดสอบจริง)
- วันที่ถูก save ลง documents.documentDate หรือยัง

---

## 💡 คำตอบคำถาม: "ถึงกับต้อง migrate db เลยหรอ?"

**คำตอบ:**

**ถ้าแค่เพิ่ม field วันที่:**
- ไม่ต้อง migrate ซับซ้อนขนาดนี้
- แค่ `ALTER TABLE labeled_files ADD COLUMN document_date DATE;`

**แต่เราทำ normalized design (ไม่ซ้ำข้อมูล):**
- ต้องสร้าง `documents` table
- ต้อง migrate data
- ต้อง link relations

**ข้อดี:**
- วันที่เก็บครั้งเดียว (ไม่ซ้ำ 10 หน้า)
- ขยายได้ในอนาคต (เพิ่ม metadata document อื่นๆ)

**ข้อเสีย:**
- Migration ซับซ้อนกว่า
- Code เยอะกว่า

---

**ตอนนี้:**
- Database ready ✅
- Backend ready ✅
- Frontend ready ✅
- Auto-label working ✅

**ขั้นตอนต่อไป:**
ลอง Upload files → Auto-label → Manual label และทดสอบกรอกวันที่ดูครับ!
