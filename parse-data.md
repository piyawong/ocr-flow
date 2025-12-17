# Parse Data Logic - ระบบดึงข้อมูลจาก OCR

> **อัปเดตล่าสุด:** 2025-12-13
> **ที่มา:** `ref/lib/data_parsing.py`, `ref/lib/task-02-group-to-label.py`

---

## สารบัญ

1. [ภาพรวม](#ภาพรวม)
2. [Flow การทำงาน](#flow-การทำงาน)
3. [ฟังก์ชัน Parse Data](#ฟังก์ชัน-parse-data)
4. [Data Structures](#data-structures)
5. [Output Files](#output-files)
6. [ที่มาของโค้ด](#ที่มาของโค้ด)

---

## ภาพรวม

ระบบ Parse Data ทำหน้าที่ดึงข้อความจาก OCR มาแปลงเป็นข้อมูลที่มีโครงสร้าง (structured data) สำหรับเอกสาร 2 ประเภทหลัก:

1. **ตราสาร (Foundation Instrument)** - ข้อบังคับมูลนิธิ
2. **บัญชีรายชื่อกรรมการมูลนิธิ (Committee Members)** - รายชื่อกรรมการ

---

## Flow การทำงาน

```
OCR Text → Pattern Matching → Document Grouping → Data Parsing → JSON Output
```

### ขั้นตอนโดยละเอียด (จาก `task-02-group-to-label.py`)

| Step | Description | Output |
|------|-------------|--------|
| 1 | OCR images ด้วย Typhoon API | `ocrs/{page}.txt`, `ocrs/combined.txt` |
| 2 | Match patterns + Group pages | `documents[]`, `unmatched[]` |
| 3 | Create PDFs | `pdfs/{template}.pdf` |
| 3.5 | Extract logo (จาก ตราสาร.pdf หน้าแรก) | `logo.png` |
| 4 | Create summary | `summary.md` |
| 4.5 | Create skeleton JSONs | `foundation-instrument.json`, `committee-members.json` |
| **5** | **Parse data from OCR** | **Updated JSON files** |
| 6 | Send to API | API response |

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

**ไฟล์:** `ref/lib/data_parsing.py:276-364`

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
| name | `cells[1]` | คอลัมน์ที่ 2 |
| address | `cells[3]` | คอลัมน์ที่ 4 |
| phone | `cells[4]` (8-col) หรือ ตรวจสอบ `-` หรือ digit | Optional |
| position | `cells[6]` (8-col) หรือ `cells[5]` (6-col) | ตำแหน่ง |

**Table Parsing:**
1. หา `<table>...</table>` tags
2. Loop แต่ละ `<tr>` row (ข้าม header row)
3. Extract `<td>` cells
4. Map cells → member object

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

### DocumentTemplate

**ไฟล์:** `ref/lib/templates.py:20-38`

```python
@dataclass
class DocumentTemplate:
    name: str                          # ชื่อไฟล์ PDF
    first_page_patterns: list          # patterns หน้าแรก
    last_page_patterns: list           # patterns หน้าสุดท้าย
    category: str                      # หมวดหมู่
    first_page_negative_patterns: list # patterns ที่ห้าม match
    last_page_negative_patterns: list
    is_single_page: bool               # เอกสารหน้าเดียว?
```

---

## Output Files

### `foundation-instrument.json`

```
03-label/{folder_id}/foundation-instrument.json
```

โครงสร้างข้อมูลตราสารมูลนิธิที่ parse ได้

### `committee-members.json`

```
03-label/{folder_id}/committee-members.json
```

โครงสร้างข้อมูลรายชื่อกรรมการที่ parse ได้

### `config.json`

```
03-label/{folder_id}/config.json
```

Metadata รวมถึง:
- `is_checked_foundation` - parse ตราสารสำเร็จ?
- `is_checked_members` - parse กรรมการสำเร็จ?
- `is_success` - ทุกขั้นตอนสำเร็จ?

---

## ที่มาของโค้ด

| Component | File | Line |
|-----------|------|------|
| parse_foundation_instrument_data | `ref/lib/data_parsing.py` | 36-273 |
| parse_committee_members_data | `ref/lib/data_parsing.py` | 276-364 |
| convert_thai_to_arabic | `ref/lib/data_parsing.py` | 25-29 |
| DocumentGroup | `ref/lib/document_grouping.py` | 27-49 |
| group_pages_by_patterns | `ref/lib/document_grouping.py` | 56-220 |
| DocumentTemplate | `ref/lib/templates.py` | 20-38 |
| load_templates | `ref/lib/templates.py` | 54-82 |
| Main process_folder | `ref/lib/task-02-group-to-label.py` | 81-737 |

---

## Helper Functions

### `convert_thai_to_arabic()`

**ไฟล์:** `ref/lib/data_parsing.py:20-29`

แปลงเลขไทยเป็นเลขอารบิก:

```python
THAI_TO_ARABIC = {
    '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4',
    '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9'
}
```

---

## Validation & Error Handling

### Committee Files Continuity Check

เมื่อมีหลายไฟล์ `บัญชีรายชื่อกรรมการมูลนิธิ.pdf`:

1. ตรวจสอบว่าลำดับที่ (order numbers) ต่อเนื่องกัน
2. ถ้าไม่ต่อเนื่อง → บันทึก warning + ไม่ parse
3. ถ้าต่อเนื่อง → รวม (merge) ทุกไฟล์แล้ว parse

**Code:** `ref/lib/task-02-group-to-label.py:525-559`

### is_success Flag

`is_success = true` เมื่อ:
- `is_checked_logo = true`
- `is_checked_foundation = true`
- `is_checked_members = true`
- `is_checked_pdfs = true`
- API call สำเร็จ

---

**สร้างโดย:** OCR Flow Development Team
