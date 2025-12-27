# Stage 05 Output Structure - โครงสร้างข้อมูลองค์กร/มูลนิธิ

> **อัปเดตล่าสุด:** 2025-12-27
> **วัตถุประสงค์:** สรุปโครงสร้างข้อมูลที่ได้หลังจบ Stage 05 (Final Review)

---

## 📊 ภาพรวมข้อมูลที่ได้

หลังจาก **Stage 05 (Final Review)** เสร็จสิ้น คุณจะได้ข้อมูลองค์กร/มูลนิธิครบถ้วน ประกอบด้วย:

| หมวดข้อมูล | Tables | จำนวน | คำอธิบาย |
|------------|--------|-------|---------|
| **Metadata** | `groups` | 1 | ข้อมูลพื้นฐาน org + review status |
| **Labels** | `documents` | N | ผลลัพธ์การ label เอกสาร |
| **ตราสาร** | `foundation_instruments` + nested | 1 + N | โครงสร้างตราสารมูลนิธิ (หมวด/ข้อ/อนุข้อ) |
| **กรรมการ** | `committee_members` | N | รายชื่อกรรมการมูลนิธิ |
| **ไฟล์** | `files` | N | ไฟล์ต้นฉบับ + OCR text |
| **Organizations** | `organizations` | 0-1 | ข้อมูลองค์กร (ถ้ามีการจับคู่) |

---

## 🗂️ Entity Relationships (ER Diagram)

```
┌────────────────────────────────────────────────────────────────────┐
│                         ORGANIZATION DATA                          │
└────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐
│         Group (1)            │ ← ศูนย์กลางข้อมูลองค์กร
├──────────────────────────────┤
│ id: number                   │
│ districtOffice: string       │ ← สำนักงานเขต
│ registrationNumber: string   │ ← เลขทะเบียน
│ logoUrl: string              │ ← Logo URL (MinIO)
│                              │
│ -- Stage 05 Review Status -- │
│ finalReview03: enum          │ ← 'pending'|'approved'|'rejected'
│ finalReview03Reviewer        │
│ finalReview03ReviewerId      │
│ finalReview03ReviewedAt      │
│ finalReview03Notes           │
│                              │
│ finalReview04: enum          │ ← 'pending'|'approved'|'rejected'
│ finalReview04Reviewer        │
│ finalReview04ReviewerId      │
│ finalReview04ReviewedAt      │
│ finalReview04Notes           │
│                              │
│ lockedBy: number             │ ← Concurrent editing lock
│ lockedAt: Date               │
└──────────────────────────────┘
          │
          ├───────────► files (N)
          │             ├─ fileNumber
          │             ├─ originalName
          │             ├─ storagePath (MinIO)
          │             ├─ ocrText
          │             ├─ orderInGroup
          │             └─ isBookmark
          │
          ├───────────► documents (N)
          │             ├─ documentNumber (1, 2, 3...)
          │             ├─ templateName ("ตราสาร", "บัญชีรายชื่อกรรมการ")
          │             ├─ category
          │             ├─ startPage / endPage
          │             └─ pageCount
          │
          ├═══════════► foundation_instruments (1) ← OneToOne
          │             ├─ name (ชื่อเต็ม)
          │             ├─ shortName (ม.X.X.)
          │             ├─ address
          │             ├─ logoDescription
          │             └─ isCancelled
          │                  │
          │                  └───► charter_sections (N)
          │                        ├─ number ("1", "2", "3")
          │                        ├─ title ("ชื่อและที่ตั้ง")
          │                        └─ orderIndex
          │                             │
          │                             └───► charter_articles (N)
          │                                   ├─ number ("1", "2", "3")
          │                                   ├─ content (เนื้อหา)
          │                                   └─ orderIndex
          │                                        │
          │                                        └───► charter_sub_items (N)
          │                                              ├─ number ("1.1", "1.2")
          │                                              ├─ content
          │                                              └─ orderIndex
          │
          ├───────────► committee_members (N)
          │             ├─ name (ชื่อ-สกุล)
          │             ├─ position ("ประธาน", "กรรมการ")
          │             ├─ address
          │             ├─ phone
          │             └─ orderIndex (1, 2, 3...)
          │
          └◄────────── organizations (0..1) ← Optional matching
                        ├─ districtOfficeName
                        ├─ name
                        ├─ type ("สมาคม"|"มูลนิธิ")
                        ├─ registrationNumber
                        └─ matchedGroupId → Group.id
```

---

## 📦 TypeScript Entity Types

### 1. Group (ข้อมูลหลัก)

```typescript
@Entity('groups')
export class Group {
  id: number;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Stage 03: PDF Labeling
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  isAutoLabeled: boolean;              // Auto-label เสร็จ
  labeledAt: Date | null;              // เวลาที่ label
  labeledReviewer: string | null;      // ชื่อผู้ review
  labeledReviewerId: number | null;    // User ID
  labeledNotes: string | null;         // หมายเหตุ
  isLabeledReviewed: boolean;          // User review แล้ว

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Stage 04: Parse Data
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  isParseData: boolean;                // Parse เสร็จ
  parseDataAt: Date | null;            // เวลาที่ parse
  isParseDataReviewed: boolean;        // User review แล้ว
  parseDataReviewer: string | null;    // ชื่อผู้ review
  parseDataReviewerId: number | null;  // User ID
  extractDataNotes: string | null;     // หมายเหตุ

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⭐ Stage 05: Final Review (Split Review)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Review Stage 03 (PDF Labels) - แยกอิสระ
  finalReview03: 'pending' | 'approved' | 'rejected';
  finalReview03Reviewer: string | null;
  finalReview03ReviewerId: number | null;
  finalReview03ReviewedAt: Date | null;
  finalReview03Notes: string | null;

  // Review Stage 04 (Extract Data) - แยกอิสระ
  finalReview04: 'pending' | 'approved' | 'rejected';
  finalReview04Reviewer: string | null;
  finalReview04ReviewerId: number | null;
  finalReview04ReviewedAt: Date | null;
  finalReview04Notes: string | null;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Organization Info
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  districtOffice: string | null;       // สำนักงานเขต
  registrationNumber: string | null;   // เลขทะเบียนมูลนิธิ
  logoUrl: string | null;              // Logo URL (MinIO)

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Concurrent Editing Lock
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  lockedBy: number | null;             // User ID ที่ lock group
  lockedAt: Date | null;               // เวลาที่ lock
  lockedByUser: User | null;           // Relation to User

  createdAt: Date;
  updatedAt: Date;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Relations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  files: File[];                       // OneToMany
  documents: Document[];               // OneToMany (CASCADE DELETE)
  foundationInstrument: FoundationInstrument; // OneToOne (CASCADE DELETE)
  committeeMembers: CommitteeMember[]; // OneToMany (CASCADE DELETE)
}
```

---

### 2. File (ไฟล์ต้นฉบับ)

```typescript
@Entity('files')
export class File {
  id: number;
  fileNumber: number;                  // Auto-increment
  originalName: string;                // ชื่อไฟล์ต้นฉบับ
  storagePath: string;                 // Path ใน MinIO
  mimeType: string;                    // "image/jpeg", "application/pdf"
  size: number;                        // bytes

  // Stage 00: Review tracking
  isReviewed: boolean;                 // Mark relevant/not relevant
  reviewedAt: Date | null;
  editedPath: string | null;           // Path ของไฟล์ที่แก้ไข (drawing/masking)
  hasEdited: boolean;                  // มีการแก้ไขหรือไม่

  // Stage 01: Upload tracking
  processed: boolean;                  // OCR เสร็จแล้ว
  processedAt: Date | null;

  // OCR Queue State
  ocrProcessing: boolean;              // กำลัง OCR อยู่
  ocrStartedAt: Date | null;
  ocrCompletedAt: Date | null;
  ocrFailedCount: number;
  lastOcrError: string | null;

  // Stage 02: Grouping
  groupId: number | null;
  group: Group | null;
  orderInGroup: number | null;         // ลำดับในกลุ่ม (1, 2, 3...)
  ocrText: string | null;              // ข้อความจาก OCR
  isBookmark: boolean;                 // ไฟล์แบ่งกลุ่ม

  createdAt: Date;
}
```

---

### 3. Document (ผลลัพธ์ Label)

```typescript
@Entity('documents')
export class Document {
  id: number;
  groupId: number;
  group: Group;                        // ManyToOne (CASCADE DELETE)

  documentNumber: number;              // Auto-increment per group (1, 2, 3...)

  // Label Information
  templateName: string;                // "ตราสาร", "บัญชีรายชื่อกรรมการ"
  category: string;                    // หมวดหมู่เอกสาร
  documentDate: Date | null;           // วันที่เอกสาร (parsed)

  // Page Range
  startPage: number;                   // หน้าแรก (1-based)
  endPage: number;                     // หน้าสุดท้าย
  pageCount: number;                   // จำนวนหน้าทั้งหมด

  // Review Tracking
  isUserReviewed: boolean;
  reviewer: string;
  reviewNotes: string;

  createdAt: Date;
  updatedAt: Date;
}
```

---

### 4. FoundationInstrument (ตราสารมูลนิธิ)

```typescript
@Entity('foundation_instruments')
export class FoundationInstrument {
  id: number;
  groupId: number;                     // OneToOne with Group (UNIQUE)
  group: Group;                        // CASCADE DELETE

  name: string;                        // "มูลนิธิส่งเสริมการศึกษา"
  shortName: string;                   // "ม.ส.ศ."
  address: string;                     // "123 ถนนสุขุมวิท..."
  logoDescription: string;             // "วงกลมสีน้ำเงิน มีดาว 3 ดวง..."
  isCancelled: boolean;                // มูลนิธิยกเลิกแล้วหรือไม่

  charterSections: CharterSection[];   // OneToMany (CASCADE)

  createdAt: Date;
  updatedAt: Date;
}
```

---

### 5. CharterSection (หมวดตราสาร)

```typescript
@Entity('charter_sections')
export class CharterSection {
  id: number;
  foundationInstrumentId: number;
  foundationInstrument: FoundationInstrument; // ManyToOne (CASCADE DELETE)

  number: string;                      // "1", "2", "3"
  title: string;                       // "ชื่อและที่ตั้ง", "วัตถุประสงค์"
  orderIndex: number;                  // ลำดับการแสดง

  articles: CharterArticle[];          // OneToMany (CASCADE)
}
```

---

### 6. CharterArticle (ข้อตราสาร)

```typescript
@Entity('charter_articles')
export class CharterArticle {
  id: number;
  charterSectionId: number;
  charterSection: CharterSection;      // ManyToOne (CASCADE DELETE)

  number: string;                      // "1", "2", "3"
  content: string;                     // "มูลนิธินี้มีชื่อว่า..."
  orderIndex: number;

  subItems: CharterSubItem[];          // OneToMany (CASCADE)
}
```

---

### 7. CharterSubItem (ข้อย่อยตราสาร)

```typescript
@Entity('charter_sub_items')
export class CharterSubItem {
  id: number;
  charterArticleId: number;
  charterArticle: CharterArticle;      // ManyToOne (CASCADE DELETE)

  number: string;                      // "1.1", "1.2", "2.1"
  content: string;                     // เนื้อหาข้อย่อย
  orderIndex: number;
}
```

---

### 8. CommitteeMember (กรรมการมูลนิธิ)

```typescript
@Entity('committee_members')
export class CommitteeMember {
  id: number;
  groupId: number;
  group: Group;                        // ManyToOne (CASCADE DELETE)

  name: string;                        // "นายสมชาย ใจดี"
  address: string;                     // "123 ถนนสุขุมวิท..."
  phone: string;                       // "02-123-4567"
  position: string;                    // "ประธานกรรมการ", "กรรมการ", "เหรัญญิก"
  orderIndex: number;                  // ลำดับในรายชื่อ (1, 2, 3...)

  createdAt: Date;
}
```

---

### 9. Organization (องค์กร/สำนักงาน)

```typescript
@Entity('organizations')
export class Organization {
  id: number;

  districtOfficeName: string;          // "สำนักงานเขตจอมทอง"
  name: string;                        // "มูลนิธิส่งเสริมการศึกษา"
  type: string;                        // "สมาคม" | "มูลนิธิ"
  registrationNumber: string;          // เลข กท. (เช่น "30", "31")
  description: string | null;          // คำอธิบายเพิ่มเติม
  displayOrder: number;                // ลำดับการแสดงผล
  isActive: boolean;                   // เปิด/ปิดการใช้งาน

  matchedGroupId: number | null;       // FK to groups.id
  matchedGroup: Group | null;          // ManyToOne (SET NULL on delete)

  createdAt: Date;
  updatedAt: Date;
}
```

---

## 📋 ตัวอย่างข้อมูล JSON

### Full Organization Data

```json
{
  "group": {
    "id": 1,
    "districtOffice": "สำนักงานเขตจอมทอง",
    "registrationNumber": "กท.30",
    "logoUrl": "groups/1/logo.png",

    "finalReview03": "approved",
    "finalReview03Reviewer": "สมชาย ใจดี",
    "finalReview03ReviewerId": 5,
    "finalReview03ReviewedAt": "2025-12-27T10:30:00Z",
    "finalReview03Notes": "ตรวจสอบ labels แล้ว ถูกต้องครบถ้วน",

    "finalReview04": "approved",
    "finalReview04Reviewer": "สมหญิง รักษ์ชาติ",
    "finalReview04ReviewerId": 3,
    "finalReview04ReviewedAt": "2025-12-27T11:00:00Z",
    "finalReview04Notes": "ข้อมูลตราสารและกรรมการครบถ้วน",

    "lockedBy": null,
    "lockedAt": null
  },

  "files": [
    {
      "id": 1,
      "fileNumber": 1,
      "originalName": "page_001.jpg",
      "storagePath": "raw/001.jpg",
      "orderInGroup": 1,
      "ocrText": "ตราสารของมูลนิธิ...",
      "isBookmark": false
    }
  ],

  "documents": [
    {
      "id": 1,
      "groupId": 1,
      "documentNumber": 1,
      "templateName": "ตราสาร",
      "category": "ตราสาร",
      "startPage": 1,
      "endPage": 15,
      "pageCount": 15,
      "isUserReviewed": true
    },
    {
      "id": 2,
      "groupId": 1,
      "documentNumber": 2,
      "templateName": "บัญชีรายชื่อกรรมการมูลนิธิ",
      "category": "บัญชีรายชื่อกรรมการมูลนิธิ",
      "startPage": 16,
      "endPage": 17,
      "pageCount": 2,
      "isUserReviewed": true
    }
  ],

  "foundationInstrument": {
    "id": 1,
    "groupId": 1,
    "name": "มูลนิธิส่งเสริมการศึกษาและพัฒนาชุมชน",
    "shortName": "ม.ส.พ.ช.",
    "address": "123 ถนนสุขุมวิท แขวงคลองตัน เขตคลองเตย กรุงเทพมหานคร 10110",
    "logoDescription": "วงกลมสีน้ำเงิน ภายในมีดาว 3 ดวงสีทอง จัดเรียงเป็นรูปสามเหลี่ยม",
    "isCancelled": false,

    "charterSections": [
      {
        "id": 1,
        "number": "1",
        "title": "ชื่อและที่ตั้ง",
        "orderIndex": 1,
        "articles": [
          {
            "id": 1,
            "number": "1",
            "content": "มูลนิธินี้มีชื่อว่า มูลนิธิส่งเสริมการศึกษาและพัฒนาชุมชน",
            "orderIndex": 1,
            "subItems": []
          },
          {
            "id": 2,
            "number": "2",
            "content": "มูลนิธินี้มีชื่อย่อว่า ม.ส.พ.ช.",
            "orderIndex": 2,
            "subItems": []
          },
          {
            "id": 3,
            "number": "3",
            "content": "มูลนิธินี้ตั้งอยู่เลขที่ 123 ถนนสุขุมวิท แขวงคลองตัน เขตคลองเตย กรุงเทพมหานคร 10110",
            "orderIndex": 3,
            "subItems": []
          }
        ]
      },
      {
        "id": 2,
        "number": "2",
        "title": "วัตถุประสงค์",
        "orderIndex": 2,
        "articles": [
          {
            "id": 4,
            "number": "4",
            "content": "มูลนิธินี้มีวัตถุประสงค์ดังต่อไปนี้",
            "orderIndex": 1,
            "subItems": [
              {
                "id": 1,
                "number": "4.1",
                "content": "ส่งเสริมการศึกษาแก่เยาวชนและประชาชนทั่วไป",
                "orderIndex": 1
              },
              {
                "id": 2,
                "number": "4.2",
                "content": "พัฒนาชุมชนให้มีคุณภาพชีวิตที่ดีขึ้น",
                "orderIndex": 2
              }
            ]
          }
        ]
      }
    ]
  },

  "committeeMembers": [
    {
      "id": 1,
      "groupId": 1,
      "name": "นายสมชาย ใจดี",
      "address": "456 ถนนพระราม 4 แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110",
      "phone": "02-123-4567",
      "position": "ประธานกรรมการ",
      "orderIndex": 1
    },
    {
      "id": 2,
      "groupId": 1,
      "name": "นางสาวสมหญิง รักษ์ชาติ",
      "address": "789 ถนนสุขุมวิท แขวงพระโขนง เขตคลองเตย กรุงเทพมหานคร 10110",
      "phone": "02-987-6543",
      "position": "กรรมการ",
      "orderIndex": 2
    },
    {
      "id": 3,
      "groupId": 1,
      "name": "นายสมศักดิ์ ดีมาก",
      "address": "321 ถนนเพชรบุรี แขวงทุ่งพญาไท เขตราชเทวี กรุงเทพมหานคร 10400",
      "phone": "02-555-1234",
      "position": "เหรัญญิก",
      "orderIndex": 3
    }
  ]
}
```

---

## 🔄 Cascade Delete Behavior

### ลบ Group → CASCADE ลบทุกอย่าง

```sql
DELETE FROM groups WHERE id = 1;

-- ผลลัพธ์: ลบอัตโนมัติ
✅ documents (ทุกรายการ)
✅ foundation_instruments
   ✅ charter_sections
      ✅ charter_articles
         ✅ charter_sub_items
✅ committee_members (ทุกรายการ)

-- ไม่ลบ:
❌ files (group_id จะเป็น NULL)
❌ organizations (matchedGroupId จะเป็น NULL)
```

---

## 📊 API Response Type

```typescript
// GET /files/groups/:groupId
interface GroupDetailResponse {
  id: number;
  districtOffice: string | null;
  registrationNumber: string | null;
  logoUrl: string | null;

  // Stage 05 Review Status
  finalReview03: 'pending' | 'approved' | 'rejected';
  finalReview03Reviewer: string | null;
  finalReview03ReviewerId: number | null;
  finalReview03ReviewedAt: Date | null;
  finalReview03Notes: string | null;

  finalReview04: 'pending' | 'approved' | 'rejected';
  finalReview04Reviewer: string | null;
  finalReview04ReviewerId: number | null;
  finalReview04ReviewedAt: Date | null;
  finalReview04Notes: string | null;

  // Relations (populated)
  files: File[];
  documents: Document[];
  foundationInstrument: FoundationInstrument & {
    charterSections: (CharterSection & {
      articles: (CharterArticle & {
        subItems: CharterSubItem[];
      })[];
    })[];
  };
  committeeMembers: CommitteeMember[];
}
```

---

## ✅ Stage 05 Completion Criteria

Group ถือว่าพร้อม upload ไป **Stage 06** เมื่อ:

```typescript
// Condition 1: Stage 03 (PDF Labels) approved
finalReview03 === 'approved'

// Condition 2: Stage 04 (Extract Data) approved
finalReview04 === 'approved'

// Both conditions must be true
const isReadyForUpload = (
  group.finalReview03 === 'approved' &&
  group.finalReview04 === 'approved'
);
```

---

## 📌 สรุป

หลังจบ **Stage 05** คุณจะได้:

1. ✅ **Metadata** - Review status แยกอิสระ (Stage 03 + Stage 04)
2. ✅ **Labels** - ผลลัพธ์การ label เอกสารทั้งหมด
3. ✅ **ตราสาร** - โครงสร้างข้อบังคับมูลนิธิ (หมวด → ข้อ → อนุข้อ)
4. ✅ **กรรมการ** - รายชื่อกรรมการพร้อมข้อมูลติดต่อ
5. ✅ **ไฟล์** - ไฟล์ต้นฉบับพร้อม OCR text
6. ✅ **Organizations** - ข้อมูลการจับคู่องค์กร (ถ้ามี)

**ข้อมูลทั้งหมดพร้อมสำหรับ Stage 06 (Upload to Final Destination)** 🚀

---

**สร้างโดย:** OCR Flow Development Team
**อัปเดตล่าสุด:** 2025-12-27
**เวอร์ชัน:** 1.0
