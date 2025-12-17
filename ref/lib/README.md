# OCR Flow Processing Library

This directory contains refactored modules from `task-02-group-to-label.py`.

## 📁 Library Structure

```
lib/
├── README.md                    # This file - Documentation
├── __init__.py                  # Package exports and documentation
├── config.py                    # Configuration and constants
├── templates.py                 # Template classes and loading
├── utils.py                     # Utility functions
├── ocr.py                       # OCR and PDF functions
├── pattern_matching.py          # Pattern matching logic
├── document_grouping.py         # Document grouping logic
├── data_parsing.py              # Data extraction functions
└── api_client.py                # API communication functions
```

---

## 📄 Module Descriptions

### 1. `config.py` - Configuration และ Constants

**Purpose**: จัดเก็บค่า configuration และ constants ที่ใช้ทั่วทั้ง project

**Contains**:
- `FUZZY_THRESHOLD = 80` - Threshold สำหรับการ match pattern แบบ fuzzy (0-100)
- `API_BASE_URL = "http://localhost:3001"` - Base URL ของ API
- `API_TIMEOUT = 10` - Timeout สำหรับการเรียก API (วินาที)
- `UPLOAD_TIMEOUT = 30` - Timeout สำหรับการ upload ไฟล์ (วินาที)

**Usage**:
```python
from lib.config import FUZZY_THRESHOLD, API_BASE_URL
```

---

### 2. `templates.py` - Template Classes และ Loading

**Purpose**: จัดการ document templates สำหรับการจับคู่ pattern

**Contains**:
- `DocumentTemplate` dataclass - โครงสร้างของ template
  - `name`: ชื่อไฟล์ PDF ที่จะสร้าง
  - `first_page_patterns`: patterns สำหรับหน้าแรก
  - `last_page_patterns`: patterns สำหรับหน้าสุดท้าย
  - `category`: หมวดหมู่ (ถ้าไม่ว่าง จะสร้าง folder ตามชื่อนี้)
  - `first_page_negative_patterns`: patterns ที่ถ้าเจอในหน้าแรกแล้วจะไม่ match
  - `last_page_negative_patterns`: patterns ที่ถ้าเจอในหน้าสุดท้ายแล้วจะไม่ match

- `UNMATCHED_TEMPLATE` - Template default สำหรับหน้าที่ไม่ match
- `load_templates(json_path)` - โหลด templates จากไฟล์ JSON

**Usage**:
```python
from lib.templates import DocumentTemplate, load_templates
from pathlib import Path

templates = load_templates(Path("templates.json"))
```

---

### 3. `utils.py` - Utility Functions

**Purpose**: ฟังก์ชันช่วยเหลือทั่วไป

**Contains**:
- `log(msg)` - พิมพ์ log พร้อม timestamp
- `get_processable_folders(group_dir)` - หา folders ที่พร้อมจะ process
- `get_sorted_images(folder)` - หารูปภาพในโฟลเดอร์และเรียงตามลำดับตัวเลข
- `mark_folder_as_labeled(folder, has_unmatched)` - ทำเครื่องหมายว่าโฟลเดอร์ประมวลผลเสร็จแล้ว

**Usage**:
```python
from lib.utils import log, get_sorted_images

log("Starting processing...")
images = get_sorted_images(Path("02-group/1"))
```

---

### 4. `ocr.py` - OCR และ PDF Functions

**Purpose**: ทำ OCR และสร้าง PDF

**Contains**:
- `ocr_image_typhoon(image_path, api_key)` - ทำ OCR ด้วย Typhoon OCR API
  - Returns: `(text, confidence)` tuple
  - แก้ไข OCR errors อัตโนมัติ (เช่น "ํา" → "ำ")

- `create_pdf_from_images(image_paths, output_path)` - สร้าง PDF จากรูปภาพ

**Usage**:
```python
from lib.ocr import ocr_image_typhoon, create_pdf_from_images

# OCR
text, confidence = ocr_image_typhoon(Path("image.jpg"), "your_api_key")

# Create PDF
create_pdf_from_images([Path("1.jpg"), Path("2.jpg")], Path("output.pdf"))
```

---

### 5. `pattern_matching.py` - Pattern Matching Logic

**Purpose**: Logic สำหรับการจับคู่ pattern ในข้อความ

**Contains**:
- `text_matches_single_pattern(text, pattern, full_info)`
  - เช็คว่าข้อความมี pattern หรือไม่ (รองรับ fuzzy matching)
  - Returns: `(matched, match_info, score)` tuple

- `text_matches_patterns(text, patterns, full_info)`
  - เช็คว่าข้อความ match กับ pattern ใดๆ หรือไม่
  - รองรับ OR logic (string) และ AND logic (list of strings)
  - Returns: `(matched, match_info, avg_score)` tuple

- `find_matching_template(text, templates, check_type)`
  - หา template ที่ match ที่สุด
  - `check_type` = "first" หรือ "last"
  - Returns: `(template, match_info)` tuple

- `get_full_match_info(text, patterns)`
  - ดึง match info แบบเต็ม (ไม่ตัด) สำหรับ summary

**Usage**:
```python
from lib.pattern_matching import find_matching_template

template, match_info = find_matching_template(text, templates, "first")
if template:
    print(f"Matched: {template.name} - {match_info}")
```

---

### 6. `document_grouping.py` - Document Grouping Logic

**Purpose**: จัดกลุ่มหน้าเป็นเอกสาร

**Contains**:
- `DocumentGroup` dataclass - กลุ่มของหน้าที่เป็นเอกสารเดียวกัน
  - `template`: Template ที่ match
  - `start_page`: หน้าแรก (1-indexed)
  - `end_page`: หน้าสุดท้าย (1-indexed)
  - `pages`: รายการเลขหน้าทั้งหมด
  - `start_match_info`: ข้อมูลว่า start page match เพราะอะไร
  - `end_match_info`: ข้อมูลว่า end page match เพราะอะไร

- `group_pages_by_patterns(ocr_texts, templates)`
  - จัดกลุ่มหน้าตาม template patterns
  - Returns: `(documents, unmatched_pages, incomplete_documents)` tuple

**Logic**:
1. เมื่อเจอ `first_page_pattern` → เริ่ม document ใหม่
2. หน้าต่อๆ ไปนับต่อจนกว่าจะเจอ `last_page_patterns`
3. หลังจากเจอ `last_page_patterns` → หน้าถัดไปต้อง match `first_page_pattern`
4. Template อาจมีแค่หน้าเดียว (first และ last อยู่หน้าเดียวกัน)

**Usage**:
```python
from lib.document_grouping import group_pages_by_patterns

documents, unmatched, incomplete = group_pages_by_patterns(ocr_texts, templates)
print(f"Found {len(documents)} complete documents")
```

---

### 7. `data_parsing.py` - Data Extraction Functions

**Purpose**: แยกข้อมูลจาก OCR text เป็น structured data

**Contains**:
- `parse_foundation_instrument_data(ocr_texts, foundation_doc)`
  - แยกข้อมูลจาก "ตราสาร" เอกสาร
  - Returns: dict ที่มี `name`, `shortName`, `address`, `logoDescription`, `charterSections`
  - ใช้ regex ในการแยกข้อมูล:
    - ชื่อมูลนิธิ: `มูลนิธินี้(?:มี)?ชื่อว่า ...`
    - ชื่อย่อ: `ย่อว่า ...`
    - ที่อยู่: `สำนักงานของมูลนิธิตั้งอยู่(?:ที่)? ...`
    - หมวดและข้อ: `หมวดที่ X`, `ข้อ Y`

- `parse_committee_members_data(ocr_texts, committee_doc)`
  - แยกข้อมูลจาก "บัญชีรายชื่อกรรมการมูลนิธิ" เอกสาร
  - Returns: dict ที่มี `committeeMembers` array
  - แยกจาก markdown table format

**Usage**:
```python
from lib.data_parsing import parse_foundation_instrument_data

foundation_data = parse_foundation_instrument_data(ocr_texts, foundation_doc)
print(f"Foundation name: {foundation_data['name']}")
```

---

### 8. `api_client.py` - API Communication Functions

**Purpose**: สื่อสารกับ API

**Contains**:
- `send_foundation_data_to_api(folder_id, output_folder)`
  - ส่งข้อมูล foundation ไปยัง API
  - รวมข้อมูลจาก `foundation-instrument.json` และ `committee-members.json`
  - Returns: `(success, foundation_id)` tuple
  - Skip การส่งถ้า `name` เป็น null/empty

- `upload_pdfs_to_api(folder_id, output_folder, foundation_id)`
  - Upload PDF files ไปยัง API
  - สแกน `pdfs/` folder และ upload ทั้ง root และ subfolder
  - สร้าง folder ใน API ตาม category

- `create_folder_via_api(foundation_id, folder_name)`
  - สร้าง folder ใน API
  - Returns: `(success, folder_id)` tuple

- `upload_pdf_file(foundation_id, pdf_path, parent_id, category)`
  - Upload ไฟล์ PDF เดียวไปยัง API
  - ใช้ multipart/form-data format
  - Returns: `True` ถ้า success

**Usage**:
```python
from lib.api_client import send_foundation_data_to_api, upload_pdfs_to_api

success, foundation_id = send_foundation_data_to_api(1, Path("03-label/1"))
if success:
    upload_pdfs_to_api(1, Path("03-label/1"), foundation_id)
```

---

## 🔄 Data Flow

```
┌─────────────────┐
│  Input Images   │
│  (02-group/)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  OCR Processing │  ◄── ocr.py: ocr_image_typhoon()
│  (Typhoon API)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Pattern Match  │  ◄── pattern_matching.py: find_matching_template()
│  (Templates)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Group Documents │  ◄── document_grouping.py: group_pages_by_patterns()
│ (Pages → PDFs)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Parse Data     │  ◄── data_parsing.py: parse_foundation_instrument_data()
│  (Extract Info) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Send to API    │  ◄── api_client.py: send_foundation_data_to_api()
│  (Upload PDFs)  │
└─────────────────┘
```

---

## 🚀 Quick Start

### Import หลายๆ module พร้อมกัน

```python
from lib import (
    # Config
    FUZZY_THRESHOLD,

    # Templates
    load_templates,

    # Utils
    log, get_sorted_images,

    # OCR
    ocr_image_typhoon, create_pdf_from_images,

    # Pattern Matching
    find_matching_template,

    # Document Grouping
    group_pages_by_patterns,

    # Data Parsing
    parse_foundation_instrument_data,

    # API Client
    send_foundation_data_to_api
)
```

### ตัวอย่างการใช้งาน

```python
from pathlib import Path
from lib import (
    load_templates,
    log,
    get_sorted_images,
    ocr_image_typhoon,
    group_pages_by_patterns,
)

# 1. Load templates
templates = load_templates(Path("templates.json"))
log(f"Loaded {len(templates)} templates")

# 2. Get images
images = get_sorted_images(Path("02-group/1"))
log(f"Found {len(images)} images")

# 3. OCR images
ocr_texts = {}
for idx, img_path in enumerate(images, 1):
    text, confidence = ocr_image_typhoon(img_path, "your_api_key")
    ocr_texts[idx] = text
    log(f"OCR [{idx}/{len(images)}]: {img_path.name}")

# 4. Group pages into documents
documents, unmatched, incomplete = group_pages_by_patterns(ocr_texts, templates)
log(f"Found {len(documents)} complete documents")
log(f"Unmatched pages: {unmatched}")
```

---

## 📝 Notes

- ทุก module มี docstrings อธิบายฟังก์ชันและ parameters
- ใช้ type hints เพื่อความชัดเจน
- รองรับ Python 3.9+
- ใช้ `from __future__ import annotations` เพื่อ forward references

---

## 🔧 Development

### Adding New Features

1. เพิ่มฟังก์ชันใน module ที่เหมาะสม
2. เพิ่ม docstring อธิบายฟังก์ชัน
3. Export ฟังก์ชันใน `__init__.py`
4. Update `README.md` นี้

### Testing

```python
# Test individual modules
from lib.config import FUZZY_THRESHOLD
print(f"Fuzzy threshold: {FUZZY_THRESHOLD}")

from lib.templates import load_templates
templates = load_templates(Path("templates.json"))
print(f"Loaded {len(templates)} templates")
```

---

## 📚 Related Files

- `task-02-group-to-label.py` - Main script ที่ใช้ library นี้
- `templates.json` - Template configuration file
- `logo_extractor.py` - Logo extraction module (ยังไม่ได้ refactor เข้า lib)
