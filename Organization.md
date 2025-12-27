# Organization Data Output - Stage 05

> **สำหรับ:** OCR Flow v2 - โครงสร้างข้อมูลสุดท้ายที่ได้หลังจบ Stage 05 (Final Review)
> **อัปเดตล่าสุด:** 2025-12-27

---

## ภาพรวม

เมื่อ group ผ่าน Stage 05 (Final Review) และได้รับ **Approved** ทั้ง Stage 03 และ Stage 04 จะมีข้อมูลครบถ้วนดังนี้:

```
Organization Data (หลังจบ Stage 05)
├── Group Metadata                 # ข้อมูลกลุ่มเอกสาร
├── Documents (Labeled)            # เอกสารที่ถูก label แล้ว
├── Foundation Instrument          # ข้อมูลตราสารมูลนิธิ (parsed)
│   ├── Basic Info                 # ชื่อ, ชื่อย่อ, ที่อยู่
│   └── Charter Sections           # หมวด → ข้อ → อนุข้อ
├── Committee Members              # รายชื่อกรรมการ (parsed)
└── Review Status                  # สถานะการ approve
```

---

## 1. Group Metadata (ข้อมูลกลุ่มเอกสาร)

**Source Table:** `groups`

```typescript
interface GroupMetadata {
  id: number;                       // Group ID
  organization: string | null;      // ชื่อองค์กร/สำนักงาน
  registrationNumber: string | null; // เลขทะเบียนมูลนิธิ
  logoUrl: string | null;           // URL ของ Logo (MinIO path)
  createdAt: Date;                  // วันที่สร้าง group
  completedAt: Date | null;         // วันที่จัดกลุ่มเสร็จ
}
```

**ตัวอย่างข้อมูล:**
```json
{
  "id": 1,
  "organization": "สำนักงานวัฒนธรรมจังหวัด",
  "registrationNumber": "กท.123/2567",
  "logoUrl": "logos/group-1-logo.png",
  "createdAt": "2025-12-20T10:30:00Z",
  "completedAt": "2025-12-20T10:35:00Z"
}
```

---

## 2. Documents (เอกสารที่ถูก label)

**Source Table:** `documents`

```typescript
interface Document {
  id: number;                      // Document ID
  groupId: number;                 // FK → groups
  documentNumber: number;          // ลำดับเอกสารใน group (1, 2, 3, ...)
  templateName: string;            // ชื่อ template ที่ match
  category: string;                // หมวดหมู่เอกสาร
  documentDate: Date | null;       // วันที่เอกสาร (parsed)
  startPage: number;               // หน้าแรกของเอกสาร (1-based)
  endPage: number;                 // หน้าสุดท้ายของเอกสาร
  pageCount: number;               // จำนวนหน้าทั้งหมด
  isUserReviewed: boolean;         // Review แล้วหรือยัง
  reviewer: string | null;         // ชื่อผู้ review
}
```

**ตัวอย่างข้อมูล:**
```json
[
  {
    "id": 1,
    "groupId": 1,
    "documentNumber": 1,
    "templateName": "ตราสาร",
    "category": "เอกสารหลัก",
    "documentDate": "2567-01-15",
    "startPage": 1,
    "endPage": 7,
    "pageCount": 7,
    "isUserReviewed": true,
    "reviewer": "Admin User"
  },
  {
    "id": 2,
    "groupId": 1,
    "documentNumber": 2,
    "templateName": "บัญชีรายชื่อกรรมการ",
    "category": "เอกสารหลัก",
    "documentDate": null,
    "startPage": 8,
    "endPage": 8,
    "pageCount": 1,
    "isUserReviewed": true,
    "reviewer": "Admin User"
  },
  {
    "id": 3,
    "groupId": 1,
    "documentNumber": 3,
    "templateName": "ขออนุญาตจดทะเบียน",
    "category": "เอกสารประกอบ",
    "documentDate": "2567-01-10",
    "startPage": 9,
    "endPage": 10,
    "pageCount": 2,
    "isUserReviewed": true,
    "reviewer": "Admin User"
  }
]
```

---

## 3. Foundation Instrument (ตราสารมูลนิธิ)

### 3.1 Basic Info

**Source Table:** `foundation_instruments`

```typescript
interface FoundationInstrument {
  id: number;                       // Foundation Instrument ID
  groupId: number;                  // FK → groups (1:1 relationship)
  name: string | null;              // ชื่อมูลนิธิ (เต็ม)
  shortName: string | null;         // ชื่อย่อ (เช่น "ม.ก.ข.")
  address: string | null;           // ที่ตั้งมูลนิธิ
  logoDescription: string | null;   // คำอธิบายตราสัญลักษณ์
  isCancelled: boolean;             // มูลนิธิถูกยกเลิกแล้วหรือไม่
  charterSections: CharterSection[]; // หมวดของตราสาร
}
```

**ตัวอย่างข้อมูล:**
```json
{
  "id": 1,
  "groupId": 1,
  "name": "มูลนิธิส่งเสริมการศึกษาและวัฒนธรรม",
  "shortName": "ม.ส.ศ.ว.",
  "address": "เลขที่ 123 ถนนราชดำเนิน แขวงพระบรมมหาราชวัง เขตพระนคร กรุงเทพมหานคร 10200",
  "logoDescription": "รูปวงกลม ภายในมีรูปดอกบัวสีขาว พื้นหลังสีน้ำเงิน ล้อมรอบด้วยข้อความชื่อมูลนิธิ",
  "isCancelled": false
}
```

### 3.2 Charter Sections (หมวดของตราสาร)

**Source Table:** `charter_sections`

```typescript
interface CharterSection {
  id: number;                       // Section ID
  foundationInstrumentId: number;   // FK → foundation_instruments
  number: string;                   // เลขหมวด (เช่น "1", "2")
  title: string;                    // ชื่อหมวด
  orderIndex: number;               // ลำดับการแสดง
  articles: CharterArticle[];       // ข้อในหมวดนี้
}
```

### 3.3 Charter Articles (ข้อในแต่ละหมวด)

**Source Table:** `charter_articles`

```typescript
interface CharterArticle {
  id: number;                       // Article ID
  charterSectionId: number;         // FK → charter_sections
  number: string;                   // เลขข้อ (เช่น "1", "2")
  content: string;                  // เนื้อหาของข้อ
  orderIndex: number;               // ลำดับการแสดง
  subItems: CharterSubItem[];       // ข้อย่อย
}
```

### 3.4 Charter Sub Items (ข้อย่อย)

**Source Table:** `charter_sub_items`

```typescript
interface CharterSubItem {
  id: number;                       // Sub Item ID
  charterArticleId: number;         // FK → charter_articles
  number: string;                   // เลขข้อย่อย (เช่น "1.1", "1.2")
  content: string;                  // เนื้อหาของข้อย่อย
  orderIndex: number;               // ลำดับการแสดง
}
```

**ตัวอย่างข้อมูลตราสารแบบครบถ้วน:**
```json
{
  "charterSections": [
    {
      "id": 1,
      "number": "1",
      "title": "ชื่อและที่ตั้ง",
      "orderIndex": 0,
      "articles": [
        {
          "id": 1,
          "number": "1",
          "content": "มูลนิธินี้ชื่อว่า \"มูลนิธิส่งเสริมการศึกษาและวัฒนธรรม\" เรียกเป็นภาษาอังกฤษว่า \"Education and Culture Promotion Foundation\"",
          "orderIndex": 0,
          "subItems": []
        },
        {
          "id": 2,
          "number": "2",
          "content": "สำนักงานใหญ่ของมูลนิธิตั้งอยู่ ณ เลขที่ 123 ถนนราชดำเนิน แขวงพระบรมมหาราชวัง เขตพระนคร กรุงเทพมหานคร 10200",
          "orderIndex": 1,
          "subItems": []
        }
      ]
    },
    {
      "id": 2,
      "number": "2",
      "title": "วัตถุประสงค์",
      "orderIndex": 1,
      "articles": [
        {
          "id": 3,
          "number": "3",
          "content": "วัตถุประสงค์ของมูลนิธิ",
          "orderIndex": 0,
          "subItems": [
            {
              "id": 1,
              "number": "1",
              "content": "เพื่อส่งเสริมและสนับสนุนการศึกษาแก่เยาวชนที่ขาดแคลนทุนทรัพย์",
              "orderIndex": 0
            },
            {
              "id": 2,
              "number": "2",
              "content": "เพื่อส่งเสริมและอนุรักษ์ศิลปวัฒนธรรมไทย",
              "orderIndex": 1
            },
            {
              "id": 3,
              "number": "3",
              "content": "เพื่อดำเนินการหรือร่วมมือกับองค์กรการกุศลอื่นเพื่อสาธารณประโยชน์",
              "orderIndex": 2
            }
          ]
        }
      ]
    },
    {
      "id": 3,
      "number": "3",
      "title": "ทุนและทรัพย์สิน",
      "orderIndex": 2,
      "articles": [
        {
          "id": 4,
          "number": "4",
          "content": "ทรัพย์สินของมูลนิธิในเบื้องต้นคือทรัพย์สินที่ผู้ก่อตั้งได้มอบให้มูลนิธิ จำนวนเงิน 500,000 บาท (ห้าแสนบาทถ้วน)",
          "orderIndex": 0,
          "subItems": []
        }
      ]
    }
  ]
}
```

---

## 4. Committee Members (รายชื่อกรรมการ)

**Source Table:** `committee_members`

```typescript
interface CommitteeMember {
  id: number;                       // Member ID
  groupId: number;                  // FK → groups
  name: string;                     // ชื่อ-นามสกุล
  position: string | null;          // ตำแหน่ง (เช่น "ประธานกรรมการ", "กรรมการ")
  address: string | null;           // ที่อยู่
  phone: string | null;             // เบอร์โทรศัพท์
  orderIndex: number;               // ลำดับในรายชื่อ
}
```

**ตัวอย่างข้อมูล:**
```json
[
  {
    "id": 1,
    "groupId": 1,
    "name": "นายสมชาย ใจดี",
    "position": "ประธานกรรมการ",
    "address": "123/45 หมู่ 5 ต.สามเสน อ.พญาไท กรุงเทพฯ 10400",
    "phone": "02-123-4567",
    "orderIndex": 0
  },
  {
    "id": 2,
    "groupId": 1,
    "name": "นางสมหญิง รักดี",
    "position": "รองประธานกรรมการ",
    "address": "456/78 ซอยสุขใจ แขวงดินแดง เขตดินแดง กรุงเทพฯ 10400",
    "phone": "02-234-5678",
    "orderIndex": 1
  },
  {
    "id": 3,
    "groupId": 1,
    "name": "นายสมศักดิ์ มีสุข",
    "position": "เหรัญญิก",
    "address": "789/12 ถนนพหลโยธิน แขวงสามเสนใน เขตพญาไท กรุงเทพฯ 10400",
    "phone": "02-345-6789",
    "orderIndex": 2
  },
  {
    "id": 4,
    "groupId": 1,
    "name": "นางสาวสมใจ ดีมาก",
    "position": "เลขานุการ",
    "address": "111/22 ซอยอารี แขวงสามเสนใน เขตพญาไท กรุงเทพฯ 10400",
    "phone": "02-456-7890",
    "orderIndex": 3
  },
  {
    "id": 5,
    "groupId": 1,
    "name": "นายสมบูรณ์ สมบัติ",
    "position": "กรรมการ",
    "address": "222/33 ซอยสุขุมวิท 15 แขวงคลองเตยเหนือ เขตวัฒนา กรุงเทพฯ 10110",
    "phone": "02-567-8901",
    "orderIndex": 4
  }
]
```

---

## 5. Review Status (สถานะการ Approve)

**Source Table:** `groups`

```typescript
interface ReviewStatus {
  // Stage 03 Review (PDF Labels)
  finalReview03: 'pending' | 'approved' | 'rejected';
  finalReview03Reviewer: string | null;
  finalReview03ReviewedAt: Date | null;
  finalReview03Notes: string | null;

  // Stage 04 Review (Extract Data)
  finalReview04: 'pending' | 'approved' | 'rejected';
  finalReview04Reviewer: string | null;
  finalReview04ReviewedAt: Date | null;
  finalReview04Notes: string | null;
}
```

**ตัวอย่างข้อมูล:**
```json
{
  "finalReview03": "approved",
  "finalReview03Reviewer": "Admin User",
  "finalReview03ReviewedAt": "2025-12-20T14:30:00Z",
  "finalReview03Notes": "PDF labels verified correctly",

  "finalReview04": "approved",
  "finalReview04Reviewer": "Admin User",
  "finalReview04ReviewedAt": "2025-12-20T14:35:00Z",
  "finalReview04Notes": "All extracted data verified"
}
```

---

## 6. Complete Organization Output (รวมทั้งหมด)

โครงสร้าง JSON ที่สมบูรณ์เมื่อ group ผ่าน Stage 05:

```json
{
  "groupId": 1,

  "metadata": {
    "organization": "สำนักงานวัฒนธรรมจังหวัด",
    "registrationNumber": "กท.123/2567",
    "logoUrl": "logos/group-1-logo.png"
  },

  "documents": [
    {
      "documentNumber": 1,
      "templateName": "ตราสาร",
      "category": "เอกสารหลัก",
      "documentDate": "2567-01-15",
      "startPage": 1,
      "endPage": 7,
      "pageCount": 7
    },
    {
      "documentNumber": 2,
      "templateName": "บัญชีรายชื่อกรรมการ",
      "category": "เอกสารหลัก",
      "documentDate": null,
      "startPage": 8,
      "endPage": 8,
      "pageCount": 1
    }
  ],

  "foundationInstrument": {
    "name": "มูลนิธิส่งเสริมการศึกษาและวัฒนธรรม",
    "shortName": "ม.ส.ศ.ว.",
    "address": "เลขที่ 123 ถนนราชดำเนิน แขวงพระบรมมหาราชวัง เขตพระนคร กรุงเทพมหานคร 10200",
    "logoDescription": "รูปวงกลม ภายในมีรูปดอกบัวสีขาว...",
    "isCancelled": false,
    "charterSections": [
      {
        "number": "1",
        "title": "ชื่อและที่ตั้ง",
        "articles": [
          {
            "number": "1",
            "content": "มูลนิธินี้ชื่อว่า...",
            "subItems": []
          }
        ]
      }
    ]
  },

  "committeeMembers": [
    {
      "name": "นายสมชาย ใจดี",
      "position": "ประธานกรรมการ",
      "address": "123/45 หมู่ 5 ต.สามเสน...",
      "phone": "02-123-4567",
      "orderIndex": 0
    }
  ],

  "reviewStatus": {
    "stage03": {
      "status": "approved",
      "reviewer": "Admin User",
      "reviewedAt": "2025-12-20T14:30:00Z",
      "notes": "PDF labels verified correctly"
    },
    "stage04": {
      "status": "approved",
      "reviewer": "Admin User",
      "reviewedAt": "2025-12-20T14:35:00Z",
      "notes": "All extracted data verified"
    }
  }
}
```

---

## 7. API Endpoints สำหรับดึงข้อมูล

### 7.1 Get Final Review Group Detail
```
GET /files/final-review-groups/:groupId
```

**Response:**
```typescript
{
  groupId: number;
  stage03: {
    totalPages: number;
    matchedPages: number;
    unmatchedPages: number;
    matchPercentage: number;
    documents: any[];
    isReviewed: boolean;
    reviewer: string | null;
    remarks: string | null;
  };
  stage04: {
    hasFoundationInstrument: boolean;
    foundationData: FoundationInstrument | null;
    committeeCount: number;
    committeeMembers: CommitteeMember[];
    isReviewed: boolean;
    reviewer: string | null;
    remarks: string | null;
  };
  stage05: {
    finalReview03: 'pending' | 'approved' | 'rejected';
    finalReview03Reviewer: string | null;
    finalReview03ReviewedAt: string | null;
    finalReview03Notes: string | null;
    finalReview04: 'pending' | 'approved' | 'rejected';
    finalReview04Reviewer: string | null;
    finalReview04ReviewedAt: string | null;
    finalReview04Notes: string | null;
  };
  metadata: {
    districtOffice: string | null;
    registrationNumber: string | null;
    logoUrl: string | null;
  };
}
```

### 7.2 Get Groups for Final Upload (Stage 06)
```
GET /files/final-review-groups?status=approved
```

Returns only groups where **both** `finalReview03 = 'approved'` AND `finalReview04 = 'approved'`

---

## 8. Database Relationships Diagram

```
groups (1)
├─────> files (N)                  ← ไฟล์ดิบทั้งหมด
├─────> documents (N)              ← เอกสารที่ถูก label
├─────> foundation_instruments (1) ← ข้อมูลตราสาร (1:1)
│       └─────> charter_sections (N)
│               └─────> charter_articles (N)
│                       └─────> charter_sub_items (N)
└─────> committee_members (N)      ← รายชื่อกรรมการ
```

---

## 9. Stage Flow Summary

```
Stage 00: Upload Images
    ↓
Stage 01: OCR Processing
    ↓
Stage 02: Auto Grouping (BOOKMARK-based)
    ↓
Stage 03: PDF Labeling
    ├─> Auto-label (pattern matching)
    └─> Manual review → isLabeledReviewed = true
    ↓
Stage 04: Data Extraction
    ├─> Parse ตราสาร (foundation instrument)
    ├─> Parse รายชื่อกรรมการ (committee members)
    └─> Manual review → isParseDataReviewed = true
    ↓
Stage 05: Final Review ⭐
    ├─> Review Stage 03 → finalReview03 = 'approved'
    ├─> Review Stage 04 → finalReview04 = 'approved'
    └─> ✅ Organization Data Complete!
    ↓
Stage 06: Final Upload
    └─> Upload เฉพาะ groups ที่ผ่าน Stage 05
```

---

## 10. Notes

### ข้อมูลที่ต้องมีก่อนถึง Stage 06
1. `finalReview03 = 'approved'` - PDF labels ถูกต้อง
2. `finalReview04 = 'approved'` - Extracted data ถูกต้อง

### ข้อมูลที่อาจเป็น null
- `documentDate` - บางเอกสารไม่มีวันที่
- `shortName` - บางมูลนิธิไม่มีชื่อย่อ
- `phone` - บางกรรมการไม่มีเบอร์โทร
- `logoDescription` - บางมูลนิธิไม่มีคำอธิบายตรา

### Cascade Delete
เมื่อลบ group จะ cascade delete:
- ✅ documents
- ✅ foundation_instruments → charter_sections → charter_articles → charter_sub_items
- ✅ committee_members
- ❌ files (จะ set group_id = null แทน)

---

**สร้างโดย:** OCR Flow Development Team
**อัปเดตล่าสุด:** 2025-12-27
