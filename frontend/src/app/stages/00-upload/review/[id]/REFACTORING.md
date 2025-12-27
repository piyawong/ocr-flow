# Refactoring Summary - Stage 00 Upload Review Page

## โครงสร้างใหม่หลัง Refactoring

### ไฟล์และโฟลเดอร์

```
/stages/00-upload/review/[id]/
├── types.ts                 # Type definitions (RawFile, TextElement, HistoryState, DrawMode)
├── components/              # แยก UI components
│   ├── index.ts            # Export ทั้งหมด
│   ├── FileItem.tsx        # รายการไฟล์ในSidebar
│   ├── LeftSidebar.tsx     # Sidebar ซ้าย (File list + Progress)
│   ├── TopBar.tsx          # แถบด้านบน (Back, Progress, Next Unreviewed)
│   ├── ModeIndicator.tsx   # แสดงโหมดปัจจุบัน (Mouse/Brush/Eraser)
│   ├── PositionIndicator.tsx  # แสดงตำแหน่งไฟล์ (X/Y)
│   └── DrawingToolbar.tsx  # ปุ่ม Undo/Redo
└── page.tsx                # Main component (ยังคง logic หลัก)

```

## ✅ Refactoring สำเร็จแล้ว!

ไฟล์ `page.tsx` ได้ถูก refactor เรียบร้อยแล้ว โดยแทนที่ inline code ทั้งหมดด้วย components ที่แยกออกมา

## Components ที่แยกออกมา

### 1. **types.ts**
- `RawFile` - Interface สำหรับ file metadata
- `TextElement` - Interface สำหรับ text elements on canvas
- `HistoryState` - Interface สำหรับ undo/redo history
- `DrawMode` - Type สำหรับ drawing mode ('mouse' | 'brush' | 'eraser')

### 2. **FileItem.tsx**
รายการไฟล์แต่ละไฟล์ในSidebar (Memoized component)

**Props:**
- `file: RawFile` - ข้อมูลไฟล์
- `idx: number` - Index ในรายการ
- `isActive: boolean` - ไฟล์ที่เลือกอยู่หรือไม่
- `sidebarCollapsed: boolean` - Sidebar ซ่อนหรือไม่
- `onSelect: () => void` - Callback เมื่อคลิกเลือกไฟล์

**Features:**
- Thumbnail preview
- Review status indicator (เครื่องหมายถูกสีเขียว)
- Collapsed mode (แสดงแค่หมายเลข)

### 3. **LeftSidebar.tsx**
Sidebar ด้านซ้าย - แสดงรายการไฟล์ทั้งหมด

**Props:**
- `allFiles: RawFile[]` - รายการไฟล์ทั้งหมด
- `currentFile: RawFile | null` - ไฟล์ที่เลือกอยู่
- `sidebarCollapsed: boolean` - สถานะการซ่อน sidebar
- `setSidebarCollapsed: (collapsed: boolean) => void` - Toggle sidebar
- `visibleFiles: Array<{ file: RawFile; originalIdx: number }>` - ไฟล์ที่แสดงบนหน้าจอ (virtualized)
- `sidebarScrollRef: React.RefObject<HTMLDivElement>` - Ref สำหรับ scroll
- `onSelectFile: (fileId: number) => void` - Callback เมื่อเลือกไฟล์

**Features:**
- Virtual scrolling (แสดงเฉพาะไฟล์ที่อยู่ใน viewport)
- Progress bar (reviewed/total)
- Collapse/Expand button

### 4. **TopBar.tsx**
แถบด้านบน - Navigation และ Progress

**Props:**
- `currentIndex: number` - Index ของไฟล์ปัจจุบัน
- `totalFiles: number` - จำนวนไฟล์ทั้งหมด
- `reviewedCount: number` - จำนวนไฟล์ที่ review แล้ว
- `unreviewedCount: number` - จำนวนไฟล์ที่ยังไม่ review
- `progress: number` - Progress เป็น % (0-100)
- `onGoBack: () => void` - กลับไปหน้า list
- `onGoToNextUnreviewed: () => void` - ไปไฟล์ถัดไปที่ยังไม่ review

**Features:**
- Back button
- Progress bar และ percentage
- Next Unreviewed button

### 5. **ModeIndicator.tsx**
แสดงโหมดการทำงานปัจจุบัน (อยู่บนภาพ)

**Props:**
- `mode: DrawMode` - โหมดปัจจุบัน ('mouse' | 'brush' | 'eraser')
- `hasUnsavedDrawing: boolean` - มีการแก้ไขที่ยังไม่ save หรือไม่
- `textElementsCount: number` - จำนวน text elements

**Features:**
- แสดงไอคอนตามโหมด
- แสดง * เมื่อมีการแก้ไขที่ยังไม่ save
- แสดงจำนวน text elements

### 6. **PositionIndicator.tsx**
แสดงตำแหน่งไฟล์ปัจจุบัน (อยู่บนภาพด้านล่าง)

**Props:**
- `currentIndex: number` - Index ปัจจุบัน
- `totalFiles: number` - จำนวนไฟล์ทั้งหมด

**Features:**
- แสดงตำแหน่งเป็น "X / Y"

### 7. **DrawingToolbar.tsx**
ปุ่ม Undo/Redo (แสดงเมื่ออยู่ใน brush/eraser mode)

**Props:**
- `historyIndex: number` - Index ของ history ปัจจุบัน
- `historyLength: number` - จำนวน history ทั้งหมด
- `onUndo: () => void` - Callback สำหรับ undo
- `onRedo: () => void` - Callback สำหรับ redo

**Features:**
- Undo button (disabled เมื่อไม่มี history)
- Redo button (disabled เมื่ออยู่ท้าย history)

## วิธีใช้ Components

### Import Components

```tsx
import {
  TopBar,
  LeftSidebar,
  ModeIndicator,
  PositionIndicator,
  DrawingToolbar,
} from './components';
import { RawFile, TextElement, HistoryState, DrawMode } from './types';
```

### ตัวอย่างการใช้งาน

```tsx
// ใน main page.tsx
<div className="fixed inset-0 bg-bg-primary flex flex-col overflow-hidden">
  {/* Top Bar */}
  <TopBar
    currentIndex={currentIndex}
    totalFiles={allFiles.length}
    reviewedCount={reviewedCount}
    unreviewedCount={unreviewedCount}
    progress={progress}
    onGoBack={goBack}
    onGoToNextUnreviewed={goToNextUnreviewed}
  />

  {/* Main Content */}
  <div className="flex-1 flex overflow-hidden">
    {/* Left Sidebar */}
    <LeftSidebar
      allFiles={allFiles}
      currentFile={file}
      sidebarCollapsed={sidebarCollapsed}
      setSidebarCollapsed={setSidebarCollapsed}
      visibleFiles={visibleFiles}
      sidebarScrollRef={sidebarScrollRef}
      onSelectFile={selectFile}
    />

    {/* Center - Image + Canvas */}
    <div className="flex-1 relative">
      {/* ModeIndicator */}
      <ModeIndicator
        mode={mode}
        hasUnsavedDrawing={hasUnsavedDrawing}
        textElementsCount={textElements.filter(t => t.text).length}
      />

      {/* PositionIndicator */}
      <PositionIndicator
        currentIndex={currentIndex}
        totalFiles={allFiles.length}
      />

      {/* DrawingToolbar (แสดงเฉพาะ brush/eraser mode) */}
      {mode !== 'mouse' && (
        <DrawingToolbar
          historyIndex={historyIndex}
          historyLength={historyRef.current.length}
          onUndo={undo}
          onRedo={redo}
        />
      )}

      {/* ... Image + Canvas ... */}
    </div>

    {/* Right Sidebar - ยังอยู่ใน main page.tsx */}
  </div>
</div>
```

## ประโยชน์ของการ Refactor

### 1. **Code Organization**
- แยก UI components ออกจาก business logic
- ง่ายต่อการหาและแก้ไข
- ลดขนาดของ main page.tsx

### 2. **Reusability**
- Components สามารถนำไปใช้ใหม่ได้
- ง่ายต่อการทดสอบแยกส่วน

### 3. **Maintainability**
- แก้ไข UI แค่ component เดียว
- ไม่กระทบส่วนอื่น
- Type safety ด้วย TypeScript

### 4. **Performance**
- FileItem ใช้ React.memo() เพื่อป้องกัน re-render ที่ไม่จำเป็น
- Virtual scrolling ใน LeftSidebar

## สิ่งที่ยังอยู่ใน Main page.tsx

เนื่องจากความซับซ้อนและ tight coupling กับ state management ส่วนเหล่านี้ยังคงอยู่ใน main page.tsx:

1. **State Management** - ทุก useState, useRef, useCallback
2. **Business Logic** - Drawing functions, Text manipulation, History management
3. **Keyboard Shortcuts** - Event handlers
4. **Right Sidebar** - Drawing tools และ Action buttons (ซับซ้อนมาก, มี state เยอะ)
5. **Center Panel** - Image viewer, Canvas, Text overlay (tight coupling กับ refs และ drawing logic)

## Next Steps (ถ้าต้องการ refactor ต่อ)

1. **สร้าง Custom Hooks**
   - `useDrawing()` - Drawing logic (brush, eraser, canvas)
   - `useTextElements()` - Text management
   - `useHistory()` - Undo/redo
   - `useKeyboardShortcuts()` - Keyboard handlers
   - `useFileNavigation()` - File navigation logic

2. **แยก Right Sidebar**
   - `RightSidebar.tsx` - รวม drawing tools และ actions
   - `DrawingSettings.tsx` - Brush size, opacity
   - `TextColorPicker.tsx` - Text color selector
   - `ActionButtons.tsx` - Save, Clear, Reset buttons

3. **แยก Center Panel**
   - `ImageViewer.tsx` - Image display component
   - `DrawingCanvas.tsx` - Canvas overlay
   - `TextOverlay.tsx` - Text elements overlay

แต่การแยกเหล่านี้จะซับซ้อนมาก เพราะต้อง pass props และ callbacks จำนวนมาก

## สรุป

การ refactor ครั้งนี้:
- ✅ แยก **simple stateless components** ออกมาแล้ว (TopBar, Sidebars, Indicators)
- ✅ ใช้ **TypeScript types** แทน inline interfaces
- ✅ มี **clear component API** (props interface)
- ⚠️ **Complex stateful logic** ยังคงอยู่ใน main page.tsx (ถูกต้องแล้ว - ไม่ควรแยกจนเกินไป)

**ผลลัพธ์:** โค้ดอ่านง่ายขึ้น, จัดการได้ง่ายขึ้น, แต่ยังคงความซับซ้อนที่จำเป็นสำหรับ business logic ไว้ที่เดิม
