# OCR Flow v2 - Backend Architecture (รายละเอียด)

> **อัปเดตล่าสุด:** 2025-12-20 (เพิ่ม Global Auth Guard + @Public() สำหรับ SSE endpoints)
> **วัตถุประสงค์:** เอกสารรายละเอียดสถาปัตยกรรม Backend สำหรับนักพัฒนา

---

## 📋 สารบัญ

1. [ภาพรวม Backend](#ภาพรวม-backend)
2. [Tech Stack](#tech-stack)
3. [โครงสร้าง Modules](#โครงสร้าง-modules)
4. [Files Module](#1-files-module-stage-01--stage-02)
5. [Labeled Files Module](#2-labeled-files-module-stage-03)
6. [Task Runner Module](#3-task-runner-module-stage-01)
7. [Label Runner Module](#4-label-runner-module-stage-02)
8. [Parse Runner Module](#5-parse-runner-module-stage-03--stage-04)
9. [Shared Label Utils](#6-shared-label-utils-utility-module)
10. [Templates Module](#7-templates-module)
11. [Auth Module](#8-auth-module)
12. [MinIO Module](#9-minio-module)
13. [Background Task Patterns](#background-task-patterns)
14. [Service Methods สำคัญ](#service-methods-สำคัญ)

---

## 🎯 ภาพรวม Backend

Backend ของ OCR Flow v2 ถูกสร้างด้วย **NestJS** (Node.js + TypeScript) และใช้สถาปัตยกรรมแบบ **Module-based** เพื่อแยก responsibilities ออกเป็นส่วนๆ ตาม business logic

### เป้าหมายหลัก
- ✅ **Upload & Storage** - จัดการไฟล์และบันทึกลง MinIO + PostgreSQL
- ✅ **OCR Processing** - เรียก Typhoon OCR API เพื่อ extract text
- ✅ **Auto Grouping** - จัดกลุ่มไฟล์อัตโนมัติตาม BOOKMARK
- ✅ **Pattern Matching** - Auto-label PDF ด้วย Exact Match algorithm
- ✅ **Data Extraction** - Parse structured data (ตราสาร, กรรมการ)
- ✅ **Authentication** - JWT-based auth with role-based access control

---

## 🛠️ Tech Stack

### Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **NestJS** | Latest | Node.js framework (TypeScript) |
| **TypeORM** | Latest | ORM สำหรับ PostgreSQL |
| **PostgreSQL** | 16 | Relational database |
| **MinIO** | Latest | S3-compatible object storage |
| **Passport.js** | Latest | Authentication framework |
| **bcrypt** | Latest | Password hashing |

### API Integration

| Service | Purpose | Keys |
|---------|---------|------|
| **Typhoon OCR API** | OCR text extraction | 3 API keys (rotation) |

### Key Libraries

```json
{
  "@nestjs/passport": "Authentication",
  "@nestjs/jwt": "JWT token management",
  "passport-jwt": "JWT strategy",
  "passport-local": "Username/password strategy",
  "typeorm": "Database ORM",
  "class-validator": "DTO validation",
  "class-transformer": "DTO transformation"
}
```

---

## 📁 โครงสร้าง Modules

```
backend/src/
├── files/              # Upload + Grouping (Stage 01, 02)
├── labeled-files/      # PDF Labeling (Stage 03)
├── task-runner/        # OCR + Grouping worker (Stage 01)
├── label-runner/       # Auto labeling worker (Stage 02)
├── parse-runner/       # Data extraction worker (Stage 03, 04)
├── shared/
│   └── label-utils/    # Pattern matching utilities
├── templates/          # Template management
├── auth/               # Authentication & Authorization
├── minio/              # Object storage integration
├── app.module.ts       # Root module
└── main.ts             # Entry point
```

### Module Summary

| Module | Purpose | Stages | Entities |
|--------|---------|--------|----------|
| **files** | Upload & Grouping | 01, 02, 04 | File, Group |
| **labeled-files** | PDF Labeling | 03 | LabeledFile |
| **task-runner** | Background OCR | 01 | - |
| **label-runner** | Background Labeling | 02 | - |
| **parse-runner** | Data Extraction | 03, 04 | FoundationInstrument, CommitteeMember, etc. |
| **templates** | Template Config | All | Template |
| **auth** | Authentication | All | User |
| **minio** | Storage | All | - |

---

## 1. Files Module (Stage 01 + Stage 02)

### Entities

#### File Entity
```typescript
@Entity('files')
export class File {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  originalName: string;

  @Column()
  minioPath: string;

  @Column({ nullable: true })
  fileNumber: number;

  @Column({ nullable: true })
  groupNumber: number;

  @Column({ default: false })
  processed: boolean;

  @Column({ type: 'jsonb', nullable: true })
  ocrText: any;

  @Column({ default: false })
  isBookmark: boolean;

  @Column({ nullable: true })
  positionInGroup: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Group, group => group.files)
  group: Group;
}
```

#### Group Entity
```typescript
@Entity('groups')
export class Group {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  groupNumber: number;

  @Column({ default: false })
  isComplete: boolean;

  @Column({ default: false })
  isLabeled: boolean;

  @Column({ default: false })
  isParseData: boolean;

  @Column({ default: false })
  is_labeled_reviewed: boolean;

  @Column({ nullable: true })
  labeled_reviewer: string;

  @Column({ type: 'text', nullable: true })
  labeled_notes: string;

  @Column({ default: false })
  isParseDataReviewed: boolean;

  @Column({ nullable: true })
  parseDataReviewer: string;

  @Column({ type: 'text', nullable: true })
  extractDataNotes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => File, file => file.group)
  files: File[];

  @OneToMany(() => LabeledFile, labeledFile => labeledFile.group)
  labeledFiles: LabeledFile[];
}
```

### API Endpoints

#### Stage 01: Upload

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/files/upload` | อัพโหลดไฟล์ (images/PDFs) | Yes |
| GET | `/files` | ดึงรายการไฟล์ทั้งหมด (pagination, sorting, filtering) | Yes |
| GET | `/files/:id/preview` | ดูตัวอย่างไฟล์ | No (Public) |
| POST | `/files/:id/rotate` | Rotate รูปภาพ 90° | Yes |
| DELETE | `/files/:id` | ลบไฟล์ | Yes |
| POST | `/files/clear` | ลบไฟล์ทั้งหมด | Yes |
| POST | `/files/reset-processed` | รีเซ็ต processed status | Yes |
| POST | `/files/validate-storage` | ตรวจสอบ storage integrity | Yes |

##### GET /files - Query Parameters

```typescript
interface GetFilesQuery {
  page?: number;          // Default: 1
  limit?: number;         // Default: 10
  sortBy?: 'createdAt' | 'fileNumber' | 'originalName'; // Default: 'createdAt'
  sortOrder?: 'ASC' | 'DESC'; // Default: 'DESC'
  processed?: 'all' | 'true' | 'false'; // Default: 'all'
}
```

##### Response Format

```json
{
  "files": [
    {
      "id": 1,
      "originalName": "document.pdf",
      "fileNumber": 1,
      "groupNumber": 1,
      "processed": true,
      "isBookmark": false,
      "createdAt": "2025-12-19T10:00:00.000Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 10,
  "totalPages": 10
}
```

##### POST /files/:id/rotate - Request Body

```json
{
  "degrees": 90  // 90, 180, 270, -90
}
```

#### Stage 02: Grouping

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/files/groups-metadata` | ดึง metadata ของทุก group | Yes |
| GET | `/files/ready-to-label` | ดึง groups ที่พร้อม label | Yes |
| GET | `/files/group/:groupId` | ดึงไฟล์ของ group ที่ระบุ | Yes |
| PUT | `/files/group/:groupId/reorder` | เปลี่ยนลำดับไฟล์ใน group | Yes |
| POST | `/files/clear-grouping` | ลบการจัดกลุ่มทั้งหมด (CASCADE DELETE) | Yes |
| SSE | `/files/events` | รับ events แบบ real-time | No (Public) |

##### GET /files/groups-metadata - Response

```json
{
  "groups": [
    {
      "groupNumber": 1,
      "fileCount": 5,
      "isComplete": true,
      "isLabeled": false,
      "createdAt": "2025-12-19T10:00:00.000Z"
    }
  ]
}
```

##### PUT /files/group/:groupId/reorder - Request Body

```json
{
  "fileIds": [5, 3, 1, 2, 4]  // New order
}
```

##### SSE Events Format

```typescript
// Event types
type FileEvent = 'GROUP_COMPLETE' | 'GROUP_CREATED';

// Event data
{
  type: 'GROUP_COMPLETE',
  data: {
    groupNumber: 1,
    fileCount: 5
  }
}
```

#### Stage 04: Parsed Data

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/files/parsed-groups` | ดึง list ของ groups ที่ parse แล้ว | Yes |
| GET | `/files/parsed-group/:groupId` | ดึงรายละเอียดของ group ที่ parse แล้ว | Yes |
| POST | `/files/parsed-group/:groupId/mark-reviewed` | Mark parse data as reviewed | Yes |

##### GET /files/parsed-groups - Response

```json
{
  "groups": [
    {
      "groupId": 1,
      "fileCount": 5,
      "parseDataAt": "2025-12-19T10:00:00.000Z",
      "hasFoundationInstrument": true,
      "committeeCount": 7,
      "isParseDataReviewed": false,
      "parseDataReviewer": null
    }
  ]
}
```

##### GET /files/parsed-group/:groupId - Response

```json
{
  "group": {
    "groupNumber": 1,
    "fileCount": 5,
    "isParseData": true
  },
  "foundationInstrument": {
    "id": 1,
    "name": "มูลนิธิตัวอย่าง",
    "shortName": "ม.ต.",
    "address": "123 ถนนตัวอย่าง",
    "charterSections": [...]
  },
  "committeeMembers": [...]
}
```

##### POST /files/parsed-group/:groupId/mark-reviewed - Request/Response

```typescript
// Request
{
  "reviewer": "admin@example.com",
  "notes": "Reviewed and approved"
}

// Response
{
  "success": true,
  "message": "Parse data marked as reviewed"
}
```

### Service Methods สำคัญ

#### FilesService

```typescript
class FilesService {
  // Upload
  async uploadFile(file: Express.Multer.File): Promise<File>
  async uploadFiles(files: Express.Multer.File[]): Promise<File[]>

  // Query
  async findAll(query: GetFilesQuery): Promise<PaginatedResponse<File>>
  async findOne(id: number): Promise<File>
  async findByGroupNumber(groupNumber: number): Promise<File[]>

  // Update
  async rotateImage(id: number, degrees: number): Promise<File>
  async updateFile(id: number, data: Partial<File>): Promise<File>
  async reorderGroupFiles(groupId: number, fileIds: number[]): Promise<void>

  // Delete
  async deleteFile(id: number): Promise<void>
  async clearAll(): Promise<void>
  async clearGrouping(): Promise<void>

  // Storage
  async validateStorage(): Promise<ValidationResult>
}
```

---

## 2. Labeled Files Module (Stage 03)

### Entity

```typescript
@Entity('labeled_files')
export class LabeledFile {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => File)
  file: File;

  @ManyToOne(() => Group)
  group: Group;

  @Column()
  label: string;

  @Column({ default: false })
  isUserReviewed: boolean;

  @Column({ nullable: true })
  reviewer: string;

  @Column({ default: 1 })
  pageNumber: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/labeled-files` | ดึงรายการไฟล์ที่ label แล้ว | Yes |
| GET | `/labeled-files/processed-groups` | ดึง list ของ group ที่ label แล้ว | Yes |
| GET | `/labeled-files/summary` | ดึง summary ของทุก group | Yes |
| GET | `/labeled-files/templates` | ดึงรายการ templates (from DB) | Yes |
| GET | `/labeled-files/group/:groupId` | ดึงไฟล์ของ group ที่ระบุ | Yes |
| GET | `/labeled-files/group/:groupId/summary` | ดึง summary ของ group | Yes |
| PATCH | `/labeled-files/group/:groupId/pages` | Manual label: อัปเดต labels | Yes |
| POST | `/labeled-files/group/:groupId/mark-reviewed` | Save review notes & mark reviewed | Yes |
| POST | `/labeled-files/clear` | ลบ labeled files ทั้งหมด | Yes |

#### GET /labeled-files/summary - Query Parameters

```typescript
interface SummaryQuery {
  includeReviewed?: boolean; // Default: false
}
```

**Behavior:**
- `includeReviewed=false` → แสดงเฉพาะ groups ที่ `isUserReviewed = false`
- `includeReviewed=true` → แสดงทุก groups รวมถึงที่ review แล้ว

##### Response Format

```json
{
  "groups": [
    {
      "groupId": 1,
      "groupNumber": 1,
      "totalPages": 5,
      "matchedPages": 5,
      "unmatchedPages": 0,
      "matchPercentage": 100,
      "isReviewed": false,
      "reviewer": null
    }
  ]
}
```

#### PATCH /labeled-files/group/:groupId/pages - Request Body

```json
{
  "pages": [
    {
      "fileId": 1,
      "label": "ตราสาร"
    },
    {
      "fileId": 2,
      "label": "บัญชีรายชื่อกรรมการมูลนิธิ"
    }
  ]
}
```

#### POST /labeled-files/group/:groupId/mark-reviewed

**Request Body:**
```json
{
  "reviewer": "admin@example.com",
  "notes": "Reviewed and approved",
  "markAsReviewed": true  // Optional: default false
}
```

**Behavior:**
1. **Always:** Update `labeled_notes` ใน groups table
2. **When markAsReviewed = true:**
   - Update `isUserReviewed = true` และ `reviewer` ใน labeled_files
   - Update `labeled_reviewer` และ `is_labeled_reviewed = true` ใน groups
   - **Auto-trigger Parse Data:** ถ้า group match 100% → เรียก `parseRunnerService.parseGroup()` ใน background ทันที
3. **When markAsReviewed = false:** บันทึกเฉพาะ notes (ไม่ mark as reviewed)

**Response:**
```json
{
  "updated": 5,
  "marked": true,
  "parsed": true,
  "parseMessage": "Parse data triggered in background"
}
```

### Service Methods สำคัญ

```typescript
class LabeledFilesService {
  // Query
  async findAll(): Promise<LabeledFile[]>
  async findByGroup(groupId: number): Promise<LabeledFile[]>
  async getGroupSummary(groupId: number): Promise<GroupSummary>
  async getAllGroupsSummary(includeReviewed: boolean): Promise<GroupSummary[]>

  // Update
  async updatePageLabels(groupId: number, pages: PageUpdate[]): Promise<number>
  async markGroupAsReviewed(groupId: number, reviewer: string, notes?: string): Promise<MarkReviewedResult>

  // Delete
  async clearAll(): Promise<void>
}
```

---

## 3. Task Runner Module (Stage 01)

### Purpose
รัน background tasks สำหรับ **OCR + Grouping** แบบ **Infinite Worker Loop**

### API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/task-runner/start` | เริ่ม infinite worker loop | Yes |
| POST | `/task-runner/stop` | หยุด worker loop | Yes |
| GET | `/task-runner/status` | ตรวจสอบสถานะ task | Yes |
| GET | `/task-runner/logs-history` | ดึง log history | Yes |
| POST | `/task-runner/clear-logs` | ลบ logs | Yes |
| SSE | `/task-runner/logs` | รับ logs แบบ real-time | No (Public) |

### Worker Loop Logic

```typescript
async startInfiniteWorkerLoop() {
  while (this.isRunning) {
    // 1. Find pending files (processed = false)
    const pendingFiles = await this.filesService.findPending();

    if (pendingFiles.length === 0) {
      this.log('No pending files. Waiting...');
      await this.sleep(5000);
      continue;
    }

    // 2. Process each file
    for (const file of pendingFiles) {
      // OCR
      const ocrResult = await this.ocrService.process(file);

      // Update file
      await this.filesService.update(file.id, {
        ocrText: ocrResult,
        processed: true
      });

      this.emitEvent('FILE_PROCESSED', { fileId: file.id });
    }

    // 3. Auto-group files
    await this.groupFiles();

    await this.sleep(1000);
  }
}
```

### SSE Events

```typescript
type TaskEvent = 'LOG' | 'FILE_PROCESSED' | 'GROUP_CREATED' | 'STATUS_CHANGE';

// Event format
{
  type: 'FILE_PROCESSED',
  data: {
    fileId: 1,
    fileNumber: 1,
    timestamp: '2025-12-19T10:00:00.000Z'
  }
}
```

### Service Methods

```typescript
class TaskRunnerService {
  // Control
  async start(): Promise<void>
  async stop(): Promise<void>

  // Status
  getStatus(): TaskStatus

  // Logs
  getLogs(): LogEntry[]
  clearLogs(): void

  // Events
  emitEvent(type: string, data: any): void
}
```

---

## 4. Label Runner Module (Stage 02)

### Purpose
รัน **label process** (Pattern Matching + PDF Splitting) แบบ **Infinite Worker Loop**

### Shared Utilities
ใช้ **`shared/label-utils`** สำหรับ pattern matching logic (reusable)

### API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/label-runner/start` | เริ่ม label process สำหรับทุก group | Yes |
| POST | `/label-runner/relabel/:groupId` | Re-label group ที่ระบุ | Yes |
| POST | `/label-runner/stop` | หยุด label process | Yes |
| GET | `/label-runner/status` | ตรวจสอบสถานะ task | Yes |
| GET | `/label-runner/logs-history` | ดึง log history | Yes |
| POST | `/label-runner/clear-logs` | ลบ logs | Yes |
| SSE | `/label-runner/logs` | รับ logs แบบ real-time | No (Public) |

### Worker Loop Logic

```typescript
async startInfiniteWorkerLoop() {
  while (this.isRunning) {
    // 1. Find unlabeled groups
    const groups = await this.filesService.findUnlabeledGroups();

    if (groups.length === 0) {
      this.log('No groups to label. Waiting...');
      await this.sleep(5000);
      continue;
    }

    // 2. Process each group
    for (const group of groups) {
      await this.labelGroup(group.id);
      this.emitEvent('GROUP_PROCESSED', { groupId: group.id });
    }

    await this.sleep(1000);
  }
}

async labelGroup(groupId: number) {
  // 1. Get group files
  const files = await this.filesService.findByGroup(groupId);

  // 2. Get templates
  const templates = await this.templatesService.getTemplatesForLabeling();

  // 3. Process files using shared utils
  const results = await processFilesForLabeling(files, templates, this.log);

  // 4. Save labeled files
  await this.labeledFilesService.saveLabeledFiles(results);

  // 5. Mark group as labeled
  await this.filesService.markGroupAsLabeled(groupId);
}
```

### Relabel Endpoint

**POST /label-runner/relabel/:groupId**

```typescript
async relabelGroup(groupId: number) {
  // 1. Delete existing labels
  await this.labeledFilesService.deleteByGroup(groupId);

  // 2. Reset group status
  await this.filesService.update(groupId, { isLabeled: false });

  // 3. Re-run label process
  await this.labelGroup(groupId);
}
```

### SSE Events

```typescript
type LabelEvent = 'LOG' | 'GROUP_PROCESSED' | 'STATUS_CHANGE';

// Event format
{
  type: 'GROUP_PROCESSED',
  data: {
    groupId: 1,
    groupNumber: 1,
    totalPages: 5,
    matchedPages: 5,
    matchPercentage: 100
  }
}
```

---

## 5. Parse Runner Module (Stage 03 + Stage 04)

### Purpose
รัน **parse data process** (Extract structured data from OCR) แบบ **On-Demand**

**⚠️ สำคัญ:** ระบบไม่มี Infinite Worker Loop แล้ว - Parse ทำงานเมื่อ:
1. **Auto-parse** - หลัง user review (Stage 03)
2. **Manual re-parse** - กดปุ่ม Re-parse (Stage 04)

### Validation Requirements

ก่อนที่ group จะถูก parse ต้องผ่าน validation:

| Requirement | Description |
|-------------|-------------|
| ✅ `isAutoLabeled = true` | Label เสร็จแล้ว |
| ✅ `isParseData = false` | ยังไม่ได้ parse (ยกเว้น force=true) |
| ✅ **Match 100%** | ทุกหน้าต้อง label แล้ว (ไม่มี unmatched) |
| ✅ **User Reviewed** | Group ต้อง `isLabeledReviewed = true` |

### API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/parse-runner/parse/:groupId` | Parse group เดียว (first-time) | Yes |
| POST | `/parse-runner/parse/:groupId?force=true` | Re-parse group (override) | Yes |

**Note:** ไม่มี `/start`, `/stop`, `/status`, `/logs` endpoints แล้ว

### Service Methods

#### parseGroup(groupId: number, force = false)

Parse ข้อมูลจาก OCR แบบ on-demand (ไม่ใช่ worker loop):

- **Auto-triggered**: หลัง user review (Stage 03) โดย `labeledFilesService.markGroupAsReviewed()`
- **Manual-triggered**: กดปุ่ม Re-parse (Stage 04) โดย `POST /parse-runner/parse/:groupId?force=true`

**Validation:**
- Check group exists, isAutoLabeled, 100% matched, user reviewed
- ถ้า `isParseData = true` และ `force = false` → ปฏิเสธ (ป้องกัน parse ซ้ำ)

**Parsing:**
1. Get pages with labels
2. Parse foundation instrument (regex patterns)
3. Parse committee members (table parsing)  
4. Save to database (5 tables)
5. Update `groups.isParseData = true`

---
    success: true,
    message: `Group ${groupId} parsed successfully`,
    data: result
  };
}
```

### SSE Events

```typescript
type ParseEvent = 'LOG' | 'GROUP_PARSED' | 'STATUS_CHANGE';

// Event format
{
  type: 'GROUP_PARSED',
  data: {
    groupId: 1,
    groupNumber: 1,
    foundationInstrument: {...},
    committeeMembers: [...]
  }
}
```

---

## 6. Shared Label Utils (Utility Module)

### Purpose
**Shared utilities** สำหรับ pattern matching และ label processing (reusable across modules)

### Files

```
shared/label-utils/
├── types.ts                # Shared interfaces
├── pattern-matcher.ts      # Core pattern matching functions
└── index.ts                # Module exports
```

### Exported Functions

#### extractOcrText
```typescript
function extractOcrText(ocrText: any): string
```
Extract text from OCR JSON format

#### containsPattern
```typescript
function containsPattern(text: string, pattern: string): boolean
```
**Exact pattern matching** (normalized text comparison)
- Lowercase + trim + collapse whitespace

#### checkPatternVariant
```typescript
function checkPatternVariant(text: string, patterns: string[]): boolean
```
Check all patterns in variant (**AND logic** - ต้องเจอทุกคำ)

#### checkPatterns
```typescript
function checkPatterns(text: string, patterns: string[][]): boolean
```
Check multiple variants (**OR logic** between variants)

#### checkNegativePatterns
```typescript
function checkNegativePatterns(text: string, patterns: string[]): boolean
```
Check negative patterns (ป้องกัน false match)

#### findFirstPageTemplate
```typescript
function findFirstPageTemplate(
  text: string,
  templates: Template[],
  previousTemplate?: Template
): Template | null
```
Find matching template for first page
- รับ `previousTemplate` เป็น optional parameter สำหรับ context-based matching
- ตรวจสอบ `context_rules` ก่อนทำการ match patterns

#### checkLastPage
```typescript
function checkLastPage(text: string, template: Template): boolean
```
Check if page matches `last_page_patterns`

#### processFilesForLabeling
```typescript
function processFilesForLabeling(
  files: File[],
  templates: Template[],
  logCallback: (message: string) => void
): Promise<LabelResult[]>
```
**Main labeling function**
- ติดตาม `currentTemplate` สำหรับ context-based matching
- ส่ง `previousTemplate` ไปยัง `findFirstPageTemplate()` เมื่อหา template ใหม่

### Usage Example

```typescript
import { processFilesForLabeling } from '@/shared/label-utils';

// In label-runner.service.ts
async labelGroup(groupId: number) {
  const files = await this.filesService.findByGroup(groupId);
  const templates = await this.templatesService.getTemplatesForLabeling();

  const results = await processFilesForLabeling(
    files,
    templates,
    (msg) => this.log(msg)
  );

  await this.labeledFilesService.saveLabeledFiles(results);
}
```

---

## 7. Templates Module

### Entity

```typescript
@Entity('templates')
export class Template {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  category: string;

  @Column({ type: 'jsonb' })
  patterns: string[][];  // OR logic between variants

  @Column({ type: 'jsonb', nullable: true })
  negative_patterns: string[];

  @Column({ type: 'jsonb', nullable: true })
  last_page_patterns: string[][];

  @Column({ default: 'single' })
  page_type: 'single' | 'multi';

  @Column({ type: 'jsonb', nullable: true })
  context_rules: {
    requirePreviousCategory?: string[];
    blockPreviousCategory?: string[];
  };

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  priority: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/templates` | ดึง templates ทั้งหมด | Yes |
| GET | `/templates/:id` | ดึง template ตาม ID | Yes |
| POST | `/templates` | สร้าง template ใหม่ | Yes (Admin) |
| PUT | `/templates/:id` | แก้ไข template | Yes (Admin) |
| DELETE | `/templates/:id` | ลบ template | Yes (Admin) |
| POST | `/templates/:id/toggle` | เปิด/ปิด template (toggle isActive) | Yes (Admin) |

### Service Methods

```typescript
class TemplatesService {
  // Query
  async findAll(): Promise<Template[]>
  async findOne(id: number): Promise<Template>
  async findActive(): Promise<Template[]>

  // Transform
  async getTemplatesForLabeling(): Promise<LabelTemplate[]>

  // Create/Update
  async create(data: CreateTemplateDto): Promise<Template>
  async update(id: number, data: UpdateTemplateDto): Promise<Template>

  // Delete
  async delete(id: number): Promise<void>

  // Toggle
  async toggleActive(id: number): Promise<Template>
}
```

### Template Format Example

```json
{
  "id": 1,
  "category": "ตราสาร",
  "patterns": [
    ["ตราสาร", "มูลนิธิ"],
    ["ตราสารตั้ง", "มูลนิธิ"]
  ],
  "negative_patterns": ["แก้ไข", "เพิ่มเติม"],
  "last_page_patterns": [
    ["ลงชื่อ", "กรรมการ"]
  ],
  "page_type": "multi",
  "context_rules": {
    "requirePreviousCategory": ["หน้าปก"],
    "blockPreviousCategory": ["บัญชีรายชื่อกรรมการมูลนิธิ"]
  },
  "isActive": true,
  "priority": 1
}
```

---

## 8. Auth Module

### Entity

```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;  // bcrypt hashed

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER
  })
  role: UserRole;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

enum UserRole {
  ADMIN = 'admin',
  USER = 'user'
}
```

### Tech Stack

| Package | Purpose |
|---------|---------|
| `@nestjs/passport` | Passport integration |
| `@nestjs/jwt` | JWT token management |
| `passport-jwt` | JWT strategy |
| `passport-local` | Username/password strategy |
| `bcrypt` | Password hashing |

### API Endpoints

#### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login (returns JWT token) |
| POST | `/auth/register` | Register new user |
| POST | `/auth/init-admin` | Create default admin user (first time) |

#### Protected Endpoints

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| GET | `/auth/me` | Get current user profile | Any |
| GET | `/auth/users` | List all users | Admin |
| GET | `/auth/users/:id` | Get user by ID | Admin |
| PATCH | `/auth/users/:id` | Update user | Admin |
| DELETE | `/auth/users/:id` | Delete user | Admin |

### Guards

**Global Authentication:**
- ✅ **JwtAuthGuard** ถูกติดตั้งเป็น **Global Guard** (APP_GUARD) ใน `app.module.ts`
- ✅ **ทุก endpoints** ต้อง authentication ตามค่าเริ่มต้น
- ✅ ใช้ `@Public()` decorator สำหรับ endpoints ที่ไม่ต้องการ auth

**Public Endpoints (ใช้ @Public() decorator):**
- `/auth/login`, `/auth/register`, `/auth/init-admin` - Authentication endpoints
- **SSE Endpoints** - Server-Sent Events (EventSource API ไม่รองรับ custom headers):
  - `/task-runner/logs` - OCR task logs
  - `/label-runner/logs` - Auto-label logs
  - `/files/events` - File processing events
- **Preview Endpoints** - Image/PDF previews (HTML `<img>` tag ไม่รองรับ custom headers):
  - `/files/:id/preview` - Raw file preview
  - `/labeled-files/:id/preview` - Labeled file preview

**Note:** SSE และ Preview endpoints ใช้ `@Public()` เพราะ browser EventSource และ `<img>` tag ไม่สามารถส่ง Authorization header ได้ แต่ frontend มี route guard อยู่แล้ว

#### JwtAuthGuard (Global)
```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true; // Skip auth for @Public() routes
    }

    return super.canActivate(context); // Validate JWT token
  }
}
```

**Configuration (app.module.ts):**
```typescript
@Module({
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // ← Global guard
    },
  ],
})
export class AppModule {}
```

#### RolesGuard
```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<UserRole[]>(
      'roles',
      context.getHandler()
    );

    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}
```

### Decorators

#### @Public()
```typescript
@Public()
@Get('health')
async healthCheck() {
  return { status: 'ok' };
}
```

#### @Roles()
```typescript
@Roles(UserRole.ADMIN)
@Delete('users/:id')
async deleteUser(@Param('id') id: number) {
  return this.authService.deleteUser(id);
}
```

#### @CurrentUser()
```typescript
@Get('me')
async getProfile(@CurrentUser() user: User) {
  return user;
}
```

### Service Methods

```typescript
class AuthService {
  // Authentication
  async validateUser(email: string, password: string): Promise<User | null>
  async login(user: User): Promise<{ access_token: string }>
  async register(data: RegisterDto): Promise<User>

  // User Management
  async findAll(): Promise<User[]>
  async findOne(id: number): Promise<User>
  async findByEmail(email: string): Promise<User>
  async update(id: number, data: UpdateUserDto): Promise<User>
  async delete(id: number): Promise<void>

  // Password
  async hashPassword(password: string): Promise<string>
  async comparePassword(password: string, hash: string): Promise<boolean>

  // Admin
  async initDefaultAdmin(): Promise<User>
}
```

### JWT Token Format

```json
{
  "sub": 1,
  "email": "admin@example.com",
  "role": "admin",
  "iat": 1703000000,
  "exp": 1703604800
}
```

---

## 9. MinIO Module

### Purpose
จัดการ **MinIO client** และ **file storage** (S3-compatible object storage)

### Configuration

```typescript
@Module({
  providers: [
    {
      provide: 'MINIO_CLIENT',
      useFactory: () => {
        return new Client({
          endPoint: process.env.MINIO_ENDPOINT,
          port: parseInt(process.env.MINIO_PORT),
          useSSL: false,
          accessKey: process.env.MINIO_ACCESS_KEY,
          secretKey: process.env.MINIO_SECRET_KEY
        });
      }
    },
    MinioService
  ],
  exports: [MinioService]
})
```

### Service Methods

```typescript
class MinioService {
  // Upload
  async uploadFile(
    bucket: string,
    path: string,
    buffer: Buffer,
    metadata?: Record<string, string>
  ): Promise<string>

  // Download
  async getFile(bucket: string, path: string): Promise<Buffer>
  async getFileStream(bucket: string, path: string): Promise<Stream>

  // Delete
  async deleteFile(bucket: string, path: string): Promise<void>
  async deleteFiles(bucket: string, paths: string[]): Promise<void>

  // Bucket Management
  async createBucket(bucket: string): Promise<void>
  async deleteBucket(bucket: string): Promise<void>
  async listBuckets(): Promise<string[]>

  // Utilities
  async fileExists(bucket: string, path: string): Promise<boolean>
  async getFileStats(bucket: string, path: string): Promise<BucketItemStat>
}
```

### Usage Example

```typescript
// Upload file
const buffer = await sharp(file.buffer)
  .rotate()
  .toBuffer();

const path = `raw/${Date.now()}-${file.originalname}`;
await this.minioService.uploadFile('ocr-documents', path, buffer);

// Download file
const buffer = await this.minioService.getFile('ocr-documents', path);

// Delete file
await this.minioService.deleteFile('ocr-documents', path);
```

---

## Background Task Patterns

### Infinite Worker Loop Pattern

```typescript
class BackgroundService {
  private isRunning = false;
  private logs: LogEntry[] = [];
  private sseClients: Response[] = [];

  async start() {
    if (this.isRunning) {
      throw new Error('Task is already running');
    }

    this.isRunning = true;
    this.log('Starting worker loop...');

    // Start loop in background
    this.startInfiniteWorkerLoop().catch(err => {
      this.log(`Error: ${err.message}`, 'error');
      this.isRunning = false;
    });
  }

  async stop() {
    this.log('Stopping worker loop...');
    this.isRunning = false;
  }

  private async startInfiniteWorkerLoop() {
    while (this.isRunning) {
      try {
        // 1. Find pending items
        const items = await this.findPendingItems();

        if (items.length === 0) {
          this.log('No pending items. Waiting...');
          await this.sleep(5000);
          continue;
        }

        // 2. Process items
        for (const item of items) {
          await this.processItem(item);
        }

        // 3. Sleep before next iteration
        await this.sleep(1000);
      } catch (error) {
        this.log(`Error: ${error.message}`, 'error');
        await this.sleep(5000);
      }
    }

    this.log('Worker loop stopped');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### SSE Logging Pattern

```typescript
class BackgroundService {
  private sseClients: Response[] = [];

  // SSE endpoint
  @Sse('logs')
  streamLogs(@Res() res: Response) {
    // Add client
    this.sseClients.push(res);

    // Send initial logs
    this.logs.forEach(log => {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    });

    // Cleanup on disconnect
    res.on('close', () => {
      const index = this.sseClients.indexOf(res);
      if (index > -1) {
        this.sseClients.splice(index, 1);
      }
    });
  }

  private log(message: string, level: 'info' | 'error' = 'info') {
    const logEntry = {
      message,
      level,
      timestamp: new Date().toISOString()
    };

    // Add to history
    this.logs.push(logEntry);

    // Keep last 1000 logs
    if (this.logs.length > 1000) {
      this.logs.shift();
    }

    // Broadcast to SSE clients
    this.sseClients.forEach(client => {
      client.write(`data: ${JSON.stringify(logEntry)}\n\n`);
    });
  }

  private emitEvent(type: string, data: any) {
    const event = {
      type,
      data,
      timestamp: new Date().toISOString()
    };

    this.sseClients.forEach(client => {
      client.write(`data: ${JSON.stringify(event)}\n\n`);
    });
  }
}
```

---

## Service Methods สำคัญ

### FilesService

| Method | Description | Returns |
|--------|-------------|---------|
| `uploadFile(file)` | อัพโหลดไฟล์ไปยัง MinIO + บันทึก DB | File |
| `findAll(query)` | ดึงไฟล์ทั้งหมด (pagination) | PaginatedResponse<File> |
| `findByGroup(groupId)` | ดึงไฟล์ของ group ที่ระบุ | File[] |
| `rotateImage(id, degrees)` | Rotate รูปภาพ | File |
| `reorderGroupFiles(groupId, fileIds)` | เปลี่ยนลำดับไฟล์ใน group | void |
| `clearGrouping()` | ลบการจัดกลุ่มทั้งหมด (CASCADE) | void |

### LabeledFilesService

| Method | Description | Returns |
|--------|-------------|---------|
| `findByGroup(groupId)` | ดึง labeled files ของ group | LabeledFile[] |
| `getGroupSummary(groupId)` | ดึง summary ของ group | GroupSummary |
| `updatePageLabels(groupId, pages)` | อัปเดต labels หลายหน้า | number |
| `markGroupAsReviewed(groupId, reviewer, notes)` | Mark group as reviewed + auto-trigger parse | MarkReviewedResult |
| `clearAll()` | ลบ labeled files ทั้งหมด | void |

### TemplatesService

| Method | Description | Returns |
|--------|-------------|---------|
| `findAll()` | ดึง templates ทั้งหมด | Template[] |
| `findActive()` | ดึงเฉพาะ active templates | Template[] |
| `getTemplatesForLabeling()` | แปลง templates สำหรับ label-utils | LabelTemplate[] |
| `create(data)` | สร้าง template ใหม่ | Template |
| `update(id, data)` | แก้ไข template | Template |
| `toggleActive(id)` | เปิด/ปิด template | Template |

### TaskRunnerService

| Method | Description | Returns |
|--------|-------------|---------|
| `start()` | เริ่ม infinite worker loop | void |
| `stop()` | หยุด worker loop | void |
| `getStatus()` | ดึงสถานะปัจจุบัน | TaskStatus |
| `getLogs()` | ดึง log history | LogEntry[] |
| `clearLogs()` | ลบ logs | void |

### LabelRunnerService

| Method | Description | Returns |
|--------|-------------|---------|
| `start()` | เริ่ม label process (infinite loop) | void |
| `stop()` | หยุด label process | void |
| `relabelGroup(groupId)` | Re-label group ที่ระบุ | void |
| `getStatus()` | ดึงสถานะปัจจุบัน | TaskStatus |
| `getLogs()` | ดึง log history | LogEntry[] |

### ParseRunnerService

| Method | Description | Returns |
|--------|-------------|---------|
| `start()` | เริ่ม parse process (infinite loop) | void |
| `stop()` | หยุด parse process | void |
| `parseGroup(groupId)` | Parse group ที่ระบุ | ParseResult |
| `getStatus()` | ดึงสถานะปัจจุบัน | TaskStatus |
| `getLogs()` | ดึง log history | LogEntry[] |

### AuthService

| Method | Description | Returns |
|--------|-------------|---------|
| `login(user)` | Login และสร้าง JWT token | { access_token: string } |
| `register(data)` | ลงทะเบียนผู้ใช้ใหม่ | User |
| `validateUser(email, password)` | ตรวจสอบ credentials | User \| null |
| `findAll()` | ดึงผู้ใช้ทั้งหมด | User[] |
| `update(id, data)` | อัปเดตข้อมูลผู้ใช้ | User |
| `delete(id)` | ลบผู้ใช้ | void |

### MinioService

| Method | Description | Returns |
|--------|-------------|---------|
| `uploadFile(bucket, path, buffer)` | อัพโหลดไฟล์ไปยัง MinIO | string |
| `getFile(bucket, path)` | ดาวน์โหลดไฟล์จาก MinIO | Buffer |
| `deleteFile(bucket, path)` | ลบไฟล์จาก MinIO | void |
| `fileExists(bucket, path)` | ตรวจสอบว่าไฟล์มีอยู่หรือไม่ | boolean |

---

## 📝 สรุป

Backend ของ OCR Flow v2 ถูกออกแบบมาเพื่อ:

1. **Modular Architecture** - แยก responsibilities ชัดเจนตาม modules
2. **Background Processing** - ใช้ Infinite Worker Loop pattern สำหรับ long-running tasks
3. **Real-time Updates** - ใช้ SSE สำหรับ logs และ events
4. **Reusable Utilities** - แยก logic ออกมาเป็น shared utilities (label-utils)
5. **Type Safety** - ใช้ TypeScript + TypeORM สำหรับ type safety
6. **Authentication** - JWT-based auth with role-based access control
7. **Storage** - MinIO (S3-compatible) สำหรับเก็บไฟล์

---

**สร้างโดย:** OCR Flow Development Team
**Last Updated:** 2025-12-19
