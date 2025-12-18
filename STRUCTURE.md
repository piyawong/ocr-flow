# OCR Flow v2 - โครงสร้างและ Logic ของระบบ

> **อัปเดตล่าสุด:** 2025-12-17 (เพิ่ม Authentication System - JWT + Passport)
> **เอกสารนี้อธิบาย:** โครงสร้างโค้ด, สถาปัตยกรรม, และ logic หลักของ OCR Flow System

---

## 📋 สารบัญ

1. [ภาพรวมระบบ](#ภาพรวมระบบ)
2. [โครงสร้างโฟลเดอร์](#โครงสร้างโฟลเดอร์)
3. [สถาปัตยกรรม Backend](#สถาปัตยกรรม-backend)
4. [สถาปัตยกรรม Frontend](#สถาปัตยกรรม-frontend)
5. [Database Schema](#database-schema)
6. [Infrastructure](#infrastructure)
7. [Logic และ Data Flow](#logic-และ-data-flow)
8. [Authentication](#authentication)
9. [เป้าหมายและวัตถุประสงค์](#เป้าหมายและวัตถุประสงค์)
10. [การแก้ไขและอัปเดต](#การแก้ไขและอัปเดต)

---

## 🎯 ภาพรวมระบบ

**OCR Flow v2** เป็นระบบ Document Processing ที่ทำงานผ่าน 6 ขั้นตอนหลัก:

```
01-RAW → 02-GROUP → 03-PDF-LABEL → 04-EXTRACT → 05-REVIEW → 06-UPLOAD
```

### เป้าหมายหลัก
- **อัตโนมัติการแยกเอกสาร** จากเอกสารหลายหน้า (multi-page documents) เป็นเอกสารย่อยตาม template
- **OCR และ Pattern Matching** เพื่อระบุประเภทของเอกสาร
- **จัดเก็บและจัดการเอกสาร** ผ่าน MinIO Object Storage และ PostgreSQL

---

## 📁 โครงสร้างโฟลเดอร์

```
OCR-flow-v2/
├── backend/                    # NestJS API Backend
│   ├── src/
│   │   ├── files/              # Module: จัดการไฟล์ (Stage 01: Upload + Stage 02: Grouping)
│   │   │   ├── file.entity.ts       # Entity สำหรับ files table
│   │   │   ├── group.entity.ts      # Entity สำหรับ groups table
│   │   │   ├── files.controller.ts  # API endpoints
│   │   │   ├── files.service.ts     # Business logic
│   │   │   └── files.module.ts      # Module definition
│   │   ├── labeled-files/      # Module: จัดการไฟล์ที่ label แล้ว (Stage 03)
│   │   │   ├── labeled-file.entity.ts
│   │   │   ├── labeled-files.controller.ts
│   │   │   ├── labeled-files.service.ts
│   │   │   └── labeled-files.module.ts
│   │   ├── task-runner/        # Module: รัน OCR + Grouping background tasks (Stage 01)
│   │   │   ├── task-runner.controller.ts
│   │   │   ├── task-runner.service.ts
│   │   │   └── task-runner.module.ts
│   │   ├── label-runner/       # Module: รัน Label process (Stage 02)
│   │   │   ├── label-runner.controller.ts
│   │   │   ├── label-runner.service.ts
│   │   │   └── label-runner.module.ts
│   │   ├── parse-runner/       # Module: รัน Parse Data process (Stage 03)
│   │   │   ├── parse-runner.controller.ts
│   │   │   ├── parse-runner.service.ts
│   │   │   └── parse-runner.module.ts
│   │   ├── shared/             # Shared utilities (reusable across modules)
│   │   │   └── label-utils/    # Label processing utilities
│   │   │       ├── types.ts         # Shared types/interfaces
│   │   │       ├── pattern-matcher.ts  # Core pattern matching logic
│   │   │       └── index.ts         # Exports
│   │   ├── minio/              # Module: MinIO integration
│   │   │   ├── minio.service.ts
│   │   │   └── minio.module.ts
│   │   ├── templates/          # Module: Template management
│   │   │   ├── template.entity.ts    # Entity สำหรับ templates table
│   │   │   ├── templates.controller.ts
│   │   │   ├── templates.service.ts
│   │   │   ├── templates.module.ts
│   │   │   └── dto/                  # DTOs (create, update)
│   │   ├── auth/               # Module: Authentication (JWT + Passport)
│   │   │   ├── user.entity.ts        # Entity สำหรับ users table
│   │   │   ├── auth.controller.ts    # Auth endpoints (login, register, etc.)
│   │   │   ├── auth.service.ts       # Auth business logic
│   │   │   ├── auth.module.ts        # Module definition
│   │   │   ├── dto/                  # DTOs
│   │   │   │   ├── login.dto.ts
│   │   │   │   ├── register.dto.ts
│   │   │   │   └── update-user.dto.ts
│   │   │   ├── strategies/           # Passport strategies
│   │   │   │   ├── jwt.strategy.ts   # JWT validation
│   │   │   │   └── local.strategy.ts # Username/password validation
│   │   │   ├── guards/               # Auth guards
│   │   │   │   ├── jwt-auth.guard.ts # JWT protection
│   │   │   │   ├── local-auth.guard.ts
│   │   │   │   └── roles.guard.ts    # Role-based access
│   │   │   └── decorators/           # Custom decorators
│   │   │       ├── public.decorator.ts     # Mark routes as public
│   │   │       ├── roles.decorator.ts      # Role requirements
│   │   │       └── current-user.decorator.ts # Get current user
│   │   ├── app.module.ts       # Root module
│   │   └── main.ts             # Entry point
│   ├── dist/                   # Compiled output
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                   # Next.js Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── stages/
│   │   │   │   ├── 01-raw/      # หน้าอัพโหลดไฟล์ดิบ
│   │   │   │   ├── 02-group/    # หน้าจัดกลุ่มไฟล์
│   │   │   │   ├── 03-pdf-label/ # หน้า label PDF
│   │   │   │   ├── 04-extract/  # หน้า extract ข้อมูล
│   │   │   │   ├── 05-review/   # หน้า review
│   │   │   │   └── 06-upload/   # หน้า upload final
│   │   │   ├── login/         # หน้า Login
│   │   │   │   └── page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx    # Auth state management
│   │   ├── lib/
│   │   │   └── api.ts             # API client with auth
│   │   └── components/
│   │       ├── Navbar.tsx         # Updated with user menu + logout
│   │       ├── AuthGuard.tsx      # Protected route wrapper
│   │       ├── StageTabs.tsx
│   │       └── ThemeProvider.tsx
│   ├── middleware.ts              # Route protection middleware
│   ├── Dockerfile
│   └── package.json
│
├── templates/                  # Template PDF ตัวอย่าง (สำหรับการพัฒนา/ทดสอบ)
│   ├── ตราสาร-example.pdf
│   ├── บัญชีรายชื่อกรรมการมูลนิธิ-example.pdf
│   └── ...
│
├── ref/                        # Reference implementations (Python)
│   └── lib/                    # Python modules สำหรับ OCR processing
│       ├── data_parsing.py     # [สำคัญ] Parse OCR text → structured data
│       ├── document_grouping.py # จัดกลุ่มหน้าเป็น documents
│       ├── pattern_matching.py # Pattern matching logic
│       ├── templates.py        # Template data structures
│       ├── ocr.py              # Typhoon OCR API integration
│       ├── api_client.py       # API client สำหรับส่งข้อมูล
│       ├── database.py         # Database operations
│       ├── utils.py            # Utility functions
│       ├── config.py           # Configuration
│       └── task-02-group-to-label.py  # Main processing script
│
├── docker-compose.yml          # Docker orchestration
├── .env                        # Environment variables
├── .env.example                # Template สำหรับ .env
├── auto-label.md               # [เอกสารสำคัญ] Logic การ auto label PDF (Stage 2)
├── template-learning-task.md   # [เอกสารสำคัญ] Template optimization จาก manual labels
├── parse-data.md               # [เอกสารสำคัญ] อธิบาย logic การ parse data จาก OCR
├── task-runner.md              # [เอกสารสำคัญ] Pattern สำหรับ Infinite Worker Loop + SSE Logging
├── STRUCTURE.md                # [เอกสารนี้] โครงสร้างระบบ
└── CLAUDE.md                   # [กฎสำหรับ Claude] กฎการทำงานกับ AI assistant
```

---

## 🔧 สถาปัตยกรรม Backend

### Tech Stack
- **Framework:** NestJS (Node.js + TypeScript)
- **ORM:** TypeORM
- **Database:** PostgreSQL
- **Storage:** MinIO (S3-compatible)
- **OCR API:** Typhoon OCR API (3 API keys rotation)

### Modules

#### 1. **files** (Stage 01 + Stage 02)
- **Entities:**
  - `File` - เก็บไฟล์ทั้งหมด (Stage 01: upload, Stage 02: grouping metadata)
  - `Group` - เก็บ metadata ของแต่ละ group
- **ฟังก์ชัน:** จัดการไฟล์ตั้งแต่ upload จนถึง grouping
- **API Endpoints:**
  - **Stage 01 (Upload):**
    - `POST /files/upload` - อัพโหลดไฟล์
    - `GET /files` - ดึงรายการไฟล์ทั้งหมด (รองรับ pagination, sorting, filtering)
      - Query parameters:
        - `page` (number, default: 1) - หน้าปัจจุบัน
        - `limit` (number, default: 10) - จำนวนรายการต่อหน้า
        - `sortBy` (string, default: 'createdAt') - เรียงตาม: createdAt, fileNumber, originalName
        - `sortOrder` ('ASC' | 'DESC', default: 'DESC') - ลำดับการเรียง
        - `processed` ('all' | 'true' | 'false', default: 'all') - กรองตาม processed status
      - Response: `{ files, total, page, limit, totalPages }`
    - `GET /files/:id/preview` - ดูตัวอย่างไฟล์
    - `POST /files/:id/rotate` - **Rotate รูปภาพ 90 องศา** (รับ body: `{ degrees: number }`)
    - `DELETE /files/:id` - ลบไฟล์
    - `POST /files/clear` - ลบไฟล์ทั้งหมด
    - `POST /files/reset-processed` - รีเซ็ต processed status
    - `POST /files/validate-storage` - ตรวจสอบ storage integrity
  - **Stage 02 (Grouping):**
    - `GET /files/groups-metadata` - ดึง metadata ของทุก group (รวม `createdAt` สำหรับการเรียงลำดับ)
    - `GET /files/ready-to-label` - ดึง groups ที่พร้อม label
    - `GET /files/group/:groupId` - ดึงไฟล์ของ group ที่ระบุ
    - `PUT /files/group/:groupId/reorder` - **เปลี่ยนลำดับไฟล์ใน group** (drag-and-drop reordering)
    - `POST /files/clear-grouping` - **ลบการจัดกลุ่มทั้งหมด (Revert All Groups) + CASCADE DELETE labeled_files**
    - `SSE /files/events` - รับ events แบบ real-time (GROUP_COMPLETE, GROUP_CREATED)
  - **Stage 04 (Parsed Data):**
    - `GET /files/parsed-groups` - ดึง list ของ groups ที่ parse แล้ว
      - Response: `{ groups: Array<{ groupId, fileCount, parseDataAt, hasFoundationInstrument, committeeCount, isParseDataReviewed, parseDataReviewer }> }`
    - `GET /files/parsed-group/:groupId` - ดึงรายละเอียดของ group ที่ parse แล้ว (พร้อม relations)
      - Response: `{ group, foundationInstrument, committeeMembers }`
      - Relations: charterSections → articles → subItems
    - `POST /files/parsed-group/:groupId/mark-reviewed` - ✅ **Mark parse data as reviewed**
      - Body: `{ reviewer: string, notes?: string }`
      - Update `isParseDataReviewed = true`, `parseDataReviewer = reviewer`, `extractDataNotes = notes`

#### 2. **labeled-files** (Stage 03)
- **Entity:** `LabeledFile`
- **ฟังก์ชัน:** จัดการไฟล์ที่ผ่านการ label แล้ว
- **API Endpoints:**
  - `GET /labeled-files` - ดึงรายการไฟล์ที่ label แล้ว
  - `GET /labeled-files/processed-groups` - ดึง list ของ group ที่ label แล้ว
  - `GET /labeled-files/summary?includeReviewed={true|false}` - ดึง summary ของทุก group
    - **Query Parameters:**
      - `includeReviewed` (boolean, default: false) - ถ้า false: แสดงเฉพาะ groups ที่มี `isUserReviewed = false`, ถ้า true: แสดงทุก groups
    - **Response:** รวม fields `isReviewed` (boolean) และ `reviewer` (string | null)
  - `GET /labeled-files/templates` - ดึงรายการ templates ทั้งหมด (จาก Database)
  - `GET /labeled-files/group/:groupId` - ดึงไฟล์ของ group ที่ระบุ
  - `GET /labeled-files/group/:groupId/summary` - ดึง summary ของ group ที่ระบุ
  - `PATCH /labeled-files/group/:groupId/pages` - **Manual Label: อัปเดต labels ของหลายหน้า**
  - `POST /labeled-files/group/:groupId/mark-reviewed` - **Save review notes and conditionally mark as reviewed**
    - **Body:** `{ reviewer: string, notes?: string, markAsReviewed?: boolean }`
    - **Always:** Update `labeled_notes` ใน groups table
    - **When markAsReviewed = true:**
      - Update `isUserReviewed = true` และ `reviewer` ใน labeled_files
      - Update `labeled_reviewer` และ `is_labeled_reviewed = true` ใน groups
      - ✅ **Auto-trigger Parse Data:** ถ้า group match 100% → เรียก `parseRunnerService.parseGroup()` ใน background ทันที
    - **When markAsReviewed = false:** บันทึกเฉพาะ notes (ไม่ mark as reviewed)
    - **Response:** `{ updated: number, marked: boolean, parsed?: boolean, parseMessage?: string }`
      - `parsed: true` - Parse data ถูก trigger ใน background
      - `parseMessage` - คำอธิบาย (เช่น "Parse data triggered in background")
  - `POST /labeled-files/clear` - **ลบ labeled files ทั้งหมด + reset groups.isLabeled (Reset Progress ใช้ตัวนี้)**

#### 3. **task-runner** (Stage 01)
- **ฟังก์ชัน:** รัน background tasks สำหรับ OCR + Grouping (Infinite Worker Loop)
- **API Endpoints:**
  - `POST /task-runner/start` - เริ่ม infinite worker loop
  - `POST /task-runner/stop` - หยุด worker loop
  - `GET /task-runner/status` - ตรวจสอบสถานะ task
  - `GET /task-runner/logs-history` - ดึง log history
  - `POST /task-runner/clear-logs` - ลบ logs
  - `SSE /task-runner/logs` - รับ logs แบบ real-time

#### 4. **label-runner** (Stage 02)
- **ฟังก์ชัน:** รัน label process (Pattern Matching + PDF Splitting)
- **Shared Utilities:** ใช้ `shared/label-utils` สำหรับ pattern matching logic
- **API Endpoints:**
  - `POST /label-runner/start` - เริ่ม label process สำหรับทุก group (Infinite Worker Loop)
  - `POST /label-runner/relabel/:groupId` - **Re-label group ที่ระบุ** (ลบ labels เดิม + รัน label ใหม่)
  - `POST /label-runner/stop` - หยุด label process
  - `GET /label-runner/status` - ตรวจสอบสถานะ task
  - `GET /label-runner/logs-history` - ดึง log history
  - `POST /label-runner/clear-logs` - ลบ logs
  - `SSE /label-runner/logs` - รับ logs แบบ real-time (รวม GROUP_PROCESSED events)

#### 5. **parse-runner** (Stage 03)
- **ฟังก์ชัน:** รัน parse data process (Extract structured data from OCR)
- **Logic:**
  - หา groups ที่ `isLabeled = true` AND `isParseData = false`
  - **⚠️ Validation Requirements (ต้องผ่านทั้งหมด):**
    - ✅ `isLabeled = true` - Label เสร็จแล้ว
    - ✅ `isParseData = false` - ยังไม่ได้ parse
    - ✅ **Match 100%** - ทุกหน้าต้อง label แล้ว (ไม่มี unmatched)
    - ✅ **User Reviewed** - ทุกหน้าต้อง `isUserReviewed = true`
  - Parse foundation instrument data (ตราสาร) → สกัด name, shortName, address, logoDescription, charterSections
  - Parse committee members data (บัญชีรายชื่อกรรมการ) → สกัด name, address, phone, position
  - บันทึกผลลัพธ์ลง database tables: `foundation_instruments`, `charter_sections`, `charter_articles`, `charter_sub_items`, `committee_members`
- **API Endpoints:**
  - `POST /parse-runner/start` - เริ่ม parse data process (Infinite Worker Loop)
    - Filter เฉพาะ groups ที่ผ่าน validation ทั้งหมด
    - Log: "No groups ready to parse data. Waiting for new groups (must be 100% matched AND user reviewed)"
  - `POST /parse-runner/stop` - หยุด parse process
  - `POST /parse-runner/parse/:groupId` - **Parse group เดียว (Function-based)** - รับ groupId เป็น parameter
    - **Validation:**
      - ตรวจสอบว่า group exists
      - ตรวจสอบว่า group label แล้ว (`isLabeled = true`)
      - ตรวจสอบว่ายัง parse ยัง (`isParseData = false`)
      - ตรวจสอบว่า **match 100%** (ทุกหน้า labeled)
      - ✅ **ตรวจสอบว่า user reviewed แล้ว** (ทุกหน้า `isUserReviewed = true`)
    - **Response:** `{ success: boolean, message: string, data?: { foundationInstrument, committeeMembers } }`
    - **Error Messages:**
      - "Group X not found"
      - "Group X has already been parsed"
      - "Group X has not been labeled yet"
      - "Group X must be 100% matched before parsing"
      - "Group X must be user reviewed before parsing" ← **ใหม่**
  - `GET /parse-runner/status` - ตรวจสอบสถานะ task
  - `GET /parse-runner/logs-history` - ดึง log history
  - `POST /parse-runner/clear-logs` - ลบ logs
  - `SSE /parse-runner/logs` - รับ logs แบบ real-time (รวม GROUP_PARSED events)

#### 6. **minio**
- **ฟังก์ชัน:** จัดการ MinIO client และ file storage
- **Features:**
  - Upload files to MinIO
  - Delete files from MinIO
  - Get file buffers
  - Manage buckets

#### 7. **shared/label-utils** (Utility Module)
- **ฟังก์ชัน:** Shared utilities สำหรับ pattern matching และ label processing
- **Files:**
  - `types.ts` - Shared interfaces (Template, MatchResult, PageLabel, etc.)
  - `pattern-matcher.ts` - Core pattern matching functions (Exact Match Only)
  - `index.ts` - Module exports
- **Exported Functions:**
  - `extractOcrText(ocrText)` - Extract text from OCR JSON
  - `containsPattern(text, pattern)` - Exact pattern matching (normalized)
  - `checkPatternVariant(text, patterns)` - Check all patterns in variant (AND logic)
  - `checkPatterns(text, patterns)` - Check multiple variants (OR logic between variants)
  - `checkNegativePatterns(text, patterns)` - Check negative patterns
  - `findFirstPageTemplate(text, templates, previousTemplate?)` - Find matching template for first page
    - **รับ `previousTemplate` เป็น optional parameter** สำหรับ context-based matching
    - ตรวจสอบ `context_rules` ก่อนทำการ match patterns
  - `checkLastPage(text, template)` - Check if page matches last_page_patterns
  - `processFilesForLabeling(files, templates, logCallback)` - **Main labeling function**
    - ติดตาม `currentTemplate` สำหรับ context-based matching
    - ส่ง `previousTemplate` ไปยัง `findFirstPageTemplate()` เมื่อหา template ใหม่
- **Usage:**
  - ใช้ใน `label-runner.service.ts` สำหรับทั้ง infinite loop และ relabel
  - สามารถ reuse ใน modules อื่นได้ในอนาคต

#### 8. **templates**
- **Entity:** `Template`
- **ฟังก์ชัน:** จัดการ templates สำหรับ auto-labeling
- **API Endpoints:**
  - `GET /templates` - ดึง templates ทั้งหมด
  - `GET /templates/:id` - ดึง template ตาม ID
  - `POST /templates` - สร้าง template ใหม่
  - `PUT /templates/:id` - แก้ไข template
  - `DELETE /templates/:id` - ลบ template
  - `POST /templates/:id/toggle` - เปิด/ปิด template (toggle isActive)
- **Service Methods:**
  - `findAll()` - ดึง templates ทั้งหมด
  - `findActive()` - ดึงเฉพาะ templates ที่ isActive = true
  - `getTemplatesForLabeling()` - แปลง templates เป็น format สำหรับ label-utils

#### 9. **auth** (Authentication Module)
- **Entity:** `User`
- **ฟังก์ชัน:** จัดการ authentication และ authorization
- **Tech Stack:**
  - `@nestjs/passport` - Passport integration
  - `@nestjs/jwt` - JWT token management
  - `passport-jwt` - JWT strategy
  - `passport-local` - Username/password strategy
  - `bcrypt` - Password hashing
- **API Endpoints:**
  - `POST /auth/login` - Login (returns JWT token)
  - `POST /auth/register` - Register new user
  - `GET /auth/me` - Get current user profile (Protected)
  - `GET /auth/users` - List all users (Admin only)
  - `GET /auth/users/:id` - Get user by ID (Admin only)
  - `PATCH /auth/users/:id` - Update user (Admin only)
  - `DELETE /auth/users/:id` - Delete user (Admin only)
  - `POST /auth/init-admin` - Create default admin user (first time setup)
- **Guards:**
  - `JwtAuthGuard` - Validate JWT token
  - `LocalAuthGuard` - Validate username/password
  - `RolesGuard` - Check user role (admin/user)
- **Decorators:**
  - `@Public()` - Mark route as public (no auth required)
  - `@Roles(UserRole.ADMIN)` - Require specific role
  - `@CurrentUser()` - Get current user from request

---

## 🎨 สถาปัตยกรรม Frontend

### Tech Stack
- **Framework:** Next.js 16.0.10 (App Router with Turbopack)
- **UI Library:** React 19.2.3
- **Styling:** Tailwind CSS 3.4.17 (Utility-first CSS framework)
- **State Management:** React Hooks (useState, useEffect)
- **Drag-and-Drop:** dnd-kit (^6.3.1 core, ^10.0.0 sortable, ^3.2.2 utilities)
- **PostCSS:** tailwindcss + autoprefixer for CSS processing

### Styling System (Tailwind CSS)
- **Configuration:** `tailwind.config.ts` - Defines custom colors, fonts, and animations
- **Global Styles:** `src/app/globals.css` - Imports Tailwind and defines CSS custom properties
- **Theme Support:** Dark/Light mode via CSS variables (data-theme attribute)
- **Custom Colors:** Accent (#3b82f6), Success (#22c55e), Warning (#f59e0b), Danger (#ef4444)
- **Custom Animations:** pulse, infinityGlow (for terminal effects)
- **Font Families:**
  - Sans: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto
  - Mono: SF Mono, Monaco, Inconsolata, Fira Mono

### Pages (Stages)

#### 1. **01-raw** (`/stages/01-raw`)
- อัพโหลดไฟล์ดิบ (images/PDFs)
- แสดงรายการไฟล์ที่อัพโหลด
- **Enhanced Status Card:**
  - Progress bar แสดง processing progress (processed/total)
  - Real-time stats: Processed count, Pending count
  - Last activity timestamp (เมื่อ task กำลังรัน)
  - Dynamic status indicator (Processing/Ready/All Processed)
- **Compact Terminal Mode:**
  - Default mode: Compact view แสดง summary + recent important logs
  - Toggle button "📋 Full Logs" / "📊 Compact" เพื่อสลับโหมด
  - Filter ออก repetitive "waiting" messages ใน compact mode
  - แสดง summary: processed count, pending count, last activity
- **Improved File Table:**
  - Preview thumbnails ขนาดใหญ่ขึ้น (100x100px, เดิม 60x60px)
  - Hover effect บน thumbnail (scale-105)
  - Click thumbnail เพื่อเปิด full preview modal
- **Quick Actions:**
  - ปุ่ม "👁️ View" - เปิด full image preview modal
  - ปุ่ม "🗑️" - ลบไฟล์ (พร้อม confirmation)
- **Image Preview Modal:**
  - แสดงรูปภาพขนาดเต็ม (max 90vh)
  - Header: File name, file number, status, created date
  - Actions: Download, Delete
  - Dark background (bg-black/90) พร้อม backdrop blur
- **Real-time Updates via SSE:**
  - อัปเดท progress bar เมื่อมี FILE_PROCESSED event
  - อัปเดท processed/pending counts แบบ real-time
  - อัปเดท last activity timestamp
- **View Mode Toggle (แทน Filter dropdown):**
  - **All Files mode:** แสดงทุกไฟล์ (ทั้ง processed และ pending)
  - **Progress mode:** แสดงเฉพาะไฟล์ที่ยังไม่ processed
  - ไฟล์ที่ processed เสร็จจะหายไปทันทีใน Progress mode
  - Toggle buttons แสดงจำนวน pending files: "Progress (X)"

#### 2. **02-group** (`/stages/02-group`)
- จัดกลุ่มไฟล์ที่เกี่ยวข้องกัน
- **Enhanced Status Card (ปรับปรุงให้เหมือน Stage 01):**
  - **Progress Bar:** แสดง labeling progress (labeled/total groups) พร้อม percentage
  - **Real-time Stats:** แสดง Labeled count และ Pending count
  - **Last Activity Timestamp:** แสดงเวลาล่าสุดที่มีการ label (เมื่อ task กำลังรัน)
  - **Dynamic Status Indicator:** Processing/Ready/All Matched/No Groups
  - **Detailed Metrics:**
    - Total Groups: รวมทั้ง labeled และ pending (พร้อมแสดงจำนวนแยก)
    - Total Pages: รวมทั้ง labeled และ pending
    - Status: แสดงสถานะการ match (All Matched 100%, Labeled X%, Partial X%)
- **Compact Terminal Mode:**
  - Toggle button "📋 Full Logs" / "📊 Compact" เพื่อสลับโหมด
  - **Compact Mode:**
    - Summary section: แสดง labeled/pending counts, last activity
    - Recent Activity: แสดง 5 logs ล่าสุด (กรอง waiting messages)
  - **Full Logs Mode:** แสดง logs ทั้งหมดแบบ scrollable
- **Table Display (แสดงเฉพาะ unlabeled groups):**
  - แสดง groups ที่ยังไม่ label (`isLabeled = false`) เป็น table
  - เรียงตาม `createdAt` มากไปน้อย (ล่าสุดก่อน)
  - คอลัมน์: Group ID, File Count, Status, Actions
- **View Mode Toggle:**
  - **Unlabeled mode:** แสดง groups ที่ยังไม่ label (default)
  - **Labeled mode:** แสดง groups ที่ label แล้ว พร้อม match percentage
- **Lazy Loading:**
  - เปิดหน้าครั้งแรก: Fetch เฉพาะ group metadata (groupNumber, fileCount, isComplete, isLabeled, createdAt)
  - คลิกที่ group: Fetch files ของ group นั้นๆ แบบ on-demand
  - ลดการใช้ bandwidth และเพิ่มความเร็วในการโหลด
- รัน label PDF process ผ่าน terminal (background task)
- **SSE Connections:**
  - SSE #1: `/label-runner/logs` - รับ label task logs และ GROUP_PROCESSED events
  - SSE #2: `/files/events` - รับ GROUP_COMPLETE events
  - SSE #3: `/task-runner/logs` - รับ real-time group creation events จาก Stage 01
- **Real-time Updates:**
  - อัปเดท progress bar เมื่อมี GROUP_PROCESSED event
  - อัปเดท labeled/pending counts แบบ real-time
  - อัปเดท last activity timestamp
  - Groups ที่ label เสร็จจะหายไปทันทีใน Unlabeled mode
- **Processed Tracking:**
  - Filter out groups ที่ label แล้ว (ไม่แสดงใน Unlabeled table)
  - ป้องกันการประมวลผลซ้ำ (skip processed groups)
  - Status card แสดง labeled pages และ overall progress
- **Reset Progress:**
  - ปุ่ม "Reset Label Progress" สำหรับ clear labeled data
  - สามารถ rerun label task ได้หลังจาก reset

#### 3. **03-pdf-label** (`/stages/03-pdf-label`)
- แสดงรายการ groups ที่ label แล้ว (PDF Label Review)
- **Auto Label All Feature:**
  - ปุ่ม "🚀 Start Auto Label All" - เริ่ม auto label ทุก group (infinite loop)
  - ปุ่ม "⏸️ Stop Auto Label" - หยุด label process
  - **Terminal Component:** แสดง real-time logs จาก label process
    - Compact Mode: แสดง summary + recent 10 logs (กรอง waiting messages)
    - Full Logs Mode: แสดง logs ทั้งหมดแบบ scrollable
    - ปุ่ม Clear Logs สำหรับลบ logs
  - **SSE Connection:** เชื่อมต่อกับ `/label-runner/logs` เพื่อรับ real-time logs
  - **Auto-refresh:** เมื่อ label เสร็จ (GROUP_PROCESSED event) จะ refresh groups list อัตโนมัติ
  - **API Endpoints:**
    - `POST /label-runner/start` - เริ่ม label process
    - `POST /label-runner/stop` - หยุด label process
    - `GET /label-runner/logs-history` - ดึง log history
    - `POST /label-runner/clear-logs` - ลบ logs
    - `SSE /label-runner/logs` - รับ real-time logs
- **Filters:**
  - **Review Status Filter:**
    - "Unreviewed Only" (default) - แสดงเฉพาะ groups ที่ยังไม่ได้ review (มี `isUserReviewed = false`)
    - "All Groups" - แสดงทุก groups รวมถึงที่ review แล้ว
  - **Match % Filter:**
    - "All" - แสดงทุก groups
    - "100% Matched" - แสดงเฉพาะ groups ที่ match 100%
    - "Not 100%" - แสดงเฉพาะ groups ที่ match ไม่ถึง 100%
- **Table Columns:**
  - Group #, Total Pages, Matched, Unmatched, Match %, Status (All Matched/Partial/No Match)
  - **Reviewed** - แสดงสถานะ "✓ Reviewed" (เขียว) หรือ "⚠ Pending" (เหลือง)
  - **Reviewer** - แสดงชื่อผู้ review หรือ "Not reviewed"
  - Actions - ปุ่ม "Review"
- **Group จะหายจากรายการ (Unreviewed Only mode) เมื่อ:**
  - User กด Save ใน Manual Label page
  - **และ** Group นั้น match 100% (ทุกหน้า labeled แล้ว)
  - → จะ mark `isUserReviewed = true` และ group จะหายจากรายการ (ถ้าเลือก filter "Unreviewed Only")

##### 3.1 **Manual Label Page** (`/stages/03-pdf-label/manual/[groupId]`)
- หน้าสำหรับ manual label แบบ interactive
- **UI Layout:**
  - **Left Sidebar:** แสดง page list พร้อม template name และ status + **Color coding ตาม template** + **Drag handles (⋮⋮) สำหรับ reorder**
  - **Center:** PDF/Image preview พร้อม zoom controls และ **rotate buttons**
  - **Right Panel:** Label info, Quick Select, Templates list, OCR text
- **Features:**
  - เลือก START/END page ด้วย Space key
  - Template Modal พร้อม search
  - Keyboard shortcuts (Space, Arrow keys, T, 1-9, C, Esc, H, Cmd+S)
  - Manual Save (ต้องกดปุ่ม Save หรือ Cmd+S)
  - Unsaved changes warning
  - **Rotate Image:** หมุนรูปภาพ 90 องศา (ซ้าย/ขวา) และบันทึกลงไฟล์จริง
  - **Template Color Coding:** แต่ละ template มีสีที่แตกต่างกัน แสดงเป็นแถบด้านซ้ายและจุดสีหน้าชื่อ template
  - **Drag-and-Drop Reordering:** สามารถลาก (drag) หน้าเพื่อเปลี่ยนลำดับได้ (ใช้ dnd-kit library) - auto-save เมื่อ drop
  - ✅ **No Auto-Jump:** หลังเลือก template หรือ save เสร็จ → **ไม่เด้งไป** next unmatch page (คงไว้หน้าเดิม)
- **Save Flow with Notes:**
  - ✅ **Step 1 - Reviewer Name Check:** ถ้ายังไม่ได้ตั้งชื่อ → เด้ง modal ให้ใส่ชื่อ
  - ✅ **Step 2 - Review Notes Modal (แสดงเสมอ):** เมื่อคลิก Save → แสดง Notes Modal ให้ user ใส่หมายเหตุ (optional)
    - **ถ้า match 100%:** Modal บอกว่า "จะ mark as reviewed" + ปุ่มแสดง "Save & Mark as Reviewed"
    - **ถ้า match < 100%:** Modal บอกว่า "จะ NOT mark as reviewed จนกว่าจะ 100%" + ปุ่มแสดง "Save"
    - ✅ **Keyboard Shortcuts:**
      - **Enter** (ไม่กด Shift) → Submit form ทันที (save)
      - **Shift+Enter** → ขึ้นบรรทัดใหม่ (สำหรับเขียน notes หลายบรรทัด)
      - **Escape** → ปิด modal
  - ✅ **Step 3 - Save & Update:**
    - บันทึก `labeled_notes` ลง groups table **เสมอ** (ไม่ว่า match เท่าไร)
    - ถ้า match 100%:
      - Update `isUserReviewed = true` และ `reviewer = <name>` ใน labeled_files
      - Update `labeled_reviewer = <name>` และ `is_labeled_reviewed = true` ใน groups
      - ✅ **Auto-trigger Parse Data** → เรียก parse data ทันทีใน background (ไม่ต้องรอ)
      - Parse ทำงาน asynchronously (user ไม่ต้องรอ)
      - ข้อมูลจะปรากฏใน Stage 04 เมื่อ parse เสร็จ
    - ถ้า match < 100% → **ไม่** update isUserReviewed (group ยังคงแสดงใน Stage 03)
    - ✅ **หลัง save เสร็จ → คงอยู่หน้าเดิม** (ไม่เด้งไปหน้า unmatch)
  - ✅ **localStorage Integration:** ดึงชื่อจาก localStorage (key: `ocr-flow-reviewer-name`)

#### 4. **04-extract** (`/stages/04-extract`)
- **ฟังก์ชัน:** แสดงและดูข้อมูลที่ extract (parse) จาก labeled PDFs
- **Routes:**
  - `/stages/04-extract` - หน้าหลัก (List view)
  - `/stages/04-extract/[groupId]` - หน้า detail ของแต่ละ group (Foundation + Committee tabs)
  - `/documents/[groupId]` - 📄 **Documents viewer** (เปิดใน new window, **ไม่มี navbar/stage tabs**, มี preview modal ในหน้าเดียวกัน)
- **หน้าหลัก (List View):**
  - **Summary Cards:** แสดง Parsed Groups, Foundation Instruments, Committee Members count
  - **Table View:** แสดง list ของ groups ที่ parse แล้ว
    - Columns: Group #, Pages, Foundation (Yes/No), Committee (count), **Review Status**, **Reviewer**, Parsed At, Actions
    - **Review Status:** แสดง "✓ Reviewed" (เขียว) หรือ "⚠ Pending" (เหลือง)
    - **Reviewer:** แสดงชื่อผู้ review หรือ "Not reviewed"
    - Click row หรือปุ่ม "**Review**" → Navigate ไปหน้า `/stages/04-extract/[groupId]`
- **หน้า Detail (`/stages/04-extract/[groupId]` - Read-only):**
  - **Header:**
    - Group ID, Foundation name, Review status badge
    - Parsed timestamp, Reviewer name (ถ้ามี)
    - ปุ่ม Back (←) - กลับไปหน้า list
    - ปุ่ม "**Mark as Reviewed**" - แสดงเฉพาะเมื่อยัง review (เรียก `POST /files/parsed-group/:groupId/mark-reviewed`)
    - ปุ่ม "Re-parse Data" - รัน parse ใหม่ (เรียก `POST /parse-runner/parse/:groupId`)
  - **Tabs:**
    - Tab 1: **Foundation Instrument** - แสดง name, shortName, address, logoDescription, charterSections (หมวด → ข้อ → อนุข้อ)
    - Tab 2: **Committee Members** - แสดง table รายชื่อกรรมการ (name, position, address, phone)
    - **Button: 📄 Documents** - เปิด Documents viewer ใน **new window** (ไม่ใช่ tab!)
      - แสดง icon "open in new window" (↗️)
      - คลิกแล้วเปิด `/documents/[groupId]` ใน window ใหม่

##### 4.1 **📄 Documents Viewer (`/documents/[groupId]` - New Window)**
- **Clean Full Screen UI (ไม่มี Navbar และ Stage Tabs)**
- **Custom Layout:** ใช้ layout.tsx แยก - ซ่อน navbar ด้วย CSS
- **3-Panel Layout (คล้าย macOS Preview + Finder):**

```
┌─────────────────────────────────────────────────────┐
│ [Header: Close + Title + Page Info]                │
├──────────┬─────────────────────────┬────────────────┤
│          │                         │                │
│  File    │    Image Preview        │   OCR Text    │
│  List    │    (Large, centered)    │   (Scrollable)│
│  (256px) │                         │   (320px)     │
│          ├─────────────────────────┤                │
│          │ [Thumbnail Strip]       │                │
└──────────┴─────────────────────────┴────────────────┘
```

##### **📁 Left Sidebar - File List (256px width)**
- **Finder-style file list** - เหมือน macOS sidebar
- **Features:**
  - List of all files (Page 1, 2, 3...)
  - **Color dots** - ตาม template (10 สีสลับ)
  - **Active state** - highlight ด้วย accent color
  - **Arrow indicator** - แสดงหน้าที่เลือก
  - **Click** - navigate ไปหน้านั้น
- **Scrollable:** vertical scroll เมื่อไฟล์เยอะ
- **Compact design:** ประหยัดพื้นที่

##### **🖼️ Center Panel - Image Preview (Flex-1)**
- **Main Focus Area** - พื้นที่ใหญ่สุด
- **Image Display:**
  - Full size, center aligned
  - Object-fit: contain
  - Max dimensions: fit viewport
  - High quality rendering
- **Background:** bg-secondary (contrast กับ sidebar)
- **Bottom: Thumbnail Strip (128px height)**
  - Horizontal scrollable thumbnails
  - All pages (1-14)
  - **Selected state:** ring-2 ring-accent + border color
  - **Inactive:** opacity-60
  - **Hover:** opacity-100
  - **Click:** navigate ไปหน้านั้น
  - Show page number below thumbnail

##### **📝 Right Sidebar - OCR Text (320px width)**
- **OCR Result Panel**
- **Header:**
  - Title: "OCR Result"
  - Template badge (color-coded dot + name)
- **Content:**
  - Full OCR text (whitespace-pre-wrap)
  - Scrollable (vertical)
  - Background: bg-secondary พร้อม border
  - **Text formatting:** leading-relaxed
  - **Fallback:** "No OCR text available" ถ้าไม่มีข้อมูล
- **Best For:** อ่าน/verify OCR text ขณะดูรูป

##### **🎯 Header (Minimal)**
- **Left:** Close button (X) + "Group X • Y Documents"
- **Right:** "Page X of Y"
- **Height:** compact (py-2)
- **No clutter:** ไม่มี view switcher (ใช้ single layout)

##### **⌨️ Keyboard Controls**
- `←` Arrow Left - หน้าก่อนหน้า
- `→` Arrow Right - หน้าถัดไป
- `Esc` - close window
- **Smooth & Responsive** - ไม่มี delay

##### **🎨 Visual Features**
- **Color System:** 10 สีสลับกัน per template
- **Active Indicators:**
  - File list: accent background + arrow
  - Thumbnail: ring + border color
  - Sync across all 3 areas
- **Responsive:** ปรับตามขนาดหน้าจอ

- **API Calls:**
  - `GET /files/parsed-groups` - ดึง list ของ groups ที่ parse แล้ว (พร้อม isParseDataReviewed, parseDataReviewer)
  - `GET /files/parsed-group/:groupId` - ดึงรายละเอียดของ group (พร้อม relations)
  - `GET /labeled-files/group/:groupId` - ดึงเอกสารทั้งหมดของ group (สำหรับ Documents viewer)
  - `GET /labeled-files/:id/preview` - Preview รูปภาพ (สำหรับ thumbnails + full preview)
  - `POST /files/parsed-group/:groupId/mark-reviewed` - ✅ **Mark extract data as reviewed** (Body: `{ reviewer: string }`)
  - `POST /parse-runner/parse/:groupId` - Re-parse group
- **⚠️ Read-only View:**
  - ไม่สามารถแก้ไขข้อมูลโดยตรง (ทั้ง Detail page และ Documents viewer)
  - ถ้าต้องการแก้ไข → Re-parse หรือแก้ที่ Stage 05 (Review)
- **✅ Auto-parse Integration:**
  - Groups จะปรากฏอัตโนมัติเมื่อ Save & Review (100% matched) ใน Stage 03
  - Parse ทำงานใน background - ไม่ต้องรอ

#### 5. **05-review** (`/stages/05-review`)
- Review ข้อมูลที่ extract ได้
- แก้ไข/อนุมัติข้อมูล

#### 6. **06-upload** (`/stages/06-upload`)
- Upload final documents

### Components

- **Navbar:** Navigation bar
  - แสดง navigation links
  - **Reviewer Name Display:** แสดงชื่อ reviewer ที่ตั้งไว้ (ดึงจาก localStorage)
  - **Reviewer Name Setting:** ปุ่ม settings สำหรับตั้งค่าชื่อ reviewer
  - **Reviewer Name Modal:** Modal สำหรับป้อนและบันทึกชื่อ reviewer
  - **localStorage Key:** `ocr-flow-reviewer-name`
  - Theme toggle button
- **StageTabs:** Tab navigation สำหรับ stages
- **ThemeProvider:** Dark/Light mode provider
- **AuthGuard:** Protected route wrapper component

---

## 🗄️ Database Schema

### Tables

#### 0. **users** (Authentication)
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
- `email` - Email (unique, ใช้สำหรับ login)
- `password_hash` - Password hash (bcrypt)
- `name` - ชื่อผู้ใช้ (จะใช้เป็น reviewer name อัตโนมัติ)
- `role` - บทบาท: `admin` (จัดการ users ได้) หรือ `user` (ใช้งานปกติ)
- `is_active` - สถานะ active/inactive

**Default Admin:**
- เรียก `POST /auth/init-admin` เพื่อสร้าง admin คนแรก
- Email: `admin@ocrflow.local`
- Password: `admin123`

#### 1. **files** (รวม Stage 01 + Stage 02)
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
- **Stage 01:**
  - `processed` - สถานะการประมวลผล OCR (default: false)
  - `processed_at` - เวลาที่ประมวลผล OCR เสร็จ
- **Stage 02:**
  - `group_id` - ID ของ group ที่ไฟล์นี้อยู่
  - `order_in_group` - ลำดับของไฟล์ใน group
  - `ocr_text` - ข้อความจาก OCR (เก็บไว้สำหรับ pattern matching)
  - `is_bookmark` - ไฟล์นี้เป็น BOOKMARK หรือไม่

#### 2. **groups** (Stage 02 metadata + Stage 03 status tracking + Stage 04 review tracking)
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

  -- Registration info
  district_office TEXT NULL,
  registration_number VARCHAR(50) NULL,
  logo_url VARCHAR(500) NULL,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**ฟิลด์สำคัญ:**

**Stage 01-02 (Grouping):**
- `is_complete` - group นี้จัดกลุ่มเสร็จแล้วหรือยัง
- `completed_at` - เวลาที่จัดกลุ่มเสร็จ

**Stage 02-03 (Auto-labeling + Manual Review):**
- `is_auto_labeled` - group นี้ผ่าน auto-label (label runner) แล้วหรือยัง (เดิมชื่อ is_labeled)
- `labeled_at` - เวลาที่ auto-label เสร็จ
- `labeled_reviewer` - ชื่อผู้ review labels (Stage 03 Manual Label)
- `labeled_notes` - หมายเหตุจากผู้ review labels (Stage 03)
- `is_labeled_reviewed` - ได้ review labels (manual) แล้วหรือยัง

**Stage 03 (Parse Data):**
- `is_parse_data` - group นี้ parse data เสร็จแล้วหรือยัง
- `parse_data_at` - เวลาที่ parse data เสร็จ

**Stage 04 (Parse Data Review):**
- `is_parse_data_reviewed` - group นี้ review parse data แล้วหรือยัง
- `parse_data_reviewer` - ชื่อผู้ review parse data
- `extract_data_notes` - ✅ หมายเหตุจากผู้ review parse data (Stage 04)

**Registration Info:**
- `district_office` - สำนักงานเขตที่จดทะเบียน (text)
- `registration_number` - เลขทะเบียนมูลนิธิ (varchar 50)
- `logo_url` - URL ของ Logo มูลนิธิใน MinIO (varchar 500)

**Relations:**
- `foundationInstrument` - OneToOne → foundation_instruments table
- `committeeMembers` - OneToMany → committee_members table

#### 3. **labeled_files** (Stage 03)
```sql
CREATE TABLE labeled_files (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  order_in_group INTEGER NOT NULL,
  grouped_file_id INTEGER NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  ocr_text TEXT NULL,

  -- Label results
  template_name VARCHAR(255) NULL,
  category VARCHAR(255) NULL,
  label_status VARCHAR(50) DEFAULT 'unmatched',  -- 'start' | 'continue' | 'end' | 'single' | 'unmatched'
  match_reason TEXT NULL,

  -- Document tracking
  document_id INTEGER NULL,
  page_in_document INTEGER NULL,

  -- User review tracking
  is_user_reviewed BOOLEAN DEFAULT FALSE,
  reviewer VARCHAR(255) NULL,

  created_at TIMESTAMP DEFAULT NOW()
);
```

**ฟิลด์สำคัญ:**
- `group_id` - Foreign key to groups table **with CASCADE DELETE** (เมื่อ delete group → labeled_files ที่เกี่ยวข้องจะถูก delete อัตโนมัติ)
- `label_status` - สถานะการ match ('start', 'continue', 'end', 'single', 'unmatched')
- `template_name` - ชื่อ template ที่ match
- `document_id` - ID ของเอกสาร (auto-increment ต่อ group)
- `page_in_document` - หน้าที่ของไฟล์นี้ในเอกสาร
- `is_user_reviewed` - User ได้ review label นี้แล้วหรือยัง (default: false)
- `reviewer` - ชื่อหรือ ID ของผู้ review

**⚠️ CASCADE DELETE Behavior:**
- เมื่อเรียก `POST /files/clear-grouping` (ลบ groups ทั้งหมด) → `labeled_files` ทั้งหมดจะถูก delete อัตโนมัติ
- ไม่จำเป็นต้องเรียก `POST /labeled-files/clear` ก่อน
- Database จะดูแล referential integrity โดยอัตโนมัติ

#### 4. **foundation_instruments** (Parsed Data - ตราสาร)
```sql
CREATE TABLE foundation_instruments (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL UNIQUE REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NULL,
  short_name VARCHAR(255) NULL,
  address TEXT NULL,
  logo_description TEXT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**ฟิลด์สำคัญ:**
- `group_id` - Foreign key to groups (OneToOne) with CASCADE DELETE
- `name` - ชื่อมูลนิธิ
- `short_name` - ชื่อย่อ (เช่น "ม.ก.ข.")
- `address` - ที่ตั้ง
- `logo_description` - คำอธิบายตราสัญลักษณ์

#### 5. **charter_sections** (หมวดต่างๆ ของตราสาร)
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
- `foundation_instrument_id` - Foreign key to foundation_instruments
- `number` - เลขหมวด (เช่น "1", "2")
- `title` - ชื่อหมวด (เช่น "ชื่อและที่ตั้ง")
- `order_index` - ลำดับการแสดง

#### 6. **charter_articles** (ข้อต่างๆ ในแต่ละหมวด)
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
- `charter_section_id` - Foreign key to charter_sections
- `number` - เลขข้อ (เช่น "1", "2")
- `content` - เนื้อหาของข้อ
- `order_index` - ลำดับการแสดง

#### 7. **charter_sub_items** (ข้อย่อยของข้อ)
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
- `charter_article_id` - Foreign key to charter_articles
- `number` - เลขข้อย่อย (เช่น "1.1", "1.2")
- `content` - เนื้อหาของข้อย่อย
- `order_index` - ลำดับการแสดง

#### 8. **committee_members** (กรรมการมูลนิธิ)
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
- `group_id` - Foreign key to groups (ManyToOne) with CASCADE DELETE
- `name` - ชื่อกรรมการ
- `address` - ที่อยู่
- `phone` - เบอร์โทรศัพท์
- `position` - ตำแหน่ง (เช่น "ประธาน", "กรรมการ")
- `order_index` - ลำดับในรายชื่อ

---

## 🏗️ Infrastructure

### Docker Services

#### 1. **postgres** (PostgreSQL 16)
- **Port:** 5434 (host) → 5432 (container)
- **Database:** ocrflow
- **User:** postgres
- **Volume:** `postgres_data`

#### 2. **pgadmin** (pgAdmin 4)
- **Port:** 5054 (host) → 80 (container)
- **Login:** admin@admin.com / admin (default)
- **Volume:** `pgadmin_data`
- **Access:** http://localhost:5054
- **Database Connection:**
  - Host: postgres
  - Port: 5432
  - Username: postgres
  - Password: postgres
  - Database: ocrflow

#### 3. **minio** (MinIO Object Storage)
- **Port:** 9004 (API), 9005 (Console)
- **Bucket:** ocr-documents
- **User:** minioadmin
- **Volume:** `minio_data`

#### 4. **backend** (NestJS)
- **Port:** 4004
- **Environment:**
  - `DB_HOST=postgres`
  - `MINIO_ENDPOINT=minio`
  - `TYPHOON_OCR_API_KEY_1/2/3` (API key rotation)
- **Volumes:**
  - `./backend:/app` (hot reload)

#### 5. **frontend** (Next.js)
- **Port:** 3004
- **Environment:**
  - `NEXT_PUBLIC_API_URL=http://localhost:4004`

---

## 🔄 Logic และ Data Flow

### Flow หลักของระบบ

```
┌─────────────────────────────────────────────────────────────────────┐
│                         OCR FLOW SYSTEM                             │
└─────────────────────────────────────────────────────────────────────┘

01. RAW (Upload)
    └─> User อัพโหลดไฟล์ (images/PDFs)
    └─> บันทึกใน MinIO (bucket: raw/)
    └─> บันทึก metadata ใน PostgreSQL (raw_files)
    └─> ตั้งค่า processed = false (รอประมวลผล)

02. GROUP (Grouping) - Infinite Worker Loop ⭐ NEW
    └─> **∞ Infinite Worker Loop (Backend):**
        ├─> คลิก "Start" → เริ่ม infinite loop ที่ backend
        ├─> คลิก "Stop" → หยุด loop ทันที
        └─> Loop ทำงานต่อเนื่องจนกว่าจะถูก stop

    └─> **Loop Logic (ทำซ้ำเรื่อยๆ):**
        ┌─ while (isRunning) ─────────────────────────────┐
        │                                                  │
        │ 1. Get file IDs ที่อยู่ใน complete groups       │
        │ 2. Get unprocessed files (processed = false)    │
        │ 3. Filter out files ที่อยู่ใน complete groups   │
        │                                                  │
        │ 4. ถ้าไม่มีไฟล์:                                │
        │    └─> รอ 5 วินาที → loop ใหม่                │
        │                                                  │
        │ 5. ถ้ามีไฟล์:                                   │
        │    ├─> OCR ด้วย Typhoon API (3 workers)        │
        │    ├─> ตรวจจับ BOOKMARK                         │
        │    ├─> จัดกลุ่มแบบ sequential                   │
        │    └─> Mark files เป็น processed = true        │
        │                                                  │
        │ 6. รอ 2 วินาที → loop รอบถัดไป                 │
        └──────────────────────────────────────────────────┘

    └─> **การจัดกลุ่ม (Grouping):**
        ├─> เจอ BOOKMARK → ปิด group ก่อนหน้า + เริ่ม Group ใหม่
        ├─> ⚠️ BOOKMARK เป็นแค่ตัวแบ่ง ไม่เก็บลง group (groupId=null, orderInGroup=null)
        ├─> ไม่เจอ BOOKMARK → เพิ่มลงใน Group ปัจจุบัน
        ├─> Mark group เป็น isComplete = true เมื่อปิด group
        ├─> บันทึกใน PostgreSQL (files table) พร้อม OCR text
        └─> BOOKMARK files จะถูก mark เป็น isBookmark=true แต่ไม่อยู่ใน group ใดๆ

    └─> ⚠️ **ไม่มีการ copy file** - grouped files อ้างอิง raw storage path โดยตรง

    ⚠️ **ป้องกันการประมวลผลซ้ำ:**
        ├─> ข้ามไฟล์ที่ processed = true (OCR แล้ว)
        └─> ข้ามไฟล์ที่อยู่ใน complete groups (จัดกลุ่มแล้ว)

    🎮 **Frontend UI (Stage 01):**
    └─> ปุ่ม "Start" - เริ่ม infinite loop
    └─> ปุ่ม "Stop" - หยุด loop
    └─> แสดง real-time logs ผ่าน SSE
    └─> API: POST /task-runner/start
    └─> API: POST /task-runner/stop
    └─> API: GET /task-runner/logs (SSE stream)

    🔒 **ป้องกันการประมวลผลซ้ำ:**
    └─> ตรวจสอบ processed groups จาก labeled_files table
    └─> ข้าม group ที่มี labeled_files แล้ว
    └─> แสดง log "Skipping X already processed groups"
    └─> ถ้าทุก group processed → แสดง "All groups already processed"
    └─> รัน task เฉพาะ group ที่ยังไม่ได้ label

    📈 **Progress Tracking:**
    └─> ดึงข้อมูลจาก GET /labeled-files/processed-groups
    └─> คำนวณ stats per group (labeled/total, percentage)
    └─> แสดง "✓ Processed" badge บน folder cards ที่ label แล้ว
    └─> แสดง match stats ใต้ folder:
        ├─> 100% Matched (สีเขียว background) - ถ้า match ทั้งหมด
        └─> XX% Matched (สีเหลือง background) - ถ้า match บางส่วน
    └─> อัปเดต status card:
        ├─> Total Groups: X labeled
        ├─> Total Pages: X matched
        └─> Status: All Matched / Labeled (X%) / Partial (X%)
    └─> Auto-refresh เมื่อ task เสร็จ

    🔄 **Reset Progress:**
    └─> ปุ่ม "Reset Label Progress" (แสดงเมื่อมี labeled data)
    └─> API: `POST /labeled-files/clear`
    └─> Clear ข้อมูล labeled_files ทั้งหมด + reset groups.isLabeled
    └─> ไม่ลบ groups (เฉพาะ reset label data)
    └─> สามารถ rerun label task ได้หลัง reset

    🔄 **Revert All Groups (Clear Grouping):**
    └─> ปุ่ม "Revert All Groups" ใน Stage 02
    └─> API: `POST /files/clear-grouping`
    └─> Clear files.groupId, files.orderInGroup, files.ocrText, files.isBookmark
    └─> Delete groups ทั้งหมด
    └─> ⚠️ **CASCADE DELETE:** labeled_files จะถูก delete อัตโนมัติโดย database
    └─> ทำให้ต้อง rerun ทั้ง grouping และ labeling

03. PDF-LABEL (OCR + Pattern Matching) ⭐ CORE LOGIC
    └─> Step 1: OCR
        ├─> ส่งแต่ละหน้าไป Typhoon OCR API
        └─> ได้ text file (02-group/{id}/ocrs/{page}.txt)
    └─> Step 2: Pattern Matching (Multi-Strategy)
        ├─> ดึง templates จาก Database (templates table)
        ├─> Match แต่ละหน้าด้วย first_page_patterns
        ├─> หาจุดจบด้วย last_page_patterns
        ├─> ใช้ Exact Match (normalized text comparison)
        └─> บันทึก match_info (match reason)
    └─> Step 3: Split PDF
        ├─> แยก PDF ตาม template ที่ match
        ├─> สร้าง subfolder ตาม category (ถ้ามี)
        └─> บันทึกใน 03-label/{id}/{template}.pdf
    └─> Step 4: Generate Summary
        ├─> สร้าง summary.md (match status, page-to-template mapping)
        ├─> สร้าง config.json (fallback)
        └─> บันทึกใน PostgreSQL (labeled_files, folders, pages)

04. EXTRACT (Data Extraction)
    └─> Extract structured data จาก labeled PDFs
    └─> ใช้ NLP/ML models (ถ้ามี)

05. REVIEW (Human Review)
    └─> User review ข้อมูลที่ extract ได้
    └─> แก้ไข/อนุมัติข้อมูล

06. UPLOAD (Final Upload)
    └─> Upload documents ไปยัง final destination
```

### Pattern Matching Logic (ดูรายละเอียดใน `auto-label.md`)

#### Exact Match (Normalized Text Comparison)
ระบบใช้ **Exact Match** โดยการเปรียบเทียบข้อความที่ normalize แล้ว:
- Lowercase ทั้งหมด
- Trim whitespace
- Collapse multiple spaces เป็น single space

#### ขั้นตอนการ Match
1. อ่าน OCR text ของแต่ละหน้า
2. ลอง match กับทุก template ที่ `isActive = true` ใน Database
3. ตรวจสอบ `first_page_patterns`:
   - ใช้ **AND logic** ภายใน variant (ต้องเจอทุกคำ)
   - ใช้ **OR logic** ระหว่าง variants (เจอ variant ใดก็ได้)
   - ใช้ **Exact Match** (normalized text comparison)
4. ตรวจสอบ `first_page_negative_patterns`:
   - ถ้าเจอคำใน negative_patterns → ปฏิเสธ template นี้
5. **ตรวจสอบ `context_rules` (ใหม่):**
   - ตรวจสอบ context ของหน้าก่อนหน้า (previousTemplate)
   - **`requirePreviousCategory`:** ถ้ากำหนดไว้ → match เฉพาะเมื่อหน้าก่อนหน้ามี category ที่ตรงกับรายการ
   - **`blockPreviousCategory`:** ถ้ากำหนดไว้ → ห้าม match เมื่อหน้าก่อนหน้ามี category ที่ตรงกับรายการ
   - **Use Case:** เอกสารที่มีหลาย variants ที่มี patterns คล้ายกัน แต่ต้องแยกตาม context
6. ถ้า `is_single_page = true`:
   - เป็นเอกสารหน้าเดียว → match เลย
7. ถ้าไม่ใช่ single page:
   - ต้องหา `last_page_patterns` เพื่อจบเอกสาร
8. ตรวจสอบ `last_page_patterns`:
   - Logic เหมือน first_page_patterns
9. ตรวจสอบ `last_page_negative_patterns`:
   - ถ้าเจอ → ยังไม่จบเอกสาร

#### Context-Based Matching (Context Rules)
**ฟีเจอร์ใหม่:** ระบบสามารถ match template ตาม context ของหน้าก่อนหน้าได้

**กลไกการทำงาน:**
- `findFirstPageTemplate(text, templates, previousTemplate)` - รับ `previousTemplate` เป็น parameter
- ตรวจสอบ `context_rules` ของแต่ละ template ก่อนทำการ match patterns
- ถ้า template มี `requirePreviousCategory`:
  - ตรวจสอบว่า `previousTemplate.category` อยู่ใน list หรือไม่
  - ถ้าไม่อยู่ → skip template นี้ (ไม่ match)
- ถ้า template มี `blockPreviousCategory`:
  - ตรวจสอบว่า `previousTemplate.category` อยู่ใน list หรือไม่
  - ถ้าอยู่ → skip template นี้ (ไม่ match)
- Logic นี้ทำงานก่อนการ check patterns → ป้องกัน false match ตั้งแต่ต้น

**ตัวอย่าง Use Case: หนังสือให้อำนาจ (2 รูปแบบ)**
```json
// Template 1: หนังสือให้อำนาจ (จัดตั้ง)
{
  "name": "หนังสือให้อำนาจ (จัดตั้ง)",
  "category": "documents",
  "contextRules": {
    "requirePreviousCategory": ["application_form", "documents"]
  },
  "firstPagePatterns": [
    ["หนังสือให้อำนาจ", "จัดตั้งมูลนิธิ"]
  ]
}

// Template 2: หนังสือให้อำนาจ (เปลี่ยนแปลง)
{
  "name": "หนังสือให้อำนาจ (เปลี่ยนแปลง)",
  "category": "documents",
  "contextRules": {
    "requirePreviousCategory": ["change_notice", "change_form"]
  },
  "firstPagePatterns": [
    ["หนังสือให้อำนาจ", "เปลี่ยนแปลง"]
  ]
}
```

**ผลลัพธ์:**
- ถ้าหน้าก่อนหน้าเป็น "คำขอจัดตั้ง" (category: application_form) → match "หนังสือให้อำนาจ (จัดตั้ง)" เท่านั้น
- ถ้าหน้าก่อนหน้าเป็น "หนังสือแจ้งเปลี่ยนแปลง" (category: change_notice) → match "หนังสือให้อำนาจ (เปลี่ยนแปลง)" เท่านั้น

#### Template Structure (Database)
Templates เก็บใน PostgreSQL table `templates` โดยมี fields:

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
- `first_page_patterns` - JSONB: รูปแบบหน้าแรก `[["pattern1", "pattern2"], ["alt1", "alt2"]]`
  - AND logic ภายใน variant (ต้องเจอทุกคำ)
  - OR logic ระหว่าง variants (เจอ variant ใดก็ได้)
- `last_page_patterns` - JSONB: รูปแบบหน้าสุดท้าย (nullable)
- `first_page_negative_patterns` - JSONB: patterns ที่ต้องไม่เจอ → ปฏิเสธ template
- `last_page_negative_patterns` - JSONB: patterns ที่ต้องไม่เจอในหน้าสุดท้าย
- `context_rules` - JSONB: กฎการ match ตาม context ของหน้าก่อนหน้า
  - `requirePreviousCategory`: string[] - match เฉพาะเมื่อหน้าก่อนหน้าเป็น category ที่ระบุ
  - `blockPreviousCategory`: string[] - ห้าม match เมื่อหน้าก่อนหน้าเป็น category ที่ระบุ
  - **Use Case:** เอกสารที่มีหลาย variants (เช่น "หนังสือให้อำนาจ" มี 2 รูปแบบ: จัดตั้ง/เปลี่ยนแปลง)
- `is_single_page` - ถ้า true = เอกสารหน้าเดียว (ไม่ต้องหา last_page_patterns)
- `is_active` - ถ้า false = ไม่ใช้ใน auto-labeling

**API Endpoints สำหรับจัดการ Templates:**
- `GET /templates` - ดึง templates ทั้งหมด (เรียงตาม sortOrder, id)
- `GET /templates/:id` - ดึง template ตาม ID
- `POST /templates` - สร้าง template ใหม่
- `PUT /templates/:id` - แก้ไข template
- `DELETE /templates/:id` - ลบ template
- `POST /templates/:id/toggle` - เปิด/ปิด template (toggle isActive)

---

## 🔐 Authentication

### Overview
ระบบใช้ **JWT (JSON Web Tokens)** กับ **Passport.js** สำหรับ authentication และ authorization

### Tech Stack
- **Backend:** `@nestjs/passport`, `@nestjs/jwt`, `passport-jwt`, `passport-local`, `bcrypt`
- **Frontend:** React Context + localStorage สำหรับ token storage

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Authentication Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User เข้า /login                                            │
│     │                                                            │
│  2. กรอก email + password → POST /auth/login                    │
│     │                                                            │
│  3. Backend validate credentials (bcrypt compare)               │
│     │                                                            │
│  4. ถ้าถูกต้อง → return JWT token                               │
│     │                                                            │
│  5. Frontend เก็บ token ใน localStorage                         │
│     │                                                            │
│  6. ทุก API request → ส่ง token ใน Authorization header         │
│     Authorization: Bearer <token>                                │
│     │                                                            │
│  7. Backend validate token → allow/deny                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### User Roles
| Role | Permissions |
|------|-------------|
| `admin` | Full access - จัดการ users, เข้าถึงทุก features |
| `user` | Standard access - ใช้งาน stages, review documents |

### Environment Variables
```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
```

### First Time Setup
1. รัน backend และ database
2. เรียก `POST /auth/init-admin` หรือกดปุ่ม "Create Default Admin User" บนหน้า login
3. Login ด้วย:
   - Email: `admin@ocrflow.local`
   - Password: `admin123`
4. เปลี่ยนรหัสผ่านและสร้าง users เพิ่มเติม

### Frontend Components
- **AuthContext** (`src/contexts/AuthContext.tsx`) - จัดการ auth state
- **AuthGuard** (`src/components/AuthGuard.tsx`) - Protected route wrapper
- **Login Page** (`src/app/login/page.tsx`) - หน้า login
- **Navbar** - แสดง user info และ logout button

### API Endpoints

#### Public Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login และรับ JWT token |
| POST | `/auth/register` | สร้าง user ใหม่ |
| POST | `/auth/init-admin` | สร้าง default admin (first time) |

#### Protected Endpoints (ต้อง login)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/me` | ดึงข้อมูล user ปัจจุบัน |

#### Admin Only Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/users` | ดึงรายการ users ทั้งหมด |
| GET | `/auth/users/:id` | ดึงข้อมูล user ตาม ID |
| PATCH | `/auth/users/:id` | แก้ไขข้อมูล user |
| DELETE | `/auth/users/:id` | ลบ user |

### Security Features
- **Password Hashing:** bcrypt (10 salt rounds)
- **JWT Expiry:** 7 days (configurable)
- **Token Validation:** ทุก protected route ตรวจสอบ token
- **Role-based Access:** Guards ตรวจสอบ user role
- **Auto-logout:** ถ้า token หมดอายุ → redirect ไป /login

---

## 🎯 เป้าหมายและวัตถุประสงค์

### เป้าหมายหลัก
1. **อัตโนมัติการแยกเอกสาร** จากเอกสารหลายหน้าเป็นเอกสารย่อย
2. **ระบุประเภทเอกสาร** ด้วย Pattern Matching และ OCR
3. **จัดเก็บและจัดการเอกสาร** อย่างเป็นระบบ
4. **Pattern Matching** ด้วย Exact Match (normalized text comparison)
5. **Flexible Configuration** ผ่าน Database (templates table + UI Management)

### Use Cases
- **จัดการเอกสารมูลนิธิ:**
  - ตราสาร
  - บัญชีรายชื่อกรรมการ
  - บันทึกการประชุม
  - หนังสือรับรอง
  - เอกสารเปลี่ยนแปลงมูลนิธิ
  - และอื่นๆ (ดูใน `templates/`)

### Key Features
- **Multi-page Document Processing**
- **Pattern Matching** (Exact Match + Negative Patterns)
- **Category-based Organization** (subfolder support)
- **Single-page Detection** (isSinglePage flag)
- **Template Management** (isActive toggle, sortOrder)
- **OCR API Key Rotation** (3 keys)
- **Database + Object Storage** (PostgreSQL + MinIO)

---

## 🔄 การแก้ไขและอัปเดต

### ⚠️ สิ่งสำคัญ: อัปเดต STRUCTURE.md เมื่อมีการเปลี่ยนแปลง

เมื่อมีการแก้ไข/เพิ่มเติม code ที่ส่งผลกระทบต่อ:
- ✅ **โครงสร้างโฟลเดอร์/โค้ด** → อัปเดต [โครงสร้างโฟลเดอร์](#โครงสร้างโฟลเดอร์)
- ✅ **Module/Service/Controller ใหม่** → อัปเดต [สถาปัตยกรรม Backend](#สถาปัตยกรรม-backend)
- ✅ **Frontend pages/components ใหม่** → อัปเดต [สถาปัตยกรรม Frontend](#สถาปัตยกรรม-frontend)
- ✅ **Database schema** → อัปเดต [Database Schema](#database-schema)
- ✅ **Infrastructure/Docker** → อัปเดต [Infrastructure](#infrastructure)
- ✅ **Logic หลัก/Flow** → อัปเดต [Logic และ Data Flow](#logic-และ-data-flow)
- ✅ **Templates** → อัปเดต [Template Structure](#template-structure-database)

### วิธีอัปเดต STRUCTURE.md
1. แก้ไข STRUCTURE.md ในส่วนที่เกี่ยวข้อง
2. ระบุ **อัปเดตล่าสุด** (วันที่) ที่ด้านบนของเอกสาร
3. ถ้ามีการเปลี่ยนแปลง auto label logic → อัปเดต `auto-label.md` ด้วย

### ไฟล์เอกสารสำคัญ
- **STRUCTURE.md** (ไฟล์นี้) - โครงสร้างระบบ
- **auto-label.md** - Logic การ auto label PDF (Stage 2)
- **template-learning-task.md** - Template optimization จาก manual labels
- **parse-data.md** - Logic การ parse data จาก OCR (ตราสาร, กรรมการ)
- **task-runner.md** - Pattern สำหรับ Infinite Worker Loop + SSE Logging
- **CLAUDE.md** - กฎสำหรับ Claude AI assistant

---

## 📚 Resources

### เอกสารเพิ่มเติม
- [auto-label.md](./auto-label.md) - Logic การ auto label PDF (Stage 2) อย่างละเอียด
- [template-learning-task.md](./template-learning-task.md) - Template optimization จาก manual labels
- [parse-data.md](./parse-data.md) - Logic การ parse data จาก OCR (ตราสาร, กรรมการ)
- [task-runner.md](./task-runner.md) - Pattern สำหรับ Infinite Worker Loop + SSE Logging
- [Backend README](./backend/README.md) - NestJS documentation
- [Frontend README](./frontend/README.md) - Next.js documentation

### External Dependencies
- **NestJS:** https://docs.nestjs.com
- **Next.js:** https://nextjs.org/docs
- **TypeORM:** https://typeorm.io
- **MinIO:** https://min.io/docs
- **Typhoon OCR API:** (ใช้ API keys ที่กำหนดใน .env)

---

**สร้างโดย:** OCR Flow Development Team
**อัปเดตล่าสุด:** 2025-12-15
