# OCR Flow v2 - API Reference

> **อัปเดตล่าสุด:** 2025-12-24 (Migrate districts → organizations)
> **เอกสารนี้อธิบาย:** API Endpoints ทั้งหมดของระบบ OCR Flow v2

---

## 📋 สารบัญ

1. [ภาพรวม API](#ภาพรวม-api)
2. [Authentication](#authentication)
3. [Organizations Module](#organizations-module)
4. [Files Module (Stage 01-02-04)](#files-module-stage-01-02-04)
5. [Labeled Files Module (Stage 03)](#labeled-files-module-stage-03)
6. [Templates Module](#templates-module)
7. [Task Runner Module (Stage 01)](#task-runner-module-stage-01)
8. [Label Runner Module (Stage 02)](#label-runner-module-stage-02)
9. [Parse Runner Module (Stage 03)](#parse-runner-module-stage-03)
10. [Quick Lookup Table](#quick-lookup-table)

---

## 🎯 ภาพรวม API

### Base URL
```
http://localhost:4004
```

### Authentication
- **Type:** JWT Bearer Token
- **Header:** `Authorization: Bearer <token>`
- **Login endpoint:** `POST /auth/login`
- **Token expiry:** ตามการตั้งค่า (ดูที่ JWT_EXPIRES_IN)

### Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Success message"
}
```

### Error Response
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

---

## 🔐 Authentication

### 1. Login (Public)
**Endpoint:** `POST /auth/login`

**Purpose:** เข้าสู่ระบบและรับ JWT token

**Request Body:**
```json
{
  "email": "admin@ocrflow.local",
  "password": "admin123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@ocrflow.local",
    "name": "Admin User",
    "role": "admin",
    "isActive": true
  }
}
```

---

### 2. Register (Public)
**Endpoint:** `POST /auth/register`

**Purpose:** ลงทะเบียนผู้ใช้ใหม่

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "isActive": true
  }
}
```

---

### 3. Get Current User (Protected)
**Endpoint:** `GET /auth/me`

**Purpose:** ดึงข้อมูลผู้ใช้ปัจจุบัน

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": 1,
  "email": "admin@ocrflow.local",
  "name": "Admin User",
  "role": "admin",
  "isActive": true,
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

---

### 4. List All Users (Admin Only)
**Endpoint:** `GET /auth/users`

**Purpose:** ดึงรายการผู้ใช้ทั้งหมด (เฉพาะ admin)

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response:**
```json
[
  {
    "id": 1,
    "email": "admin@ocrflow.local",
    "name": "Admin User",
    "role": "admin",
    "isActive": true,
    "createdAt": "2025-01-01T00:00:00.000Z"
  },
  {
    "id": 2,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "isActive": true,
    "createdAt": "2025-01-02T00:00:00.000Z"
  }
]
```

---

### 5. Get User by ID (Admin Only)
**Endpoint:** `GET /auth/users/:id`

**Purpose:** ดึงข้อมูลผู้ใช้ตาม ID (เฉพาะ admin)

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "id": 2,
  "email": "user@example.com",
  "name": "John Doe",
  "role": "user",
  "isActive": true,
  "createdAt": "2025-01-02T00:00:00.000Z"
}
```

---

### 6. Update User (Admin Only)
**Endpoint:** `PATCH /auth/users/:id`

**Purpose:** แก้ไขข้อมูลผู้ใช้ (เฉพาะ admin)

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "name": "John Smith",
  "role": "admin",
  "isActive": false
}
```

**Response:**
```json
{
  "id": 2,
  "email": "user@example.com",
  "name": "John Smith",
  "role": "admin",
  "isActive": false,
  "updatedAt": "2025-01-03T00:00:00.000Z"
}
```

---

### 7. Delete User (Admin Only)
**Endpoint:** `DELETE /auth/users/:id`

**Purpose:** ลบผู้ใช้ (เฉพาะ admin)

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "message": "User deleted successfully"
}
```

---

### 8. Initialize Admin (Public - First Time Only)
**Endpoint:** `POST /auth/init-admin`

**Purpose:** สร้าง admin user คนแรก (ใช้ครั้งเดียวตอนติดตั้งระบบ)

**Response:**
```json
{
  "message": "Admin user created successfully",
  "user": {
    "email": "admin@ocrflow.local",
    "name": "Admin User",
    "role": "admin"
  }
}
```

**Default Credentials:**
- Email: `admin@ocrflow.local`
- Password: `admin123`

---

## 🏢 Organizations Module

**Purpose:** จัดการข้อมูลองค์กร (สำนักงานเขต) และการเชื่อมโยงกับกลุ่มไฟล์

### 1. Create Organization
**Endpoint:** `POST /organizations`

**Purpose:** สร้างองค์กร (สำนักงานเขต) ใหม่

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "name": "สำนักงานเขตจอมทอง",
  "groupName": "จอมทอง",
  "registrationNumber": "30",
  "description": "สำนักงานเขตจอมทอง สำหรับการจัดการเอกสาร",
  "displayOrder": 1,
  "isActive": true,
  "matchedGroupId": 1
}
```

**Response:**
```json
{
  "message": "Organization created successfully",
  "organization": {
    "id": 1,
    "name": "สำนักงานเขตจอมทอง",
    "groupName": "จอมทอง",
    "registrationNumber": "30",
    "description": "สำนักงานเขตจอมทอง สำหรับการจัดการเอกสาร",
    "displayOrder": 1,
    "isActive": true,
    "matchedGroupId": 1,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

---

### 2. Get All Organizations
**Endpoint:** `GET /organizations`

**Purpose:** ดึงรายการองค์กรทั้งหมด (รองรับ filter by active status)

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `active` | string | undefined | Filter: 'true' (active only), 'false' (inactive only), undefined (all) |

**Example:**
```
GET /organizations?active=true
```

**Response:**
```json
{
  "total": 2,
  "organizations": [
    {
      "id": 1,
      "name": "สำนักงานเขตจอมทอง",
      "groupName": "จอมทอง",
      "registrationNumber": "30",
      "description": "สำนักงานเขตจอมทอง สำหรับการจัดการเอกสาร",
      "displayOrder": 1,
      "isActive": true,
      "matchedGroupId": 1,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "name": "สำนักงานเขตดินแดง",
      "groupName": "ดินแดง",
      "registrationNumber": "31",
      "description": null,
      "displayOrder": 2,
      "isActive": true,
      "matchedGroupId": 2,
      "createdAt": "2025-01-01T01:00:00.000Z",
      "updatedAt": "2025-01-01T01:00:00.000Z"
    }
  ]
}
```

---

### 3. Get Single Organization
**Endpoint:** `GET /organizations/:id`

**Purpose:** ดึงข้อมูลองค์กร (สำนักงานเขต) ตาม ID

**Response:**
```json
{
  "organization": {
    "id": 1,
    "name": "สำนักงานเขตจอมทอง",
    "groupName": "จอมทอง",
    "registrationNumber": "30",
    "description": "สำนักงานเขตจอมทอง สำหรับการจัดการเอกสาร",
    "displayOrder": 1,
    "isActive": true,
    "matchedGroupId": 1,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

---

### 4. Update Organization
**Endpoint:** `PATCH /organizations/:id`

**Purpose:** แก้ไขข้อมูลองค์กร (สำนักงานเขต)

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "name": "สำนักงานเขตจอมทอง (อัปเดต)",
  "groupName": "จอมทอง",
  "displayOrder": 5,
  "isActive": false
}
```

**Response:**
```json
{
  "message": "Organization updated successfully",
  "organization": {
    "id": 1,
    "name": "สำนักงานเขตจอมทอง (อัปเดต)",
    "groupName": "จอมทอง",
    "registrationNumber": "30",
    "displayOrder": 5,
    "isActive": false,
    "matchedGroupId": 1,
    "updatedAt": "2025-01-02T00:00:00.000Z"
  }
}
```

---

### 5. Delete Organization
**Endpoint:** `DELETE /organizations/:id`

**Purpose:** ลบองค์กร (สำนักงานเขต)

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "message": "Organization deleted successfully"
}
```

---

## 📁 Files Module (Stage 01-02-04)

### Stage 01: Upload & OCR Processing

#### 1. Upload Files
**Endpoint:** `POST /files/upload`

**Purpose:** อัพโหลดไฟล์ (images/PDFs)

**Request:** `multipart/form-data`
```
files: File[] (multiple files)
```

**Response:**
```json
{
  "uploaded": [
    {
      "id": 1,
      "fileNumber": 1,
      "originalName": "document-001.jpg",
      "storagePath": "ocr-flow-v2-uploads/file-1-1234567890.jpg",
      "mimeType": "image/jpeg",
      "size": 1048576,
      "processed": false,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### 2. Get All Files (Paginated)
**Endpoint:** `GET /files`

**Purpose:** ดึงรายการไฟล์ทั้งหมด (รองรับ pagination, sorting, filtering)

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | หน้าปัจจุบัน |
| `limit` | number | 10 | จำนวนรายการต่อหน้า |
| `sortBy` | string | 'createdAt' | เรียงตาม: createdAt, fileNumber, originalName |
| `sortOrder` | 'ASC' \| 'DESC' | 'DESC' | ลำดับการเรียง |
| `processed` | 'all' \| 'true' \| 'false' | 'all' | กรองตาม processed status |

**Example:**
```
GET /files?page=1&limit=20&sortBy=createdAt&sortOrder=DESC&processed=false
```

**Response:**
```json
{
  "files": [
    {
      "id": 1,
      "fileNumber": 1,
      "originalName": "document-001.jpg",
      "processed": true,
      "processedAt": "2025-01-01T00:10:00.000Z",
      "groupId": 1,
      "orderInGroup": 1,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

---

#### 3. Preview File
**Endpoint:** `GET /files/:id/preview`

**Purpose:** ดูตัวอย่างไฟล์ (รูปภาพ)

**Response:** Binary image data (JPEG/PNG)

---

#### 4. Rotate Image
**Endpoint:** `POST /files/:id/rotate`

**Purpose:** หมุนรูปภาพ 90 องศา (บันทึกลงไฟล์จริง)

**Request Body:**
```json
{
  "degrees": 90
}
```

**Values:** `90`, `-90`, `180`

**Response:**
```json
{
  "message": "Image rotated successfully",
  "file": {
    "id": 1,
    "fileNumber": 1,
    "originalName": "document-001.jpg",
    "storagePath": "ocr-flow-v2-uploads/file-1-1234567890.jpg"
  }
}
```

---

#### 5. Delete File
**Endpoint:** `DELETE /files/:id`

**Purpose:** ลบไฟล์

**Response:**
```json
{
  "message": "File deleted successfully"
}
```

---

#### 6. Clear All Files
**Endpoint:** `POST /files/clear`

**Purpose:** ลบไฟล์ทั้งหมด (รวมใน MinIO)

**Response:**
```json
{
  "message": "All files cleared successfully",
  "deleted": 100
}
```

---

#### 7. Reset Processed Status
**Endpoint:** `POST /files/reset-processed`

**Purpose:** รีเซ็ต processed status ของทุกไฟล์ (สำหรับ reprocess)

**Response:**
```json
{
  "message": "Processed status reset successfully",
  "updated": 100
}
```

---

#### 8. Validate Storage
**Endpoint:** `POST /files/validate-storage`

**Purpose:** ตรวจสอบ storage integrity (ตรวจว่าไฟล์ใน DB match กับ MinIO)

**Response:**
```json
{
  "totalFiles": 100,
  "validFiles": 98,
  "invalidFiles": 2,
  "missingInStorage": [
    {
      "fileId": 50,
      "storagePath": "ocr-flow-v2-uploads/file-50-1234567890.jpg"
    }
  ]
}
```

---

### Stage 02: Grouping

#### 9. Get Groups Metadata
**Endpoint:** `GET /files/groups-metadata`

**Purpose:** ดึง metadata ของทุก group (รวม createdAt สำหรับเรียงลำดับ)

**Response:**
```json
[
  {
    "groupId": 1,
    "fileCount": 14,
    "isComplete": true,
    "isLabeled": true,
    "createdAt": "2025-01-01T01:00:00.000Z"
  },
  {
    "groupId": 2,
    "fileCount": 8,
    "isComplete": true,
    "isLabeled": false,
    "createdAt": "2025-01-01T02:00:00.000Z"
  }
]
```

---

#### 10. Get Groups Ready to Label
**Endpoint:** `GET /files/ready-to-label`

**Purpose:** ดึง groups ที่พร้อม label (isComplete = true, isLabeled = false)

**Response:**
```json
[
  {
    "groupId": 2,
    "fileCount": 8,
    "isComplete": true,
    "isLabeled": false,
    "createdAt": "2025-01-01T02:00:00.000Z"
  }
]
```

---

#### 11. Get Group Files
**Endpoint:** `GET /files/group/:groupId`

**Purpose:** ดึงไฟล์ทั้งหมดของ group ที่ระบุ

**Response:**
```json
{
  "groupId": 1,
  "fileCount": 14,
  "files": [
    {
      "id": 1,
      "fileNumber": 1,
      "originalName": "document-001.jpg",
      "orderInGroup": 1,
      "isBookmark": false,
      "ocrText": "{ ... }",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### 12. Reorder Files in Group
**Endpoint:** `PUT /files/group/:groupId/reorder`

**Purpose:** เปลี่ยนลำดับไฟล์ใน group (drag-and-drop reordering)

**Request Body:**
```json
{
  "fileIds": [3, 1, 2, 4]
}
```

**Response:**
```json
{
  "message": "Files reordered successfully",
  "updated": 4
}
```

---

#### 13. Clear All Grouping (Revert)
**Endpoint:** `POST /files/clear-grouping`

**Purpose:** ลบการจัดกลุ่มทั้งหมด + CASCADE DELETE labeled_files

**Response:**
```json
{
  "message": "All grouping cleared successfully",
  "deletedGroups": 5,
  "updatedFiles": 100
}
```

---

#### 14. Real-time Group Events (SSE)
**Endpoint:** `SSE /files/events`

**Purpose:** รับ events แบบ real-time (GROUP_COMPLETE, GROUP_CREATED)

**Event Types:**
- `GROUP_COMPLETE` - group นี้จัดกลุ่มเสร็จแล้ว
- `GROUP_CREATED` - มี group ใหม่ถูกสร้าง

**Example Event:**
```
event: GROUP_COMPLETE
data: {"groupId":1,"fileCount":14}
```

---

### Stage 04: Parsed Data

#### 15. Get Parsed Groups (List)
**Endpoint:** `GET /files/parsed-groups`

**Purpose:** ดึง list ของ groups ที่ parse แล้ว (พร้อม review status)

**Response:**
```json
{
  "groups": [
    {
      "groupId": 1,
      "fileCount": 14,
      "parseDataAt": "2025-01-01T03:00:00.000Z",
      "hasFoundationInstrument": true,
      "committeeCount": 5,
      "isParseDataReviewed": false,
      "parseDataReviewer": null
    }
  ]
}
```

---

#### 16. Get Parsed Group Detail
**Endpoint:** `GET /files/parsed-group/:groupId`

**Purpose:** ดึงรายละเอียดของ group ที่ parse แล้ว (พร้อม relations)

**Response:**
```json
{
  "group": {
    "id": 1,
    "isParseData": true,
    "parseDataAt": "2025-01-01T03:00:00.000Z",
    "isParseDataReviewed": false,
    "parseDataReviewer": null,
    "extractDataNotes": null
  },
  "foundationInstrument": {
    "id": 1,
    "name": "มูลนิธิเพื่อการพัฒนาสังคม",
    "shortName": "ม.พ.ส.",
    "address": "123 ถนนสุขุมวิท กรุงเทพฯ",
    "logoDescription": "ดอกบัวสีน้ำเงิน",
    "charterSections": [
      {
        "id": 1,
        "number": "1",
        "title": "ชื่อและที่ตั้ง",
        "articles": [
          {
            "id": 1,
            "number": "1",
            "content": "มูลนิธินี้ชื่อว่า มูลนิธิเพื่อการพัฒนาสังคม",
            "subItems": []
          }
        ]
      }
    ]
  },
  "committeeMembers": [
    {
      "id": 1,
      "name": "นายสมชาย ใจดี",
      "position": "ประธาน",
      "address": "456 ถนนพหลโยธิน กรุงเทพฯ",
      "phone": "02-1234567",
      "orderIndex": 1
    }
  ]
}
```

---

#### 17. Mark Parse Data as Reviewed
**Endpoint:** `POST /files/parsed-group/:groupId/mark-reviewed`

**Purpose:** Mark parse data as reviewed (Stage 04)

**Request Body:**
```json
{
  "reviewer": "John Doe",
  "notes": "ตรวจสอบแล้ว ข้อมูลถูกต้อง"
}
```

**Response:**
```json
{
  "message": "Parse data marked as reviewed",
  "group": {
    "id": 1,
    "isParseDataReviewed": true,
    "parseDataReviewer": "John Doe",
    "extractDataNotes": "ตรวจสอบแล้ว ข้อมูลถูกต้อง"
  }
}
```

---

## 🏷️ Labeled Files Module (Stage 03)

### 1. Get All Labeled Files
**Endpoint:** `GET /labeled-files`

**Purpose:** ดึงรายการไฟล์ที่ label แล้วทั้งหมด

**Response:**
```json
[
  {
    "id": 1,
    "groupId": 1,
    "orderInGroup": 1,
    "originalName": "document-001.jpg",
    "templateName": "ตราสาร",
    "category": "foundation_instrument",
    "labelStatus": "start",
    "documentId": 1,
    "pageInDocument": 1,
    "isUserReviewed": false,
    "reviewer": null,
    "createdAt": "2025-01-01T02:00:00.000Z"
  }
]
```

---

### 2. Get Processed Groups (Labeled)
**Endpoint:** `GET /labeled-files/processed-groups`

**Purpose:** ดึง list ของ group ที่ label แล้ว

**Response:**
```json
[
  {
    "groupId": 1,
    "fileCount": 14,
    "labeledAt": "2025-01-01T02:00:00.000Z",
    "matchedCount": 14,
    "unmatchedCount": 0,
    "matchPercentage": 100
  }
]
```

---

### 3. Get Summary (All Groups)
**Endpoint:** `GET /labeled-files/summary`

**Purpose:** ดึง summary ของทุก group (พร้อม review status)

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `includeReviewed` | boolean | false | ถ้า false: แสดงเฉพาะ unreviewed groups |

**Example:**
```
GET /labeled-files/summary?includeReviewed=false
```

**Response:**
```json
[
  {
    "groupId": 1,
    "totalPages": 14,
    "matchedPages": 14,
    "unmatchedPages": 0,
    "matchPercentage": 100,
    "documents": [
      {
        "documentId": 1,
        "templateName": "ตราสาร",
        "pageCount": 10
      },
      {
        "documentId": 2,
        "templateName": "บัญชีรายชื่อกรรมการ",
        "pageCount": 4
      }
    ],
    "isReviewed": false,
    "reviewer": null,
    "labeledNotes": null
  }
]
```

---

### 4. Get Templates
**Endpoint:** `GET /labeled-files/templates`

**Purpose:** ดึงรายการ templates ทั้งหมด (จาก Database)

**Response:**
```json
[
  {
    "id": 1,
    "name": "ตราสาร",
    "category": "foundation_instrument",
    "isActive": true,
    "isMultiPage": true
  },
  {
    "id": 2,
    "name": "บัญชีรายชื่อกรรมการ",
    "category": "committee_members",
    "isActive": true,
    "isMultiPage": false
  }
]
```

---

### 5. Get Group Labeled Files
**Endpoint:** `GET /labeled-files/group/:groupId`

**Purpose:** ดึงไฟล์ของ group ที่ระบุ (พร้อม label results)

**Response:**
```json
{
  "groupId": 1,
  "fileCount": 14,
  "files": [
    {
      "id": 1,
      "orderInGroup": 1,
      "originalName": "document-001.jpg",
      "storagePath": "ocr-flow-v2-uploads/file-1-1234567890.jpg",
      "templateName": "ตราสาร",
      "category": "foundation_instrument",
      "labelStatus": "start",
      "documentId": 1,
      "pageInDocument": 1,
      "isUserReviewed": true,
      "reviewer": "John Doe",
      "ocrText": "{ ... }"
    }
  ]
}
```

---

### 6. Get Group Summary
**Endpoint:** `GET /labeled-files/group/:groupId/summary`

**Purpose:** ดึง summary ของ group ที่ระบุ

**Response:**
```json
{
  "groupId": 1,
  "totalPages": 14,
  "matchedPages": 14,
  "unmatchedPages": 0,
  "matchPercentage": 100,
  "documents": [
    {
      "documentId": 1,
      "templateName": "ตราสาร",
      "category": "foundation_instrument",
      "pageCount": 10,
      "pages": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    },
    {
      "documentId": 2,
      "templateName": "บัญชีรายชื่อกรรมการ",
      "category": "committee_members",
      "pageCount": 4,
      "pages": [11, 12, 13, 14]
    }
  ],
  "unmatchedPages": []
}
```

---

### 7. Manual Label Pages (Batch Update)
**Endpoint:** `PATCH /labeled-files/group/:groupId/pages`

**Purpose:** Manual Label - อัปเดต labels ของหลายหน้า (batch update)

**Request Body:**
```json
{
  "updates": [
    {
      "labeledFileId": 1,
      "templateName": "ตราสาร",
      "category": "foundation_instrument",
      "labelStatus": "start"
    },
    {
      "labeledFileId": 2,
      "templateName": "ตราสาร",
      "category": "foundation_instrument",
      "labelStatus": "continue"
    }
  ]
}
```

**Response:**
```json
{
  "message": "Labels updated successfully",
  "updated": 2
}
```

---

### 8. Mark Group as Reviewed (Save Review)
**Endpoint:** `POST /labeled-files/group/:groupId/mark-reviewed`

**Purpose:** บันทึก review notes และ conditionally mark as reviewed

**Request Body:**
```json
{
  "reviewer": "John Doe",
  "notes": "ตรวจสอบแล้ว Label ถูกต้อง",
  "markAsReviewed": true
}
```

**Parameters:**
- `reviewer` (required) - ชื่อผู้ review
- `notes` (optional) - หมายเหตุ
- `markAsReviewed` (optional, default: false) - mark as reviewed ถ้า true

**Behavior:**
- **Always:** บันทึก `labeled_notes` ใน groups table
- **When markAsReviewed = true AND match 100%:**
  - Update `isUserReviewed = true` และ `reviewer` ใน labeled_files
  - Update `labeled_reviewer` และ `is_labeled_reviewed = true` ใน groups
  - **Auto-trigger Parse Data** → เรียก parseRunnerService.parseGroup() ใน background
- **When markAsReviewed = false OR match < 100%:**
  - บันทึกเฉพาะ notes (ไม่ mark as reviewed)

**Response:**
```json
{
  "updated": 14,
  "marked": true,
  "parsed": true,
  "parseMessage": "Parse data triggered in background"
}
```

---

### 9. Clear All Labeled Files (Reset)
**Endpoint:** `POST /labeled-files/clear`

**Purpose:** ลบ labeled files ทั้งหมด + reset groups.isLabeled (Reset Progress)

**Response:**
```json
{
  "message": "All labeled files cleared successfully",
  "deleted": 100,
  "groupsReset": 5
}
```

---

### 10. Preview Labeled File
**Endpoint:** `GET /labeled-files/:id/preview`

**Purpose:** Preview รูปภาพของ labeled file

**Response:** Binary image data (JPEG/PNG)

---

## 📋 Templates Module

### 1. Get All Templates
**Endpoint:** `GET /templates`

**Purpose:** ดึง templates ทั้งหมด (รวม active และ inactive)

**Response:**
```json
[
  {
    "id": 1,
    "name": "ตราสาร",
    "category": "foundation_instrument",
    "isActive": true,
    "isMultiPage": true,
    "patterns": [
      {
        "patternType": "first_page",
        "keywords": [
          ["ตราสาร", "จัดตั้งมูลนิธิ"]
        ]
      }
    ],
    "contextRules": null,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

---

### 2. Get Template by ID
**Endpoint:** `GET /templates/:id`

**Purpose:** ดึง template ตาม ID

**Response:**
```json
{
  "id": 1,
  "name": "ตราสาร",
  "category": "foundation_instrument",
  "isActive": true,
  "isMultiPage": true,
  "patterns": [
    {
      "patternType": "first_page",
      "keywords": [
        ["ตราสาร", "จัดตั้งมูลนิธิ"]
      ]
    },
    {
      "patternType": "last_page",
      "keywords": [
        ["ลายมือชื่อ", "ผู้จัดตั้ง"]
      ]
    }
  ],
  "negativePatterns": [],
  "contextRules": null,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

---

### 3. Create Template
**Endpoint:** `POST /templates`

**Purpose:** สร้าง template ใหม่

**Request Body:**
```json
{
  "name": "ตราสารใหม่",
  "category": "foundation_instrument",
  "isActive": true,
  "isMultiPage": true,
  "patterns": [
    {
      "patternType": "first_page",
      "keywords": [
        ["ตราสาร", "จัดตั้งมูลนิธิ"]
      ]
    }
  ],
  "negativePatterns": [
    ["ไม่ใช่ตราสาร"]
  ],
  "contextRules": {
    "canFollowTemplates": ["บัญชีรายชื่อกรรมการ"],
    "cannotFollowTemplates": []
  }
}
```

**Response:**
```json
{
  "id": 3,
  "name": "ตราสารใหม่",
  "category": "foundation_instrument",
  "isActive": true,
  "isMultiPage": true,
  "createdAt": "2025-01-02T00:00:00.000Z"
}
```

---

### 4. Update Template
**Endpoint:** `PUT /templates/:id`

**Purpose:** แก้ไข template

**Request Body:**
```json
{
  "name": "ตราสาร (อัปเดต)",
  "isActive": true,
  "patterns": [
    {
      "patternType": "first_page",
      "keywords": [
        ["ตราสาร", "จัดตั้งมูลนิธิ"],
        ["ตราสาร", "มูลนิธิ"]
      ]
    }
  ]
}
```

**Response:**
```json
{
  "id": 1,
  "name": "ตราสาร (อัปเดต)",
  "isActive": true,
  "updatedAt": "2025-01-02T01:00:00.000Z"
}
```

---

### 5. Delete Template
**Endpoint:** `DELETE /templates/:id`

**Purpose:** ลบ template

**Response:**
```json
{
  "message": "Template deleted successfully"
}
```

---

### 6. Toggle Template Active Status
**Endpoint:** `POST /templates/:id/toggle`

**Purpose:** เปิด/ปิด template (toggle isActive)

**Response:**
```json
{
  "id": 1,
  "name": "ตราสาร",
  "isActive": false,
  "updatedAt": "2025-01-02T02:00:00.000Z"
}
```

---

## 🔄 Task Runner Module (Stage 01)

**Purpose:** จัดการ OCR + Grouping background tasks (Infinite Worker Loop)

### 1. Start Task Runner
**Endpoint:** `POST /task-runner/start`

**Purpose:** เริ่ม infinite worker loop (OCR + Grouping)

**Response:**
```json
{
  "message": "Task runner started",
  "status": "running"
}
```

---

### 2. Stop Task Runner
**Endpoint:** `POST /task-runner/stop`

**Purpose:** หยุด worker loop

**Response:**
```json
{
  "message": "Task runner stopped",
  "status": "stopped"
}
```

---

### 3. Get Task Status
**Endpoint:** `GET /task-runner/status`

**Purpose:** ตรวจสอบสถานะ task

**Response:**
```json
{
  "isRunning": true,
  "currentTask": "Processing file 10/100",
  "processed": 10,
  "pending": 90,
  "lastActivity": "2025-01-01T00:10:00.000Z"
}
```

---

### 4. Get Log History
**Endpoint:** `GET /task-runner/logs-history`

**Purpose:** ดึง log history (100 logs ล่าสุด)

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2025-01-01T00:10:00.000Z",
      "level": "info",
      "message": "Processed file 10",
      "data": {
        "fileId": 10,
        "fileNumber": 10
      }
    }
  ]
}
```

---

### 5. Clear Logs
**Endpoint:** `POST /task-runner/clear-logs`

**Purpose:** ลบ logs

**Response:**
```json
{
  "message": "Logs cleared successfully"
}
```

---

### 6. Real-time Logs (SSE)
**Endpoint:** `SSE /task-runner/logs`

**Purpose:** รับ logs แบบ real-time (Server-Sent Events)

**Event Types:**
- `log` - log message
- `FILE_PROCESSED` - ไฟล์ถูก process เสร็จ
- `GROUP_CREATED` - group ใหม่ถูกสร้าง

**Example Event:**
```
event: log
data: {"level":"info","message":"Processing file 10","timestamp":"2025-01-01T00:10:00.000Z"}

event: FILE_PROCESSED
data: {"fileId":10,"fileNumber":10}
```

---

## 🏷️ Label Runner Module (Stage 02)

**Purpose:** จัดการ Label process (Pattern Matching + PDF Splitting)

### 1. Start Label Runner
**Endpoint:** `POST /label-runner/start`

**Purpose:** เริ่ม label process สำหรับทุก group (Infinite Worker Loop)

**Response:**
```json
{
  "message": "Label runner started",
  "status": "running"
}
```

---

### 2. Re-label Group
**Endpoint:** `POST /label-runner/relabel/:groupId`

**Purpose:** Re-label group ที่ระบุ (ลบ labels เดิม + รัน label ใหม่)

**Response:**
```json
{
  "message": "Group 1 re-labeled successfully",
  "groupId": 1,
  "matchedPages": 14,
  "unmatchedPages": 0,
  "matchPercentage": 100
}
```

---

### 3. Stop Label Runner
**Endpoint:** `POST /label-runner/stop`

**Purpose:** หยุด label process

**Response:**
```json
{
  "message": "Label runner stopped",
  "status": "stopped"
}
```

---

### 4. Get Label Status
**Endpoint:** `GET /label-runner/status`

**Purpose:** ตรวจสอบสถานะ label task

**Response:**
```json
{
  "isRunning": true,
  "currentGroup": 2,
  "labeled": 1,
  "pending": 4,
  "lastActivity": "2025-01-01T01:10:00.000Z"
}
```

---

### 5. Get Log History
**Endpoint:** `GET /label-runner/logs-history`

**Purpose:** ดึง log history

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2025-01-01T01:10:00.000Z",
      "level": "info",
      "message": "Labeled group 1",
      "data": {
        "groupId": 1,
        "matchPercentage": 100
      }
    }
  ]
}
```

---

### 6. Clear Logs
**Endpoint:** `POST /label-runner/clear-logs`

**Purpose:** ลบ logs

**Response:**
```json
{
  "message": "Logs cleared successfully"
}
```

---

### 7. Real-time Logs (SSE)
**Endpoint:** `SSE /label-runner/logs`

**Purpose:** รับ logs แบบ real-time (รวม GROUP_PROCESSED events)

**Event Types:**
- `log` - log message
- `GROUP_PROCESSED` - group ถูก label เสร็จ

**Example Event:**
```
event: log
data: {"level":"info","message":"Labeling group 1","timestamp":"2025-01-01T01:10:00.000Z"}

event: GROUP_PROCESSED
data: {"groupId":1,"matchPercentage":100}
```

---

## 📊 Parse Runner Module (Stage 03)

**Purpose:** จัดการ Parse Data process (Extract structured data from OCR)

### 1. Start Parse Runner
**Endpoint:** `POST /parse-runner/start`

**Purpose:** เริ่ม parse data process (Infinite Worker Loop)

**Validation Requirements:**
- ✅ `isLabeled = true` - Label เสร็จแล้ว
- ✅ `isParseData = false` - ยังไม่ได้ parse
- ✅ **Match 100%** - ทุกหน้าต้อง label แล้ว
- ✅ **User Reviewed** - ทุกหน้าต้อง `isUserReviewed = true`

**Response:**
```json
{
  "message": "Parse runner started",
  "status": "running"
}
```

---

### 2. Stop Parse Runner
**Endpoint:** `POST /parse-runner/stop`

**Purpose:** หยุด parse process

**Response:**
```json
{
  "message": "Parse runner stopped",
  "status": "stopped"
}
```

---

### 3. Parse Single Group (Function-based)
**Endpoint:** `POST /parse-runner/parse/:groupId`

**Purpose:** Parse group เดียว (รับ groupId เป็น parameter)

**Validation:**
- ตรวจสอบว่า group exists
- ตรวจสอบว่า group label แล้ว (`isLabeled = true`)
- ตรวจสอบว่ายัง parse ยัง (`isParseData = false`)
- ตรวจสอบว่า **match 100%** (ทุกหน้า labeled)
- ✅ ตรวจสอบว่า **user reviewed แล้ว** (ทุกหน้า `isUserReviewed = true`)

**Response (Success):**
```json
{
  "success": true,
  "message": "Group 1 parsed successfully",
  "data": {
    "foundationInstrument": {
      "id": 1,
      "name": "มูลนิธิเพื่อการพัฒนาสังคม",
      "shortName": "ม.พ.ส.",
      "address": "123 ถนนสุขุมวิท กรุงเทพฯ"
    },
    "committeeMembers": [
      {
        "id": 1,
        "name": "นายสมชาย ใจดี",
        "position": "ประธาน"
      }
    ]
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Group 1 must be user reviewed before parsing"
}
```

**Error Messages:**
- "Group X not found"
- "Group X has already been parsed"
- "Group X has not been labeled yet"
- "Group X must be 100% matched before parsing"
- "Group X must be user reviewed before parsing"

---

### 4. Get Parse Status
**Endpoint:** `GET /parse-runner/status`

**Purpose:** ตรวจสอบสถานะ parse task

**Response:**
```json
{
  "isRunning": true,
  "currentGroup": 1,
  "parsed": 0,
  "pending": 3,
  "lastActivity": "2025-01-01T03:10:00.000Z"
}
```

---

### 5. Get Log History
**Endpoint:** `GET /parse-runner/logs-history`

**Purpose:** ดึง log history

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2025-01-01T03:10:00.000Z",
      "level": "info",
      "message": "Parsed group 1",
      "data": {
        "groupId": 1,
        "hasFoundationInstrument": true,
        "committeeCount": 5
      }
    }
  ]
}
```

---

### 6. Clear Logs
**Endpoint:** `POST /parse-runner/clear-logs`

**Purpose:** ลบ logs

**Response:**
```json
{
  "message": "Logs cleared successfully"
}
```

---

### 7. Real-time Logs (SSE)
**Endpoint:** `SSE /parse-runner/logs`

**Purpose:** รับ logs แบบ real-time (รวม GROUP_PARSED events)

**Event Types:**
- `log` - log message
- `GROUP_PARSED` - group ถูก parse เสร็จ

**Example Event:**
```
event: log
data: {"level":"info","message":"Parsing group 1","timestamp":"2025-01-01T03:10:00.000Z"}

event: GROUP_PARSED
data: {"groupId":1,"hasFoundationInstrument":true,"committeeCount":5}
```

---

## 📊 Quick Lookup Table

### Authentication Endpoints

| Method | Endpoint | Purpose | Auth | Role |
|--------|----------|---------|------|------|
| POST | `/auth/login` | Login | Public | - |
| POST | `/auth/register` | Register user | Public | - |
| GET | `/auth/me` | Get current user | Protected | - |
| GET | `/auth/users` | List all users | Protected | Admin |
| GET | `/auth/users/:id` | Get user by ID | Protected | Admin |
| PATCH | `/auth/users/:id` | Update user | Protected | Admin |
| DELETE | `/auth/users/:id` | Delete user | Protected | Admin |
| POST | `/auth/init-admin` | Create admin | Public | - |

### Organizations Endpoints

| Method | Endpoint | Purpose | Auth | Role |
|--------|----------|---------|------|------|
| POST | `/organizations` | Create organization | Protected | Admin |
| GET | `/organizations` | Get all organizations | Protected | - |
| GET | `/organizations/:id` | Get single organization | Protected | - |
| PATCH | `/organizations/:id` | Update organization | Protected | Admin |
| DELETE | `/organizations/:id` | Delete organization | Protected | Admin |

### Files Endpoints (Stage 01-02-04)

| Method | Endpoint | Purpose | Stage |
|--------|----------|---------|-------|
| POST | `/files/upload` | Upload files | 01 |
| GET | `/files` | Get all files (paginated) | 01 |
| GET | `/files/:id/preview` | Preview file | 01 |
| POST | `/files/:id/rotate` | Rotate image | 01 |
| DELETE | `/files/:id` | Delete file | 01 |
| POST | `/files/clear` | Clear all files | 01 |
| POST | `/files/reset-processed` | Reset processed status | 01 |
| POST | `/files/validate-storage` | Validate storage integrity | 01 |
| GET | `/files/groups-metadata` | Get groups metadata | 02 |
| GET | `/files/ready-to-label` | Get groups ready to label | 02 |
| GET | `/files/group/:groupId` | Get group files | 02 |
| PUT | `/files/group/:groupId/reorder` | Reorder files in group | 02 |
| POST | `/files/clear-grouping` | Clear all grouping | 02 |
| SSE | `/files/events` | Real-time group events | 02 |
| GET | `/files/parsed-groups` | Get parsed groups list | 04 |
| GET | `/files/parsed-group/:groupId` | Get parsed group detail | 04 |
| POST | `/files/parsed-group/:groupId/mark-reviewed` | Mark parse data reviewed | 04 |

### Labeled Files Endpoints (Stage 03)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/labeled-files` | Get all labeled files |
| GET | `/labeled-files/processed-groups` | Get processed groups |
| GET | `/labeled-files/summary` | Get summary (all groups) |
| GET | `/labeled-files/templates` | Get templates |
| GET | `/labeled-files/group/:groupId` | Get group labeled files |
| GET | `/labeled-files/group/:groupId/summary` | Get group summary |
| PATCH | `/labeled-files/group/:groupId/pages` | Manual label pages |
| POST | `/labeled-files/group/:groupId/mark-reviewed` | Mark group reviewed |
| POST | `/labeled-files/clear` | Clear all labeled files |
| GET | `/labeled-files/:id/preview` | Preview labeled file |

### Templates Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/templates` | Get all templates |
| GET | `/templates/:id` | Get template by ID |
| POST | `/templates` | Create template |
| PUT | `/templates/:id` | Update template |
| DELETE | `/templates/:id` | Delete template |
| POST | `/templates/:id/toggle` | Toggle template active |

### Task Runner Endpoints (Stage 01)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/task-runner/start` | Start task runner |
| POST | `/task-runner/stop` | Stop task runner |
| GET | `/task-runner/status` | Get task status |
| GET | `/task-runner/logs-history` | Get log history |
| POST | `/task-runner/clear-logs` | Clear logs |
| SSE | `/task-runner/logs` | Real-time logs |

### Label Runner Endpoints (Stage 02)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/label-runner/start` | Start label runner |
| POST | `/label-runner/relabel/:groupId` | Re-label group |
| POST | `/label-runner/stop` | Stop label runner |
| GET | `/label-runner/status` | Get label status |
| GET | `/label-runner/logs-history` | Get log history |
| POST | `/label-runner/clear-logs` | Clear logs |
| SSE | `/label-runner/logs` | Real-time logs |

### Parse Runner Endpoints (Stage 03)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/parse-runner/start` | Start parse runner |
| POST | `/parse-runner/stop` | Stop parse runner |
| POST | `/parse-runner/parse/:groupId` | Parse single group |
| GET | `/parse-runner/status` | Get parse status |
| GET | `/parse-runner/logs-history` | Get log history |
| POST | `/parse-runner/clear-logs` | Clear logs |
| SSE | `/parse-runner/logs` | Real-time logs |

---

## 📝 หมายเหตุ

### Query Parameters Conventions
- **Pagination:** `page`, `limit`
- **Sorting:** `sortBy`, `sortOrder`
- **Filtering:** `processed`, `includeReviewed`

### SSE (Server-Sent Events)
- **Content-Type:** `text/event-stream`
- **Event Format:** `event: <type>\ndata: <json>\n\n`
- **Reconnection:** Client ควร reconnect เมื่อ connection ขาด

### Error Codes
- **400** - Bad Request (validation error)
- **401** - Unauthorized (no token or invalid token)
- **403** - Forbidden (insufficient permissions)
- **404** - Not Found
- **500** - Internal Server Error

### Authentication
- **JWT Token Location:** `Authorization: Bearer <token>`
- **Token Expiry:** ตรวจสอบที่ `.env` (JWT_EXPIRES_IN)
- **Refresh Token:** ยังไม่รองรับ (future feature)

### Cascade Delete Behavior
- `labeled_files` → CASCADE DELETE เมื่อ delete `groups`
- `foundation_instruments` → CASCADE DELETE เมื่อ delete `groups`
- `committee_members` → CASCADE DELETE เมื่อ delete `groups`
- `charter_sections` → CASCADE DELETE เมื่อ delete `foundation_instruments`
- `charter_articles` → CASCADE DELETE เมื่อ delete `charter_sections`
- `charter_sub_items` → CASCADE DELETE เมื่อ delete `charter_articles`

---

**สร้างโดย:** OCR Flow Development Team
**วันที่:** 2025-12-19
