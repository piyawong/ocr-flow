# Database Management Scripts

> **Scripts สำหรับจัดการ Database**

---

## 📋 Scripts Available

### 1. Reset Database (Keep Templates Only) ⭐ RECOMMENDED

**File:** `reset-db-keep-templates.sh`

**การทำงาน:**
1. ✅ Backup templates table
2. ✅ Flush all data จากทุก table
3. ✅ Restore templates กลับมา
4. ✅ Verify ข้อมูล

**วิธีใช้:**
```bash
# From project root
./backend/scripts/reset-db-keep-templates.sh
```

**ผลลัพธ์:**
- Templates ถูกเก็บไว้ทั้งหมด
- ข้อมูลอื่นทั้งหมดถูกลบ (files, groups, labeled_files, documents, users, etc.)
- Backup templates ถูกสร้างใน `backend/backups/templates_YYYYMMDD_HHMMSS.sql`

**หลังรัน script:**
1. Restart backend: `docker-compose restart backend`
2. สร้าง admin user ใหม่: `POST /auth/init-admin`
3. เริ่มใช้งานใหม่

---

### 2. Backup Templates Only

**File:** `backup-templates.sh`

**การทำงาน:**
- Backup เฉพาะ templates table ลง `backend/backups/`

**วิธีใช้:**
```bash
./backend/scripts/backup-templates.sh
```

**Output:**
```
✅ Templates backed up to: ./backend/backups/templates_20251219_143025.sql
📊 Backup size: 12K
📝 Records backed up: 15
```

---

### 3. SQL Script (Manual Run)

**File:** `backup-and-flush-db.sql`

**การทำงาน:**
- SQL script สำหรับรันใน psql หรือ pgAdmin โดยตรง

**วิธีใช้:**
```bash
# Using Docker
docker exec -i postgres-ocr psql -U postgres -d ocrflow < backend/scripts/backup-and-flush-db.sql

# Using psql directly
psql -h localhost -p 5434 -U postgres -d ocrflow -f backend/scripts/backup-and-flush-db.sql
```

---

## 🚀 Quick Start

### Reset Database แบบเร็ว (ใช้บ่อยที่สุด)

```bash
# 1. Run reset script
./backend/scripts/reset-db-keep-templates.sh

# 2. Restart backend
docker-compose restart backend

# 3. Create admin user (in another terminal or Postman)
curl -X POST http://localhost:4004/auth/init-admin

# 4. Done! You can now login with:
# Email: admin@ocrflow.local
# Password: admin123
```

---

## 📊 การทำงานของ Scripts

### Reset Flow Diagram

```
┌─────────────────────┐
│  Original State     │
│  - templates: 15    │
│  - files: 100       │
│  - groups: 5        │
│  - labeled_files: 50│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Step 1: Backup     │
│  templates → backup │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Step 2: Flush      │
│  TRUNCATE all tables│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Step 3: Restore    │
│  backup → templates │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Final State        │
│  - templates: 15 ✅ │
│  - files: 0 ✅      │
│  - groups: 0 ✅     │
│  - labeled_files: 0✅│
│  - documents: 0 ✅  │
│  - users: 0 ✅      │
└─────────────────────┘
```

---

## 🔍 Verification

**หลังรัน reset script ให้ตรวจสอบ:**

```bash
# Check templates count
docker exec -i postgres-ocr psql -U postgres -d ocrflow -c "SELECT COUNT(*) FROM templates;"

# Check all tables
docker exec -i postgres-ocr psql -U postgres -d ocrflow -c "
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.tables t WHERE t.table_name = tables.table_name) as exists,
  pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
"
```

---

## ⚠️ Important Notes

### Templates ที่ถูกเก็บไว้
- ✅ ข้อมูล templates ทั้งหมด (patterns, categories, context rules)
- ✅ Template configurations (isActive, sortOrder)

### ข้อมูลที่ถูกลบ
- ❌ Users (ต้องสร้าง admin ใหม่)
- ❌ Files (แต่ไฟล์ใน MinIO ยังอยู่)
- ❌ Groups
- ❌ Labeled Files
- ❌ Documents
- ❌ Foundation Instruments
- ❌ Committee Members

### MinIO Files
- ⚠️ ไฟล์ใน MinIO **ไม่ถูกลบ**
- ถ้าต้องการลบไฟล์ใน MinIO:
  ```bash
  # Using MinIO Console
  # 1. เปิด http://localhost:9005
  # 2. Login: minioadmin/minioadmin
  # 3. Delete bucket: ocr-documents
  # 4. Create bucket ใหม่: ocr-documents
  ```

---

## 🔄 Restore Templates from Backup

ถ้าต้องการ restore templates จาก backup:

```bash
# List backups
ls -lh backend/backups/

# Restore specific backup
docker exec -i postgres-ocr psql -U postgres -d ocrflow < backend/backups/templates_20251219_143025.sql
```

---

## 🛠️ Troubleshooting

### Issue 1: Permission Denied

```bash
# Fix: Make scripts executable
chmod +x backend/scripts/*.sh
```

### Issue 2: Docker Container Not Found

```bash
# Check container name
docker ps

# Update script with correct container name
# Default: postgres-ocr
# If different, edit script and change "postgres-ocr" to your container name
```

### Issue 3: Templates Not Restored

```bash
# Check if backup file exists
ls -lh backend/backups/

# Manually restore
docker exec -i postgres-ocr psql -U postgres -d ocrflow < backend/backups/templates_YYYYMMDD_HHMMSS.sql
```

---

## 📝 Example Output

```
╔════════════════════════════════════════════════════════════════╗
║     Reset Database (Keep Templates Only)                      ║
╚════════════════════════════════════════════════════════════════╝

📦 Step 1: Backing up templates...
   ✅ Backed up 15 templates to: ./backend/backups/templates_20251219_143025.sql

🗑️  Step 2: Flushing all data...
   ✅ Database flushed successfully

🔍 Step 3: Verifying...
 templates: 15
 files: 0
 groups: 0
 labeled_files: 0
 documents: 0
 users: 0

╔════════════════════════════════════════════════════════════════╗
║  ✅ Reset Complete!                                            ║
╠════════════════════════════════════════════════════════════════╣
║  📁 Templates kept: 15 records                                 ║
║  🗑️  All other data deleted                                    ║
║  💾 Backup saved: ./backend/backups/templates_20251219_143025.sql
╠════════════════════════════════════════════════════════════════╣
║  📝 Next Steps:                                                ║
║  1. Restart backend: docker-compose restart backend           ║
║  2. Create admin user: POST /auth/init-admin                  ║
║  3. Start fresh with upload -> group -> label                 ║
╚════════════════════════════════════════════════════════════════╝
```

---

## 💡 Use Cases

### Use Case 1: Development Testing
```bash
# Reset database to test from scratch
./backend/scripts/reset-db-keep-templates.sh
docker-compose restart backend
curl -X POST http://localhost:4004/auth/init-admin
```

### Use Case 2: Before Running Migration
```bash
# Clean slate before migration
./backend/scripts/reset-db-keep-templates.sh
docker-compose restart backend
psql -h localhost -p 5434 -U postgres -d ocrflow -f backend/migrations/add-documents-table.sql
```

### Use Case 3: Fix Corrupted Data
```bash
# Reset if data is corrupted
./backend/scripts/reset-db-keep-templates.sh
# Templates are safe, start fresh with new uploads
```

---

**Created:** 2025-12-19
**Updated:** 2025-12-19
