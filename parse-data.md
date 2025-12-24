# Parse Data Logic - ระบบดึงข้อมูลจาก OCR

> **อัปเดตล่าสุด:** 2025-12-24 (เพิ่ม ม.น.2 เปลี่ยนแปลง priority)
> **ที่มา:** `backend/src/parse-runner/parse-runner.service.ts`

---

## สารบัญ

1. [ภาพรวม](#ภาพรวม)
2. [Flow การทำงาน](#flow-การทำงาน)
3. [ฟังก์ชัน Parse Data](#ฟังก์ชัน-parse-data)
4. [Data Structures](#data-structures)
5. [Database Tables](#database-tables)
6. [API Endpoints](#api-endpoints)

---

## ภาพรวม

ระบบ Parse Data ทำหน้าที่ดึงข้อความจาก OCR มาแปลงเป็นข้อมูลที่มีโครงสร้าง (structured data) และบันทึกลง Database สำหรับเอกสาร 2 ประเภทหลัก:

1. **ตราสาร (Foundation Instrument)** - ข้อบังคับมูลนิธิ
2. **บัญชีรายชื่อกรรมการมูลนิธิ (Committee Members)** - รายชื่อกรรมการ

**⚠️ สำคัญ:** ระบบไม่มี background worker loop แล้ว - Parse ทำงานแบบ **on-demand** เท่านั้น:
1. **Auto-parse หลัง user review** - เมื่อ user กด "Complete Review" ใน Stage 03
2. **Manual re-parse** - เมื่อ user กดปุ่ม "Re-parse" ใน Stage 04

---

## Flow การทำงาน

```
User Review (Stage 03) → Auto Parse → Save to Database
               OR
User Click Re-parse (Stage 04) → Force Parse → Update Database
```

### ขั้นตอนการ Parse (On-Demand)

| Step | Description | Triggered By |
|------|-------------|--------------|
| 1 | User review labels และกด "Complete Review" (Stage 03) | `POST /labeled-files/group/:groupId/mark-reviewed` |
| 2 | Check 100% matched + User reviewed | `markGroupAsReviewed()` |
| 3 | **Auto-parse ทันที** (ไม่ต้องรอ worker loop) | `parseRunnerService.parseGroup(groupId)` |
| 4 | Parse foundation instrument + committee members | Regex patterns + Table parsing |
| 5 | Save to database tables | 5 tables (foundation_instruments, charter_sections, etc.) |
| 6 | Update `groups.isParseData = true` | Mark as completed |
| **OR** | **Manual Re-parse** | |
| 1 | User กดปุ่ม "Re-parse" (Stage 04) | `POST /parse-runner/parse/:groupId?force=true` |
| 2 | Force re-parse (bypass isParseData check) | `parseGroup(groupId, force=true)` |
| 3 | Parse + Update database | Same as auto-parse |

---

## ฟังก์ชัน Parse Data

### 1. `parse_foundation_instrument_data()`

**ไฟล์:** `ref/lib/data_parsing.py:36-273`

**Input:**
- `ocr_texts: dict[int, str]` - Dictionary mapping page number → OCR text
- `foundation_doc: DocumentGroup` - DocumentGroup สำหรับ ตราสาร.pdf

**Output:**
```json
{
  "name": "ชื่อมูลนิธิ",
  "shortName": "ชื่อย่อ (เช่น ม.ส.ต.)",
  "address": "ที่อยู่สำนักงาน",
  "logoDescription": "คำอธิบายเครื่องหมาย",
  "charterSections": [
    {
      "number": "1",
      "title": "ชื่อหมวด",
      "articles": [
        {
          "number": "1",
          "content": "เนื้อหาข้อ",
          "subItems": [
            {
              "number": "1.1",
              "content": "เนื้อหาข้อย่อย"
            }
          ]
        }
      ]
    }
  ]
}
```

**Logic การดึงข้อมูล:**

| Field | Pattern | หมายเหตุ |
|-------|---------|----------|
| name | `มูลนิธินี้(?:มี)?ชื่อว่า\s+(.+?)` | หยุดก่อน `ย่อว่า`, `ข้อ 2` |
| shortName | `(?:ชื่อย่อว่า\|ย่อว่า\|ขอว่า)\s+(.+?)` | หรือ pattern `ม.X.X.` |
| address | `ข้อ\s+3[\.\s]+(.+?)` | ตัดคำว่า "ตั้งอยู่" ออก |
| logoDescription | `เครื่องหมายของมูลนิธินี้\s+คือ\s+(.+?)` | หยุดก่อน `<figure>` |
| charterSections | `หมวดที่\s+([๐-๙\d]+)\s+([^\n]+)` | Loop หาทุกหมวด |
| articles | `ข้อ\s+([๐-๙\d]+)[\.\s]+(.+?)` | ใน section แต่ละหมวด |

**Pre-processing:**
1. รวม text จากทุกหน้าของ ตราสาร
2. แปลงเลขไทย → อารบิก (`๑` → `1`)
3. ลบ page numbers `<page_number>...</page_number>`
4. แก้ OCR errors (เช่น `ชื่อ 1` → `ข้อ 1`)

---

### 2. `parse_committee_members_data()`

**ไฟล์:** `backend/src/parse-runner/parse-runner.service.ts:252-511`

**Input:**
- `ocr_texts: dict[int, str]` - Dictionary mapping page number → OCR text
- `committee_docs: list[DocumentGroup]` - List ของ DocumentGroup (รองรับหลายไฟล์)

**Output:**
```json
{
  "committeeMembers": [
    {
      "name": "ชื่อ-สกุล",
      "address": "ที่อยู่",
      "phone": "เบอร์โทรศัพท์ (หรือ null)",
      "position": "ตำแหน่ง"
    }
  ]
}
```

**Logic การดึงข้อมูล:**

| Field | Column Index | หมายเหตุ |
|-------|-------------|----------|
| **Running Number** | `cells[0]` | เลขลำดับ (ใช้ validate consecutive) |
| name | `cells[1]` | คอลัมน์ที่ 2 |
| address | `cells[3]` | คอลัมน์ที่ 4 |
| phone | `cells[4]` (8-col) หรือ ตรวจสอบ `-` หรือ digit | Optional |
| position | `cells[6]` (8-col) หรือ `cells[5]` (6-col) | ตำแหน่ง |

**Table Parsing with Validation:**
1. **Parse แต่ละหน้าแยกกัน** (แทนที่จะรวมทั้งหมด)
2. สำหรับแต่ละหน้า:
   - Extract running numbers จาก `cells[0]`
   - Extract date จากหน้านั้นๆ (Thai format: "วันที่ X เดือน Y พ.ศ. Z" หรือ "dd/mm/yyyy")
   - Parse ตาราง → Extract members
3. **Group หน้าที่มี running numbers ติดกัน:**
   - Check consecutive: `minRun === maxRun + 1` or `minRun <= maxRun + 2` (allow small gap)
   - สร้าง groups ของหน้าที่ติดกัน
4. **เลือก group ที่ถูกต้อง:**
   - **ถ้ามี date:** เลือก group ที่มี date ล่าสุด
   - **ถ้าไม่มี date:** เลือก group ที่มี `orderInGroup` มากที่สุด
5. Return members จาก group ที่เลือก

**Date Patterns Supported:**
- `วันที่ X เดือน Y พ.ศ. Z` (Thai format)
- `ณ วันที่ X เดือน Y พ.ศ. Z`
- `dd/mm/yyyy` (numeric format)
- `dd/mm/yy` (2-digit year, auto-convert to Buddhist year)

**Running Number Validation:**
- **ป้องกัน:** กรณีมีหลายตารางกรรมการ (version เก่า/ใหม่) ในชุดเอกสารเดียวกัน
- **ป้องกัน:** กรณีตารางอื่นที่ไม่ใช่กรรมการแต่ถูก label ผิด
- **รองรับ:** ตารางข้ามหลายหน้าแบบต่อเนื่อง (running numbers ต่อกัน)

---

### 2.1 `parseCommitteeMembersFromMN2()` - Parse จาก ม.น.2 (เปลี่ยนแปลง)

**ไฟล์:** `backend/src/parse-runner/parse-runner.service.ts:253-424`

**⚠️ Priority:** เอกสาร "หนังสือให้อำนาจและรายละเอียดการเปลี่ยนแปลง(ม.น.2)(เปลี่ยนแปลง)" มี **ลำดับความสำคัญสูงกว่า** บัญชีรายชื่อกรรมการมูลนิธิ

**Input:**
- `ocr_texts: dict[int, str]` - OCR text จากเอกสาร ม.น.2 (เปลี่ยนแปลง)

**Output:**
```json
{
  "committeeMembers": [
    {
      "name": "นายธงชัย รักปทุม",
      "address": null,
      "phone": null,
      "position": "ประธานกรรมการ"
    }
  ]
}
```

**Table Format:**
| Column | Data | Example |
|--------|------|---------|
| `cells[0]` | เลขลำดับ + ชื่อ-สกุล | `"1. นายธงชัย รักปทุม"` |
| `cells[1]` | ตำแหน่ง | `"ประธานกรรมการ"` |

**Logic:**
1. **Parse แต่ละหน้าแยก** (เผื่อมีหลายใบ ม.น.2)
2. สำหรับแต่ละหน้า:
   - Extract date จากหน้านั้น (Thai format: "วันที่ X เดือน Y พ.ศ. Z" หรือ "dd/mm/yyyy")
   - Extract tables using `<table>...</table>` pattern
   - For each row:
     - Extract cells
     - Check if `cells[0]` matches pattern `^\d+\.\s*(.+)$` (e.g., "1. นายธงชัย")
     - Extract name from match group
     - Skip metadata rows (ที่ทำการ, ที่อยู่, วัตถุประสงค์)
     - Create member object with `name` and `position` (address & phone = null)
3. **เลือกหน้าที่ถูกต้อง:**
   - **ถ้ามี date:** เลือกหน้าที่มี date ล่าสุด
   - **ถ้าไม่มี date:** เลือกหน้าที่มี `orderInGroup` มากที่สุด
4. Return members จากหน้าที่เลือก

**Date Patterns Supported:**
- `วันที่ X เดือน Y พ.ศ. Z` (Thai format)
- `ณ วันที่ X เดือน Y พ.ศ. Z`
- `dd/mm/yyyy` (numeric format)
- `dd/mm/yy` (2-digit year, auto-convert to Buddhist year)

**Selection Priority:**
```
IF มีเอกสาร "หนังสือให้อำนาจและรายละเอียดการเปลี่ยนแปลง(ม.น.2)(เปลี่ยนแปลง)"
  → ถ้ามีหลายใบ: เลือกใบที่มี date ล่าสุด
  → parse จากเอกสารนี้ (parseCommitteeMembersFromMN2)
ELSE IF มีเอกสาร "บัญชีรายชื่อกรรมการมูลนิธิ"
  → parse จากบัญชีรายชื่อปกติ (parseCommitteeMembersData)
```

**ตัวอย่าง:** Group 132

---

## Data Structures

### DocumentGroup

**ไฟล์:** `ref/lib/document_grouping.py:27-49`

```python
@dataclass
class DocumentGroup:
    template: DocumentTemplate
    start_page: int       # 1-indexed
    end_page: int         # 1-indexed
    pages: list[int]      # list of all page numbers
    start_match_info: str # ข้อมูลว่า match เพราะอะไร
    end_match_info: str
    start_negative_match: str  # ถ้าถูก reject
    end_negative_match: str
```

---

## Database Tables

Parse data จะถูกบันทึกลง PostgreSQL (5 tables):

| Table | Description | Relations |
|-------|-------------|-----------|
| `foundation_instruments` | ข้อมูลตราสาร (name, shortName, address, logoDescription) | One-to-One กับ `groups` |
| `charter_sections` | หมวดในตราสาร (number, title, orderIndex) | One-to-Many กับ `foundation_instruments` |
| `charter_articles` | ข้อในตราสาร (number, content, orderIndex) | One-to-Many กับ `charter_sections` |
| `charter_sub_items` | ข้อย่อยในตราสาร (number, content, orderIndex) | One-to-Many กับ `charter_articles` |
| `committee_members` | กรรมการมูลนิธิ (name, address, phone, position) | One-to-Many กับ `groups` |

**CASCADE DELETE:** ลบ `group` → ลบข้อมูล parse ทั้งหมด

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| **POST** | `/parse-runner/parse/:groupId` | Parse group เดียว (first-time parse) |
| **POST** | `/parse-runner/parse/:groupId?force=true` | Re-parse group (force override) |

**Note:** ไม่มี `/start`, `/stop`, `/status`, `/logs` endpoints แล้ว - ระบบไม่ใช่ background worker

---

## Helper Functions

### `convertThaiToArabic()`

**ไฟล์:** `backend/src/parse-runner/parse-runner.service.ts:58-64`

แปลงเลขไทยเป็นเลขอารบิก:

```typescript
const THAI_TO_ARABIC: Record<string, string> = {
  '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4',
  '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9'
};
```

---

**สร้างโดย:** OCR Flow Development Team
**อัปเดตล่าสุด:** 2025-12-23
