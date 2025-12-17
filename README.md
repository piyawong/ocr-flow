# OCR Flow v2

> Automated document processing system with OCR, pattern matching, and intelligent file grouping

## 🚀 Quick Start

### Prerequisites

- **Node.js** v20.9.0 or higher
- **npm** v10+
- **Docker** & **Docker Compose** (for containerized deployment)

### Development Setup (Local)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd OCR-flow-v2
   ```

2. **Install Node.js 20 (using nvm)**
   ```bash
   nvm install 20
   nvm use 20
   ```

3. **Install dependencies**
   ```bash
   # Frontend
   cd frontend
   npm install

   # Backend
   cd ../backend
   npm install
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Run development servers**
   ```bash
   # Terminal 1 - Frontend (Next.js 16)
   cd frontend
   npm run dev

   # Terminal 2 - Backend (NestJS)
   cd backend
   npm run start:dev
   ```

Frontend: http://localhost:3004
Backend API: http://localhost:4004

---

### Docker Deployment (Recommended)

1. **Start all services**
   ```bash
   docker-compose up -d
   ```

2. **View logs**
   ```bash
   docker-compose logs -f
   ```

3. **Stop all services**
   ```bash
   docker-compose down
   ```

**Services:**
- Frontend: http://localhost:3004
- Backend API: http://localhost:4004
- PostgreSQL: localhost:5434
- MinIO Console: http://localhost:9005
- MinIO API: http://localhost:9004

---

## 📚 Documentation

- **[STRUCTURE.md](./STRUCTURE.md)** - Complete system architecture and codebase structure
- **[auto-label.md](./auto-label.md)** - Auto label PDF logic and pattern matching (Exact Match)
- **[template-learning-task.md](./template-learning-task.md)** - Template optimization from manual labels
- **[CLAUDE.md](./CLAUDE.md)** - AI assistant guidelines
- **[parse-data.md](./parse-data.md)** - Data parsing logic for OCR text
- **[task-runner.md](./task-runner.md)** - Infinite Worker Loop + SSE Logging pattern

---

## 🏗️ Tech Stack

### Frontend
- **Next.js** 16.0.10 (with Turbopack)
- **React** 19.2.3
- **TypeScript** 5.x
- **Tailwind CSS** 3.4.17 (Utility-first CSS framework)
- **ESLint** 9.x

### Backend
- **NestJS** (Node.js + TypeScript)
- **PostgreSQL** 16
- **TypeORM**
- **MinIO** (S3-compatible object storage)

### Infrastructure
- **Docker** & **Docker Compose**
- **Typhoon OCR API** (3-key rotation)

---

## 📋 Features

### 6-Stage Document Processing Pipeline

```
01-RAW → 02-GROUP → 03-PDF-LABEL → 04-EXTRACT → 05-REVIEW → 06-UPLOAD
```

1. **Stage 01: Raw Images**
   - Upload JPEG document images
   - File validation and storage

2. **Stage 02: Group**
   - OCR processing with Typhoon API
   - Automatic file grouping by bookmarks
   - Infinity Loop mode for continuous processing

3. **Stage 03: PDF Label**
   - Pattern matching with **Exact Match** (normalized text comparison)
   - Multi-page document detection
   - Template-based categorization (Database-driven)
   - AND/OR logic + Negative patterns

4. **Stage 04: Extract Data**
   - Structured data extraction from labeled PDFs

5. **Stage 05: Review**
   - Manual review and validation interface

6. **Stage 06: Upload**
   - Final document upload to destination

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

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

# Typhoon OCR API Keys (3 keys for rotation)
TYPHOON_OCR_API_KEY_1=your_key_1
TYPHOON_OCR_API_KEY_2=your_key_2
TYPHOON_OCR_API_KEY_3=your_key_3

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:4004
```

### Templates Configuration

Templates are stored in PostgreSQL database (table: `templates`).
Manage templates via:
- **API:** `/templates` endpoints (GET, POST, PUT, DELETE)
- **Frontend:** Templates management page (coming soon)

Example template structure:

```json
{
  "name": "ตราสาร",
  "firstPagePatterns": [
    ["ข้อบังคับ", "หมวดที่", "ชื่อ", "เครื่องหมาย"]
  ],
  "lastPagePatterns": [
    ["ลงนาม", "ผู้จัดทำข้อบังคับ"]
  ],
  "firstPageNegativePatterns": [
    ["แก้ไข"], ["เปลี่ยนแปลง"]
  ],
  "isSinglePage": false,
  "isActive": true,
  "category": "เอกสารมูลนิธิ",
  "sortOrder": 0
}
```

---

## 🔧 Development

### Project Structure

```
OCR-flow-v2/
├── frontend/          # Next.js 16 application
├── backend/           # NestJS API
├── templates/         # Example PDF templates (for reference)
├── docs/              # Documentation files
├── auto-label.md      # Auto label logic (Stage 2)
├── parse-data.md      # Parse data logic (Stage 3)
├── task-runner.md     # Infinite Worker Loop pattern
├── STRUCTURE.md       # System architecture
├── CLAUDE.md          # AI assistant guidelines
├── docker-compose.yml # Docker orchestration
└── README.md          # This file
```

### Key Scripts

**Frontend:**
```bash
npm run dev      # Start dev server (Turbopack)
npm run build    # Production build
npm start        # Start production server
npm run lint     # Run ESLint
```

**Backend:**
```bash
npm run start:dev  # Start dev server (watch mode)
npm run build      # Production build
npm start          # Start production server
npm test           # Run tests
```

---

## 🐛 Troubleshooting

### Backend Connection Issues

If you see "Backend server is not running" warning in the frontend:

1. **Check backend is running:**
   ```bash
   curl http://localhost:4004
   ```

2. **Start backend manually:**
   ```bash
   cd backend
   npm run start:dev
   ```

3. **Check Docker services:**
   ```bash
   docker-compose ps
   docker-compose logs backend
   ```

### Database Issues

**Reset database:**
```bash
docker-compose down -v
docker-compose up -d
```

### Node Version Issues

Ensure you're using Node.js 20+:
```bash
node --version  # Should be v20.9.0 or higher
nvm use 20      # Switch to Node 20 if using nvm
```

---

## 📊 Database Schema

### Tables

- **files** - All files (Stage 01: upload + Stage 02: grouping metadata)
- **groups** - Group metadata (isComplete, isLabeled, isParseData)
- **labeled_files** - Pattern-matched and labeled documents
- **templates** - Template configurations (Database-driven)

See [STRUCTURE.md](./STRUCTURE.md#database-schema) for complete schema.

---

## 🎯 Upgrade Notes

### Recent Updates (2025-12-13)

- ✅ Upgraded to **Next.js 16.0.10** (Turbopack stable)
- ✅ Upgraded to **React 19.2.3**
- ✅ Upgraded to **Node.js 20.19.6**
- ✅ **Migrated to Tailwind CSS 3.4.17** (全面替換 CSS Modules)
  - Converted all components to use Tailwind utility classes
  - Removed all CSS Module files (`.module.css`)
  - Updated globals.css with Tailwind directives (`@tailwind base/components/utilities`)
  - Configured PostCSS with `tailwindcss` and `autoprefixer`
  - Configured custom animations (pulse, infinityGlow) in `tailwind.config.ts`
  - Preserved all CSS custom properties for dark/light theme support
- ✅ Added **SSE reconnection logic** (max 5 attempts, exponential backoff)
- ✅ Added **health check monitoring** (5-minute timeout detection)
- ✅ Improved **error handling** (silent fail for backend offline)
- ✅ Added **backend status indicator** in UI

### Breaking Changes

**Next.js 16 Requirements:**
- Node.js ≥20.9.0 (previously supported 18.x)
- React 19.x (previously 18.x)

**Tailwind CSS 3 Migration:**
- CSS Modules are no longer used - all styling is now done with Tailwind utility classes
- Using Tailwind CSS v3.4.17 (stable version) compatible with Next.js 16
- `@tailwind` directives in globals.css for base, components, and utilities
- PostCSS configured with `tailwindcss` and `autoprefixer`
- Custom animations defined in `tailwind.config.ts` instead of separate CSS files

---

## 📖 Resources

### Documentation
- [Next.js 16 Docs](https://nextjs.org/docs)
- [NestJS Docs](https://docs.nestjs.com)
- [TypeORM Docs](https://typeorm.io)
- [MinIO Docs](https://min.io/docs)

### External APIs
- **Typhoon OCR API** - Thai language OCR service

---

## 👥 Team

**OCR Flow Development Team**

---

## 📝 License

[Your License Here]

---

## 🤝 Contributing

1. Read [CLAUDE.md](./CLAUDE.md) for AI assistant guidelines
2. Read [STRUCTURE.md](./STRUCTURE.md) for system architecture
3. Follow existing code patterns and conventions
4. Update documentation when making changes

---

**Last Updated:** 2025-12-14
