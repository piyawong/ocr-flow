# Frontend Architecture - OCR Flow v2

> **เอกสารฉบับนี้:** รวบรวมรายละเอียดสถาปัตยกรรม Frontend ทั้งหมด
> **อัปเดตล่าสุด:** 2025-12-19
> **สำหรับ:** นักพัฒนา Frontend (Developer Documentation)

---

## 📑 สารบัญ (Table of Contents)

1. [Tech Stack](#-tech-stack)
2. [Styling System](#-styling-system)
3. [Project Structure](#-project-structure)
4. [Pages (Stages)](#-pages-stages)
   - [Stage 01: Raw Upload](#stage-01-raw-upload-stagesraw)
   - [Stage 02: Group](#stage-02-group-stagesgroup)
   - [Stage 03: PDF Label](#stage-03-pdf-label-stagespdf-label)
   - [Stage 04: Extract](#stage-04-extract-stagesextract)
   - [Stage 05: Review](#stage-05-review-stagesreview)
   - [Stage 06: Upload](#stage-06-upload-stagesupload)
5. [Shared Components](#-shared-components)
6. [UI/UX Patterns](#-uiux-patterns)
7. [Keyboard Shortcuts](#-keyboard-shortcuts)
8. [API Integration](#-api-integration)
9. [Real-time Features (SSE)](#-real-time-features-sse)

---

## 🛠 Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 16.0.10 | Framework (App Router with Turbopack) |
| **React** | 19.2.3 | UI Library |
| **Tailwind CSS** | 3.4.17 | Utility-first CSS Framework |
| **dnd-kit** | ^6.3.1 (core), ^10.0.0 (sortable) | Drag-and-Drop สำหรับ page reordering |
| **PostCSS** | Latest | CSS Processing (tailwindcss + autoprefixer) |

### เหตุผลการเลือก Tech Stack

- **Next.js App Router**: Server Components, Streaming, และ Turbopack สำหรับ development speed
- **React 19**: ใช้ Hooks (useState, useEffect) สำหรับ state management
- **Tailwind CSS**: Rapid UI development, consistent design system
- **dnd-kit**: Accessible และ performant drag-and-drop library

---

## 🎨 Styling System

### Tailwind CSS Configuration

**ไฟล์:** `tailwind.config.ts`

#### Custom Colors
```typescript
colors: {
  accent: '#3b82f6',    // Primary accent (blue)
  success: '#22c55e',   // Success state (green)
  warning: '#f59e0b',   // Warning state (amber)
  danger: '#ef4444',    // Error/danger state (red)
}
```

#### Custom Animations
```typescript
animations: {
  pulse: '2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  infinityGlow: 'glow 2s ease-in-out infinite alternate',
}
```

### Global Styles

**ไฟล์:** `src/app/globals.css`

- Import Tailwind directives
- Define CSS custom properties
- Theme support (Dark/Light mode)

### Theme System

#### Theme Toggle
- **Attribute-based**: `data-theme="light"` หรือ `data-theme="dark"`
- **CSS Variables**: ใช้ CSS custom properties สำหรับ colors
- **Component**: `<ThemeProvider>` wrapper ทั้ง app

#### Template Color Coding
ระบบใช้ **10 สีสลับกัน** สำหรับแยก template types:

```typescript
const TEMPLATE_COLORS = [
  'bg-blue-500',    // Color 1
  'bg-green-500',   // Color 2
  'bg-yellow-500',  // Color 3
  'bg-red-500',     // Color 4
  'bg-purple-500',  // Color 5
  'bg-pink-500',    // Color 6
  'bg-indigo-500',  // Color 7
  'bg-orange-500',  // Color 8
  'bg-teal-500',    // Color 9
  'bg-cyan-500',    // Color 10
];
```

**ใช้ที่:**
- Left Sidebar (Page List) - แถบสีด้านซ้ายของแต่ละหน้า
- Template Badge - จุดสีหน้าชื่อ template
- Thumbnail Border - border สีรอบ thumbnail

### Font Families

```css
font-family:
  Sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto
  Mono: "SF Mono", Monaco, Inconsolata, "Fira Mono"
```

---

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── stages/
│   │   │   ├── 01-raw/         # Stage 01: Upload
│   │   │   ├── 02-group/       # Stage 02: Grouping
│   │   │   ├── 03-pdf-label/   # Stage 03: PDF Label
│   │   │   │   └── manual/
│   │   │   │       └── [groupId]/ # Manual Label page
│   │   │   ├── 04-extract/     # Stage 04: Extract
│   │   │   │   └── [groupId]/  # Detail view
│   │   │   ├── 05-review/      # Stage 05: Final Review
│   │   │   │   └── [groupId]/  # Review detail
│   │   │   └── 06-upload/      # Stage 06: Upload
│   │   ├── documents/
│   │   │   └── [groupId]/      # Documents viewer (New Window)
│   │   ├── templates/          # Template Management
│   │   ├── globals.css         # Global styles
│   │   └── layout.tsx          # Root layout
│   └── components/             # Shared components
│       ├── Navbar.tsx
│       ├── StageTabs.tsx
│       ├── ThemeProvider.tsx
│       └── AuthGuard.tsx
└── tailwind.config.ts
```

---

## 📄 Pages (Stages)

### Stage 01: Raw Upload (`/stages/01-raw`)

#### หน้าที่ (Purpose)
อัพโหลดไฟล์ดิบ (images/PDFs) และแสดงรายการไฟล์พร้อมสถานะการประมวลผล

#### Features

##### 1. Enhanced Status Card
| Component | Description |
|-----------|-------------|
| **Progress Bar** | แสดง processing progress (processed/total files) พร้อม percentage |
| **Real-time Stats** | Processed count, Pending count |
| **Last Activity** | Timestamp ของกิจกรรมล่าสุด (เมื่อ task กำลังรัน) |
| **Status Indicator** | Dynamic: Processing / Ready / All Processed |

##### 2. Compact Terminal Mode
- **Default Mode**: Compact view แสดง summary + recent important logs
- **Toggle Button**: "📋 Full Logs" / "📊 Compact" สลับโหมด
- **Filter**: กรองออก repetitive "waiting" messages ใน compact mode
- **Summary Display**: processed count, pending count, last activity

##### 3. Improved File Table

**Features:**
- Preview thumbnails ขนาด **100x100px** (เดิม 60x60px)
- Hover effect: `scale-105` transition
- Click thumbnail → เปิด full preview modal

**Columns:**
| Column | Type | Description |
|--------|------|-------------|
| Preview | Image | Thumbnail with hover effect |
| File Number | Number | Auto-increment file number |
| File Name | Text | Original filename |
| Status | Badge | Processing / Processed |
| Created At | DateTime | Upload timestamp |
| Actions | Buttons | View, Delete |

##### 4. Quick Actions
- **👁️ View Button**: เปิด full image preview modal
- **🗑️ Delete Button**: ลบไฟล์ (พร้อม confirmation dialog)

##### 5. Image Preview Modal

**Layout:**
```
┌──────────────────────────────────────┐
│ [Header: Filename + Status + Date]  │
├──────────────────────────────────────┤
│                                      │
│         [Image - Max 90vh]           │
│                                      │
├──────────────────────────────────────┤
│ [Actions: Download + Delete]        │
└──────────────────────────────────────┘
```

**Styling:**
- Background: `bg-black/90` พร้อม backdrop blur
- Max height: 90vh
- Object-fit: contain

##### 6. View Mode Toggle

| Mode | Description | Default |
|------|-------------|---------|
| **All Files** | แสดงทุกไฟล์ (processed + pending) | No |
| **Progress** | แสดงเฉพาะไฟล์ที่ยังไม่ processed | **Yes** |

**Behavior:**
- ไฟล์ที่ processed เสร็จจะหายไปทันทีใน Progress mode
- Toggle buttons แสดงจำนวน pending files: "Progress (X)"

##### 7. Real-time Updates via SSE

**Event Types:**
- `FILE_PROCESSED`: อัปเดท progress bar
- `FILE_CREATED`: เพิ่มไฟล์ใหม่
- `FILE_UPDATED`: อัปเดทสถานะ

**Updates:**
- Progress bar และ percentage
- Processed/Pending counts
- Last activity timestamp
- File table (auto-refresh)

#### API Calls

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/files` | GET | ดึงรายการไฟล์ทั้งหมด |
| `/files/upload` | POST | อัพโหลดไฟล์ใหม่ |
| `/files/:id` | DELETE | ลบไฟล์ |
| `/files/:id/preview` | GET | ดึงรูปภาพ preview |
| `/task-runner/logs` | SSE | Real-time logs |

#### UI Components Tree

```
Stage01Page
├── StatusCard
│   ├── ProgressBar
│   ├── StatsGrid (Processed, Pending)
│   └── LastActivity
├── TerminalComponent
│   ├── ToggleButton (Compact/Full)
│   ├── Summary (Compact mode)
│   └── LogsList (Full mode)
├── ViewModeToggle (All Files / Progress)
├── FileTable
│   ├── ThumbnailCell (with hover)
│   ├── FileInfoCell
│   ├── StatusBadge
│   └── ActionButtons
└── ImagePreviewModal
    ├── Header
    ├── ImageDisplay
    └── ActionButtons
```

---

### Stage 02: Group (`/stages/02-group`)

#### หน้าที่ (Purpose)
จัดกลุ่มไฟล์ที่เกี่ยวข้องกัน และรัน label PDF process

#### Features

##### 1. Enhanced Status Card

**Components:**
| Component | Description |
|-----------|-------------|
| **Progress Bar** | Labeling progress (labeled/total groups) พร้อม % |
| **Real-time Stats** | Labeled count, Pending count |
| **Last Activity** | Timestamp ล่าสุดที่มีการ label |
| **Status Indicator** | Processing / Ready / All Matched / No Groups |
| **Detailed Metrics** | Total Groups, Total Pages, Match Status |

**Match Status Display:**
- "All Matched 100%" - สีเขียว
- "Labeled X%" - สีน้ำเงิน
- "Partial X%" - สีเหลือง

##### 2. Compact Terminal Mode

**Modes:**
- **Compact Mode**: Summary + Recent 5 logs (กรอง waiting messages)
- **Full Logs Mode**: ทุก logs แบบ scrollable

**Toggle Button**: "📋 Full Logs" ⇄ "📊 Compact"

##### 3. View Mode Toggle

| Mode | Description | Default |
|------|-------------|---------|
| **Unlabeled** | แสดง groups ที่ `isLabeled = false` | **Yes** |
| **Labeled** | แสดง groups ที่ label แล้ว พร้อม match % | No |

##### 4. Table Display

**Unlabeled Mode:**

| Column | Type | Description |
|--------|------|-------------|
| Group ID | Number | Auto-increment group number |
| File Count | Number | จำนวนไฟล์ใน group |
| Status | Badge | Complete / Incomplete |
| Actions | Button | "View" button |

**Labeled Mode:**

| Column | Type | Description |
|--------|------|-------------|
| Group ID | Number | Auto-increment group number |
| File Count | Number | จำนวนไฟล์ใน group |
| Match % | Progress | Match percentage พร้อม color coding |
| Status | Badge | All Matched / Partial / No Match |
| Actions | Button | "Review" button |

##### 5. Lazy Loading

**Optimization Strategy:**
1. **Initial Load**: Fetch เฉพาะ group metadata
   - groupNumber
   - fileCount
   - isComplete
   - isLabeled
   - createdAt
2. **On-Demand**: Click group → Fetch files ของ group นั้นๆ
3. **Benefits**: ลด bandwidth, เพิ่มความเร็ว

##### 6. SSE Connections

**Multiple SSE Streams:**

| Stream | Endpoint | Purpose |
|--------|----------|---------|
| **SSE #1** | `/label-runner/logs` | Label task logs + GROUP_PROCESSED |
| **SSE #2** | `/files/events` | GROUP_COMPLETE events |
| **SSE #3** | `/task-runner/logs` | Real-time group creation จาก Stage 01 |

##### 7. Real-time Updates

**Event Handling:**
- `GROUP_PROCESSED`: อัปเดท progress bar, counts
- `GROUP_COMPLETE`: Refresh groups list
- `FILE_PROCESSED`: อัปเดท last activity

**Auto-behavior:**
- Groups ที่ label เสร็จจะหายไปทันทีใน Unlabeled mode
- Progress bar อัปเดทแบบ real-time

##### 8. Processed Tracking

**Features:**
- Filter out groups ที่ label แล้ว (ไม่แสดงใน Unlabeled table)
- ป้องกันการประมวลผลซ้ำ (skip processed groups)
- Status card แสดง labeled pages และ overall progress

##### 9. Reset Functions

**Reset Label Progress:**
- ปุ่ม: "Reset Label Progress"
- API: `POST /labeled-files/clear`
- **Effect**: Clear labeled_files + reset `groups.isLabeled`
- **Note**: ไม่ลบ groups (เฉพาะ reset label data)

**Revert All Groups:**
- ปุ่ม: "Revert All Groups"
- API: `POST /files/clear-grouping`
- **Effect**:
  - Clear `files.groupId`, `orderInGroup`, `ocrText`, `isBookmark`
  - Delete ทุก groups
  - **CASCADE DELETE**: labeled_files ถูก delete อัตโนมัติ
- **Warning**: ต้อง rerun ทั้ง grouping และ labeling

#### API Calls

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/files/groups` | GET | ดึง groups metadata |
| `/files/group/:id` | GET | ดึงไฟล์ของ group (lazy load) |
| `/labeled-files/processed-groups` | GET | ดึง label status ของ groups |
| `/label-runner/start` | POST | เริ่ม label process |
| `/label-runner/stop` | POST | หยุด label process |
| `/labeled-files/clear` | POST | Reset label progress |
| `/files/clear-grouping` | POST | Revert all groups |
| `/label-runner/logs` | SSE | Real-time label logs |
| `/files/events` | SSE | Real-time group events |
| `/task-runner/logs` | SSE | Real-time task logs |

#### UI Components Tree

```
Stage02Page
├── StatusCard
│   ├── ProgressBar (labeled/total)
│   ├── MetricsGrid
│   │   ├── TotalGroups (labeled + pending)
│   │   ├── TotalPages
│   │   └── MatchStatus
│   └── LastActivity
├── TerminalComponent
│   ├── ModeToggle (Compact/Full)
│   ├── CompactView (Summary + Recent 5)
│   └── FullLogsView (Scrollable)
├── ActionButtons
│   ├── StartButton
│   ├── StopButton
│   ├── ResetLabelButton
│   └── RevertGroupsButton
├── ViewModeToggle (Unlabeled/Labeled)
└── GroupsTable
    ├── GroupRow (with lazy load)
    ├── FileCountCell
    ├── MatchProgressCell (Labeled mode)
    ├── StatusBadge
    └── ActionButton
```

---

### Stage 03: PDF Label (`/stages/03-pdf-label`)

#### หน้าที่ (Purpose)
แสดงรายการ groups ที่ label แล้ว และให้ user review/แก้ไข labels

#### Features

##### 1. Auto Label All Feature

**Controls:**
- ปุ่ม "🚀 Start Auto Label All" - เริ่ม auto label ทุก group (infinite loop)
- ปุ่ม "⏸️ Stop Auto Label" - หยุด label process

**Terminal Component:**
- **Compact Mode**: Summary + recent 10 logs (กรอง waiting messages)
- **Full Logs Mode**: ทุก logs แบบ scrollable
- **Clear Logs Button**: ลบ logs

**SSE Connection:**
- Endpoint: `/label-runner/logs`
- Events: Label progress, GROUP_PROCESSED
- **Auto-refresh**: Refresh groups list เมื่อ label เสร็จ

##### 2. Filters

**Review Status Filter:**

| Filter | Condition | Default |
|--------|-----------|---------|
| **Unreviewed Only** | `isUserReviewed = false` | **Yes** |
| **All Groups** | Show all groups | No |

**Match % Filter:**

| Filter | Condition |
|--------|-----------|
| **All** | Show all groups |
| **100% Matched** | Match percentage = 100% |
| **Not 100%** | Match percentage < 100% |

##### 3. Table Display

**Columns:**

| Column | Type | Description | Color Coding |
|--------|------|-------------|--------------|
| Group # | Number | Group number | - |
| Total Pages | Number | Total pages in group | - |
| Matched | Number | Pages ที่ matched | - |
| Unmatched | Number | Pages ที่ไม่ match | - |
| Match % | Progress | Percentage พร้อม bar | Green: 100%, Yellow: < 100% |
| Status | Badge | All Matched / Partial / No Match | Green / Yellow / Red |
| Reviewed | Badge | "✓ Reviewed" / "⚠ Pending" | Green / Yellow |
| Reviewer | Text | ชื่อผู้ review | - |
| Actions | Button | "Review" button | - |

##### 4. Group Visibility Rules

**Group จะหายจากรายการ (Unreviewed Only mode) เมื่อ:**
1. User กด **Save** ใน Manual Label page
2. **AND** Group นั้น match 100% (ทุกหน้า labeled แล้ว)
3. → จะ mark `isUserReviewed = true`
4. → Group หายจากรายการ (filter "Unreviewed Only")

#### API Calls

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/files/groups` | GET | ดึง labeled groups |
| `/label-runner/start` | POST | เริ่ม auto label |
| `/label-runner/stop` | POST | หยุด auto label |
| `/label-runner/logs-history` | GET | ดึง log history |
| `/label-runner/clear-logs` | POST | ลบ logs |
| `/label-runner/logs` | SSE | Real-time logs |

---

### Stage 03.1: Manual Label Page (`/stages/03-pdf-label/manual/[groupId]`)

#### หน้าที่ (Purpose)
หน้าสำหรับ manual label PDFs แบบ interactive พร้อม keyboard shortcuts

#### UI Layout

```
┌────────────────────────────────────────────────────────┐
│                    [Header]                            │
├──────────┬────────────────────────┬────────────────────┤
│          │                        │                    │
│  Page    │    PDF/Image          │   Label Info      │
│  List    │    Preview            │   Quick Select    │
│  (256px) │    (Center)           │   Templates       │
│          │                        │   OCR Text        │
│          │                        │   (320px)         │
│          │  [Zoom + Rotate]       │                    │
└──────────┴────────────────────────┴────────────────────┘
```

#### Layout Sections

##### Left Sidebar - Page List (256px)

**Features:**
- List of all pages in group
- **Color Coding**: แถบสีด้านซ้าย + จุดสี (ตาม template)
- **Drag Handles**: ⋮⋮ icon สำหรับ reorder
- **Template Name**: แสดงชื่อ template ที่ assigned
- **Status Icons**: START / CONTINUE / END / SINGLE / UNMATCHED

**Drag-and-Drop Reordering:**
- Library: **dnd-kit**
- **Features**:
  - Drag handle (⋮⋮) เพื่อจับลาก
  - Smooth animation
  - **Auto-save** เมื่อ drop
  - Visual feedback (opacity, ghost element)

**Template Colors:**
```typescript
// 10 สีสลับกัน
const COLORS = [
  'blue', 'green', 'yellow', 'red', 'purple',
  'pink', 'indigo', 'orange', 'teal', 'cyan'
];
```

##### Center Panel - PDF/Image Preview

**Display:**
- Full size preview (object-fit: contain)
- Max dimensions: fit viewport
- High quality rendering

**Controls:**

| Control | Icon | Action |
|---------|------|--------|
| Zoom In | 🔍+ | เพิ่มขนาดรูป |
| Zoom Out | 🔍- | ลดขนาดรูป |
| Reset Zoom | ⟲ | รีเซ็ตขนาด 100% |
| Rotate Left | ↶ | หมุนซ้าย 90° |
| Rotate Right | ↷ | หมุนขวา 90° |

**Rotate Feature:**
- หมุนรูปภาพ 90 องศา (ซ้าย/ขวา)
- **บันทึกลงไฟล์จริง** (ไม่ใช่แค่ display)
- API: `POST /labeled-files/:id/rotate`

##### Right Panel - Label Info (320px)

**Sections:**

1. **Quick Select**
   - START / END buttons
   - Current selection display

2. **Templates List**
   - Scrollable list
   - Search box
   - Template categories
   - Color dots

3. **OCR Text**
   - Full text display
   - Scrollable
   - Whitespace preserved

#### Features

##### 1. Template Selection

**Methods:**
- Click template จาก list
- Keyboard shortcut (1-9)
- Template Modal (กด T)

**Template Modal:**
- Search functionality
- Category grouping
- Color coding
- Keyboard navigation (↑↓ Enter Esc)

##### 2. START/END Selection

**Flow:**
1. เลือก START page (กด Space)
2. เลือก END page (กด Space อีกครั้ง)
3. เลือก template
4. → ทุกหน้าระหว่าง START-END จะถูก assign template นี้

**Visual Feedback:**
- START page: 🟢 Green border
- END page: 🔴 Red border
- Selected range: Highlighted background

##### 3. Keyboard Shortcuts

| Key | Action | Description |
|-----|--------|-------------|
| **Space** | Toggle START/END | เลือกหน้า START หรือ END |
| **Arrow ←** | Previous Page | ไปหน้าก่อนหน้า |
| **Arrow →** | Next Page | ไปหน้าถัดไป |
| **Arrow ↑** | Scroll Up | เลื่อนขึ้นใน page list |
| **Arrow ↓** | Scroll Down | เลื่อนลงใน page list |
| **T** | Open Template Modal | เปิด modal เลือก template |
| **1-9** | Quick Assign | Assign template ลำดับที่ 1-9 |
| **C** | Clear Selection | ยกเลิกการเลือก START/END |
| **Esc** | Close Modal | ปิด modal ที่เปิดอยู่ |
| **H** | Show Shortcuts | แสดงรายการ shortcuts |
| **Cmd+S** | Save | บันทึกการเปลี่ยนแปลง |

##### 4. Save Flow with Notes

**Step 1: Reviewer Name Check**
- ถ้ายังไม่ได้ตั้งชื่อ → เด้ง modal ให้ใส่ชื่อ
- ชื่อจะถูกบันทึกใน localStorage (`ocr-flow-reviewer-name`)

**Step 2: Review Notes Modal (แสดงเสมอ)**

**Behavior ตาม Match %:**

| Match % | Modal Message | Button Text |
|---------|--------------|-------------|
| **100%** | "จะ mark as reviewed และ trigger auto-parse" | "Save & Mark as Reviewed" |
| **< 100%** | "จะ NOT mark as reviewed จนกว่าจะ 100%" | "Save" |

**Keyboard Shortcuts ใน Modal:**
- **Enter** (ไม่กด Shift) → Submit ทันที (save)
- **Shift+Enter** → ขึ้นบรรทัดใหม่ (เขียน notes หลายบรรทัด)
- **Escape** → ปิด modal

**Step 3: Save & Update**

**เสมอ:**
- บันทึก `labeled_notes` ลง `groups` table

**ถ้า match 100%:**
- Update `isUserReviewed = true` ใน `labeled_files`
- Update `reviewer = <name>` ใน `labeled_files`
- Update `labeled_reviewer = <name>` ใน `groups`
- Update `is_labeled_reviewed = true` ใน `groups`
- **Auto-trigger Parse Data** → รัน parse ทันทีใน background
- Parse ทำงาน asynchronously (user ไม่ต้องรอ)
- ข้อมูลจะปรากฏใน Stage 04 เมื่อ parse เสร็จ

**ถ้า match < 100%:**
- **ไม่** update `isUserReviewed`
- Group ยังคงแสดงใน Stage 03

**หลัง save เสร็จ:**
- ✅ **No Auto-Jump**: คงอยู่หน้าเดิม (ไม่เด้งไปหน้า unmatch)

##### 5. Unsaved Changes Warning

**Behavior:**
- ถ้ามีการเปลี่ยนแปลงยังไม่ save
- User พยายามออกจากหน้า
- → แสดง confirmation dialog

#### API Calls

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/labeled-files/group/:groupId` | GET | ดึงข้อมูล labeled files |
| `/labeled-files/:id` | PATCH | อัปเดต label ของ 1 page |
| `/labeled-files/group/:groupId/bulk-update` | PATCH | อัปเดต labels หลาย pages |
| `/labeled-files/:id/rotate` | POST | หมุนรูปภาพ |
| `/labeled-files/group/:groupId/reorder` | POST | เปลี่ยนลำดับหน้า |
| `/files/parsed-group/:groupId/save-review` | POST | บันทึก review (trigger auto-parse ถ้า 100%) |
| `/templates` | GET | ดึง templates ทั้งหมด |

#### UI Components Tree

```
ManualLabelPage
├── Header
│   ├── BackButton
│   ├── GroupInfo
│   ├── ProgressIndicator (X/Y matched)
│   └── SaveButton
├── LeftSidebar (256px)
│   ├── SearchBox
│   └── PageList (DnD)
│       └── PageItem
│           ├── DragHandle (⋮⋮)
│           ├── ColorBar (template color)
│           ├── PageNumber
│           ├── TemplateBadge
│           └── StatusIcon
├── CenterPanel
│   ├── ZoomControls
│   ├── RotateButtons
│   └── ImageViewer
│       └── Image (zoomable, rotatable)
├── RightPanel (320px)
│   ├── QuickSelect
│   │   ├── StartButton
│   │   └── EndButton
│   ├── TemplatesList
│   │   ├── SearchBox
│   │   └── TemplateItems (scrollable)
│   └── OCRText (scrollable)
└── Modals
    ├── TemplateModal (Search + Select)
    ├── ReviewNotesModal (Save confirmation)
    ├── ReviewerNameModal (First-time setup)
    ├── ShortcutsModal (Help)
    └── UnsavedChangesDialog
```

---

### Stage 04: Extract (`/stages/04-extract`)

#### หน้าที่ (Purpose)
แสดงและดูข้อมูลที่ extract (parse) จาก labeled PDFs

#### Routes

| Route | Purpose | Layout |
|-------|---------|--------|
| `/stages/04-extract` | หน้าหลัก (List view) | With Navbar + Tabs |
| `/stages/04-extract/[groupId]` | Detail view (Foundation + Committee) | With Navbar + Tabs |
| `/documents/[groupId]` | 📄 Documents viewer | **No Navbar/Tabs** (Clean UI) |

---

#### หน้าหลัก (List View)

##### Summary Cards

| Card | Metric | Description |
|------|--------|-------------|
| **Parsed Groups** | Count | จำนวน groups ที่ parse แล้ว |
| **Foundation Instruments** | Count | จำนวนตราสารที่พบ |
| **Committee Members** | Count | จำนวนกรรมการทั้งหมด |

##### Table View

**Columns:**

| Column | Type | Description | Color |
|--------|------|-------------|-------|
| Group # | Number | Group number | - |
| Pages | Number | Total pages | - |
| Foundation | Badge | Yes / No | Green / Gray |
| Committee | Number | Committee members count | - |
| **Review Status** | Badge | "✓ Reviewed" / "⚠ Pending" | Green / Yellow |
| **Reviewer** | Text | ชื่อผู้ review / "Not reviewed" | - |
| Parsed At | DateTime | Parse timestamp | - |
| Actions | Button | "**Review**" button | Blue |

**Row Click:**
- Click anywhere on row → Navigate to `/stages/04-extract/[groupId]`
- Or click "Review" button

---

#### หน้า Detail (`/stages/04-extract/[groupId]`)

##### Header

**Left Section:**
- Group ID
- Foundation name
- Review status badge

**Right Section:**
- Parsed timestamp
- Reviewer name (ถ้ามี)

**Actions:**

| Button | Action | API | Condition |
|--------|--------|-----|-----------|
| **← Back** | กลับไปหน้า list | - | Always |
| **Mark as Reviewed** | Mark ว่า review แล้ว | `POST /files/parsed-group/:groupId/mark-reviewed` | ยัง review (show เฉพาะตอนนี้) |
| **Re-parse Data** | รัน parse ใหม่ | `POST /parse-runner/parse/:groupId` | Always |
| **📄 Documents** | เปิด Documents viewer | - | Always |

**Documents Button:**
- Icon: "open in new window" (↗️)
- เปิด `/documents/[groupId]` ใน **new window** (ไม่ใช่ tab!)

##### Tabs

**Tab 1: Foundation Instrument**

**Display:**

| Section | Fields |
|---------|--------|
| **Basic Info** | Name, Short Name, Address |
| **Logo** | Logo Description |
| **Charter** | หมวด → ข้อ → อนุข้อ (hierarchical) |

**Charter Structure:**
```
หมวด 1: ชื่อและที่ตั้ง
  ข้อ 1: มูลนิธินี้ชื่อว่า...
    1.1: ชื่อย่อว่า...
  ข้อ 2: ที่ตั้ง...

หมวด 2: วัตถุประสงค์
  ข้อ 3: มูลนิธินี้มีวัตถุประสงค์...
    3.1: อนุข้อ 1
    3.2: อนุข้อ 2
```

**Tab 2: Committee Members**

**Table:**

| Column | Description |
|--------|-------------|
| # | Order number |
| Name | ชื่อกรรมการ |
| Position | ตำแหน่ง (ประธาน, กรรมการ, etc.) |
| Address | ที่อยู่ |
| Phone | เบอร์โทรศัพท์ |

---

#### ⚠️ Read-only View

**Important:**
- **ไม่สามารถแก้ไขข้อมูลโดยตรง** (ทั้ง Detail page และ Documents viewer)
- ถ้าต้องการแก้ไข → **Re-parse** หรือแก้ที่ **Stage 05 (Review)**

#### ✅ Auto-parse Integration

**Workflow:**
1. User save & review ใน Stage 03 (match 100%)
2. System trigger auto-parse ใน background
3. Parse ทำงาน asynchronously (user ไม่ต้องรอ)
4. Groups ปรากฏอัตโนมัติใน Stage 04 เมื่อ parse เสร็จ

#### API Calls

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/files/parsed-groups` | GET | List ของ groups ที่ parse แล้ว |
| `/files/parsed-group/:groupId` | GET | Detail ของ group (with relations) |
| `/labeled-files/group/:groupId` | GET | เอกสารทั้งหมดของ group |
| `/labeled-files/:id/preview` | GET | Preview รูปภาพ (thumbnails + full) |
| `/files/parsed-group/:groupId/mark-reviewed` | POST | Mark extract data as reviewed (Body: `{ reviewer: string }`) |
| `/parse-runner/parse/:groupId` | POST | Re-parse group |

---

### Stage 04.1: Documents Viewer (`/documents/[groupId]`)

#### หน้าที่ (Purpose)
📄 Full-screen document viewer (เปิดใน new window) พร้อม OCR text

#### Layout Design

**Clean Full Screen UI:**
- **ไม่มี Navbar**
- **ไม่มี Stage Tabs**
- Custom `layout.tsx` ที่ซ่อน navbar ด้วย CSS

#### 3-Panel Layout (คล้าย macOS Preview + Finder)

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

---

#### 📁 Left Sidebar - File List (256px width)

**Design: Finder-style**

**Features:**
- List of all files (Page 1, 2, 3, ...)
- **Color dots** - ตาม template (10 สีสลับ)
- **Active state** - highlight ด้วย accent color
- **Arrow indicator** (→) - แสดงหน้าที่เลือก
- **Click** - navigate ไปหน้านั้น

**Scrollable:**
- Vertical scroll เมื่อไฟล์เยอะ
- Smooth scrolling behavior

**Styling:**
```css
/* Active state */
.active {
  background: accent-color;
  border-left: 4px solid accent;
}

/* Color dot */
.color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: template-color;
}
```

---

#### 🖼️ Center Panel - Image Preview (Flex-1)

**Main Focus Area:**
- พื้นที่ใหญ่สุด
- Center aligned
- High quality rendering

**Image Display:**
```css
img {
  object-fit: contain;
  max-width: 100%;
  max-height: calc(100vh - header - thumbnail);
}
```

**Background:**
- `bg-secondary` (contrast กับ sidebar)

---

#### Bottom: Thumbnail Strip (128px height)

**Layout:**
- Horizontal scrollable thumbnails
- All pages (1-14)
- Centered alignment

**States:**

| State | Styling |
|-------|---------|
| **Selected** | `ring-2 ring-accent` + border color |
| **Inactive** | `opacity-60` |
| **Hover** | `opacity-100` + scale transition |

**Features:**
- Click → navigate ไปหน้านั้น
- Page number below thumbnail
- Smooth scroll to selected

---

#### 📝 Right Sidebar - OCR Text (320px width)

**Header:**
- Title: "OCR Result"
- Template badge (color-coded dot + name)

**Content:**
- Full OCR text
- Whitespace preserved (`whitespace-pre-wrap`)
- Vertical scrollable

**Styling:**
```css
.ocr-text {
  background: bg-secondary;
  border: 1px solid border-color;
  padding: 1rem;
  line-height: 1.75; /* leading-relaxed */
}
```

**Fallback:**
- "No OCR text available" ถ้าไม่มีข้อมูล

---

#### 🎯 Header (Minimal)

**Layout:**

| Left | Center | Right |
|------|--------|-------|
| Close button (X) | "Group X • Y Documents" | "Page X of Y" |

**Styling:**
- Height: compact (`py-2`)
- No clutter: ไม่มี view switcher

---

#### ⌨️ Keyboard Controls

| Key | Action |
|-----|--------|
| **← Arrow Left** | หน้าก่อนหน้า |
| **→ Arrow Right** | หน้าถัดไป |
| **Esc** | Close window |

**Performance:**
- Smooth & Responsive
- ไม่มี delay

---

#### 🎨 Visual Features

**Color System:**
- **10 สีสลับกัน** per template
- Consistent across all 3 areas

**Active Indicators:**
- File list: accent background + arrow
- Thumbnail: ring + border color
- Sync across all 3 areas

**Responsive:**
- ปรับตามขนาดหน้าจอ
- Minimum width: 1024px recommended

#### UI Components Tree

```
DocumentsViewerPage
├── Header
│   ├── CloseButton
│   ├── GroupInfo ("Group X • Y Documents")
│   └── PageInfo ("Page X of Y")
├── MainLayout (3-panel)
│   ├── LeftSidebar (256px)
│   │   └── FileList
│   │       └── FileItem
│   │           ├── ColorDot
│   │           ├── PageNumber
│   │           ├── TemplateName
│   │           └── ActiveArrow (→)
│   ├── CenterPanel (flex-1)
│   │   ├── ImageViewer
│   │   │   └── Image
│   │   └── ThumbnailStrip (128px)
│   │       └── Thumbnail
│   │           ├── Image
│   │           └── PageNumber
│   └── RightSidebar (320px)
│       ├── Header
│       │   ├── Title ("OCR Result")
│       │   └── TemplateBadge
│       └── OCRText (scrollable)
└── KeyboardListener (←, →, Esc)
```

---

### Stage 05: Review (`/stages/05-review`)

#### หน้าที่ (Purpose)
Final Review & Approval Stage - รวม Stage 03 + 04 review

#### Main List Page

##### Filters

| Filter | Condition |
|--------|-----------|
| **Pending** | `isFinalApproved = false` |
| **Approved** | `isFinalApproved = true` |
| **All** | Show all groups |

##### Status Cards

| Card | Metric |
|------|--------|
| **Pending** | Groups ที่ยังไม่ approve |
| **Approved** | Groups ที่ approve แล้ว |
| **Total Groups** | รวมทั้งหมด |
| **Approval Rate** | % ของ approved |

##### Entry Conditions

**Group จะแสดงใน Stage 05 เมื่อ:**
1. `isLabeledReviewed = true` (Stage 03 reviewed)
2. **AND** `isParseDataReviewed = true` (Stage 04 reviewed)

**Quality Gate:**
- ป้องกัน upload groups ที่ยังไม่พร้อม
- Ensure complete review workflow

---

#### Detail Page (`/stages/05-review/[groupId]`)

##### Layout: Side-by-Side Summary

```
┌──────────────────────────────────────────────┐
│              [Header]                        │
├──────────────────┬───────────────────────────┤
│ Stage 03 Summary │ Stage 04 Summary          │
│ (PDF Labeling)   │ (Data Extraction)         │
│                  │                           │
│ • Match rate     │ • Foundation status       │
│ • Documents      │ • Committee count         │
│ • Reviewer       │ • Parse date              │
│ • Date           │ • Reviewer                │
└──────────────────┴───────────────────────────┘
│                                              │
│        [Final Review Decision]               │
│        • Notes (optional)                    │
│        • Approve Button                      │
└──────────────────────────────────────────────┘
```

##### Stage 03 Summary

**Display:**
- Match rate (X/Y matched, Z% matched)
- Documents found (count)
- Reviewer name
- Review date

##### Stage 04 Summary

**Display:**
- Foundation instrument status (Yes/No)
- Committee members count + list
- Parse date
- Reviewer name

##### Final Review Decision

**Form:**
- **Notes/Comments** (optional) - textarea
- **Approve Button** - submit form

**API:**
- `POST /files/parsed-group/:groupId/final-approve`
- Body:
  ```json
  {
    "reviewer": "John Doe",  // from JWT user.name
    "notes": "All data verified"
  }
  ```

**Effect:**
- Update `isFinalApproved = true`
- Save `final_reviewer`, `final_approved_at`, `final_review_notes`

##### Admin Only

**Permission:**
- เฉพาะ **admin** สามารถ approve ได้
- Check `user.role === 'admin'` from JWT

---

#### Features

| Feature | Description |
|---------|-------------|
| ✅ **Combined Review** | Stage 03 + 04 ใน 1 หน้า |
| ✅ **Final Approval** | Quality gate ก่อน Stage 06 |
| ✅ **Audit Trail** | Reviewer, timestamp, notes |
| ✅ **Admin Control** | Approval by admin only |

#### API Calls

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/files/final-review-groups` | GET | Groups ready for final review |
| `/files/parsed-group/:groupId` | GET | Detail ของ group |
| `/files/parsed-group/:groupId/final-approve` | POST | Approve group |

---

### Stage 06: Upload (`/stages/06-upload`)

#### หน้าที่ (Purpose)
Upload final documents ไปยัง destination

#### Entry Condition

**เฉพาะ groups ที่:**
- `isFinalApproved = true`

#### Features
(To be implemented)

---

## 🧩 Shared Components

### 1. Navbar

**Features:**
- Navigation links to all stages
- **Reviewer Name Display**: แสดงชื่อ reviewer ที่ตั้งไว้
- **Reviewer Name Setting**: ปุ่ม settings (⚙️) สำหรับตั้งค่าชื่อ
- **Theme Toggle**: Dark/Light mode button (🌙/☀️)

**Reviewer Name System:**
- **localStorage Key**: `ocr-flow-reviewer-name`
- **Modal**: ReviewerNameModal สำหรับป้อนและบันทึกชื่อ
- **Auto-fill**: ดึงชื่อมาใช้ใน Manual Label page

**Component Tree:**
```
Navbar
├── Logo
├── StageLinks (01-06)
├── ReviewerNameDisplay
│   └── SettingsButton (เปิด modal)
├── ThemeToggle
└── ReviewerNameModal
    ├── NameInput
    └── SaveButton
```

---

### 2. StageTabs

**Purpose:**
Tab navigation สำหรับ stages

**Features:**
- Highlight active stage
- Click to navigate
- Responsive design

**Styling:**
```css
.active-tab {
  background: accent-color;
  border-bottom: 2px solid accent;
}
```

---

### 3. ThemeProvider

**Purpose:**
Dark/Light mode provider

**Features:**
- Wrap ทั้ง app
- Provide `theme` context
- Toggle function
- Persist to localStorage

**localStorage Key:** `ocr-flow-theme`

**Usage:**
```typescript
const { theme, toggleTheme } = useTheme();
```

---

### 4. AuthGuard

**Purpose:**
Protected route wrapper component

**Features:**
- Check authentication
- Redirect to login if not authenticated
- Check user role (admin/user)
- Show loading state

**Usage:**
```typescript
<AuthGuard requireAdmin={true}>
  <AdminPage />
</AuthGuard>
```

---

## 🎯 UI/UX Patterns

### 1. Progress Indicators

**Types:**

| Type | Use Case | Visual |
|------|----------|--------|
| **Linear Progress Bar** | File/Group processing | Horizontal bar with % |
| **Circular Spinner** | Loading states | Animated circle |
| **Badge Count** | Item counts | Colored badge with number |

**Color Coding:**
- Green: Complete/Success
- Blue: In Progress
- Yellow: Warning/Partial
- Red: Error/Failed
- Gray: Pending/Inactive

---

### 2. Status Badges

**States:**

| State | Color | Icon | Use Case |
|-------|-------|------|----------|
| **Processing** | Blue | ⟳ | Task กำลังรัน |
| **Completed** | Green | ✓ | Task เสร็จ |
| **Pending** | Yellow | ⚠ | รอดำเนินการ |
| **Failed** | Red | ✗ | Error |
| **Ready** | Green | ✓ | พร้อมใช้งาน |

---

### 3. Terminal Component

**Modes:**
1. **Compact Mode** (Default):
   - Summary section (stats)
   - Recent N logs (5-10)
   - Filter out repetitive messages

2. **Full Logs Mode**:
   - All logs
   - Scrollable
   - Auto-scroll to bottom

**Toggle Button:**
- "📋 Full Logs" ⇄ "📊 Compact"

**Styling:**
```css
.terminal {
  background: black;
  color: #00ff00; /* Matrix green */
  font-family: monospace;
  padding: 1rem;
}
```

---

### 4. Modal Patterns

**Types:**

| Modal Type | Size | Usage |
|-----------|------|-------|
| **Confirmation** | Small | Delete, Reset actions |
| **Form** | Medium | Input data, Settings |
| **Preview** | Large | Image/PDF preview |
| **Full Screen** | 90vh | Template selection |

**Common Features:**
- Backdrop: `bg-black/90` + blur
- Close button (X)
- Keyboard: Esc to close
- Click outside to close (optional)

---

### 5. Table Design

**Features:**
- Sortable columns (ถ้ามี)
- Hover row highlight
- Clickable rows
- Action buttons (right align)
- Sticky header (long tables)

**Responsive:**
- Mobile: Card layout
- Desktop: Table layout

---

### 6. Real-time Updates (SSE)

**Visual Feedback:**
- **Loading State**: Spinner + "Connecting..."
- **Connected**: Green dot + "Live"
- **Disconnected**: Red dot + "Disconnected"
- **Reconnecting**: Yellow dot + "Reconnecting..."

**Auto-refresh:**
- เมื่อได้ event → Refresh data
- No need to manually refresh

---

## ⌨️ Keyboard Shortcuts

### Global Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| **Cmd/Ctrl + K** | Quick Search | All pages |
| **Cmd/Ctrl + /** | Toggle Theme | All pages |
| **Esc** | Close Modal | When modal open |

---

### Manual Label Page Shortcuts

| Key | Action | Description |
|-----|--------|-------------|
| **Space** | Toggle START/END | เลือกหน้า START หรือ END |
| **Arrow ←** | Previous Page | ไปหน้าก่อนหน้า |
| **Arrow →** | Next Page | ไปหน้าถัดไป |
| **Arrow ↑** | Scroll Up | เลื่อนขึ้นใน page list |
| **Arrow ↓** | Scroll Down | เลื่อนลงใน page list |
| **T** | Open Template Modal | เปิด modal เลือก template |
| **1-9** | Quick Assign Template | Assign template ลำดับที่ 1-9 |
| **C** | Clear Selection | ยกเลิกการเลือก START/END |
| **Esc** | Close Modal | ปิด modal ที่เปิดอยู่ |
| **H** | Show Shortcuts Help | แสดงรายการ shortcuts |
| **Cmd/Ctrl + S** | Save | บันทึกการเปลี่ยนแปลง |

**In Template Modal:**
| Key | Action |
|-----|--------|
| **Arrow ↑** | Previous template |
| **Arrow ↓** | Next template |
| **Enter** | Select template |
| **Esc** | Close modal |

**In Review Notes Modal:**
| Key | Action |
|-----|--------|
| **Enter** | Submit (save) |
| **Shift+Enter** | New line |
| **Esc** | Close modal |

---

### Documents Viewer Shortcuts

| Key | Action |
|-----|--------|
| **Arrow ←** | Previous page |
| **Arrow →** | Next page |
| **Esc** | Close window |

---

## 🔌 API Integration

### API Base URL

**Environment Variable:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:4004
```

### HTTP Client

**Recommended: Fetch API**
```typescript
const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/files`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
});
```

### Error Handling

**Pattern:**
```typescript
try {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  return data;
} catch (error) {
  console.error('API Error:', error);
  // Show error toast/notification
}
```

### API Response Format

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Success message"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400
}
```

---

## 📡 Real-time Features (SSE)

### SSE Connections

**Pattern:**
```typescript
const eventSource = new EventSource(`${API_URL}/endpoint/logs`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle event
};

eventSource.onerror = () => {
  // Handle error
  eventSource.close();
};

// Cleanup
return () => eventSource.close();
```

### SSE Endpoints

| Endpoint | Events | Purpose |
|----------|--------|---------|
| `/task-runner/logs` | FILE_PROCESSED, TASK_COMPLETE | Stage 01 OCR progress |
| `/label-runner/logs` | GROUP_PROCESSED, LABEL_COMPLETE | Stage 02/03 Label progress |
| `/files/events` | GROUP_COMPLETE, FILE_UPDATED | File system events |

### Event Types

**FILE_PROCESSED:**
```json
{
  "type": "FILE_PROCESSED",
  "data": {
    "fileId": 123,
    "fileName": "page1.jpg",
    "processed": true
  }
}
```

**GROUP_PROCESSED:**
```json
{
  "type": "GROUP_PROCESSED",
  "data": {
    "groupId": 1,
    "labeled": true,
    "matchedPages": 10,
    "totalPages": 10
  }
}
```

### Reconnection Strategy

**Auto-reconnect:**
```typescript
let reconnectAttempts = 0;
const maxReconnects = 5;

eventSource.onerror = () => {
  if (reconnectAttempts < maxReconnects) {
    setTimeout(() => {
      reconnectAttempts++;
      // Reconnect
    }, 2000 * reconnectAttempts); // Exponential backoff
  }
};
```

---

## 📝 Notes for Developers

### Performance Optimization

1. **Lazy Loading**: Load data on-demand (Stage 02 groups)
2. **Image Optimization**: Use Next.js Image component
3. **Code Splitting**: Dynamic imports for heavy components
4. **Memoization**: useMemo, useCallback สำหรับ expensive operations

### Accessibility

1. **Keyboard Navigation**: ทุกฟีเจอร์ใช้ keyboard ได้
2. **ARIA Labels**: เพิ่ม aria-label สำหรับ screen readers
3. **Focus Management**: จัดการ focus trap ใน modals
4. **Color Contrast**: ตรวจสอบ contrast ratio (WCAG AA)

### Best Practices

1. **Component Structure**: แยก presentation และ logic
2. **Error Boundaries**: Catch errors ใน components
3. **Loading States**: แสดง loading indicator เสมอ
4. **Optimistic Updates**: Update UI ก่อนรอ API response
5. **Data Validation**: Validate input ก่อนส่ง API

---

## 🔗 Related Documentation

- **STRUCTURE.md** - โครงสร้างทั้งระบบ (Backend + Frontend + Database)
- **auto-label.md** - Auto label PDF logic และ pattern matching
- **template-learning-task.md** - Template optimization จาก manual labels
- **parse-data.md** - Parse data logic (ตราสาร + กรรมการ)
- **task-runner.md** - Infinite worker loop pattern + SSE logging

---

**สร้างโดย:** OCR Flow Development Team
**สำหรับ:** Frontend Developers
**Version:** 2.0
