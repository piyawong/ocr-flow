# Database Schema - รายละเอียดฉบับสมบูรณ์

> **สำหรับ:** OCR Flow v2 Database Documentation
> **อัปเดตล่าสุด:** 2025-12-24 (Migrate districts → organizations)

---

## 📑 Table of Contents

1. [ภาพรวม Database](#ภาพรวม-database)
2. [ER Diagram](#er-diagram)
3. [ตารางทั้งหมด](#ตารางทั้งหมด)
   - [0. users - Authentication](#0-users---authentication)
   - [1. files - Upload + Grouping](#1-files---upload--grouping)
   - [2. groups - Metadata + Status Tracking](#2-groups---metadata--status-tracking)
   - [3. documents - Label Results (Main)](#3-documents---labeled-documents-main-label-storage)
   - [4. templates - Auto Label Configuration](#4-templates---auto-label-configuration)
   - [5. foundation_instruments - ตราสารมูลนิธิ](#5-foundation_instruments---ตราสารมูลนิธิ)
   - [6. charter_sections - หมวดของตราสาร](#6-charter_sections---หมวดของตราสาร)
   - [7. charter_articles - ข้อในแต่ละหมวด](#7-charter_articles---ข้อในแต่ละหมวด)
   - [8. charter_sub_items - ข้อย่อยของข้อ](#8-charter_sub_items---ข้อย่อยของข้อ)
   - [9. committee_members - กรรมการมูลนิธิ](#9-committee_members---กรรมการมูลนิธิ)
   - [10. organizations - องค์กร/มูลนิธิ](#10-organizations---องค์กรมูลนิธิ)
4. [Relations & Foreign Keys](#relations--foreign-keys)
5. [Cascade Delete Rules](#cascade-delete-rules)
6. [Indexes](#indexes)

---

## ภาพรวม Database

### Database Information
- **ชื่อ Database:** `ocrflow`
- **RDBMS:** PostgreSQL 16
- **Port:** 5434 (host) → 5432 (container)
- **User:** postgres
- **Password:** postgres

### จำนวนตาราง
- **ทั้งหมด:** 12 ตาราง
- **หมวดหมู่:**
  - **Authentication:** 1 ตาราง (users)
  - **File Management:** 2 ตาราง (files, groups)
  - **Labeling:** 2 ตาราง (documents, templates)
  - **Parsed Data:** 5 ตาราง (foundation_instruments, charter_sections, charter_articles, charter_sub_items, committee_members)
  - **Organizations:** 1 ตาราง (organizations)
  - **Activity Logging:** 1 ตาราง (activity_logs)

---

## ER Diagram

### ASCII ER Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          OCR FLOW DATABASE SCHEMA                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌────────────────┐
│     users      │ (Authentication)
├────────────────┤
│ id (PK)        │
│ email (UNIQUE) │
│ password_hash  │
│ name           │
│ role           │
│ is_active      │
└────────────────┘

┌────────────────────────────┐
│           files            │ (Stage 01 + Stage 02)
├────────────────────────────┤
│ id (PK)                    │
│ file_number                │
│ original_name              │
│ storage_path               │
│ mime_type                  │
│ size                       │
│ processed                  │◄───────┐
│ processed_at               │        │
│ group_id (FK) ─────────┐   │        │
│ order_in_group         │   │        │
│ ocr_text               │   │        │  Stage 02:
│ is_bookmark            │   │        │  Task Runner
└────────────────────────┘   │        │  (Infinite Loop)
                             │        │  - OCR Processing
                             │        │  - Grouping
                             ▼        │
                  ┌────────────────────┤
                  │       groups       │ (Metadata + Status)
                  ├────────────────────┤
                  │ id (PK)            │
                  │ is_complete        │
                  │ completed_at       │
                  │                    │
                  │ -- Stage 02-03 --  │
                  │ is_auto_labeled    │◄────────┐
                  │ labeled_at         │         │
                  │ labeled_reviewer   │         │  Stage 02-03:
                  │ labeled_notes      │         │  Label Runner
                  │ is_labeled_reviewed│         │  (Auto Label)
                  │                    │         │
                  │ -- Stage 03 --     │         │
                  │ is_parse_data      │         │
                  │ parse_data_at      │         │
                  │                    │         │
                  │ -- Stage 04 --     │         │
                  │ is_parse_data_rev..│         │
                  │ parse_data_reviewer│         │
                  │ extract_data_notes │         │
                  │                    │         │
                  │ -- Stage 05 --     │         │
                  │ is_final_approved  │         │
                  │ final_approved_at  │         │
                  │ final_reviewer     │         │
                  │ final_review_notes │         │
                  │                    │         │
                  │ -- Registration -- │         │
                  │ organization       │         │
                  │ registration_number│         │
                  │ logo_url           │         │
                  └────────────────────┘         │
                             │                   │
                             │                   │
            ┌────────────────┼───────────────────┤
            │                │                   │
            ▼                ▼                   │
┌──────────────────┐  ┌─────────────────────┐   │
│ documents        │  │ foundation_instr... │   │
├──────────────────┤  ├─────────────────────┤   │
│ id (PK)          │  │ id (PK)             │   │
│ group_id (FK)    │  │ group_id (FK,UNIQUE)│   │
│ document_number  │  │ name                │   │
│ template_name    │  │ short_name          │   │
│ category         │  │ address             │   │
│ document_date    │  │ logo_description    │   │
│ start_page       │  └─────────────────────┘   │
│ end_page         │              │              │
│ page_count       │              ▼              │
│ is_user_reviewed │  ┌─────────────────────┐   │
│ reviewer         │  │  charter_sections   │   │
│ review_notes     │  ├─────────────────────┤   │
└──────────────────┘  │ id (PK)             │   │
                      │ foundation_instr... │   │
                      │ number              │   │
                      │ title               │   │
                      │ order_index         │   │
                      └─────────────────────┘   │
                                  │              │
                                  ▼              │
                      ┌─────────────────────┐   │
                      │  charter_articles   │   │
                      ├─────────────────────┤   │
                      │ id (PK)             │   │
                      │ charter_section_id  │   │
                      │ number              │   │
                      │ content             │   │
                      │ order_index         │   │
                      └─────────────────────┘   │
                                  │              │
                                  ▼              │
                      ┌─────────────────────┐   │
                      │ charter_sub_items   │   │
                      ├─────────────────────┤   │
                      │ id (PK)             │   │
                      │ charter_article_id  │   │
                      │ number              │   │
                      │ content             │   │
                      │ order_index         │   │
                      └─────────────────────┘   │
                                                 │
            ┌──────────────────────────────────┐ │
            │                                  │ │
            ▼                                  ▼ │
┌──────────────────┐              ┌─────────────────────┐
│   templates      │              │ committee_members   │
├──────────────────┤              ├─────────────────────┤
│ id (PK)          │              │ id (PK)             │
│ name             │              │ group_id (FK)       │
│ first_page_pat...│              │ name                │
│ last_page_patt...│              │ address             │
│ first_page_neg...│              │ phone               │
│ last_page_nega...│              │ position            │
│ context_rules    │              │ order_index         │
│ category         │              └─────────────────────┘
│ is_single_page   │
│ is_active        │
│ sort_order       │
└──────────────────┘

Legend:
─────►  One-to-Many relationship
══════► One-to-One relationship
(PK)    Primary Key
(FK)    Foreign Key
```

### Mermaid ER Diagram

```mermaid
erDiagram
    users {
        int id PK
        varchar email UK
        varchar password_hash
        varchar name
        varchar role
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    files {
        int id PK
        int file_number
        varchar original_name
        varchar storage_path
        varchar mime_type
        bigint size
        boolean processed
        timestamp processed_at
        int group_id FK
        int order_in_group
        text ocr_text
        boolean is_bookmark
        timestamp created_at
    }

    groups {
        int id PK
        boolean is_complete
        timestamp completed_at
        boolean is_auto_labeled
        timestamp labeled_at
        varchar labeled_reviewer
        text labeled_notes
        boolean is_labeled_reviewed
        boolean is_parse_data
        timestamp parse_data_at
        boolean is_parse_data_reviewed
        varchar parse_data_reviewer
        text extract_data_notes
        boolean is_final_approved
        timestamp final_approved_at
        varchar final_reviewer
        text final_review_notes
        varchar organization
        varchar registration_number
        varchar logo_url
        timestamp created_at
        timestamp updated_at
    }

    documents {
        int id PK
        int group_id FK
        int document_number
        varchar template_name
        varchar category
        date document_date
        int start_page
        int end_page
        int page_count
        boolean is_user_reviewed
        varchar reviewer
        text review_notes
        timestamp created_at
        timestamp updated_at
    }

    templates {
        int id PK
        varchar name
        jsonb first_page_patterns
        jsonb last_page_patterns
        jsonb first_page_negative_patterns
        jsonb last_page_negative_patterns
        jsonb context_rules
        varchar category
        boolean is_single_page
        boolean is_active
        int sort_order
        timestamp created_at
        timestamp updated_at
    }

    foundation_instruments {
        int id PK
        int group_id FK_UK
        text name
        varchar short_name
        text address
        text logo_description
        boolean is_cancelled
        timestamp created_at
        timestamp updated_at
    }

    charter_sections {
        int id PK
        int foundation_instrument_id FK
        varchar number
        varchar title
        int order_index
    }

    charter_articles {
        int id PK
        int charter_section_id FK
        varchar number
        text content
        int order_index
    }

    charter_sub_items {
        int id PK
        int charter_article_id FK
        varchar number
        text content
        int order_index
    }

    committee_members {
        int id PK
        int group_id FK
        varchar name
        text address
        varchar phone
        varchar position
        int order_index
        timestamp created_at
    }

    organizations {
        int id PK
        varchar groupName
        varchar officeName
        varchar registrationNumber
        int matchedGroupId FK
        timestamp created_at
        timestamp updated_at
    }

    files ||--o{ groups : "group_id"
    groups ||--o{ documents : "group_id (CASCADE)"
    groups ||--|| foundation_instruments : "group_id (CASCADE, UNIQUE)"
    groups ||--o{ committee_members : "group_id (CASCADE)"
    groups ||--o{ organizations : "matchedGroupId"
    foundation_instruments ||--o{ charter_sections : "foundation_instrument_id (CASCADE)"
    charter_sections ||--o{ charter_articles : "charter_section_id (CASCADE)"
    charter_articles ||--o{ charter_sub_items : "charter_article_id (CASCADE)"
```

---

## ตารางทั้งหมด

### 0. users - Authentication

**วัตถุประสงค์:** เก็บข้อมูลผู้ใช้สำหรับ authentication และ authorization

**SQL Schema:**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',  -- 'admin' | 'user'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**ฟิลด์สำคัญ:**

| ฟิลด์ | ประเภท | คำอธิบาย | Constraints |
|------|--------|---------|-------------|
| `id` | SERIAL | Primary key | PRIMARY KEY |
| `email` | VARCHAR(255) | Email สำหรับ login | UNIQUE, NOT NULL |
| `password_hash` | VARCHAR(255) | Password hash (bcrypt) | NOT NULL |
| `name` | VARCHAR(255) | ชื่อผู้ใช้ (ใช้เป็น reviewer name) | NOT NULL |
| `role` | VARCHAR(50) | บทบาท: `admin` หรือ `user` | DEFAULT 'user' |
| `is_active` | BOOLEAN | สถานะ active/inactive | DEFAULT TRUE |
| `created_at` | TIMESTAMP | วันที่สร้าง | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | วันที่อัปเดต | DEFAULT NOW() |

**Default Admin User:**
- เรียก `POST /auth/init-admin` เพื่อสร้าง admin คนแรก
- Email: `admin@ocrflow.local`
- Password: `admin123`

**User Roles:**
- `admin` - Full access (จัดการ users, เข้าถึงทุก features)
- `user` - Standard access (ใช้งาน stages, review documents)

**Indexes:**
- Primary Key: `id`
- Unique Index: `email`

---

### 1. files - Upload + Grouping

**วัตถุประสงค์:** เก็บข้อมูลไฟล์ทั้งหมด รวม Stage 01 (Upload) และ Stage 02 (Grouping)

**SQL Schema:**
```sql
CREATE TABLE files (
  id SERIAL PRIMARY KEY,
  file_number INTEGER NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size BIGINT NOT NULL,

  -- Stage 01: Upload tracking
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP NULL,

  -- Stage 02: Grouping metadata
  group_id INTEGER NULL REFERENCES groups(id),
  order_in_group INTEGER NULL,
  ocr_text TEXT NULL,
  is_bookmark BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW()
);
```

**ฟิลด์สำคัญ:**

| ฟิลด์ | ประเภท | คำอธิบาย | Constraints |
|------|--------|---------|-------------|
| `id` | SERIAL | Primary key | PRIMARY KEY |
| `file_number` | INTEGER | หมายเลขไฟล์ (auto-increment) | NOT NULL |
| `original_name` | VARCHAR(255) | ชื่อไฟล์ต้นฉบับ | NOT NULL |
| `storage_path` | VARCHAR(500) | Path ใน MinIO (bucket: raw/) | NOT NULL |
| `mime_type` | VARCHAR(100) | MIME type (image/jpeg, application/pdf) | NOT NULL |
| `size` | BIGINT | ขนาดไฟล์ (bytes) | NOT NULL |
| `processed` | BOOLEAN | สถานะการประมวลผล OCR | DEFAULT FALSE |
| `processed_at` | TIMESTAMP | เวลาที่ประมวลผล OCR เสร็จ | NULL |
| `group_id` | INTEGER | Foreign key to groups | REFERENCES groups(id) |
| `order_in_group` | INTEGER | ลำดับของไฟล์ใน group | NULL |
| `ocr_text` | TEXT | ข้อความจาก OCR (สำหรับ pattern matching) | NULL |
| `is_bookmark` | BOOLEAN | ไฟล์นี้เป็น BOOKMARK หรือไม่ | DEFAULT FALSE |
| `created_at` | TIMESTAMP | วันที่อัปโหลด | DEFAULT NOW() |

**Stage 01 - Upload:**
- `processed = false` - รอประมวลผล OCR
- `processed = true` - OCR เสร็จแล้ว

**Stage 02 - Grouping:**
- `group_id` - ID ของ group ที่ไฟล์นี้อยู่
- `order_in_group` - ลำดับของไฟล์ใน group (1, 2, 3, ...)
- `ocr_text` - ข้อความจาก OCR (เก็บไว้สำหรับ pattern matching)
- `is_bookmark` - ไฟล์นี้เป็น BOOKMARK หรือไม่

**BOOKMARK Files:**
- ⚠️ BOOKMARK เป็นแค่ตัวแบ่ง group (ไม่เก็บลง group)
- `group_id = NULL`
- `order_in_group = NULL`
- `is_bookmark = TRUE`

**Relations:**
- `group_id` → `groups.id` (Many-to-One, nullable)

**Indexes:**
- Primary Key: `id`
- Index: `group_id` (for faster joins)
- Index: `processed` (for filtering unprocessed files)

---

### 2. groups - Metadata + Status Tracking

**วัตถุประสงค์:** เก็บ metadata ของแต่ละ group และติดตาม status ของทุก stage

**SQL Schema:**
```sql
CREATE TABLE groups (
  id SERIAL PRIMARY KEY,
  is_complete BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP NULL,

  -- Stage 02: Auto-labeling (label runner)
  is_auto_labeled BOOLEAN DEFAULT FALSE,
  labeled_at TIMESTAMP NULL,
  labeled_reviewer VARCHAR(255) NULL,
  labeled_notes TEXT NULL,
  is_labeled_reviewed BOOLEAN DEFAULT FALSE,

  -- Stage 03: Parse data
  is_parse_data BOOLEAN DEFAULT FALSE,
  parse_data_at TIMESTAMP NULL,

  -- Stage 04: Parse data review
  is_parse_data_reviewed BOOLEAN DEFAULT FALSE,
  parse_data_reviewer VARCHAR(255) NULL,
  extract_data_notes TEXT NULL,

  -- Stage 05: Final Review & Approval
  is_final_approved BOOLEAN DEFAULT FALSE,
  final_approved_at TIMESTAMP NULL,
  final_reviewer VARCHAR(255) NULL,
  final_review_notes TEXT NULL,

  -- Registration info
  organization VARCHAR(255) NULL,
  registration_number VARCHAR(50) NULL,
  logo_url VARCHAR(500) NULL,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**ฟิลด์สำคัญ:**

| ฟิลด์ | ประเภท | คำอธิบาย | Stage |
|------|--------|---------|-------|
| `id` | SERIAL | Primary key | - |
| `is_complete` | BOOLEAN | จัดกลุ่มเสร็จแล้ว | 01-02 |
| `completed_at` | TIMESTAMP | เวลาที่จัดกลุ่มเสร็จ | 01-02 |
| `is_auto_labeled` | BOOLEAN | ผ่าน auto-label แล้ว | 02-03 |
| `labeled_at` | TIMESTAMP | เวลาที่ auto-label เสร็จ | 02-03 |
| `labeled_reviewer` | VARCHAR(255) | ผู้ review labels | 02-03 |
| `labeled_notes` | TEXT | หมายเหตุจากผู้ review labels | 02-03 |
| `is_labeled_reviewed` | BOOLEAN | Review labels (manual) แล้ว | 02-03 |
| `is_parse_data` | BOOLEAN | Parse data เสร็จแล้ว | 03 |
| `parse_data_at` | TIMESTAMP | เวลาที่ parse data เสร็จ | 03 |
| `is_parse_data_reviewed` | BOOLEAN | Review parse data แล้ว | 04 |
| `parse_data_reviewer` | VARCHAR(255) | ผู้ review parse data | 04 |
| `extract_data_notes` | TEXT | หมายเหตุจากผู้ review parse data | 04 |
| `is_final_approved` | BOOLEAN | Final approval แล้ว | 05 |
| `final_approved_at` | TIMESTAMP | เวลาที่ approve | 05 |
| `final_reviewer` | VARCHAR(255) | ผู้ approve (จาก JWT user.name) | 05 |
| `final_review_notes` | TEXT | หมายเหตุจาก final reviewer | 05 |
| `organization` | VARCHAR(255) | ชื่อองค์กร | - |
| `registration_number` | VARCHAR(50) | เลขทะเบียนมูลนิธิ | - |
| `logo_url` | VARCHAR(500) | URL ของ Logo มูลนิธิใน MinIO | - |
| `created_at` | TIMESTAMP | วันที่สร้าง | - |
| `updated_at` | TIMESTAMP | วันที่อัปเดต | - |

**Stage Flow:**

```
Stage 01-02: Grouping
├─> is_complete = true
└─> completed_at = NOW()

Stage 02-03: Auto-labeling + Manual Review
├─> is_auto_labeled = true (หลัง label runner เสร็จ)
├─> labeled_at = NOW()
├─> is_labeled_reviewed = true (หลัง user review labels)
├─> labeled_reviewer = user.name
└─> labeled_notes = "..."

Stage 03: Parse Data
├─> is_parse_data = true
└─> parse_data_at = NOW()

Stage 04: Parse Data Review
├─> is_parse_data_reviewed = true
├─> parse_data_reviewer = user.name
└─> extract_data_notes = "..."

Stage 05: Final Approval
├─> is_final_approved = true
├─> final_approved_at = NOW()
├─> final_reviewer = user.name
└─> final_review_notes = "..."
```

**Relations:**
- OneToMany → `files` (ผ่าน `files.group_id`)
- OneToMany → `documents` (CASCADE DELETE)
- OneToOne → `foundation_instruments` (CASCADE DELETE)
- OneToMany → `committee_members` (CASCADE DELETE)

**Indexes:**
- Primary Key: `id`
- Index: `is_complete` (for filtering incomplete groups)
- Index: `is_auto_labeled` (for filtering labeled groups)
- Index: `is_final_approved` (for filtering approved groups)

---

### 3. documents - Labeled Documents (Main Label Storage)

**วัตถุประสงค์:** เก็บ label หลักของเอกสารที่ถูก auto-label (แทน labeled_files)

> **✅ สำคัญ:** ตารางนี้คือที่เก็บ label หลักของระบบ แทนที่ labeled_files pattern เก่า

**SQL Schema:**
```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  document_number INTEGER NOT NULL,  -- Auto-increment per group (1, 2, 3, ...)

  -- Label information
  template_name VARCHAR(255) NULL,
  category VARCHAR(255) NULL,
  document_date DATE NULL,           -- วันที่เอกสาร (parsed from content)

  -- Page range in group
  start_page INTEGER NULL,           -- หน้าแรกของเอกสาร (1-based)
  end_page INTEGER NULL,             -- หน้าสุดท้ายของเอกสาร (1-based)
  page_count INTEGER NOT NULL DEFAULT 0,

  -- User review tracking
  is_user_reviewed BOOLEAN DEFAULT FALSE,
  reviewer VARCHAR(255) NULL,
  review_notes TEXT NULL,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_documents_group_id ON documents(group_id);
```

**ฟิลด์สำคัญ:**

| ฟิลด์ | ประเภท | คำอธิบาย | Constraints |
|------|--------|---------|-------------|
| `id` | SERIAL | Primary key | PRIMARY KEY |
| `groupId` | INTEGER | Foreign key to groups | NOT NULL, REFERENCES groups(id) ON DELETE CASCADE |
| `documentNumber` | INTEGER | เลขที่เอกสารใน group (1, 2, 3, ...) | NOT NULL |
| `templateName` | VARCHAR(255) | ชื่อ template ที่ match | NULL |
| `category` | VARCHAR(255) | หมวดหมู่ของเอกสาร | NULL |
| `documentDate` | DATE | วันที่เอกสาร (parsed) | NULL |
| `startPage` | INTEGER | หน้าแรกของเอกสาร (1-based) | NULL |
| `endPage` | INTEGER | หน้าสุดท้ายของเอกสาร | NULL |
| `pageCount` | INTEGER | จำนวนหน้าทั้งหมด | NOT NULL, DEFAULT 0 |
| `isUserReviewed` | BOOLEAN | User review แล้วหรือยัง | DEFAULT FALSE |
| `reviewer` | VARCHAR(255) | ชื่อผู้ review | NULL |
| `reviewNotes` | TEXT | หมายเหตุจากการ review | NULL |

**ตัวอย่างข้อมูล:**

| id | groupId | documentNumber | templateName | startPage | endPage | pageCount |
|----|---------|----------------|--------------|-----------|---------|-----------|
| 1  | 1       | 1              | ตราสาร        | 1         | 7       | 7         |
| 2  | 1       | 2              | บัญชีรายชื่อกรรมการ | 8  | 8       | 1         |
| 3  | 1       | 3              | ขออนุญาตจดทะเบียน | 9    | 10      | 2         |

**CASCADE DELETE:**
- ⚠️ เมื่อ delete group → documents จะถูก delete อัตโนมัติ

**Relations:**
- `groupId` → `groups.id` (Many-to-One, CASCADE DELETE)

**Indexes:**
- Primary Key: `id`
- Index: `group_id` (for faster joins)

---

### 4. templates - Auto Label Configuration

**วัตถุประสงค์:** เก็บ template สำหรับ auto-label PDF (pattern matching)

**SQL Schema:**
```sql
CREATE TABLE templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  first_page_patterns JSONB NULL,      -- รูปแบบหน้าแรก [["pattern1", "pattern2"], ["alt1", "alt2"]]
  last_page_patterns JSONB NULL,       -- รูปแบบหน้าสุดท้าย
  first_page_negative_patterns JSONB NULL,  -- patterns ที่ต้องไม่เจอ
  last_page_negative_patterns JSONB NULL,   -- patterns ที่ต้องไม่เจอในหน้าสุดท้าย
  context_rules JSONB NULL,            -- กฎการ match ตาม context ของหน้าก่อนหน้า
  category VARCHAR(255) NULL,          -- หมวดหมู่
  is_single_page BOOLEAN DEFAULT FALSE, -- เอกสารหน้าเดียวหรือไม่
  is_active BOOLEAN DEFAULT TRUE,      -- เปิดใช้งานหรือไม่
  sort_order INTEGER DEFAULT 0,        -- ลำดับการแสดง
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**ฟิลด์สำคัญ:**

| ฟิลด์ | ประเภท | คำอธิบาย | ค่าเริ่มต้น |
|------|--------|---------|------------|
| `id` | SERIAL | Primary key | - |
| `name` | VARCHAR(255) | ชื่อ template | NOT NULL |
| `first_page_patterns` | JSONB | รูปแบบหน้าแรก (AND/OR logic) | NULL |
| `last_page_patterns` | JSONB | รูปแบบหน้าสุดท้าย | NULL |
| `first_page_negative_patterns` | JSONB | Patterns ที่ต้องไม่เจอ | NULL |
| `last_page_negative_patterns` | JSONB | Patterns ที่ต้องไม่เจอในหน้าสุดท้าย | NULL |
| `context_rules` | JSONB | กฎการ match ตาม context | NULL |
| `category` | VARCHAR(255) | หมวดหมู่เอกสาร | NULL |
| `is_single_page` | BOOLEAN | เอกสารหน้าเดียวหรือไม่ | DEFAULT FALSE |
| `is_active` | BOOLEAN | เปิดใช้งานหรือไม่ | DEFAULT TRUE |
| `sort_order` | INTEGER | ลำดับการแสดง | DEFAULT 0 |
| `created_at` | TIMESTAMP | วันที่สร้าง | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | วันที่อัปเดต | DEFAULT NOW() |

**Pattern Structure:**

**1. first_page_patterns (JSONB):**
```json
[
  ["pattern1", "pattern2"],  // Variant 1: AND logic (ต้องเจอทั้งคู่)
  ["alt1", "alt2"]           // Variant 2: OR logic (เจอ variant ใดก็ได้)
]
```

**2. last_page_patterns (JSONB):**
```json
[
  ["end_pattern1", "end_pattern2"]
]
```

**3. first_page_negative_patterns (JSONB):**
```json
["negative1", "negative2"]  // ถ้าเจอ → ปฏิเสธ template
```

**4. context_rules (JSONB):**
```json
{
  "requirePreviousCategory": ["category1", "category2"],  // Match เฉพาะเมื่อหน้าก่อนหน้าเป็น category นี้
  "blockPreviousCategory": ["category3"]                  // ห้าม match เมื่อหน้าก่อนหน้าเป็น category นี้
}
```

**Pattern Matching Logic:**

```
1. Exact Match Only (normalized text comparison)
   ├─> Lowercase
   ├─> Trim whitespace
   └─> Collapse multiple spaces

2. AND logic ภายใน variant
   └─> ต้องเจอทุกคำใน variant

3. OR logic ระหว่าง variants
   └─> เจอ variant ใดก็ได้

4. Negative patterns
   └─> ถ้าเจอ → ปฏิเสธ template

5. Context rules
   └─> ตรวจสอบ category ของหน้าก่อนหน้า
```

**Template Types:**

| Type | is_single_page | last_page_patterns |
|------|----------------|-------------------|
| หน้าเดียว | `true` | ไม่ต้องระบุ |
| หลายหน้า | `false` | ต้องระบุ |

**API Endpoints:**
- `GET /templates` - ดึง templates ทั้งหมด
- `GET /templates/:id` - ดึง template ตาม ID
- `POST /templates` - สร้าง template ใหม่
- `PUT /templates/:id` - แก้ไข template
- `DELETE /templates/:id` - ลบ template
- `POST /templates/:id/toggle` - เปิด/ปิด template (toggle isActive)

**Indexes:**
- Primary Key: `id`
- Index: `is_active` (for filtering active templates)
- Index: `sort_order` (for sorting)

---

### 5. foundation_instruments - ตราสารมูลนิธิ

**วัตถุประสงค์:** เก็บข้อมูลตราสารมูลนิธิ (Parsed Data - Stage 03)

**SQL Schema:**
```sql
CREATE TABLE foundation_instruments (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL UNIQUE REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NULL,
  short_name VARCHAR(255) NULL,
  address TEXT NULL,
  logo_description TEXT NULL,
  is_cancelled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**ฟิลด์สำคัญ:**

| ฟิลด์ | ประเภท | คำอธิบาย | Constraints |
|------|--------|---------|-------------|
| `id` | SERIAL | Primary key | PRIMARY KEY |
| `group_id` | INTEGER | Foreign key to groups (OneToOne) | NOT NULL, UNIQUE, REFERENCES groups(id) ON DELETE CASCADE |
| `name` | TEXT | ชื่อมูลนิธิ | NULL |
| `short_name` | VARCHAR(255) | ชื่อย่อ (เช่น "ม.ก.ข.") | NULL |
| `address` | TEXT | ที่ตั้งมูลนิธิ | NULL |
| `logo_description` | TEXT | คำอธิบายตราสัญลักษณ์ | NULL |
| `is_cancelled` | BOOLEAN | มูลนิธิ/สมาคมนี้ยกเลิกแล้วหรือไม่ | DEFAULT FALSE |
| `created_at` | TIMESTAMP | วันที่สร้าง | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | วันที่อัปเดต | DEFAULT NOW() |

**Relations:**
- `group_id` → `groups.id` (OneToOne, UNIQUE, CASCADE DELETE)
- OneToMany → `charter_sections`

**Cascade Delete:**
- เมื่อ delete group → foundation_instruments จะถูก delete อัตโนมัติ
- เมื่อ delete foundation_instruments → charter_sections จะถูก delete อัตโนมัติ

**Indexes:**
- Primary Key: `id`
- Unique Index: `group_id`

---

### 6. charter_sections - หมวดของตราสาร

**วัตถุประสงค์:** เก็บหมวดต่างๆ ของตราสารมูลนิธิ

**SQL Schema:**
```sql
CREATE TABLE charter_sections (
  id SERIAL PRIMARY KEY,
  foundation_instrument_id INTEGER NOT NULL REFERENCES foundation_instruments(id) ON DELETE CASCADE,
  number VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  order_index INTEGER DEFAULT 0
);
```

**ฟิลด์สำคัญ:**

| ฟิลด์ | ประเภท | คำอธิบาย | Constraints |
|------|--------|---------|-------------|
| `id` | SERIAL | Primary key | PRIMARY KEY |
| `foundation_instrument_id` | INTEGER | Foreign key to foundation_instruments | NOT NULL, REFERENCES foundation_instruments(id) ON DELETE CASCADE |
| `number` | VARCHAR(50) | เลขหมวด (เช่น "1", "2") | NOT NULL |
| `title` | VARCHAR(255) | ชื่อหมวด (เช่น "ชื่อและที่ตั้ง") | NOT NULL |
| `order_index` | INTEGER | ลำดับการแสดง | DEFAULT 0 |

**Relations:**
- `foundation_instrument_id` → `foundation_instruments.id` (Many-to-One, CASCADE DELETE)
- OneToMany → `charter_articles`

**Cascade Delete:**
- เมื่อ delete foundation_instruments → charter_sections จะถูก delete อัตโนมัติ
- เมื่อ delete charter_sections → charter_articles จะถูก delete อัตโนมัติ

**Indexes:**
- Primary Key: `id`
- Index: `foundation_instrument_id` (for faster joins)
- Index: `order_index` (for sorting)

---

### 7. charter_articles - ข้อในแต่ละหมวด

**วัตถุประสงค์:** เก็บข้อต่างๆ ในแต่ละหมวดของตราสาร

**SQL Schema:**
```sql
CREATE TABLE charter_articles (
  id SERIAL PRIMARY KEY,
  charter_section_id INTEGER NOT NULL REFERENCES charter_sections(id) ON DELETE CASCADE,
  number VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  order_index INTEGER DEFAULT 0
);
```

**ฟิลด์สำคัญ:**

| ฟิลด์ | ประเภท | คำอธิบาย | Constraints |
|------|--------|---------|-------------|
| `id` | SERIAL | Primary key | PRIMARY KEY |
| `charter_section_id` | INTEGER | Foreign key to charter_sections | NOT NULL, REFERENCES charter_sections(id) ON DELETE CASCADE |
| `number` | VARCHAR(50) | เลขข้อ (เช่น "1", "2") | NOT NULL |
| `content` | TEXT | เนื้อหาของข้อ | NOT NULL |
| `order_index` | INTEGER | ลำดับการแสดง | DEFAULT 0 |

**Relations:**
- `charter_section_id` → `charter_sections.id` (Many-to-One, CASCADE DELETE)
- OneToMany → `charter_sub_items`

**Cascade Delete:**
- เมื่อ delete charter_sections → charter_articles จะถูก delete อัตโนมัติ
- เมื่อ delete charter_articles → charter_sub_items จะถูก delete อัตโนมัติ

**Indexes:**
- Primary Key: `id`
- Index: `charter_section_id` (for faster joins)
- Index: `order_index` (for sorting)

---

### 8. charter_sub_items - ข้อย่อยของข้อ

**วัตถุประสงค์:** เก็บข้อย่อยของแต่ละข้อในตราสาร

**SQL Schema:**
```sql
CREATE TABLE charter_sub_items (
  id SERIAL PRIMARY KEY,
  charter_article_id INTEGER NOT NULL REFERENCES charter_articles(id) ON DELETE CASCADE,
  number VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  order_index INTEGER DEFAULT 0
);
```

**ฟิลด์สำคัญ:**

| ฟิลด์ | ประเภท | คำอธิบาย | Constraints |
|------|--------|---------|-------------|
| `id` | SERIAL | Primary key | PRIMARY KEY |
| `charter_article_id` | INTEGER | Foreign key to charter_articles | NOT NULL, REFERENCES charter_articles(id) ON DELETE CASCADE |
| `number` | VARCHAR(50) | เลขข้อย่อย (เช่น "1.1", "1.2") | NOT NULL |
| `content` | TEXT | เนื้อหาของข้อย่อย | NOT NULL |
| `order_index` | INTEGER | ลำดับการแสดง | DEFAULT 0 |

**Relations:**
- `charter_article_id` → `charter_articles.id` (Many-to-One, CASCADE DELETE)

**Cascade Delete:**
- เมื่อ delete charter_articles → charter_sub_items จะถูก delete อัตโนมัติ

**Indexes:**
- Primary Key: `id`
- Index: `charter_article_id` (for faster joins)
- Index: `order_index` (for sorting)

---

### 9. committee_members - กรรมการมูลนิธิ

**วัตถุประสงค์:** เก็บรายชื่อกรรมการมูลนิธิ (Parsed Data - Stage 03)

**SQL Schema:**
```sql
CREATE TABLE committee_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name VARCHAR(255) NULL,
  address TEXT NULL,
  phone VARCHAR(100) NULL,
  position VARCHAR(255) NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**ฟิลด์สำคัญ:**

| ฟิลด์ | ประเภท | คำอธิบาย | Constraints |
|------|--------|---------|-------------|
| `id` | SERIAL | Primary key | PRIMARY KEY |
| `group_id` | INTEGER | Foreign key to groups (ManyToOne) | NOT NULL, REFERENCES groups(id) ON DELETE CASCADE |
| `name` | VARCHAR(255) | ชื่อกรรมการ | NULL |
| `address` | TEXT | ที่อยู่ | NULL |
| `phone` | VARCHAR(100) | เบอร์โทรศัพท์ | NULL |
| `position` | VARCHAR(255) | ตำแหน่ง (เช่น "ประธาน", "กรรมการ") | NULL |
| `order_index` | INTEGER | ลำดับในรายชื่อ | DEFAULT 0 |
| `created_at` | TIMESTAMP | วันที่สร้าง | DEFAULT NOW() |

**Relations:**
- `group_id` → `groups.id` (Many-to-One, CASCADE DELETE)

**Cascade Delete:**
- เมื่อ delete group → committee_members จะถูก delete อัตโนมัติ

**Indexes:**
- Primary Key: `id`
- Index: `group_id` (for faster joins)
- Index: `order_index` (for sorting)

---

### 10. organizations - องค์กร/มูลนิธิ

**วัตถุประสงค์:** เก็บข้อมูลองค์กร/มูลนิธิและการจับคู่กับ groups

**SQL Schema:**
```sql
CREATE TABLE organizations (
  id SERIAL PRIMARY KEY,
  groupName VARCHAR(255) NOT NULL,           -- ชื่อกลุ่ม
  officeName VARCHAR(255) NOT NULL,          -- ชื่อสำนักงาน/องค์กร
  registrationNumber VARCHAR(100) NULL,      -- เลขทะเบียน
  matchedGroupId INTEGER NULL REFERENCES groups(id) ON DELETE SET NULL,  -- Group ที่จับคู่
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_organizations_matched_group_id ON organizations(matchedGroupId);
```

**ฟิลด์สำคัญ:**

| ฟิลด์ | ประเภท | คำอธิบาย | Constraints |
|------|--------|---------|-------------|
| `id` | SERIAL | Primary key | PRIMARY KEY |
| `groupName` | VARCHAR(255) | ชื่อกลุ่ม | NOT NULL |
| `officeName` | VARCHAR(255) | ชื่อสำนักงาน/องค์กร | NOT NULL |
| `registrationNumber` | VARCHAR(100) | เลขทะเบียน | NULL |
| `matchedGroupId` | INTEGER | Foreign key to groups | NULL, REFERENCES groups(id) ON DELETE SET NULL |
| `created_at` | TIMESTAMP | วันที่สร้าง | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | วันที่อัปเดต | DEFAULT NOW() |

**Relations:**
- `matchedGroupId` → `groups.id` (Many-to-One, nullable, SET NULL on delete)

**Cascade Delete:**
- เมื่อ delete group → organizations.matchedGroupId จะเป็น NULL (ไม่ delete organizations)

**Indexes:**
- Primary Key: `id`
- Index: `matchedGroupId` (for faster joins)

---

## Relations & Foreign Keys

### Foreign Keys Summary

| ตาราง | Foreign Key | อ้างอิง | ประเภท | Cascade |
|-------|------------|---------|--------|---------|
| `files` | `group_id` | `groups.id` | Many-to-One | ❌ |
| `documents` | `group_id` | `groups.id` | Many-to-One | ✅ CASCADE DELETE |
| `foundation_instruments` | `group_id` | `groups.id` | One-to-One | ✅ CASCADE DELETE |
| `committee_members` | `group_id` | `groups.id` | Many-to-One | ✅ CASCADE DELETE |
| `organizations` | `matchedGroupId` | `groups.id` | Many-to-One | ✅ SET NULL |
| `charter_sections` | `foundation_instrument_id` | `foundation_instruments.id` | Many-to-One | ✅ CASCADE DELETE |
| `charter_articles` | `charter_section_id` | `charter_sections.id` | Many-to-One | ✅ CASCADE DELETE |
| `charter_sub_items` | `charter_article_id` | `charter_articles.id` | Many-to-One | ✅ CASCADE DELETE |

### Relationship Diagram

```
groups (1)
├─────> files (N) - No CASCADE
├─────> documents (N) - CASCADE DELETE
├─────> foundation_instruments (1) - CASCADE DELETE
│       └─────> charter_sections (N) - CASCADE DELETE
│               └─────> charter_articles (N) - CASCADE DELETE
│                       └─────> charter_sub_items (N) - CASCADE DELETE
├─────> committee_members (N) - CASCADE DELETE
└─────> organizations (N) - SET NULL
```

---

## Cascade Delete Rules

### ⚠️ CASCADE DELETE Behavior

**1. DELETE groups → CASCADE:**
- ✅ `documents` ทั้งหมดจะถูก delete อัตโนมัติ
- ✅ `foundation_instruments` จะถูก delete อัตโนมัติ
  - ✅ `charter_sections` → `charter_articles` → `charter_sub_items` จะถูก delete ตามไปด้วย
- ✅ `committee_members` ทั้งหมดจะถูก delete อัตโนมัติ
- ❌ `files` จะ**ไม่**ถูก delete (group_id จะเป็น NULL)

**2. DELETE foundation_instruments → CASCADE:**
- ✅ `charter_sections` ทั้งหมดจะถูก delete อัตโนมัติ
- ✅ `charter_articles` ทั้งหมดจะถูก delete อัตโนมัติ
- ✅ `charter_sub_items` ทั้งหมดจะถูก delete อัตโนมัติ

**3. DELETE charter_sections → CASCADE:**
- ✅ `charter_articles` ทั้งหมดจะถูก delete อัตโนมัติ
- ✅ `charter_sub_items` ทั้งหมดจะถูก delete อัตโนมัติ

**4. DELETE charter_articles → CASCADE:**
- ✅ `charter_sub_items` ทั้งหมดจะถูก delete อัตโนมัติ

### Clear Grouping Workflow

**API:** `POST /files/clear-grouping`

```
1. DELETE FROM groups; (ลบทุก groups)
   │
   ├─> CASCADE DELETE → documents (ทุกรายการ)
   ├─> CASCADE DELETE → foundation_instruments
   │   └─> CASCADE DELETE → charter_sections
   │       └─> CASCADE DELETE → charter_articles
   │           └─> CASCADE DELETE → charter_sub_items
   ├─> CASCADE DELETE → committee_members (ทุกรายการ)
   │
   └─> files.group_id = NULL (ไม่ delete files)
       files.order_in_group = NULL
       files.is_bookmark = FALSE

2. UPDATE files SET
   processed = FALSE,
   processed_at = NULL
   (Reset สำหรับรอบใหม่)
```

**⚠️ สิ่งสำคัญ:**
- Database จะดูแล referential integrity โดยอัตโนมัติ
- Files ยังคงอยู่ใน MinIO (ไม่ถูกลบ)

---

## Indexes

### Primary Keys
ทุกตารางมี `id SERIAL PRIMARY KEY`

### Unique Indexes

| ตาราง | ฟิลด์ | เหตุผล |
|-------|------|--------|
| `users` | `email` | ป้องกัน email ซ้ำ |
| `foundation_instruments` | `group_id` | OneToOne relationship |

### Performance Indexes

| ตาราง | ฟิลด์ | เหตุผล |
|-------|------|--------|
| `files` | `group_id` | Faster joins with groups |
| `files` | `processed` | Filter unprocessed files |
| `groups` | `is_complete` | Filter incomplete groups |
| `groups` | `is_auto_labeled` | Filter labeled groups |
| `groups` | `is_final_approved` | Filter approved groups |
| `documents` | `group_id` | Faster joins with groups |
| `documents` | `is_user_reviewed` | Filter reviewed/unreviewed |
| `templates` | `is_active` | Filter active templates |
| `templates` | `sort_order` | Sorting templates |
| `charter_sections` | `foundation_instrument_id` | Faster joins |
| `charter_sections` | `order_index` | Sorting sections |
| `charter_articles` | `charter_section_id` | Faster joins |
| `charter_articles` | `order_index` | Sorting articles |
| `charter_sub_items` | `charter_article_id` | Faster joins |
| `charter_sub_items` | `order_index` | Sorting sub items |
| `committee_members` | `group_id` | Faster joins |
| `committee_members` | `order_index` | Sorting members |
| `organizations` | `matchedGroupId` | Faster joins with groups |

### Recommended Index Creation

```sql
-- files
CREATE INDEX idx_files_group_id ON files(group_id);
CREATE INDEX idx_files_processed ON files(processed);

-- groups
CREATE INDEX idx_groups_is_complete ON groups(is_complete);
CREATE INDEX idx_groups_is_auto_labeled ON groups(is_auto_labeled);
CREATE INDEX idx_groups_is_final_approved ON groups(is_final_approved);

-- documents
CREATE INDEX idx_documents_group_id ON documents(group_id);
CREATE INDEX idx_documents_is_user_reviewed ON documents(is_user_reviewed);

-- templates
CREATE INDEX idx_templates_is_active ON templates(is_active);
CREATE INDEX idx_templates_sort_order ON templates(sort_order);

-- charter_sections
CREATE INDEX idx_charter_sections_foundation_instrument_id ON charter_sections(foundation_instrument_id);
CREATE INDEX idx_charter_sections_order_index ON charter_sections(order_index);

-- charter_articles
CREATE INDEX idx_charter_articles_charter_section_id ON charter_articles(charter_section_id);
CREATE INDEX idx_charter_articles_order_index ON charter_articles(order_index);

-- charter_sub_items
CREATE INDEX idx_charter_sub_items_charter_article_id ON charter_sub_items(charter_article_id);
CREATE INDEX idx_charter_sub_items_order_index ON charter_sub_items(order_index);

-- committee_members
CREATE INDEX idx_committee_members_group_id ON committee_members(group_id);
CREATE INDEX idx_committee_members_order_index ON committee_members(order_index);

-- organizations
CREATE INDEX idx_organizations_matched_group_id ON organizations(matchedGroupId);
```

---

## สรุป

### Database Statistics

| ตาราง | จำนวนฟิลด์ | Relations | Cascade Delete |
|-------|-----------|-----------|----------------|
| `users` | 8 | - | - |
| `files` | 13 | 1 FK | ❌ |
| `groups` | 21 | - | - |
| `documents` | 13 | 1 FK | ✅ |
| `templates` | 12 | - | - |
| `foundation_instruments` | 8 | 1 FK | ✅ |
| `charter_sections` | 5 | 1 FK | ✅ |
| `charter_articles` | 5 | 1 FK | ✅ |
| `charter_sub_items` | 5 | 1 FK | ✅ |
| `committee_members` | 7 | 1 FK | ✅ |
| `organizations` | 6 | 1 FK | ✅ SET NULL |

### Total
- **ตาราง:** 11
- **Foreign Keys:** 8
- **Cascade Delete:** 6 (CASCADE) + 1 (SET NULL)
- **Unique Constraints:** 2

---

**สร้างโดย:** OCR Flow Development Team
**อัปเดตล่าสุด:** 2025-12-24 (Migrate districts → organizations)
**เวอร์ชัน:** 2.1
