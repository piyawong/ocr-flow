# OCR Flow v2 - Documentation Hub

> **อัปเดตล่าสุด:** 2025-12-27 (เพิ่ม OCR Worker 4 ใช้ API Keys 13-16)
> **วัตถุประสงค์:** Navigation hub สำหรับเอกสาร OCR Flow v2

---

## 🎯 ภาพรวมระบบ (สั้นๆ)

**OCR Flow v2** เป็นระบบ Document Processing ที่ทำงานแบบอัตโนมัติผ่าน 7 ขั้นตอนหลัก:

```
00-UPLOAD → 01-RAW → 02-GROUP → 03-PDF-LABEL → 04-EXTRACT → 05-REVIEW → 06-UPLOAD
```

**เป้าหมายหลัก:**
- อัตโนมัติการแยกเอกสารจากเอกสารหลายหน้า (multi-page documents)
- OCR และ Pattern Matching เพื่อระบุประเภทเอกสาร
- จัดเก็บและจัดการเอกสารผ่าน MinIO Object Storage และ PostgreSQL
- Extract ข้อมูลโครงสร้างจากเอกสาร (ตราสาร, รายชื่อกรรมการ)

---

## 📁 โครงสร้างโฟลเดอร์ (ย่อ)

```
OCR-flow-v2/
├── backend/          # NestJS Backend (API, Services, Database)
├── frontend/         # Next.js Frontend (UI, Pages, Components)
│   └── stages/
│       ├── 00-upload/      # Stage 00: Upload Images (Simple upload only)
│       ├── 01-raw/         # Stage 01: Raw Images + OCR
│       ├── 02-group/       # Stage 02: Grouping
│       ├── 03-pdf-label/   # Stage 03: PDF Labeling
│       ├── 04-extract/     # Stage 04: Data Extraction
│       ├── 05-review/      # Stage 05: Final Review
│       └── 06-upload/      # Stage 06: Upload Final
├── templates/        # PDF Examples (ตัวอย่างเอกสาร)
├── ref/             # Python Reference (OCR processing scripts)
├── frontend-detailed.md      # ✓ มีแล้ว (Frontend architecture)
├── backend-detailed.md       # ✓ มีแล้ว (Backend modules)
├── database-detailed.md      # ✓ มีแล้ว (Database schema)
├── api-reference.md          # ✓ มีแล้ว (API endpoints)
├── auto-label.md             # ✓ มีแล้ว (Auto labeling logic)
├── parse-data.md             # ✓ มีแล้ว (Data extraction)
├── task-runner.md            # ✓ มีแล้ว (Background tasks)
├── template-learning-task.md # ✓ มีแล้ว (Template optimization)
├── STRUCTURE.md              # 📍 ไฟล์นี้ (Navigation hub)
└── STRUCTURE-old.md          # Backup (รายละเอียดเดิม)
```

---

## 🧭 ถ้าต้องการทำ... ให้ไปอ่าน

### Frontend Development
- 📱 **ทำงานกับ Frontend (Next.js)** → [frontend-detailed.md](./frontend-detailed.md)
  - Tech Stack (Next.js, React, Tailwind CSS, dnd-kit)
  - Stages รายละเอียด (01-06) พร้อม UI components
  - Components (Navbar, StageTabs, ThemeProvider, AuthGuard)
  - UI/UX patterns และ Styling system
  - Keyboard shortcuts ทุก stage
  - Real-time features (SSE)

### Backend Development
- ⚙️ **ทำงานกับ Backend (NestJS)** → [backend-detailed.md](./backend-detailed.md)
  - Tech Stack (NestJS, TypeORM, PostgreSQL, MinIO)
  - Modules รายละเอียด (9 modules)
  - Service Methods สำคัญ
  - Background tasks (Infinite Worker Loop)
  - Pattern Matching utilities (shared/label-utils)
  - Authentication & Authorization (JWT + Passport)

### API Integration
- 🔌 **ใช้ API Endpoints** → [api-reference.md](./api-reference.md)
  - API endpoints ทั้งหมด (61 endpoints)
  - แยกตาม modules (Auth, Files, Labeled Files, Templates, Task Runner, Label Runner, Parse Runner)
  - Request/Response format พร้อม examples
  - Query parameters และ filters
  - SSE events และ Error codes
  - Quick Lookup Table

### Database
- 🗄️ **ทำงานกับ Database** → [database-detailed.md](./database-detailed.md)
  - Database Schema (11 tables)
  - Tables & Relations พร้อม Foreign Keys
  - ER Diagram (ASCII + Mermaid)
  - CASCADE DELETE behavior
  - Indexes และ Performance
  - SQL Schema ครบถ้วน

### Auto Labeling & Pattern Matching
- 🏷️ **Auto Label PDF Logic** → [auto-label.md](./auto-label.md)
  - Pattern matching algorithm (Exact Match)
  - Template structure (Database-based)
  - Context Rules (requirePreviousCategory, blockPreviousCategory)
  - AND/OR logic, Negative patterns

### Data Extraction
- 📊 **Parse Data Logic** → [parse-data.md](./parse-data.md)
  - Foundation instrument parsing (ตราสาร)
  - Committee members parsing (บัญชีรายชื่อกรรมการ)
  - OCR text extraction และโครงสร้างข้อมูล

### Background Tasks
- ⚡ **Task Runner Pattern** → [task-runner.md](./task-runner.md)
  - Infinite worker loop pattern
  - SSE logging และ real-time updates
  - Error handling และ graceful shutdown

### Template Optimization
- 🎓 **Template Learning** → [template-learning-task.md](./template-learning-task.md)
  - Manual label analysis
  - Template generation และ optimization
  - Pattern selection guidelines

### Organization Output (Stage 05)
- 📊 **Organization Data Output** → [Organization.md](./Organization.md)
  - โครงสร้างข้อมูลสุดท้ายหลังจบ Stage 05
  - Foundation Instrument (ตราสาร + หมวด + ข้อ + อนุข้อ)
  - Committee Members (รายชื่อกรรมการ)
  - Review Status (สถานะการ approve)
  - Complete JSON output example

---

## 🚀 Quick Start

### Setup
```bash
# Clone repository
git clone <repo-url>
cd OCR-flow-v2

# Setup environment
cp .env.example .env
# แก้ไข .env (ใส่ API keys, database config)

# Start services
docker-compose up -d
```

### Services
| Service | URL | Purpose |
|---------|-----|---------|
| **Backend** | http://localhost:4004 | NestJS API |
| **Frontend** | http://localhost:3004 | Next.js UI |
| **MinIO Console** | http://localhost:9005 | Object Storage |
| **pgAdmin** | http://localhost:5054 | Database Admin |
| **PostgreSQL** | localhost:5434 | Database |

### Default Admin
สร้าง admin user ครั้งแรก:
1. เปิด http://localhost:3004/login
2. คลิก "Create Default Admin User"
3. Login ด้วย:
   - Email: `admin@ocrflow.local`
   - Password: `admin123`
4. เปลี่ยนรหัสผ่านหลัง login

---

## 📚 Tech Stack Summary

### Backend
| Tech | Version | Purpose |
|------|---------|---------|
| **NestJS** | Latest | Node.js framework |
| **TypeORM** | Latest | ORM for PostgreSQL |
| **PostgreSQL** | 16 | Relational database |
| **MinIO** | Latest | S3-compatible object storage |
| **Passport.js** | Latest | Authentication (JWT) |
| **bcrypt** | Latest | Password hashing |

### Frontend
| Tech | Version | Purpose |
|------|---------|---------|
| **Next.js** | 16.0.10 | React framework (App Router) |
| **React** | 19.2.3 | UI library |
| **Tailwind CSS** | 3.4.17 | Utility-first CSS |
| **dnd-kit** | 6.3.1 | Drag-and-drop library |
| **TypeScript** | Latest | Type safety |

---

## 🔍 Quick Reference

### Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         OCR FLOW SYSTEM                             │
└─────────────────────────────────────────────────────────────────────┘

00. UPLOAD (Upload Images)
    └─> User อัพโหลดไฟล์ (JPEG images only)
    └─> บันทึกใน MinIO + PostgreSQL
    └─> Simple upload interface (ไม่มี OCR processing)

01. RAW (Upload + OCR)
    └─> User อัพโหลดไฟล์ (images/PDFs)
    └─> บันทึกใน MinIO + PostgreSQL
    └─> รอประมวลผล OCR

02. GROUP (Auto-grouping)
    └─> Task runner ทำ OCR + ตรวจจับ BOOKMARK
    └─> จัดกลุ่มไฟล์แบบอัตโนมัติด้วย BOOKMARK (delimiter-based)
    └─> สร้าง groups เมื่อไฟล์ระหว่าง BOOKMARK OCR เสร็จครบ (atomic)

03. PDF-LABEL (Pattern Matching)
    └─> Auto-label ด้วย pattern matching
    └─> Manual label (review + adjust)
    └─> Save & Mark as reviewed (100% matched)

04. EXTRACT (Data Extraction)
    └─> Parse ตราสาร (foundation instrument)
    └─> Parse รายชื่อกรรมการ (committee members)
    └─> Mark extract data as reviewed

05. REVIEW (Final Review)
    └─> Review Stage 03 (PDF Labels) แยกอิสระ
    └─> Review Stage 04 (Extract Data) แยกอิสระ
    └─> สามารถ Approve/Reject แต่ละ stage แยกกันได้
    └─> บันทึก notes, reviewer, timestamp แยกกัน

06. UPLOAD (Final Upload)
    └─> Upload documents ไปยัง final destination
    └─> เฉพาะ groups ที่ finalReview03 = 'approved' AND finalReview04 = 'approved'
```

### Key Modules

| Module | Purpose | Details |
|--------|---------|---------|
| **dashboard** | System Overview | Dashboard metrics และ statistics |
| **files** | Upload + Grouping | [backend-detailed.md](./backend-detailed.md#1-files-module-stage-01--stage-02) |
| **labeled-files** | PDF Labeling | [backend-detailed.md](./backend-detailed.md#2-labeled-files-module-stage-03) |
| **task-runner** | OCR Background | [backend-detailed.md](./backend-detailed.md#3-task-runner-module-stage-01) |
| **label-runner** | Auto Label | [backend-detailed.md](./backend-detailed.md#4-label-runner-module-stage-02) |
| **parse-runner** | Data Extract | [backend-detailed.md](./backend-detailed.md#5-parse-runner-module-stage-03--stage-04) |
| **templates** | Template Mgmt | [backend-detailed.md](./backend-detailed.md#7-templates-module) |
| **auth** | Authentication | [backend-detailed.md](./backend-detailed.md#8-auth-module) |
| **minio** | Object Storage | [backend-detailed.md](./backend-detailed.md#9-minio-module) |

### Key Tables

| Table | Purpose | Details |
|-------|---------|---------|
| **users** | Authentication | [database-detailed.md](./database-detailed.md#0-users-authentication) |
| **files** | Upload tracking | [database-detailed.md](./database-detailed.md#1-files-upload--grouping) |
| **groups** | Grouping metadata | [database-detailed.md](./database-detailed.md#2-groups---metadata--status-tracking) |
| **documents** | **Label results (Main)** | [database-detailed.md](./database-detailed.md#3-documents---labeled-documents-main-label-storage) |
| **templates** | Auto label config | [database-detailed.md](./database-detailed.md#4-templates---auto-label-configuration) |
| **foundation_instruments** | ตราสาร (parsed) | [database-detailed.md](./database-detailed.md#5-foundation_instruments---ตราสารมูลนิธิ) |
| **charter_sections** | หมวดตราสาร | [database-detailed.md](./database-detailed.md#6-charter_sections---หมวดของตราสาร) |
| **charter_articles** | ข้อตราสาร | [database-detailed.md](./database-detailed.md#7-charter_articles---ข้อในแต่ละหมวด) |
| **charter_sub_items** | อนุข้อตราสาร | [database-detailed.md](./database-detailed.md#8-charter_sub_items---ข้อย่อยของข้อ) |
| **committee_members** | กรรมการ (parsed) | [database-detailed.md](./database-detailed.md#9-committee_members---กรรมการมูลนิธิ) |
| **organizations** | องค์กร/สำนักงาน | [database-detailed.md](./database-detailed.md#10-organizations---องค์กรมูลนิธิ) |

---

## 📖 Related Documents

| Document | Description | Status |
|----------|-------------|--------|
| [CLAUDE.md](./CLAUDE.md) | กฎสำหรับ Claude AI Assistant | ✓ |
| [frontend-detailed.md](./frontend-detailed.md) | Frontend architecture & stages (รายละเอียด) | ✓ |
| [backend-detailed.md](./backend-detailed.md) | Backend modules & services (รายละเอียด) | ✓ |
| [database-detailed.md](./database-detailed.md) | Database schema & relations (รายละเอียด) | ✓ |
| [api-reference.md](./api-reference.md) | API endpoints reference (61 endpoints) | ✓ |
| [auto-label.md](./auto-label.md) | Auto labeling logic (Exact Match + Context Rules) | ✓ |
| [parse-data.md](./parse-data.md) | Data extraction logic (ตราสาร + กรรมการ) | ✓ |
| [task-runner.md](./task-runner.md) | Background task patterns (Infinite Loop + SSE) | ✓ |
| [template-learning-task.md](./template-learning-task.md) | Template optimization workflow | ✓ |
| [Organization.md](./Organization.md) | ข้อมูล output หลังจบ Stage 05 (Final Review) | ✓ |
| [STRUCTURE-old.md](./STRUCTURE-old.md) | โครงสร้างระบบแบบละเอียด (backup เดิม) | ✓ |

---

## 🎯 Goals

OCR Flow v2 ถูกออกแบบมาเพื่อ:

1. **Automate document separation** - แยกเอกสารจาก multi-page PDFs อัตโนมัติ
2. **OCR & pattern matching** - ระบุประเภทเอกสารด้วย Exact Match algorithm
3. **Store & manage documents** - จัดเก็บผ่าน MinIO + PostgreSQL
4. **Extract structured data** - สกัดข้อมูลโครงสร้าง (ตราสาร, กรรมการ)
5. **Quality control** - Review process ทุก stage (Stage 03, 04, 05)

---

## 📝 Environment Variables

### Backend (.env)

```env
# Database
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=ocrflow

# MinIO
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=ocr-documents

# OCR API (Typhoon OCR API - 4 workers × 4 keys = 16 total)
# Worker 1: Keys 1-4
TYPHOON_OCR_API_KEY_1=your-api-key-1
TYPHOON_OCR_API_KEY_2=your-api-key-2
TYPHOON_OCR_API_KEY_3=your-api-key-3
TYPHOON_OCR_API_KEY_4=your-api-key-4
# Worker 2: Keys 5-8
TYPHOON_OCR_API_KEY_5=your-api-key-5
TYPHOON_OCR_API_KEY_6=your-api-key-6
TYPHOON_OCR_API_KEY_7=your-api-key-7
TYPHOON_OCR_API_KEY_8=your-api-key-8
# Worker 3: Keys 9-12
TYPHOON_OCR_API_KEY_9=your-api-key-9
TYPHOON_OCR_API_KEY_10=your-api-key-10
TYPHOON_OCR_API_KEY_11=your-api-key-11
TYPHOON_OCR_API_KEY_12=your-api-key-12
# Worker 4: Keys 13-16
TYPHOON_OCR_API_KEY_13=your-api-key-13
TYPHOON_OCR_API_KEY_14=your-api-key-14
TYPHOON_OCR_API_KEY_15=your-api-key-15
TYPHOON_OCR_API_KEY_16=your-api-key-16

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# App
PORT=4004
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:4004
```

---

## 🔐 Authentication

### JWT-based Authentication

- **Backend:** Passport.js + JWT strategy
- **Frontend:** React Context + localStorage
- **Token Storage:** localStorage (key: `auth-token`)
- **Token Expiry:** 7 days (configurable)

### User Roles

| Role | Permissions |
|------|-------------|
| `admin` | Full access - จัดการ users, final approval |
| `user` | Standard access - ใช้งาน stages, review |

### Protected Routes

- **Frontend:** AuthGuard wrapper component + middleware
- **Backend:** JwtAuthGuard + RolesGuard decorators
- **Public Routes:** `/login`, `/auth/register`, `/auth/init-admin`

---

## 🔄 Data Flow Summary

### Stage 01: RAW (Upload)
1. User อัพโหลดไฟล์
2. บันทึกใน MinIO (bucket: raw/)
3. บันทึก metadata ใน PostgreSQL (files table)
4. `processed = false` (รอประมวลผล)

### Stage 02: GROUP (Auto-grouping)
1. OCR Workers (3 workers) ทำ OCR ทุกไฟล์ (Typhoon API)
2. ตรวจจับ BOOKMARK (หน้าแบ่งกลุ่ม) - `ocrText.includes('BOOKMARK')`
3. Grouping Worker จัดกลุ่มแบบ BOOKMARK-based:
   - หา BOOKMARK ทั้งหมด (sorted by fileNumber)
   - Process แบบ sequential pairs: [B1-B7], [B7-B12], ...
   - รอให้ไฟล์ระหว่าง BOOKMARK OCR เสร็จครบ (ห้ามข้าม!)
   - สร้าง group เมื่อครบทุกไฟล์ (atomic operation)
4. บันทึก groups (created as complete) + OCR text

### Stage 03: PDF-LABEL (Pattern Matching)
1. Label runner auto-label ทุก group
2. Pattern matching (Exact Match + Context Rules)
3. User manual label (adjust + review)
4. Save & Mark as reviewed (100% matched only)
5. Auto-parse หลัง user review (on-demand)

### Stage 04: EXTRACT (Data Extraction)
1. Parse ตราสาร (foundation instrument)
2. Parse รายชื่อกรรมการ (committee members)
3. บันทึกลง database (หมวด → ข้อ → อนุข้อ)
4. Mark extract data as reviewed

### Stage 05: REVIEW (Final Review)
1. Review Stage 03 (PDF Labels) แยกอิสระ
2. Review Stage 04 (Extract Data) แยกอิสระ
3. สามารถ Approve/Reject แต่ละ stage แยกกันได้
4. บันทึก notes, reviewer, timestamp แยกกัน
5. Mark `finalReview03` และ `finalReview04` = 'approved'/'rejected'

### Stage 06: UPLOAD (Final Upload)
1. Upload เฉพาะ groups ที่:
   - `finalReview03 = 'approved'` AND
   - `finalReview04 = 'approved'`
2. Final destination (ยังไม่ implement)

---

## 🎨 Theme System (IMPORTANT - Read Before Styling!)

### Unified Theme Configuration

**⚠️ SINGLE SOURCE OF TRUTH:**
- **ไฟล์หลัก:** `frontend/src/app/globals.css` (บรรทัด 215-326)
- **Format:** HSL (for Tailwind compatibility)
- **Selectors:** `:root, [data-theme='light']` และ `.dark, [data-theme='dark']`

### Theme Variables (HSL Format)

```css
/* Light Theme */
:root, [data-theme='light'] {
  --bg-primary: 210 40% 98%;      /* #f8fafc */
  --text-primary: 215 25% 27%;    /* #1e293b */
  --border-color: 214 32% 91%;    /* #e2e8f0 */
  --success: 142 71% 45%;         /* #22c55e */
  --warning: 38 92% 50%;          /* #f59e0b */
  --danger: 0 84% 60%;            /* #ef4444 */
}

/* Dark Theme */
.dark, [data-theme='dark'] {
  --bg-primary: 222 47% 11%;      /* #0f172a */
  --text-primary: 210 40% 98%;    /* #f1f5f9 */
  --border-color: 215 25% 27%;    /* #334155 */
  /* ... same semantic colors ... */
}
```

### วิธีใช้งาน

```tsx
// ✅ ถูกต้อง - ใช้ HSL via Tailwind
<div className="bg-bg-primary text-text-primary border-border-color" />

// ✅ ถูกต้อง - Semantic colors
<div className="text-success bg-warning/10" />

// ✅ ถูกต้อง - Theme-aware colors
<div className="text-amber-600 dark:text-amber-400" />

// ❌ ผิด - Hard-coded colors (ไม่ adapt theme)
<div className="text-white bg-gray-900" />
```

### กฎสำคัญ (MUST FOLLOW!)

1. **ห้ามแก้ theme variables ใน 2 ที่:**
   - ❌ ห้ามสร้าง CSS variables ซ้ำ
   - ❌ ห้ามใช้ Hex colors (#fff) ใน globals.css

2. **แก้ theme ต้องแก้ที่เดียว:**
   - ✅ แก้ใน `globals.css` (บรรทัด 215-326)
   - ✅ ใช้ HSL format เท่านั้น
   - ✅ อัปเดตทั้ง light และ dark

3. **ใช้ Tailwind classes:**
   - ✅ `text-text-primary` (adapt theme)
   - ✅ `text-blue-600 dark:text-blue-400` (explicit)
   - ❌ `text-white` (hard-coded)

4. **ทดสอบทั้ง 2 themes:**
   - Toggle 🌙/☀️ เพื่อเช็ค contrast
   - เช็ค text visibility บน light และ dark

### การแก้ปัญหา Theme

**ถ้า text มองไม่เห็นใน light theme:**
```tsx
// แก้จาก
className="text-purple-400"

// เป็น
className="text-purple-600 dark:text-purple-400"
```

**ถ้าต้องการเพิ่มสีใหม่:**
1. เพิ่มใน `globals.css` (HSL format)
2. เพิ่มใน `tailwind.config.ts` → `colors`
3. ทดสอบทั้ง light และ dark

---

## 🧪 Testing & Development

### Start Development Environment

```bash
# Start all services
docker-compose up -d

# Watch logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop all services
docker-compose down

# Reset database (⚠️ ลบข้อมูลทั้งหมด)
docker-compose down -v
docker-compose up -d
```

### Access Services

- Frontend: http://localhost:3004
- Backend: http://localhost:4004
- API Docs: http://localhost:4004/api (ถ้ามี Swagger)
- MinIO Console: http://localhost:9005 (minioadmin/minioadmin)
- pgAdmin: http://localhost:5054 (admin@admin.com/admin)

---

## 📞 Support & Contact

**สร้างโดย:** OCR Flow Development Team

**สำหรับคำถามหรือปัญหา:**
1. ตรวจสอบเอกสารใน `docs/` folder
2. ดู [CLAUDE.md](./CLAUDE.md) สำหรับแนวทางการทำงานกับ AI
3. ดู [STRUCTURE-old.md](./STRUCTURE-old.md) สำหรับรายละเอียดโครงสร้าง

---

**ไฟล์นี้:** Navigation hub สำหรับเอกสาร OCR Flow v2
**Version:** 2.0 (Simplified)
**Last Updated:** 2025-12-19
