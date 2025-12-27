# Organization API & Database Schema

Base URL: `http://localhost:3001`

---

## Database Schema

### Entity Relationship Diagram

```
organizations (1) ──────┬────── (N) organization_documents
     │                  │              └── (N) children (self-ref)
     │                  │
     ├── (N) documents  (NEW - เอกสารแบบมี category)
     │
     ├── (N) charter_sections ── (N) charter_articles
     │                                 └── (N) subItems (self-ref)
     │
     └── (N) committee_members
```

---

## Tables

### 1. `organizations` - ข้อมูลองค์กร (มูลนิธิ/สมาคม)

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary Key |
| `name` | VARCHAR(500) | NO | ชื่อองค์กร |
| `type` | VARCHAR(50) | NO | ประเภท: "มูลนิธิ" หรือ "สมาคม" |
| `is_cancelled` | BOOLEAN | NO | สถานะยกเลิก (default: false) |
| `address` | TEXT | YES | ที่อยู่ |
| `short_name` | VARCHAR(50) | YES | ชื่อย่อ (มูลนิธิ) |
| `logo_url` | VARCHAR(255) | YES | URL โลโก้ภายนอก (มูลนิธิ) |
| `logo_storage_path` | VARCHAR(255) | YES | Path โลโก้ใน MinIO (มูลนิธิ) |
| `registration_number` | VARCHAR(100) | YES | เลขทะเบียน (มูลนิธิ) |
| `district_office` | VARCHAR(255) | YES | สำนักงานเขต/พัฒนาสังคมฯ (มูลนิธิ) |
| `logo_description` | TEXT | YES | คำอธิบายโลโก้/ตราสัญลักษณ์ (มูลนิธิ) |
| `description` | TEXT | YES | รายละเอียดองค์กร (สมาคม) |
| `phone` | VARCHAR(50) | YES | เบอร์โทรศัพท์ (สมาคม) |
| `email` | VARCHAR(255) | YES | อีเมล (สมาคม) |
| `created_at` | TIMESTAMP | NO | วันที่สร้าง |
| `updated_at` | TIMESTAMP | NO | วันที่แก้ไขล่าสุด |

**Fields by Type:**

| Field | มูลนิธิ | สมาคม |
|-------|:-------:|:-----:|
| name, type, is_cancelled, address | ✓ | ✓ |
| short_name, logo_url, logo_storage_path | ✓ | - |
| registration_number, district_office, logo_description | ✓ | - |
| description, phone, email | - | ✓ |

---

### 2. `organization_documents` - เอกสารองค์กร (รองรับโครงสร้าง folder)

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary Key |
| `organization_id` | UUID | NO | FK → organizations.id |
| `parent_id` | UUID | YES | FK → organization_documents.id (สำหรับ folder) |
| `is_folder` | BOOLEAN | NO | เป็น folder หรือไม่ (default: false) |
| `name` | VARCHAR(255) | NO | ชื่อไฟล์/folder |
| `storage_path` | VARCHAR(255) | YES | Path ใน MinIO (null ถ้าเป็น folder) |
| `mime_type` | VARCHAR(100) | YES | ประเภทไฟล์ เช่น "application/pdf" |
| `size` | BIGINT | YES | ขนาดไฟล์ (bytes) |
| `created_at` | TIMESTAMP | NO | วันที่สร้าง |
| `updated_at` | TIMESTAMP | NO | วันที่แก้ไขล่าสุด |

---

### 3. `charter_sections` - หมวดตราสาร (เฉพาะมูลนิธิ)

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary Key |
| `organization_id` | UUID | NO | FK → organizations.id |
| `number` | VARCHAR(20) | NO | เลขหมวด เช่น "๑", "๒" |
| `title` | VARCHAR(255) | NO | ชื่อหมวด เช่น "ชื่อและสำนักงาน" |
| `sort_order` | INT | NO | ลำดับการแสดงผล (default: 0) |
| `created_at` | TIMESTAMP | NO | วันที่สร้าง |
| `updated_at` | TIMESTAMP | NO | วันที่แก้ไขล่าสุด |

---

### 4. `charter_articles` - ข้อตราสาร (เฉพาะมูลนิธิ)

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary Key |
| `section_id` | UUID | NO | FK → charter_sections.id |
| `parent_id` | UUID | YES | FK → charter_articles.id (สำหรับข้อย่อย) |
| `number` | VARCHAR(20) | NO | เลขข้อ เช่น "๑.", "(ก)" |
| `content` | TEXT | NO | เนื้อหาข้อบังคับ |
| `sort_order` | INT | NO | ลำดับการแสดงผล (default: 0) |
| `created_at` | TIMESTAMP | NO | วันที่สร้าง |
| `updated_at` | TIMESTAMP | NO | วันที่แก้ไขล่าสุด |

---

### 5. `committee_members` - กรรมการมูลนิธิ (เฉพาะมูลนิธิ)

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary Key |
| `organization_id` | UUID | NO | FK → organizations.id |
| `name` | VARCHAR(255) | NO | ชื่อ-นามสกุล |
| `address` | TEXT | YES | ที่อยู่ |
| `phone` | VARCHAR(50) | YES | เบอร์โทรศัพท์ |
| `position` | VARCHAR(100) | YES | ตำแหน่ง เช่น "ประธานกรรมการ" |
| `sort_order` | INT | NO | ลำดับการแสดงผล (default: 0) |
| `created_at` | TIMESTAMP | NO | วันที่สร้าง |
| `updated_at` | TIMESTAMP | NO | วันที่แก้ไขล่าสุด |

---

### 6. `documents` - เอกสารแบบมี category (NEW)

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary Key |
| `organization_id` | UUID | NO | FK → organizations.id |
| `name` | VARCHAR(255) | NO | ชื่อเอกสาร |
| `category` | VARCHAR(100) | YES | หมวดหมู่เอกสาร |
| `storage_path` | VARCHAR(255) | YES | Path ใน MinIO |
| `mime_type` | VARCHAR(100) | YES | ประเภทไฟล์ |
| `size` | BIGINT | YES | ขนาดไฟล์ (bytes) |
| `created_at` | TIMESTAMP | NO | วันที่สร้าง |
| `updated_at` | TIMESTAMP | NO | วันที่แก้ไขล่าสุด |

**หมายเหตุ:** Table นี้แตกต่างจาก `organization_documents` ตรงที่:
- ไม่มีโครงสร้าง folder (flat structure)
- มี `category` สำหรับจัดกลุ่มเอกสาร
- เหมาะสำหรับเอกสารที่ต้องการ classify ตามประเภท

---

## API Endpoints Overview

| Category | Method | Endpoint | Description |
|----------|--------|----------|-------------|
| **Organization** | GET | `/organizations` | รายการองค์กร |
| | GET | `/organizations/:id` | ข้อมูลองค์กร |
| | POST | `/organizations` | สร้างองค์กร |
| | POST | `/organizations/upsert` | Upsert (ใช้ registrationNumber เป็น key) |
| | PUT | `/organizations/:id` | แก้ไของค์กร |
| | DELETE | `/organizations/:id` | ลบองค์กร |
| **Logo** | GET | `/organizations/:id/logo` | ดาวน์โหลดโลโก้ |
| | POST | `/organizations/:id/logo` | อัปโหลดโลโก้ |
| | POST | `/organizations/upsert-logo` | Upsert โลโก้ (ใช้ registrationNumber) |
| | DELETE | `/organizations/:id/logo` | ลบโลโก้ |
| **Document** | GET | `/organizations/:id/documents` | รายการเอกสาร |
| | POST | `/organizations/:id/documents` | อัปโหลดเอกสาร |
| | GET | `/organizations/documents/:id/download` | ดาวน์โหลดเอกสาร |
| | DELETE | `/organizations/documents/:id` | ลบเอกสาร |
| | PUT | `/organizations/documents/:id/move` | ย้ายเอกสาร |
| **Folder** | POST | `/organizations/:id/folders` | สร้าง folder |
| | PUT | `/organizations/folders/:id` | แก้ไข folder |
| | DELETE | `/organizations/folders/:id` | ลบ folder |
| **Charter** | GET | `/organizations/:id/charter` | รายการหมวดตราสาร |
| | POST | `/organizations/:id/charter/sections` | สร้างหมวด |
| | PUT | `/organizations/charter/sections/:id` | แก้ไขหมวด |
| | DELETE | `/organizations/charter/sections/:id` | ลบหมวด |
| | POST | `/organizations/charter/sections/:id/articles` | สร้างข้อ |
| | PUT | `/organizations/charter/articles/:id` | แก้ไขข้อ |
| | DELETE | `/organizations/charter/articles/:id` | ลบข้อ |
| **Committee** | GET | `/organizations/:id/committee` | รายการกรรมการ |
| | POST | `/organizations/:id/committee` | เพิ่มกรรมการ |
| | PUT | `/organizations/committee/:id` | แก้ไขกรรมการ |
| | DELETE | `/organizations/committee/:id` | ลบกรรมการ |
| **Docs (NEW)** | GET | `/organizations/:id/docs` | รายการเอกสาร (มี category) |
| | GET | `/organizations/docs/:id` | ข้อมูลเอกสาร |
| | POST | `/organizations/:id/docs` | อัปโหลดเอกสาร (พร้อม name, category) |
| | PUT | `/organizations/docs/:id` | แก้ไขเอกสาร |
| | DELETE | `/organizations/docs/:id` | ลบเอกสาร |
| | GET | `/organizations/docs/:id/download` | ดาวน์โหลดเอกสาร |

---

# Part 1: Organization CRUD (ข้อมูลองค์กร)

การจัดการข้อมูลพื้นฐานขององค์กร (มูลนิธิ/สมาคม) ผ่าน JSON API

## List Organizations

```http
GET /organizations
GET /organizations?search=สนิท
GET /organizations?type=มูลนิธิ
GET /organizations?type=สมาคม
GET /organizations?isCancelled=true
GET /organizations?type=มูลนิธิ&search=สนิท
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "มูลนิธิสนิท บุญเถื่อน",
    "type": "มูลนิธิ",
    "isCancelled": false,
    "shortName": "ม.ส.บ.",
    "address": "โรงเรียนวัดปากบึง...",
    "registrationNumber": "กท.1108",
    "districtOffice": "สำนักงานเขตลาดกระบัง",
    "logoDescription": "วงกลม 2 ชั้น...",
    "logoStoragePath": "organizations/xxx.png",
    "documents": [],
    "charterSections": [],
    "committeeMembers": []
  },
  {
    "id": "uuid",
    "name": "สมาคมนักบัญชี",
    "type": "สมาคม",
    "isCancelled": false,
    "address": "133 ถนนสุขุมวิท...",
    "description": "สมาคมวิชาชีพด้านการบัญชี",
    "phone": "02-685-2500",
    "email": "info@tfac.or.th",
    "documents": []
  }
]
```

## Get Organization Detail

```http
GET /organizations/:id
```

**Response:** เหมือน list แต่เป็น object เดียว พร้อม nested relations ครบ

## Create Organization

### สร้างมูลนิธิ

```http
POST /organizations
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "มูลนิธิทดสอบ",
  "type": "มูลนิธิ",
  "shortName": "ม.ท.",
  "address": "123 ถ.ทดสอบ แขวงลาดกระบัง เขตลาดกระบัง กรุงเทพฯ 10520",
  "registrationNumber": "กท 9999",
  "districtOffice": "สำนักงานเขตลาดกระบัง",
  "logoDescription": "รูปวงกลมสีน้ำเงิน มีรูปดอกบัว"
}
```

**Fields สำหรับมูลนิธิ:**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | string | ✓ | ชื่อมูลนิธิ (สูงสุด 500 ตัวอักษร) |
| `type` | string | ✓ | ต้องเป็น "มูลนิธิ" |
| `shortName` | string | - | ชื่อย่อ เช่น "ม.ส.บ." |
| `address` | string | - | ที่อยู่สำนักงาน |
| `registrationNumber` | string | - | เลขทะเบียนมูลนิธิ เช่น "กท.1108" |
| `districtOffice` | string | - | สำนักงานเขต/พัฒนาสังคมฯ |
| `logoDescription` | string | - | คำอธิบายตราสัญลักษณ์ |
| `isCancelled` | boolean | - | สถานะยกเลิก (default: false) |

### สร้างสมาคม

```http
POST /organizations
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "สมาคมทดสอบ",
  "type": "สมาคม",
  "address": "456 ถ.ตัวอย่าง เขตวัฒนา กรุงเทพฯ 10110",
  "description": "สมาคมสำหรับการทดสอบระบบ",
  "phone": "02-123-4567",
  "email": "test@example.com"
}
```

**Fields สำหรับสมาคม:**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | string | ✓ | ชื่อสมาคม (สูงสุด 500 ตัวอักษร) |
| `type` | string | ✓ | ต้องเป็น "สมาคม" |
| `address` | string | - | ที่อยู่สำนักงาน |
| `description` | string | - | รายละเอียดสมาคม |
| `phone` | string | - | เบอร์โทรศัพท์ |
| `email` | string | - | อีเมล |
| `isCancelled` | boolean | - | สถานะยกเลิก (default: false) |

## Upsert Organization (ใช้ registrationNumber เป็น key)

```http
POST /organizations/upsert
Content-Type: application/json
```

**Logic:**
- ถ้ามี organization ที่มี `registrationNumber` ตรงกัน → **UPDATE**
- ถ้าไม่มี → **CREATE** ใหม่

**Request Body:** (เหมือน Create Organization)
```json
{
  "name": "มูลนิธิทดสอบ",
  "type": "มูลนิธิ",
  "registrationNumber": "กท 9999",
  "shortName": "ม.ท.",
  "address": "123 ถ.ทดสอบ"
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "มูลนิธิทดสอบ",
  "type": "มูลนิธิ",
  "registrationNumber": "กท 9999",
  "_isNew": true
}
```

| Field | Description |
|-------|-------------|
| `_isNew` | `true` = สร้างใหม่, `false` = อัปเดต |

**Use Case:**
- Bulk import จากไฟล์ CSV/JSON
- Sync ข้อมูลจากระบบภายนอก
- ไม่ต้องเช็คว่ามีอยู่แล้วหรือไม่ก่อน create

## Update Organization

```http
PUT /organizations/:id
Content-Type: application/json
```

**Request Body:** (ส่งเฉพาะ field ที่ต้องการแก้ไข)
```json
{
  "name": "ชื่อใหม่",
  "address": "ที่อยู่ใหม่",
  "isCancelled": true
}
```

## Delete Organization

```http
DELETE /organizations/:id
```

**หมายเหตุ:** จะลบ documents, charter, committee ที่เกี่ยวข้องทั้งหมด (cascade delete)

---

# Part 2: Logo Upload (อัปโหลดโลโก้)

การจัดการโลโก้ขององค์กร (มูลนิธิ) ผ่าน multipart/form-data

## Upload Logo

```http
POST /organizations/:id/logo
Content-Type: multipart/form-data
```

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `file` | File | ✓ | ไฟล์รูปภาพ (PNG, JPG, GIF, WebP) |

**cURL Example:**
```bash
curl -X POST http://localhost:3001/organizations/{id}/logo \
  -F "file=@/path/to/logo.png"
```

**JavaScript Example:**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch(`/organizations/${id}/logo`, {
  method: 'POST',
  body: formData
});
```

**Response:** Organization object พร้อม `logoStoragePath` ที่อัปเดตแล้ว

**Supported Formats:**
- PNG (แนะนำ - รองรับ transparency)
- JPEG/JPG
- GIF
- WebP

## Upsert Logo (ใช้ registrationNumber เป็น key)

```http
POST /organizations/upsert-logo
Content-Type: multipart/form-data
```

**Logic:**

| สถานะ | ผลลัพธ์ |
|-------|---------|
| ❌ ไม่เจอ `registrationNumber` | **Error 404**: "Organization not found" |
| ✅ เจอ + มี logo เก่า | ลบ logo เก่า → อัปโหลดใหม่ |
| ✅ เจอ + ไม่มี logo | อัปโหลด logo ใหม่ |

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `file` | File | ✓ | ไฟล์รูปภาพ |
| `registrationNumber` | string | ✓ | เลขทะเบียนองค์กร |

**cURL Example:**
```bash
curl -X POST http://localhost:3001/organizations/upsert-logo \
  -F "file=@/path/to/logo.png" \
  -F "registrationNumber=กท 9999"
```

**JavaScript Example:**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('registrationNumber', 'กท 9999');

const response = await fetch('/organizations/upsert-logo', {
  method: 'POST',
  body: formData
});
```

**Response:** Organization object พร้อม `logoStoragePath` ที่อัปเดตแล้ว

**Use Case:**
- Bulk import โลโก้จากโฟลเดอร์ โดยใช้เลขทะเบียนเป็น key
- ไม่ต้องหา organization ID ก่อน

## Get Logo

```http
GET /organizations/:id/logo
```

**Response:** Binary image file พร้อม Content-Type ที่เหมาะสม

**Usage in HTML:**
```html
<img src="http://localhost:3001/organizations/{id}/logo" alt="Logo" />
```

## Delete Logo

```http
DELETE /organizations/:id/logo
```

**Response:** Organization object พร้อม `logoStoragePath: null`

---

# Part 3: Document Upload (อัปโหลดเอกสาร PDF)

การจัดการเอกสาร PDF ขององค์กร รองรับโครงสร้าง folder

## Flow การอัปโหลดเอกสาร

### กรณี 1: Upload ไป Root (ไม่มี folder)
```
POST /organizations/:id/documents
    └── file: document.pdf
    └── parentId: (ไม่ต้องส่ง)
```

### กรณี 2: Upload ลง Folder ใหม่
```
Step 1: POST /organizations/:id/folders
        └── Body: { "name": "เอกสารตราสาร", ... }
        └── Response: { "id": "folder-abc-123", ... }
                              ↓
Step 2: POST /organizations/:id/documents
        └── file: document.pdf
        └── parentId: folder-abc-123
```

### กรณี 3: Upload ลง Folder ที่มีอยู่แล้ว (ไม่รู้ ID)
```
Step 1: GET /organizations/:id/documents
        └── Response: [{ "id": "folder-abc-123", "name": "เอกสารตราสาร", "isFolder": true }, ...]
        └── หา folder ID จาก response
                              ↓
Step 2: POST /organizations/:id/documents
        └── file: document.pdf
        └── parentId: folder-abc-123
```

---

## List Documents

```http
GET /organizations/:id/documents
GET /organizations/:id/documents?parentId={folderId}
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `parentId` | UUID | ID ของ folder (ถ้าไม่ระบุ = root level) |

**Response:**
```json
[
  {
    "id": "uuid",
    "organizationId": "uuid",
    "parentId": null,
    "isFolder": true,
    "name": "เอกสารตราสาร",
    "storagePath": null,
    "mimeType": null,
    "size": null,
    "children": [],
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  {
    "id": "uuid",
    "organizationId": "uuid",
    "parentId": null,
    "isFolder": false,
    "name": "ใบอนุญาต.pdf",
    "storagePath": "organizations/xxx.pdf",
    "mimeType": "application/pdf",
    "size": 123456,
    "children": [],
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

## Upload Document (PDF)

```http
POST /organizations/:id/documents
Content-Type: multipart/form-data
```

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `file` | File | ✓ | ไฟล์ PDF |
| `parentId` | UUID | - | ID ของ folder (ถ้าไม่ระบุ = root level) |

**cURL Example - Upload to Root:**
```bash
curl -X POST http://localhost:3001/organizations/{id}/documents \
  -F "file=@/path/to/document.pdf"
```

**cURL Example - Upload to Folder:**
```bash
curl -X POST http://localhost:3001/organizations/{id}/documents \
  -F "file=@/path/to/document.pdf" \
  -F "parentId={folderId}"
```

**JavaScript Example:**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

// Optional: upload to specific folder
if (folderId) {
  formData.append('parentId', folderId);
}

const response = await fetch(`/organizations/${id}/documents`, {
  method: 'POST',
  body: formData
});
```

**Response:** Document object ที่สร้างใหม่

**Supported Format:** PDF only (`application/pdf`)

## Download Document

```http
GET /organizations/documents/:documentId/download
```

**Response:** Binary PDF file

**Usage:**
```javascript
// Open in new tab
window.open(`/organizations/documents/${docId}/download`, '_blank');

// Or use in iframe
<iframe src={`/organizations/documents/${docId}/download`} />
```

## Move Document

```http
PUT /organizations/documents/:documentId/move
Content-Type: application/json
```

**Request Body:**
```json
{
  "newParentId": "folder-uuid"
}
```

หรือย้ายไป root:
```json
{
  "newParentId": null
}
```

## Delete Document

```http
DELETE /organizations/documents/:documentId
```

**หมายเหตุ:** ลบทั้งข้อมูลใน database และไฟล์ใน MinIO storage

---

## Folder Management

### Create Folder

```http
POST /organizations/:id/folders
Content-Type: application/json
```

**Request Body:**
```json
{
  "organizationId": "uuid",
  "name": "เอกสารตราสาร",
  "parentId": null
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `organizationId` | UUID | ✓ | ID ขององค์กร |
| `name` | string | ✓ | ชื่อ folder |
| `parentId` | UUID | - | ID ของ parent folder (null = root) |

### Update Folder

```http
PUT /organizations/folders/:folderId
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "ชื่อใหม่",
  "parentId": "new-parent-folder-uuid"
}
```

### Delete Folder

```http
DELETE /organizations/folders/:folderId
```

**หมายเหตุ:** Cascade delete - ลบไฟล์และ sub-folder ทั้งหมดภายใน

---

# Part 4: Charter Management (ตราสาร - มูลนิธิ)

## Get Charter

```http
GET /organizations/:id/charter
```

**Response:**
```json
[
  {
    "id": "uuid",
    "organizationId": "uuid",
    "number": "๑",
    "title": "ชื่อ เครื่องหมายและสำนักงาน",
    "sortOrder": 1,
    "articles": [
      {
        "id": "uuid",
        "sectionId": "uuid",
        "parentId": null,
        "number": "๑",
        "content": "มูลนิธินี้มีชื่อว่า...",
        "sortOrder": 1,
        "subItems": []
      }
    ]
  }
]
```

## Create Section

```http
POST /organizations/:id/charter/sections
Content-Type: application/json
```

```json
{
  "number": "๑",
  "title": "ชื่อ เครื่องหมายและสำนักงาน",
  "sortOrder": 1
}
```

## Create Article

```http
POST /organizations/charter/sections/:sectionId/articles
Content-Type: application/json
```

```json
{
  "number": "๔",
  "content": "วัตถุประสงค์ของมูลนิธิ เพื่อ",
  "sortOrder": 1,
  "subItems": [
    { "number": "๔.๑", "content": "ส่งเสริมการศึกษา" },
    { "number": "๔.๒", "content": "ช่วยเหลือผู้ด้อยโอกาส" }
  ]
}
```

---

# Part 5: Committee Management (กรรมการ - มูลนิธิ)

## Get Committee Members

```http
GET /organizations/:id/committee
```

## Create Member

```http
POST /organizations/:id/committee
Content-Type: application/json
```

```json
{
  "name": "นายทดสอบ ตัวอย่าง",
  "position": "ประธานกรรมการ",
  "address": "123 ถ.ทดสอบ",
  "phone": "081-111-1111",
  "sortOrder": 1
}
```

## Update Member

```http
PUT /organizations/committee/:memberId
Content-Type: application/json
```

```json
{
  "name": "ชื่อใหม่",
  "position": "ตำแหน่งใหม่"
}
```

## Delete Member

```http
DELETE /organizations/committee/:memberId
```

---

# Part 6: Docs Management (เอกสารแบบมี category - NEW)

การจัดการเอกสารแบบมี category สำหรับ classify เอกสารตามประเภท

**ความแตกต่างจาก organization_documents:**
- ไม่มีโครงสร้าง folder (flat structure)
- มี `category` field สำหรับจัดกลุ่ม
- ต้องระบุ `name` และ `category` ตอน upload

## List Docs

```http
GET /organizations/:id/docs
GET /organizations/:id/docs?category=ใบอนุญาต
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | กรองตาม category |

**Response:**
```json
[
  {
    "id": "uuid",
    "organizationId": "uuid",
    "name": "ใบอนุญาตจัดตั้งมูลนิธิ",
    "category": "ใบอนุญาต",
    "storagePath": "organizations/xxx.pdf",
    "mimeType": "application/pdf",
    "size": 123456,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

## Get Doc

```http
GET /organizations/docs/:docId
```

## Upload Doc

```http
POST /organizations/:id/docs
Content-Type: multipart/form-data
```

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `file` | File | ✓ | ไฟล์เอกสาร (PDF, รูปภาพ, etc.) |
| `name` | string | ✓ | ชื่อเอกสาร |
| `category` | string | - | หมวดหมู่เอกสาร |

**cURL Example:**
```bash
curl -X POST http://localhost:3001/organizations/{id}/docs \
  -F "file=@/path/to/document.pdf" \
  -F "name=ใบอนุญาตจัดตั้งมูลนิธิ" \
  -F "category=ใบอนุญาต"
```

**JavaScript Example:**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('name', 'ใบอนุญาตจัดตั้งมูลนิธิ');
formData.append('category', 'ใบอนุญาต');

const response = await fetch(`/organizations/${id}/docs`, {
  method: 'POST',
  body: formData
});
```

**Response:** Document object ที่สร้างใหม่

## Update Doc

```http
PUT /organizations/docs/:docId
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "ชื่อใหม่",
  "category": "หมวดหมู่ใหม่"
}
```

## Delete Doc

```http
DELETE /organizations/docs/:docId
```

## Download Doc

```http
GET /organizations/docs/:docId/download
```

**Response:** Binary file

**Usage:**
```javascript
// Open in new tab
window.open(`/organizations/docs/${docId}/download`, '_blank');
```
